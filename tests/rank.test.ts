import { describe, expect, it } from "vitest";
import type { CarbonProvider, CarbonReading } from "../src/carbon/types.js";
import type { CloudRegion } from "../src/data/regions.js";
import { estimateRttMs, haversineKm, rankRegions } from "../src/engine/rank.js";

const REGIONS: CloudRegion[] = [
  { provider: "aws", id: "syd", name: "Sydney", location: "Sydney", country: "AU", lat: -33.87, lon: 151.21, gridZone: "AU-NSW" },
  { provider: "gcp", id: "mel", name: "Melbourne", location: "Melbourne", country: "AU", lat: -37.81, lon: 144.96, gridZone: "AU-VIC" },
  { provider: "azure", id: "sto", name: "Stockholm", location: "Stockholm", country: "SE", lat: 59.33, lon: 18.07, gridZone: "SE-SE3" },
  { provider: "aws", id: "fra", name: "Frankfurt", location: "Frankfurt", country: "DE", lat: 50.11, lon: 8.68, gridZone: "DE" },
];

function fakeCarbon(byZone: Record<string, number>, partial: Partial<CarbonReading> = {}): CarbonProvider {
  return {
    live: true,
    getReading: async (region) => ({
      intensity: byZone[region.gridZone]!,
      source: "electricity-maps",
      granularity: "grid-zone",
      asOf: "2026-09-17T00:00:00Z",
      ...partial,
    }),
    getForecast: async () => {
      throw new Error("not used");
    },
  };
}

const carbon = fakeCarbon({ "AU-NSW": 600, "AU-VIC": 700, "SE-SE3": 30, DE: 350 });
const sydney = { lat: -33.87, lon: 151.21 };

describe("rankRegions", () => {
  it("puts the cleanest grid first when there is no origin", async () => {
    const { results } = await rankRegions(carbon, {}, REGIONS);
    expect(results.map((r) => r.id)).toEqual(["sto", "fra", "syd", "mel"]);
    expect(results[0]!.score).toBe(100);
    expect(results[0]!.estimatedRttMs).toBeNull();
  });

  it("filters by provider and by country, ignoring case", async () => {
    const byProvider = await rankRegions(carbon, { providers: ["aws"] }, REGIONS);
    expect(byProvider.results.map((r) => r.id)).toEqual(["fra", "syd"]);

    const byCountry = await rankRegions(carbon, { countries: ["au"] }, REGIONS);
    expect(byCountry.evaluated).toBe(2);
    expect(byCountry.results.map((r) => r.id)).toEqual(["syd", "mel"]);
  });

  it("excludes regions over the carbon limit and counts them", async () => {
    const result = await rankRegions(carbon, { maxCarbonIntensity: 400 }, REGIONS);
    expect(result.results.map((r) => r.id)).toEqual(["sto", "fra"]);
    expect(result.excluded.maxCarbonIntensity).toBe(2);
    expect(result.qualified).toBe(2);
  });

  it("excludes regions over the latency limit", async () => {
    const result = await rankRegions(carbon, { origin: sydney, maxLatencyMs: 100 }, REGIONS);
    expect(result.results.map((r) => r.id)).toEqual(["syd", "mel"]);
    expect(result.excluded.maxLatencyMs).toBe(2);
  });

  it("requires an origin for a latency limit", async () => {
    await expect(rankRegions(carbon, { maxLatencyMs: 50 }, REGIONS)).rejects.toThrow(/origin/);
  });

  it("ranks by latency alone when carbonWeight is 0", async () => {
    const { results } = await rankRegions(carbon, { origin: sydney, carbonWeight: 0 }, REGIONS);
    expect(results[0]!.id).toBe("syd");
    expect(results[0]!.estimatedRttMs).toBe(5);
  });

  it("estimates job emissions from energy", async () => {
    const { results } = await rankRegions(carbon, { energyKwh: 250 }, REGIONS);
    // 30 gCO2e/kWh x 250 kWh = 7.5 kg
    expect(results[0]!.estimatedKgCO2e).toBe(7.5);
  });

  it("respects the limit", async () => {
    const { results } = await rankRegions(carbon, { limit: 1 }, REGIONS);
    expect(results).toHaveLength(1);
  });

  it("attributes live data to Electricity Maps", async () => {
    const { notes } = await rankRegions(carbon, {}, REGIONS);
    expect(notes).toContain("Live carbon data source: ElectricityMaps.com.");
    expect(notes.some((n) => n.includes("Ember"))).toBe(false);
  });

  it("warns when national averages hide differences between grids", async () => {
    const national = fakeCarbon({ "AU-NSW": 520, "AU-VIC": 520, "SE-SE3": 35, DE: 334 }, {
      source: "ember-annual",
      granularity: "country",
      asOf: "2025",
    });
    const { notes } = await rankRegions({ ...national, live: false }, {}, REGIONS);
    expect(notes.some((n) => n.includes("AU") && n.includes("ELECTRICITY_MAPS_API_TOKEN"))).toBe(true);
    expect(notes.some((n) => n.includes("CC BY 4.0"))).toBe(true);
  });
});

describe("distance helpers", () => {
  it("measures Sydney to Melbourne at about 713 km", () => {
    expect(haversineKm(sydney, { lat: -37.81, lon: 144.96 })).toBeCloseTo(713, -1);
  });

  it("adds a fixed overhead to the propagation estimate", () => {
    expect(estimateRttMs(0)).toBe(5);
    expect(estimateRttMs(1000)).toBe(25);
  });
});
