import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERVER_VERSION } from "../src/server.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const serverJson = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));

describe("release metadata", () => {
  it("uses one version everywhere", () => {
    expect(SERVER_VERSION).toBe(pkg.version);
    expect(serverJson.version).toBe(pkg.version);
    expect(serverJson.packages[0].version).toBe(pkg.version);
  });

  it("links the npm package to the MCP Registry entry", () => {
    expect(serverJson.name).toBe(pkg.mcpName);
    expect(serverJson.packages[0].identifier).toBe(pkg.name);
  });

  it("keeps the registry description within 100 characters", () => {
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
  });
});
