import type { CarbonProvider, CarbonReading } from "../carbon/types.js";
import { type CloudProvider, type CloudRegion, REGIONS } from "../data/regions.js";

// Round-trip latency proxy from great-circle distance: a fixed overhead plus
// fibre propagation with typical routing detours. No live telemetry.
const BASE_RTT_MS = 5;
const RTT_MS_PER_KM = 0.02;

export interface RankOptions {
  providers?: CloudProvider[];
  /** ISO alpha-2 allowlist, e.g. for data residency. */
  countries?: string[];
  origin?: { lat: number; lon: number };
  maxLatencyMs?: number;
  maxCarbonIntensity?: number;
  /** 0..1 weight on carbon; the rest goes to latency. Ignored without an origin. */
  carbonWeight?: number;
  /** Job energy, used to estimate emissions. */
  energyKwh?: number;
  limit?: number;
}

export interface RankedRegion {
  rank: number;
  provider: CloudProvider;
  id: string;
  name: string;
  location: string;
  country: string;
  gridZone: string;
  gridZoneNote?: string;
  carbonIntensity: number;
  carbonSource: CarbonReading["source"];
  carbonGranularity: CarbonReading["granularity"];
  carbonAsOf: string;
  estimatedRttMs: number | null;
  estimatedKgCO2e: number | null;
  score: number;
  reason: string;
}

export interface RankResult {
  generatedAt: string;
  evaluated: number;
  qualified: number;
  excluded: { maxCarbonIntensity: number; maxLatencyMs: number };
  results: RankedRegion[];
  notes: string[];
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function estimateRttMs(distanceKm: number): number {
  return Math.round(BASE_RTT_MS + RTT_MS_PER_KM * distanceKm);
}

// Lower is better: maps [lo, hi] to [1, 0]. All-equal values all score 1.
function benefit(x: number, lo: number, hi: number): number {
  return hi === lo ? 1 : 1 - (x - lo) / (hi - lo);
}

export async function rankRegions(
  carbon: CarbonProvider,
  options: RankOptions = {},
  regions: readonly CloudRegion[] = REGIONS,
): Promise<RankResult> {
  if (options.maxLatencyMs !== undefined && !options.origin) {
    throw new Error("maxLatencyMs needs an origin to estimate latency from.");
  }
  const countries = options.countries?.map((c) => c.toUpperCase());
  const candidates = regions.filter(
    (r) => (!options.providers?.length || options.providers.includes(r.provider)) && (!countries?.length || countries.includes(r.country)),
  );

  const rows = await Promise.all(
    candidates.map(async (region) => ({
      region,
      reading: await carbon.getReading(region),
      rtt: options.origin ? estimateRttMs(haversineKm(options.origin, region)) : null,
    })),
  );

  const excluded = { maxCarbonIntensity: 0, maxLatencyMs: 0 };
  const qualified = rows.filter(({ reading, rtt }) => {
    if (options.maxCarbonIntensity !== undefined && reading.intensity > options.maxCarbonIntensity) {
      excluded.maxCarbonIntensity++;
      return false;
    }
    if (options.maxLatencyMs !== undefined && rtt !== null && rtt > options.maxLatencyMs) {
      excluded.maxLatencyMs++;
      return false;
    }
    return true;
  });

  const intensities = qualified.map((q) => q.reading.intensity);
  const rtts = qualified.flatMap((q) => (q.rtt === null ? [] : [q.rtt]));
  const carbonWeight = options.origin ? (options.carbonWeight ?? 0.7) : 1;

  const scored = qualified.map((q) => {
    const carbonScore = benefit(q.reading.intensity, Math.min(...intensities), Math.max(...intensities));
    const latencyScore = q.rtt === null ? 0 : benefit(q.rtt, Math.min(...rtts), Math.max(...rtts));
    return { ...q, score: Math.round((carbonWeight * carbonScore + (1 - carbonWeight) * latencyScore) * 1000) / 10 };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.reading.intensity - b.reading.intensity ||
      (a.rtt ?? 0) - (b.rtt ?? 0) ||
      `${a.region.provider}/${a.region.id}`.localeCompare(`${b.region.provider}/${b.region.id}`),
  );

  const limit = options.limit ?? 5;
  const results: RankedRegion[] = scored.slice(0, limit).map(({ region, reading, rtt, score }, i) => ({
    rank: i + 1,
    provider: region.provider,
    id: region.id,
    name: region.name,
    location: region.location,
    country: region.country,
    gridZone: region.gridZone,
    ...(region.gridZoneNote ? { gridZoneNote: region.gridZoneNote } : {}),
    carbonIntensity: Math.round(reading.intensity),
    carbonSource: reading.source,
    carbonGranularity: reading.granularity,
    carbonAsOf: reading.asOf,
    estimatedRttMs: rtt,
    estimatedKgCO2e: options.energyKwh === undefined ? null : Math.round(reading.intensity * options.energyKwh) / 1000,
    score,
    reason: describe(reading, rtt),
  }));

  return {
    generatedAt: new Date().toISOString(),
    evaluated: candidates.length,
    qualified: qualified.length,
    excluded,
    results,
    notes: buildNotes(carbon, scored.map((s) => ({ region: s.region, reading: s.reading }))),
  };
}

function describe(reading: CarbonReading, rtt: number | null): string {
  const source = {
    "electricity-maps": `live grid data from Electricity Maps, ${reading.asOf}`,
    "epa-egrid-annual": `${reading.asOf} grid average from EPA eGRID`,
    "ember-annual": `${reading.asOf} national average from Ember`,
  }[reading.source];
  const parts = [`${Math.round(reading.intensity)} gCO2e/kWh (${source})`];
  if (rtt !== null) parts.push(`about ${rtt} ms round trip from origin`);
  if (reading.fallbackReason) parts.push(`live data fell back: ${reading.fallbackReason}`);
  return parts.join("; ");
}

function buildNotes(carbon: CarbonProvider, ranked: { region: CloudRegion; reading: CarbonReading }[]): string[] {
  const notes: string[] = [];
  const zonesByCountry = new Map<string, Set<string>>();
  for (const { region, reading } of ranked) {
    if (reading.granularity !== "country") continue;
    zonesByCountry.set(region.country, (zonesByCountry.get(region.country) ?? new Set()).add(region.gridZone));
  }
  const blurred = [...zonesByCountry].filter(([, zones]) => zones.size > 1).map(([country]) => country);
  if (blurred.length) {
    notes.push(
      `Regions in ${blurred.join(", ")} share a national annual average, so their carbon ranking cannot tell grids apart. ` +
        (carbon.live
          ? "Live data was unavailable for some of their zones."
          : "Set ELECTRICITY_MAPS_API_TOKEN for grid-level live data."),
    );
  }
  if (ranked.some((r) => r.reading.source === "electricity-maps")) {
    notes.push("Live carbon data source: ElectricityMaps.com.");
  }
  if (ranked.some((r) => r.reading.source === "epa-egrid-annual")) {
    notes.push(
      "US grid averages: US EPA eGRID generation mix with Ember lifecycle factors. " +
        "They describe generation inside each balancing authority and ignore imports.",
    );
  }
  if (ranked.some((r) => r.reading.source !== "electricity-maps")) {
    notes.push("Annual averages: Ember Yearly Electricity Data, licensed CC BY 4.0.");
  }
  notes.push("Latency is a rough estimate from distance, not a measurement.");
  return notes;
}
