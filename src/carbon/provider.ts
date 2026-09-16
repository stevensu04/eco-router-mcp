import { BASELINE_INTENSITY } from "../data/baseline-intensity.js";
import type { CloudRegion } from "../data/regions.js";
import { fetchLatestIntensity } from "./electricityMaps.js";
import type { CarbonProvider, CarbonReading } from "./types.js";

// Electricity Maps updates hourly; failures are cached too so a zone outside
// the caller's plan is not retried on every request.
const DEFAULT_TTL_MS = 30 * 60 * 1000;

export function baselineReading(region: CloudRegion, fallbackReason?: string): CarbonReading {
  const baseline = BASELINE_INTENSITY[region.country];
  if (!baseline) throw new Error(`No baseline carbon intensity for country ${region.country}`);
  return {
    intensity: baseline.intensity,
    source: "ember-annual",
    granularity: "country",
    asOf: String(baseline.year),
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

export interface CarbonProviderOptions {
  /** Electricity Maps API token. Without one, only annual averages are used. */
  token?: string;
  fetch?: typeof fetch;
  ttlMs?: number;
  now?: () => number;
}

export function createCarbonProvider(options: CarbonProviderOptions = {}): CarbonProvider {
  const { token } = options;
  if (!token) {
    return { live: false, getReading: async (region) => baselineReading(region) };
  }

  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  // Keyed by grid zone; storing the promise dedupes concurrent lookups.
  const cache = new Map<string, { at: number; result: Promise<{ intensity: number; datetime: string } | Error> }>();

  return {
    live: true,
    async getReading(region) {
      let entry = cache.get(region.gridZone);
      if (!entry || now() - entry.at >= ttlMs) {
        const result = fetchLatestIntensity(region.gridZone, token, { fetch: options.fetch }).catch(
          (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
        );
        entry = { at: now(), result };
        cache.set(region.gridZone, entry);
      }

      const live = await entry.result;
      if (live instanceof Error) {
        return baselineReading(region, `Electricity Maps unavailable (${live.message})`);
      }
      return { intensity: live.intensity, source: "electricity-maps", granularity: "grid-zone", asOf: live.datetime };
    },
  };
}
