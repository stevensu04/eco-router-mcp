import { describe, expect, it } from "vitest";
import type { CarbonProvider, ForecastPoint } from "../src/carbon/types.js";
import type { CloudRegion } from "../src/data/regions.js";
import { selectRegions } from "../src/engine/select.js";
import { bestWindow, findCleanWindows, MAX_FORECAST_ZONES } from "../src/engine/window.js";

function hourly(values: number[], start = "2026-09-17T00:00:00.000Z"): ForecastPoint[] {
  return values.map((intensity, i) => ({ intensity, datetime: new Date(Date.parse(start) + i * 3_600_000).toISOString() }));
}

describe("bestWindow", () => {
  it("finds the lowest average run of hours", () => {
    expect(bestWindow(hourly([50, 10, 20, 90]), 2, 24)).toEqual({ startIndex: 1, average: 15, startNowAverage: 30 });
  });

  it("keeps starting now when that is already best", () => {
    expect(bestWindow(hourly([10, 10, 50, 50]), 2, 24)).toMatchObject({ startIndex: 0, average: 10, startNowAverage: 10 });
  });

  it("only considers windows that finish in time", () => {
    // Starting at index 2 ends exactly at hour 4 and is allowed; the cheapest
    // run (index 3-4, average 5) would end at hour 5 and is not.
    expect(bestWindow(hourly([40, 30, 35, 5, 5]), 2, 4)).toMatchObject({ startIndex: 2, average: 20 });
  });

  it("returns null when the forecast is shorter than the job", () => {
    expect(bestWindow(hourly([10, 20]), 3, 24)).toBeNull();
  });
});

const REGIONS: CloudRegion[] = [
  { provider: "aws", id: "eu-north-1", name: "Europe (Stockholm)", location: "Stockholm", country: "SE", lat: 59.33, lon: 18.07, gridZone: "SE-SE3" },
  { provider: "aws", id: "eu-central-1", name: "Europe (Frankfurt)", location: "Frankfurt", country: "DE", lat: 50.11, lon: 8.68, gridZone: "DE" },
  { provider: "gcp", id: "europe-west3", name: "europe-west3", location: "Frankfurt, Germany", country: "DE", lat: 50.11, lon: 8.68, gridZone: "DE" },
  { provider: "aws", id: "us-east-1", name: "US East (N. Virginia)", location: "N. Virginia", country: "US", lat: 39.04, lon: -77.49, gridZone: "US-MIDA-PJM" },
];

function fakeForecasts(byZone: Record<string, number[] | Error>): CarbonProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    live: true,
    calls,
    getReading: async () => {
      throw new Error("not used");
    },
    getForecast: async (region) => {
      calls.push(region.gridZone);
      const series = byZone[region.gridZone];
      if (series instanceof Error) throw series;
      if (!series) throw new Error(`no forecast for ${region.gridZone}`);
      return { points: hourly(series), updatedAt: "2026-09-17T00:05:00.000Z" };
    },
  };
}

describe("findCleanWindows", () => {
  const carbon = fakeForecasts({ "SE-SE3": [20, 20, 18, 18], DE: [400, 300, 150, 160], "US-MIDA-PJM": new Error("HTTP 403 for zone US-MIDA-PJM") });

  it("ranks grid zones by their best window and reports savings", async () => {
    const result = await findCleanWindows(carbon, { regions: ["aws/eu-north-1", "aws/eu-central-1"], durationHours: 2, energyKwh: 100 }, REGIONS);
    expect(result.results.map((r) => r.gridZone)).toEqual(["SE-SE3", "DE"]);

    const frankfurt = result.results[1]!;
    expect(frankfurt.bestStart).toBe("2026-09-17T02:00:00.000Z");
    expect(frankfurt.bestEnd).toBe("2026-09-17T04:00:00.000Z");
    expect(frankfurt.bestIntensity).toBe(155);
    expect(frankfurt.startNowIntensity).toBe(350);
    expect(frankfurt.savingsVsNowPercent).toBe(55.7);
    expect(frankfurt.estimatedKgCO2e).toBe(15.5);
    expect(frankfurt.estimatedKgCO2eIfStartedNow).toBe(35);
  });

  it("lists zones without a forecast instead of failing", async () => {
    const result = await findCleanWindows(carbon, { countries: ["DE", "US"], durationHours: 1 }, REGIONS);
    expect(result.results.map((r) => r.gridZone)).toEqual(["DE"]);
    expect(result.unavailable).toEqual([{ gridZone: "US-MIDA-PJM", regions: ["aws/us-east-1"], reason: "HTTP 403 for zone US-MIDA-PJM" }]);
  });

  it("groups regions that share a grid zone and fetches that zone once", async () => {
    const counting = fakeForecasts({ DE: [1, 2] });
    const result = await findCleanWindows(counting, { countries: ["DE"], durationHours: 1 }, REGIONS);
    expect(counting.calls).toEqual(["DE"]);
    expect(result.evaluatedRegions).toBe(2);
    expect(result.evaluatedZones).toBe(1);
    expect(result.results[0]!.regions.map((r) => `${r.provider}/${r.id}`)).toEqual(["aws/eu-central-1", "gcp/europe-west3"]);
  });

  it("fails clearly when no region has a forecast", async () => {
    await expect(findCleanWindows(carbon, { regions: ["aws/us-east-1"], durationHours: 1 }, REGIONS)).rejects.toThrow(/No forecast was available/);
  });

  it("rejects jobs that cannot finish in time", async () => {
    await expect(findCleanWindows(carbon, { regions: ["aws/eu-north-1"], durationHours: 10, withinHours: 6 }, REGIONS)).rejects.toThrow(/cannot finish/);
  });

  it("caps the number of grid zones per request", async () => {
    await expect(findCleanWindows(carbon, { durationHours: 1 })).rejects.toThrow(new RegExp(`limit is ${MAX_FORECAST_ZONES}`));
  });

  it("notes when forecasts are shorter than the requested window", async () => {
    const result = await findCleanWindows(carbon, { regions: ["aws/eu-north-1"], durationHours: 1, withinHours: 48 }, REGIONS);
    expect(result.notes.some((n) => n.includes("cover only 4 hours"))).toBe(true);
  });
});

describe("selectRegions", () => {
  it("accepts provider/id and bare ids", () => {
    expect(selectRegions({ regions: ["aws/eu-north-1", "europe-west3"] }, REGIONS).map((r) => r.id)).toEqual(["eu-north-1", "europe-west3"]);
  });

  it("combines explicit regions with other filters", () => {
    expect(selectRegions({ regions: ["aws/eu-north-1", "aws/eu-central-1"], countries: ["DE"] }, REGIONS).map((r) => r.id)).toEqual(["eu-central-1"]);
  });

  it("rejects unknown regions", () => {
    expect(() => selectRegions({ regions: ["aws/mars-1"] }, REGIONS)).toThrow(/Unknown region/);
  });
});
