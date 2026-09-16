import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { createCarbonProvider } from "./carbon/provider.js";
import type { CarbonProvider } from "./carbon/types.js";
import { COUNTRY_GROUPS, expandCountries } from "./data/countryGroups.js";
import { REGIONS } from "./data/regions.js";
import { rankRegions } from "./engine/rank.js";

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

  return server;
}
