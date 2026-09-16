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

  it("exposes list_regions and rank_regions", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["list_regions", "rank_regions"]);
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
