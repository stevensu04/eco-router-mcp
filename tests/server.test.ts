import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

describe("eco-router MCP server", () => {
  let client: Client;

  beforeEach(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createServer().connect(serverTransport);
    client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  it("exposes all tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["find_clean_window", "list_regions", "rank_regions"]);
  });

  it("explains that find_clean_window needs a token", async () => {
    const result = await client.callTool({
      name: "find_clean_window",
      arguments: { regions: ["aws/eu-north-1"], durationHours: 4 },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("ELECTRICITY_MAPS_API_TOKEN");
  });

  it("ranks EU regions using annual averages by default", async () => {
    const result = await client.callTool({
      name: "rank_regions",
      arguments: { countries: ["SE", "FR", "DE", "PL"], limit: 3 },
    });
    const data = result.structuredContent as {
      results: { country: string; carbonSource: string; rank: number }[];
      notes: string[];
    };
    expect(result.isError).toBeFalsy();
    expect(data.results).toHaveLength(3);
    expect(data.results.every((r) => r.carbonSource === "ember-annual")).toBe(true);
    expect(data.results[0]!.country).toBe("SE");
  });

  it("accepts EU as a country group", async () => {
    const result = await client.callTool({ name: "rank_regions", arguments: { countries: ["EU"], limit: 20 } });
    const data = result.structuredContent as { evaluated: number; results: { country: string }[] };
    expect(result.isError).toBeFalsy();
    expect(data.results.some((r) => ["CH", "GB", "NO"].includes(r.country))).toBe(false);

    const listed = await client.callTool({ name: "list_regions", arguments: { country: "eu" } });
    expect((listed.structuredContent as { count: number }).count).toBe(data.evaluated);
  });

  it("tells US grids apart without a token", async () => {
    const result = await client.callTool({ name: "rank_regions", arguments: { countries: ["US"], limit: 20 } });
    const data = result.structuredContent as {
      results: { id: string; gridZone: string; carbonSource: string; carbonIntensity: number }[];
      notes: string[];
    };
    expect(data.results.every((r) => r.carbonSource === "epa-egrid-annual")).toBe(true);
    // Grant County PUD (Quincy, Washington) is almost all hydro.
    expect(data.results[0]!.gridZone).toBe("US-NW-GCPD");
    expect(new Set(data.results.map((r) => r.carbonIntensity)).size).toBeGreaterThan(5);
    expect(data.notes.some((n) => n.includes("share a national annual average"))).toBe(false);
  });

  it("reports invalid combinations as tool errors", async () => {
    const result = await client.callTool({ name: "rank_regions", arguments: { maxLatencyMs: 50 } });
    expect(result.isError).toBe(true);
  });

  it("filters regions by provider", async () => {
    const result = await client.callTool({ name: "list_regions", arguments: { provider: "gcp" } });
    const data = result.structuredContent as { count: number; regions: { provider: string }[] };
    expect(data.count).toBeGreaterThan(0);
    expect(data.regions.every((r) => r.provider === "gcp")).toBe(true);
  });

  it("matches country codes case-insensitively", async () => {
    const result = await client.callTool({ name: "list_regions", arguments: { country: "au" } });
    const data = result.structuredContent as { count: number; regions: { country: string }[] };
    expect(data.count).toBeGreaterThan(0);
    expect(data.regions.every((r) => r.country === "AU")).toBe(true);
  });
});
