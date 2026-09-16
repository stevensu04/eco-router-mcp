import { BASELINE_INTENSITY } from "../data/baseline-intensity.js";
import type { CloudRegion } from "../data/regions.js";
import { ZONE_BASELINE_INTENSITY } from "../data/zone-baseline/index.js";
import { fetchForecast, fetchLatestIntensity } from "./electricityMaps.js";
import type { CarbonForecast, CarbonProvider, CarbonReading } from "./types.js";

// Electricity Maps updates hourly; failures are cached too so a zone outside
// the caller's plan is not retried on every request.
const DEFAULT_TTL_MS = 30 * 60 * 1000;

export const FORECAST_NEEDS_TOKEN =
  "Carbon forecasts need live data. Set ELECTRICITY_MAPS_API_TOKEN to an Electricity Maps token whose plan includes forecasts. " +
  "Annual averages do not change by hour, so without a token use rank_regions instead.";

/** Annual average for the region: its grid zone where available, otherwise its country. */
export function baselineReading(region: CloudRegion, fallbackReason?: string): CarbonReading {
  const reason = fallbackReason ? { fallbackReason } : {};
  const zone = ZONE_BASELINE_INTENSITY[region.gridZone];
  if (zone) {
    return { intensity: zone.intensity, source: zone.source, granularity: "grid-zone", asOf: String(zone.year), ...reason };
  }
  const country = BASELINE_INTENSITY[region.country];
  if (!country) throw new Error(`No baseline carbon intensity for country ${region.country}`);
  return { intensity: country.intensity, source: "ember-annual", granularity: "country", asOf: String(country.year), ...reason };
}

export interface CarbonProviderOptions {
  /** Electricity Maps API token. Without one, only annual averages are used. */
  token?: string;
  fetch?: typeof fetch;
  ttlMs?: number;
  now?: () => number;
}

type Settled<T> = Promise<T | Error>;

/** Caches one lookup per grid zone for the TTL, including failures. */
function zoneCache<T>(ttlMs: number, now: () => number, load: (zone: string) => Promise<T>) {
  // Storing the promise dedupes concurrent lookups for the same zone.
  const cache = new Map<string, { at: number; result: Settled<T> }>();
  return (zone: string): Settled<T> => {
    let entry = cache.get(zone);
    if (!entry || now() - entry.at >= ttlMs) {
      const result = load(zone).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));
      entry = { at: now(), result };
      cache.set(zone, entry);
    }
    return entry.result;
  };
}

export function createCarbonProvider(options: CarbonProviderOptions = {}): CarbonProvider {
  const { token } = options;
  if (!token) {
    return {
      live: false,
      getReading: async (region) => baselineReading(region),
      getForecast: async () => {
        throw new Error(FORECAST_NEEDS_TOKEN);
      },
    };
  }

  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const latest = zoneCache(ttlMs, now, (zone) => fetchLatestIntensity(zone, token, { fetch: options.fetch }));
  const forecasts = zoneCache(ttlMs, now, (zone) => fetchForecast(zone, token, { fetch: options.fetch }));

  return {
    live: true,
    async getReading(region) {
      const live = await latest(region.gridZone);
      if (live instanceof Error) {
        return baselineReading(region, `Electricity Maps unavailable (${live.message})`);
      }
      return { intensity: live.intensity, source: "electricity-maps", granularity: "grid-zone", asOf: live.datetime };
    },
    async getForecast(region): Promise<CarbonForecast> {
      const forecast = await forecasts(region.gridZone);
      if (forecast instanceof Error) throw forecast;
      return forecast;
    },
  };
}
