import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { createCarbonProvider } from "./carbon/provider.js";
import type { CarbonProvider } from "./carbon/types.js";
import { COUNTRY_GROUPS, expandCountries } from "./data/countryGroups.js";
import { REGIONS } from "./data/regions.js";
import { rankRegions } from "./engine/rank.js";
import { findCleanWindows, MAX_FORECAST_ZONES } from "./engine/window.js";
import { MAX_FORECAST_HOURS } from "./carbon/electricityMaps.js";

export const SERVER_NAME = "eco-router";
export const SERVER_VERSION = "0.1.0";

const ProviderSchema = z.enum(["aws", "gcp", "azure"]);

const RegionSchema = z.object({
  provider: ProviderSchema,
  id: z.string(),
  name: z.string(),
  location: z.string(),
  country: z.string(),
  lat: z.number(),
  lon: z.number(),
  gridZone: z.string(),
  gridZoneNote: z.string().optional(),
});

const GROUP_NAMES = Object.keys(COUNTRY_GROUPS).join(", ");

const CountryOrGroup = z
  .string()
  .min(2)
  .max(3)
  .describe(`ISO 3166-1 alpha-2 country code (e.g. "DE"), or a group: ${GROUP_NAMES}.`);

const ListRegionsInput = z.object({
  provider: ProviderSchema.optional().describe("Only return regions from this cloud provider."),
  country: CountryOrGroup.optional().describe(
    `Only return regions in this country (ISO 3166-1 alpha-2, e.g. "DE") or group (${GROUP_NAMES}).`,
  ),
});

const ListRegionsOutput = z.object({
  count: z.number().int(),
  regions: z.array(RegionSchema),
});

const RankRegionsInput = z.object({
  providers: z.array(ProviderSchema).optional().describe("Only consider these cloud providers. Default: all."),
  countries: z
    .array(CountryOrGroup)
    .optional()
    .describe(
      `Only consider regions in these countries or groups (${GROUP_NAMES}), e.g. ["EU"] for EU data residency. Default: all.`,
    ),
  origin: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .optional()
    .describe("Where users or data are. Enables latency estimates and latency weighting."),
  maxLatencyMs: z.number().positive().optional().describe("Exclude regions estimated slower than this round trip. Requires origin."),
  maxCarbonIntensity: z.number().positive().optional().describe("Exclude regions above this carbon intensity, gCO2e/kWh."),
  carbonWeight: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Weight on carbon versus latency, 0..1. Default 0.7. Only used with origin."),
  energyKwh: z.number().positive().optional().describe("Estimated job energy, to report emissions per region."),
  limit: z.number().int().min(1).max(20).optional().describe("How many regions to return. Default 5."),
});

const RankRegionsOutput = z.object({
  generatedAt: z.string(),
  evaluated: z.number().int(),
  qualified: z.number().int(),
  excluded: z.object({ maxCarbonIntensity: z.number().int(), maxLatencyMs: z.number().int() }),
  results: z.array(
    z.object({
      rank: z.number().int(),
      provider: ProviderSchema,
      id: z.string(),
      name: z.string(),
      location: z.string(),
      country: z.string(),
      gridZone: z.string(),
      gridZoneNote: z.string().optional(),
      carbonIntensity: z.number(),
      carbonSource: z.enum(["electricity-maps", "epa-egrid-annual", "ember-annual"]),
      carbonGranularity: z.enum(["grid-zone", "country"]),
      carbonAsOf: z.string(),
      estimatedRttMs: z.number().nullable(),
      estimatedKgCO2e: z.number().nullable(),
      score: z.number(),
      reason: z.string(),
    }),
  ),
  notes: z.array(z.string()),
});

const FindCleanWindowInput = z.object({
  regions: z
    .array(z.string())
    .optional()
    .describe('Candidate regions as provider/id, e.g. ["aws/eu-north-1", "gcp/europe-west9"]. Tip: shortlist with rank_regions first.'),
  providers: z.array(ProviderSchema).optional().describe("Only consider these cloud providers."),
  countries: z
    .array(CountryOrGroup)
    .optional()
    .describe(`Only consider regions in these countries or groups (${GROUP_NAMES}).`),
  durationHours: z.number().int().min(1).max(MAX_FORECAST_HOURS).describe("How long the job runs, in whole hours."),
  withinHours: z
    .number()
    .int()
    .min(1)
    .max(MAX_FORECAST_HOURS)
    .optional()
    .describe(`The job must finish within this many hours from now. Default 24, max ${MAX_FORECAST_HOURS}.`),
  energyKwh: z.number().positive().optional().describe("Estimated job energy, to report emissions for each option."),
  limit: z.number().int().min(1).max(20).optional().describe("How many options to return. Default 5."),
  timezone: z
    .string()
    .optional()
    .describe(
      'The user\'s IANA time zone, e.g. "Australia/Brisbane", to get local start times. If you do not know it, ask the user rather than guessing.',
    ),
});

const FindCleanWindowOutput = z.object({
  generatedAt: z.string(),
  durationHours: z.number().int(),
  withinHours: z.number().int(),
  timezone: z.string().nullable(),
  evaluatedRegions: z.number().int(),
  evaluatedZones: z.number().int(),
  results: z.array(
    z.object({
      rank: z.number().int(),
      gridZone: z.string(),
      country: z.string(),
      regions: z.array(
        z.object({
          provider: ProviderSchema,
          id: z.string(),
          name: z.string(),
          location: z.string(),
          gridZoneNote: z.string().optional(),
        }),
      ),
      bestStart: z.string(),
      bestEnd: z.string(),
      bestStartLocal: z.string().nullable(),
      bestEndLocal: z.string().nullable(),
      bestIntensity: z.number(),
      startNowIntensity: z.number(),
      savingsVsNowPercent: z.number(),
      estimatedKgCO2e: z.number().nullable(),
      estimatedKgCO2eIfStartedNow: z.number().nullable(),
      forecastUpdatedAt: z.string().nullable(),
    }),
  ),
  unavailable: z.array(z.object({ gridZone: z.string(), regions: z.array(z.string()), reason: z.string() })),
  notes: z.array(z.string()),
});

export interface ServerOptions {
  /** Defaults to annual averages only (no live data). */
  carbon?: CarbonProvider;
}

/** Builds one MCP server instance with every Eco Router tool registered. */
export function createServer(options: ServerOptions = {}): McpServer {
  const carbon = options.carbon ?? createCarbonProvider();
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "list_regions",
    {
      title: "List cloud regions",
      description:
        "List the cloud regions Eco Router knows about, with the electricity grid zone each one draws power from.",
      inputSchema: ListRegionsInput,
      outputSchema: ListRegionsOutput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ provider, country }) => {
      let countries: string[] | undefined;
      try {
        countries = country ? expandCountries([country]) : undefined;
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
      const regions = REGIONS.filter(
        (r) => (!provider || r.provider === provider) && (!countries || countries.includes(r.country)),
      );

      // MCP clients such as Claude read `content`, so the text carries the data too.
      const lines = regions.map(
        (r) =>
          `${r.provider}/${r.id}: ${r.location}, ${r.country} (grid ${r.gridZone})` +
          (r.gridZoneNote ? ` [note: ${r.gridZoneNote}]` : ""),
      );
      return {
        content: [{ type: "text", text: `${regions.length} regions:\n${lines.join("\n")}` }],
        structuredContent: { count: regions.length, regions },
      };
    },
  );

  server.registerTool(
    "rank_regions",
    {
      title: "Rank cloud regions by carbon",
      description:
        "Rank AWS, Google Cloud and Azure regions for a workload by the carbon intensity of their electricity grid, " +
        "optionally balanced against estimated latency from an origin. Supports hard limits for allowed countries, " +
        "maximum latency and maximum carbon intensity. Read `notes` before relying on close scores.",
      inputSchema: RankRegionsInput,
      outputSchema: RankRegionsOutput,
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: carbon.live },
    },
    async (input) => {
      try {
        const result = await rankRegions(carbon, input);
        const lines = result.results.map(
          (r) =>
            `#${r.rank} ${r.provider}/${r.id} (${r.location}, ${r.country}), score ${r.score}: ${r.reason}` +
            (r.estimatedKgCO2e === null ? "" : `; about ${r.estimatedKgCO2e} kg CO2e for this job`) +
            (r.gridZoneNote ? `; grid mapping note: ${r.gridZoneNote}` : ""),
        );
        const header =
          `${result.qualified} of ${result.evaluated} regions met the constraints` +
          (result.excluded.maxCarbonIntensity || result.excluded.maxLatencyMs
            ? ` (excluded: ${result.excluded.maxCarbonIntensity} over the carbon limit, ${result.excluded.maxLatencyMs} over the latency limit)`
            : "") +
          ".";
        const text = [header, ...(lines.length ? lines : ["No region met the constraints."]), "", ...result.notes.map((n) => `Note: ${n}`)].join("\n");
        return { content: [{ type: "text", text }], structuredContent: result };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error instanceof Error ? error.message : "Ranking failed." }],
        };
      }
    },
  );

  server.registerTool(
    "find_clean_window",
    {
      title: "Find the cleanest time to run a job",
      description:
        "For flexible batch jobs, find when in the next hours (up to 72) each candidate region's grid is forecast to be cleanest, " +
        "and how much that saves compared with starting now. Pass the user's time zone to get local times. " +
        "Needs ELECTRICITY_MAPS_API_TOKEN with forecast access. " +
        `Limit candidates with regions, providers or countries (at most ${MAX_FORECAST_ZONES} grid zones per call).`,
      inputSchema: FindCleanWindowInput,
      outputSchema: FindCleanWindowOutput,
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const result = await findCleanWindows(carbon, input);
        const lines = result.results.map(
          (r) =>
            `#${r.rank} grid ${r.gridZone} (${r.country}): start ` +
            (r.bestStartLocal ? `${r.bestStartLocal} to ${r.bestEndLocal} [UTC ${r.bestStart}], ` : `${r.bestStart} UTC, `) +
            `average ${r.bestIntensity} gCO2e/kWh over ${result.durationHours} h ` +
            `(starting now: ${r.startNowIntensity}, ${r.savingsVsNowPercent}% lower)` +
            (r.estimatedKgCO2e === null ? "" : `; about ${r.estimatedKgCO2e} kg CO2e vs ${r.estimatedKgCO2eIfStartedNow} kg now`) +
            `. Regions: ${r.regions.map((x) => `${x.provider}/${x.id} (${x.location})`).join(", ")}`,
        );
        const skipped = result.unavailable.length
          ? [`No forecast for ${result.unavailable.length} grid zone(s): ${result.unavailable.map((u) => `${u.gridZone} (${u.reason})`).join("; ")}`]
          : [];
        const text = [
          `Best start time per grid zone for a ${result.durationHours}-hour job finishing within ${result.withinHours} hours ` +
            `(${result.evaluatedRegions} regions in ${result.evaluatedZones} zones):`,
          ...lines,
          ...skipped,
          "",
          ...result.notes.map((n) => `Note: ${n}`),
        ].join("\n");
        return { content: [{ type: "text", text }], structuredContent: result };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error instanceof Error ? error.message : "Forecast search failed." }],
        };
      }
    },
  );

  return server;
}
