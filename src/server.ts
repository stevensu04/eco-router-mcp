import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { REGIONS } from "./data/regions.js";

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

const ListRegionsInput = z.object({
  provider: ProviderSchema.optional().describe("Only return regions from this cloud provider."),
  country: z
    .string()
    .length(2)
    .optional()
    .describe("Only return regions in this country (ISO 3166-1 alpha-2, e.g. \"DE\")."),
});

const ListRegionsOutput = z.object({
  count: z.number().int(),
  regions: z.array(RegionSchema),
});

/** Builds one MCP server instance with every Eco Router tool registered. */
export function createServer(): McpServer {
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
      const regions = REGIONS.filter(
        (r) =>
          (!provider || r.provider === provider) &&
          (!country || r.country === country.toUpperCase()),
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

  return server;
}
