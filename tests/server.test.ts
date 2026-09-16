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

  it("exposes list_regions", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("list_regions");
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
