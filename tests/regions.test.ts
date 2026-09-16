import { describe, expect, it } from "vitest";
import { REGIONS } from "../src/data/regions.js";

describe("region dataset", () => {
  it("covers all three providers", () => {
    for (const provider of ["aws", "gcp", "azure"]) {
      expect(REGIONS.some((r) => r.provider === provider)).toBe(true);
    }
  });

  it("has no duplicate region ids within a provider", () => {
    const keys = REGIONS.map((r) => `${r.provider}/${r.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(REGIONS.map((r) => [`${r.provider}/${r.id}`, r] as const))("%s is well-formed", (_, r) => {
    expect(r.country).toMatch(/^[A-Z]{2}$/);
    expect(r.lat).toBeGreaterThanOrEqual(-90);
    expect(r.lat).toBeLessThanOrEqual(90);
    expect(r.lon).toBeGreaterThanOrEqual(-180);
    expect(r.lon).toBeLessThanOrEqual(180);
    // Electricity Maps zone keys start with the country code ("US-MIDA-PJM", "DE").
    expect(r.gridZone.split("-")[0]).toBe(r.country);
    if (r.gridZoneNote !== undefined) expect(r.gridZoneNote.length).toBeGreaterThan(0);
  });
});
