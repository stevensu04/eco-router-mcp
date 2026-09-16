import { describe, expect, it, vi } from "vitest";
import { createCarbonProvider } from "../src/carbon/provider.js";
import { BASELINE_INTENSITY } from "../src/data/baseline-intensity.js";
import { type CloudRegion, REGIONS } from "../src/data/regions.js";
import { ZONE_BASELINE_INTENSITY } from "../src/data/zone-baseline-intensity.js";

const nsw: CloudRegion = { provider: "aws", id: "ap-southeast-2", name: "Sydney", location: "Sydney", country: "AU", lat: -33.87, lon: 151.21, gridZone: "AU-NSW" };
const nsw2: CloudRegion = { ...nsw, provider: "azure", id: "australiaeast" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const virginia: CloudRegion = { provider: "aws", id: "us-east-1", name: "US East (N. Virginia)", location: "N. Virginia", country: "US", lat: 39.04, lon: -77.49, gridZone: "US-MIDA-PJM" };

describe("baseline data", () => {
  it("has an annual average for every region's country", () => {
    const missing = [...new Set(REGIONS.map((r) => r.country))].filter((c) => !BASELINE_INTENSITY[c]);
    expect(missing).toEqual([]);
  });

  it("has a grid-level annual average for every US region", () => {
    const missing = REGIONS.filter((r) => r.country === "US" && !ZONE_BASELINE_INTENSITY[r.gridZone]).map((r) => r.id);
    expect(missing).toEqual([]);
  });
});

describe("createCarbonProvider", () => {
  it("uses national annual averages without a token", async () => {
    const provider = createCarbonProvider();
    const reading = await provider.getReading(nsw);
    expect(provider.live).toBe(false);
    expect(reading).toMatchObject({ source: "ember-annual", granularity: "country", intensity: BASELINE_INTENSITY.AU!.intensity });
    expect(reading.fallbackReason).toBeUndefined();
  });

  it("prefers a grid-level annual average over the national one", async () => {
    const reading = await createCarbonProvider().getReading(virginia);
    expect(reading).toMatchObject({
      source: "epa-egrid-annual",
      granularity: "grid-zone",
      intensity: ZONE_BASELINE_INTENSITY["US-MIDA-PJM"]!.intensity,
    });
  });

  it("falls back to the grid-level average when live data fails", async () => {
    const provider = createCarbonProvider({ token: "test-token", fetch: async () => jsonResponse({}, 401) });
    const reading = await provider.getReading(virginia);
    expect(reading.source).toBe("epa-egrid-annual");
    expect(reading.fallbackReason).toMatch(/401/);
  });

  it("requests live data for the region's grid zone", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ zone: "AU-NSW", carbonIntensity: 612, datetime: "2026-09-17T06:00:00.000Z" }));
    const provider = createCarbonProvider({ token: "test-token", fetch: fetchMock });

    const reading = await provider.getReading(nsw);

    expect(reading).toEqual({ intensity: 612, source: "electricity-maps", granularity: "grid-zone", asOf: "2026-09-17T06:00:00.000Z" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.searchParams.get("zone")).toBe("AU-NSW");
    expect((init.headers as Record<string, string>)["auth-token"]).toBe("test-token");
  });

  it("falls back to the annual average when a zone is not in the plan", async () => {
    const provider = createCarbonProvider({ token: "test-token", fetch: async () => jsonResponse({ error: "forbidden" }, 403) });
    const reading = await provider.getReading(nsw);
    expect(reading.source).toBe("ember-annual");
    expect(reading.fallbackReason).toMatch(/403/);
  });

  it("falls back when the response has an unexpected shape", async () => {
    const provider = createCarbonProvider({ token: "test-token", fetch: async () => jsonResponse({ nope: true }) });
    expect((await provider.getReading(nsw)).fallbackReason).toMatch(/unexpected response/);
  });

  it("explains that forecasts need a token", async () => {
    await expect(createCarbonProvider().getForecast(nsw)).rejects.toThrow(/ELECTRICITY_MAPS_API_TOKEN/);
  });

  it("requests a 72-hour hourly forecast and sorts the points", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        zone: "AU-NSW",
        forecast: [
          { carbonIntensity: 480, datetime: "2026-09-17T01:00:00.000Z" },
          { carbonIntensity: 500, datetime: "2026-09-17T00:00:00.000Z" },
        ],
        updatedAt: "2026-09-17T00:10:00.000Z",
      }),
    );
    const provider = createCarbonProvider({ token: "test-token", fetch: fetchMock });

    const forecast = await provider.getForecast(nsw);

    expect(forecast.points.map((p) => p.intensity)).toEqual([500, 480]);
    expect(forecast.updatedAt).toBe("2026-09-17T00:10:00.000Z");
    const [url] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(url.pathname).toMatch(/carbon-intensity\/forecast$/);
    expect(url.searchParams.get("horizonHours")).toBe("72");
  });

  it("rejects forecasts with no usable points", async () => {
    const provider = createCarbonProvider({ token: "t", fetch: async () => jsonResponse({ forecast: [] }) });
    await expect(provider.getForecast(nsw)).rejects.toThrow(/no usable forecast/);
  });

  it("shares one request per zone and refreshes after the TTL", async () => {
    let clock = 0;
    const fetchMock = vi.fn(async () => jsonResponse({ carbonIntensity: 500, datetime: "2026-09-17T06:00:00Z" }));
    const provider = createCarbonProvider({ token: "t", fetch: fetchMock, ttlMs: 1000, now: () => clock });

    await Promise.all([provider.getReading(nsw), provider.getReading(nsw2)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock = 999;
    await provider.getReading(nsw);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock = 1000;
    await provider.getReading(nsw);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
