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
export const SERVER_VERSION = "0.1.1";

const ProviderSchema = z.enum(["aws", "gcp", "azure"]);

const ProviderField = ProviderSchema.describe('Cloud provider: "aws", "gcp" (Google Cloud) or "azure".');
const RegionIdField = z.string().describe('Provider\'s own region id, e.g. "eu-north-1". Pass it on as provider/id.');
const RegionNameField = z.string().describe("Provider's display name for the region.");
const LocationField = z.string().describe("City or area the region is in.");
const CountryField = z.string().describe("ISO 3166-1 alpha-2 country code.");
const GridZoneField = z.string().describe('Electricity Maps grid zone the region draws power from, e.g. "SE-SE3".');
const GridZoneNoteField = z
  .string()
  .optional()
  .describe("Present when the grid zone mapping rests on an assumption, such as which campus the region uses.");
const GeneratedAtField = z.string().describe("When this response was computed, ISO 8601 UTC.");
const NotesField = z
  .array(z.string())
  .describe("Caveats about data sources, precision and time zones. Pass relevant ones on to the user.");
const KgCO2eField = z.number().nullable();

const RegionSchema = z.object({
  provider: ProviderField,
  id: RegionIdField,
  name: RegionNameField,
  location: LocationField,
  country: CountryField,
  lat: z.number().describe("Approximate latitude of the region's datacenters."),
  lon: z.number().describe("Approximate longitude of the region's datacenters."),
  gridZone: GridZoneField,
  gridZoneNote: GridZoneNoteField,
});

const GROUP_NAMES = Object.keys(COUNTRY_GROUPS).join(", ");

const CountryOrGroup = z
  .string()
  .min(2)
  .max(3)
  .describe(`ISO 3166-1 alpha-2 country code (e.g. "DE"), or a group: ${GROUP_NAMES}.`);

const ListRegionsInput = z.object({
  provider: ProviderSchema.optional().describe(
    'Only return regions from this cloud provider: "aws", "gcp" (Google Cloud) or "azure". Default: all.',
  ),
  country: CountryOrGroup.optional().describe(
    `Only return regions in this country (ISO 3166-1 alpha-2, e.g. "DE") or group (${GROUP_NAMES}). Default: all.`,
  ),
});

const ListRegionsOutput = z.object({
  count: z.number().int().describe("Number of regions returned."),
  regions: z.array(RegionSchema).describe("Matching regions, in dataset order."),
});

const RankRegionsInput = z.object({
  providers: z
    .array(ProviderSchema)
    .optional()
    .describe('Only consider these cloud providers: "aws", "gcp" (Google Cloud), "azure". Default: all.'),
  countries: z
    .array(CountryOrGroup)
    .optional()
    .describe(
      `Only consider regions in these countries or groups (${GROUP_NAMES}), e.g. ["EU"] for EU data residency. Default: all.`,
    ),
  origin: z
    .object({
      lat: z.number().min(-90).max(90).describe("Latitude in decimal degrees."),
      lon: z.number().min(-180).max(180).describe("Longitude in decimal degrees."),
    })
    .optional()
    .describe(
      "Where the users or data are, e.g. { lat: -27.47, lon: 153.03 } for Brisbane. Enables latency estimates, latency weighting and maxLatencyMs.",
    ),
  maxLatencyMs: z
    .number()
    .positive()
    .optional()
    .describe("Exclude regions whose estimated round trip from origin is above this, in milliseconds. Requires origin."),
  maxCarbonIntensity: z
    .number()
    .positive()
    .optional()
    .describe("Exclude regions whose grid is above this carbon intensity, in gCO2e/kWh (e.g. 100)."),
  carbonWeight: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("How much carbon counts versus latency, from 0 (latency only) to 1 (carbon only). Default 0.7. Ignored without origin."),
  energyKwh: z
    .number()
    .positive()
    .optional()
    .describe("Estimated energy the job uses, in kWh. When set, each result estimates the job's kg CO2e."),
  limit: z.number().int().min(1).max(20).optional().describe("How many regions to return, 1 to 20. Default 5."),
});

const RankRegionsOutput = z.object({
  generatedAt: GeneratedAtField,
  evaluated: z.number().int().describe("Regions that matched the provider and country filters."),
  qualified: z.number().int().describe("Of those, regions that also met maxCarbonIntensity and maxLatencyMs."),
  excluded: z
    .object({
      maxCarbonIntensity: z.number().int().describe("Regions dropped for exceeding maxCarbonIntensity."),
      maxLatencyMs: z.number().int().describe("Regions dropped for exceeding maxLatencyMs."),
    })
    .describe("How many regions each hard limit removed."),
  results: z
    .array(
      z.object({
        rank: z.number().int().describe("Position in the ranking, 1 is best."),
        provider: ProviderField,
        id: RegionIdField,
        name: RegionNameField,
        location: LocationField,
        country: CountryField,
        gridZone: GridZoneField,
        gridZoneNote: GridZoneNoteField,
        carbonIntensity: z.number().describe("Grid carbon intensity used for ranking, gCO2e/kWh."),
        carbonSource: z
          .enum(["electricity-maps", "epa-egrid-annual", "eccc-nir-annual", "ember-annual"])
          .describe("Where carbonIntensity came from: live Electricity Maps data, or an annual average from EPA eGRID, Canada's NIR or Ember."),
        carbonGranularity: z
          .enum(["grid-zone", "country"])
          .describe('"country" means a national average, so regions in the same country cannot be told apart.'),
        carbonAsOf: z.string().describe("Timestamp of live data, or the year of an annual average."),
        estimatedRttMs: z.number().nullable().describe("Round trip from origin estimated from distance, in ms. Null without origin."),
        estimatedKgCO2e: KgCO2eField.describe("Estimated job emissions in kg CO2e. Null without energyKwh."),
        score: z.number().describe("Relative score from 0 to 100 among the qualified regions; higher is better."),
        reason: z.string().describe("One-line explanation of the carbon figure, its source and latency."),
      }),
    )
    .describe("Best regions first, at most limit."),
  notes: NotesField,
});

const FindCleanWindowInput = z.object({
  regions: z
    .array(z.string())
    .optional()
    .describe(
      'Candidate regions as provider/id, e.g. ["aws/eu-north-1", "gcp/europe-west9"]. Tip: shortlist with rank_regions first. All given filters must match.',
    ),
  providers: z
    .array(ProviderSchema)
    .optional()
    .describe('Only consider these cloud providers: "aws", "gcp" (Google Cloud), "azure".'),
  countries: z
    .array(CountryOrGroup)
    .optional()
    .describe(`Only consider regions in these countries or groups (${GROUP_NAMES}), e.g. ["DE", "FR"].`),
  durationHours: z
    .number()
    .int()
    .min(1)
    .max(MAX_FORECAST_HOURS)
    .describe(`How long the job runs, in whole hours (1 to ${MAX_FORECAST_HOURS}). Must not exceed withinHours.`),
  withinHours: z
    .number()
    .int()
    .min(1)
    .max(MAX_FORECAST_HOURS)
    .optional()
    .describe(`The job must finish within this many hours from now. Default 24, max ${MAX_FORECAST_HOURS}.`),
  energyKwh: z
    .number()
    .positive()
    .optional()
    .describe("Estimated energy the job uses, in kWh. When set, each option estimates kg CO2e, now and at the best time."),
  limit: z.number().int().min(1).max(20).optional().describe("How many grid zones to return, 1 to 20. Default 5."),
  timezone: z
    .string()
    .optional()
    .describe(
      'IANA time zone for local start times, e.g. "Australia/Brisbane". Defaults to the time zone of the computer running Eco Router; set it when the user is elsewhere.',
    ),
});

const FindCleanWindowOutput = z.object({
  generatedAt: GeneratedAtField,
  durationHours: z.number().int().describe("Job length used, in hours."),
  withinHours: z.number().int().describe("Deadline used, in hours from now."),
  timezone: z.string().nullable().describe("IANA time zone of the local times, or null if unknown."),
  timezoneSource: z
    .enum(["request", "system"])
    .nullable()
    .describe('"request" if the caller set timezone, "system" if it is this computer\'s.'),
  evaluatedRegions: z.number().int().describe("Regions that matched the filters."),
  evaluatedZones: z.number().int().describe("Distinct grid zones those regions draw from; each zone is forecast once."),
  results: z
    .array(
      z.object({
        rank: z.number().int().describe("Position by bestIntensity, 1 is cleanest."),
        gridZone: GridZoneField,
        country: CountryField,
        regions: z
          .array(
            z.object({
              provider: ProviderField,
              id: RegionIdField,
              name: RegionNameField,
              location: LocationField,
              gridZoneNote: GridZoneNoteField,
            }),
          )
          .describe("Candidate regions in this grid zone; they share the same best window."),
        bestStart: z.string().describe("Cleanest start time, ISO 8601 UTC."),
        bestEnd: z.string().describe("End of the job if started at bestStart, ISO 8601 UTC."),
        bestStartLocal: z.string().nullable().describe("bestStart in timezone, or null without one."),
        bestEndLocal: z.string().nullable().describe("bestEnd in timezone, or null without one."),
        bestIntensity: z.number().describe("Average forecast intensity over the best window, gCO2e/kWh."),
        startNowIntensity: z.number().describe("Average forecast intensity if the job started now, gCO2e/kWh."),
        savingsVsNowPercent: z.number().describe("How much lower bestIntensity is than startNowIntensity, in percent."),
        estimatedKgCO2e: KgCO2eField.describe("Estimated kg CO2e at the best time. Null without energyKwh."),
        estimatedKgCO2eIfStartedNow: KgCO2eField.describe("Estimated kg CO2e if started now. Null without energyKwh."),
        forecastUpdatedAt: z.string().nullable().describe("When Electricity Maps last updated this forecast, if known."),
      }),
    )
    .describe("Cleanest grid zones first, at most limit."),
  unavailable: z
    .array(
      z.object({
        gridZone: GridZoneField,
        regions: z.array(z.string()).describe("Affected regions as provider/id."),
        reason: z.string().describe("Why no usable forecast was available."),
      }),
    )
    .describe("Grid zones skipped because their forecast was missing or too short."),
  notes: NotesField,
});

export interface ServerOptions {
  /** Defaults to annual averages only (no live data). */
  carbon?: CarbonProvider;
  /** Default time zone for local times, usually the host's. */
  systemTimeZone?: string;
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
        "List the cloud regions Eco Router knows about (all public AWS, Google Cloud and Azure regions), with the electricity grid zone " +
        "each one draws power from. Use it to look up valid region ids, written as provider/id (e.g. aws/eu-north-1), or to check " +
        "which grid a region uses. Reads bundled data only: no carbon figures, no network calls, no API key. " +
        "To compare regions by carbon, use rank_regions instead.",
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
        "maximum latency and maximum carbon intensity. Use it to decide where to run; to decide when to start a flexible batch job, " +
        "use find_clean_window. Works with no setup from annual grid averages; with ELECTRICITY_MAPS_API_TOKEN it uses live grid data, " +
        "falling back to annual averages per zone. Scores are relative to the regions evaluated. Read `notes` before relying on close scores.",
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
        "and how much that saves compared with starting now. Local times default to this computer's time zone. " +
        "Needs ELECTRICITY_MAPS_API_TOKEN with forecast access. " +
        `Limit candidates with regions, providers or countries (at most ${MAX_FORECAST_ZONES} grid zones per call). ` +
        "Use it when the job can wait; to choose a region, or without a token, use rank_regions. " +
        "Regions on the same grid zone share one result.",
      inputSchema: FindCleanWindowInput,
      outputSchema: FindCleanWindowOutput,
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const result = await findCleanWindows(carbon, { ...input, fallbackTimezone: options.systemTimeZone });
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
