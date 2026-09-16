import type { CarbonProvider, ForecastPoint } from "../carbon/types.js";
import type { CloudProvider, CloudRegion } from "../data/regions.js";
import { type RegionFilter, selectRegions } from "./select.js";
import { assertTimeZone, formatLocal } from "./time.js";

const HOUR_MS = 60 * 60 * 1000;
/** Keeps a single request from spending a small plan's hourly quota. */
export const MAX_FORECAST_ZONES = 15;

export interface WindowOptions extends RegionFilter {
  /** How long the job runs, in whole hours. */
  durationHours: number;
  /** The job must finish within this many hours from now. */
  withinHours?: number;
  energyKwh?: number;
  limit?: number;
  /** IANA time zone for local times in the result, e.g. "Australia/Brisbane". */
  timezone?: string;
}

export interface WindowRegion {
  provider: CloudProvider;
  id: string;
  name: string;
  location: string;
  gridZoneNote?: string;
}

/** One grid zone's best window. Every region in the zone shares its forecast. */
export interface WindowResult {
  rank: number;
  gridZone: string;
  country: string;
  regions: WindowRegion[];
  bestStart: string;
  bestEnd: string;
  /** bestStart in the requested time zone, or null without one. */
  bestStartLocal: string | null;
  bestEndLocal: string | null;
  /** Average forecast intensity over the best window, gCO2e/kWh. */
  bestIntensity: number;
  /** Average forecast intensity if the job started in the current hour. */
  startNowIntensity: number;
  /** How much lower the best window is than starting now, in percent. */
  savingsVsNowPercent: number;
  estimatedKgCO2e: number | null;
  estimatedKgCO2eIfStartedNow: number | null;
  forecastUpdatedAt: string | null;
}

export interface WindowSearchResult {
  generatedAt: string;
  durationHours: number;
  withinHours: number;
  timezone: string | null;
  evaluatedRegions: number;
  evaluatedZones: number;
  results: WindowResult[];
  unavailable: { gridZone: string; regions: string[]; reason: string }[];
  notes: string[];
}

export interface BestWindow {
  startIndex: number;
  average: number;
  startNowAverage: number;
}

/**
 * Finds the start hour with the lowest average intensity for a job of
 * `durationHours` that must finish within `withinHours` of the first point.
 * Returns null when the forecast is too short for the job.
 */
export function bestWindow(points: readonly ForecastPoint[], durationHours: number, withinHours: number): BestWindow | null {
  const lastStart = Math.min(points.length, withinHours) - durationHours;
  if (durationHours < 1 || lastStart < 0) return null;

  const averageFrom = (start: number) => {
    let sum = 0;
    for (let i = start; i < start + durationHours; i++) sum += points[i]!.intensity;
    return sum / durationHours;
  };

  let best = { startIndex: 0, average: averageFrom(0) };
  for (let start = 1; start <= lastStart; start++) {
    const average = averageFrom(start);
    if (average < best.average) best = { startIndex: start, average };
  }
  return { ...best, startNowAverage: averageFrom(0) };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const kg = (intensity: number, energyKwh: number | undefined) =>
  energyKwh === undefined ? null : Math.round((intensity * energyKwh) / 100) / 10;

export async function findCleanWindows(carbon: CarbonProvider, options: WindowOptions, all?: readonly CloudRegion[]): Promise<WindowSearchResult> {
  const withinHours = options.withinHours ?? 24;
  if (!Number.isInteger(options.durationHours) || options.durationHours < 1) {
    throw new Error("durationHours must be a whole number of hours, at least 1.");
  }
  if (options.durationHours > withinHours) {
    throw new Error(`A ${options.durationHours}-hour job cannot finish within ${withinHours} hours.`);
  }
  const timezone = options.timezone?.trim() || null;
  if (timezone) assertTimeZone(timezone);
  const local = (iso: string) => (timezone ? formatLocal(iso, timezone) : null);

  const candidates = selectRegions(options, all);
  const zones = new Set(candidates.map((r) => r.gridZone));
  if (candidates.length === 0) throw new Error("No regions match the filters.");
  if (zones.size > MAX_FORECAST_ZONES) {
    throw new Error(
      `These filters cover ${zones.size} grid zones; the limit is ${MAX_FORECAST_ZONES} per request. ` +
        "Narrow them with regions, providers or countries, or shortlist with rank_regions first.",
    );
  }

  const byZone = new Map<string, CloudRegion[]>();
  for (const region of candidates) byZone.set(region.gridZone, [...(byZone.get(region.gridZone) ?? []), region]);

  const unavailable: WindowSearchResult["unavailable"] = [];
  const found: Omit<WindowResult, "rank">[] = [];
  let shortestHorizon = Infinity;

  await Promise.all(
    [...byZone].map(async ([gridZone, regions]) => {
      const refs = regions.map((r) => `${r.provider}/${r.id}`);
      let forecast;
      try {
        forecast = await carbon.getForecast(regions[0]!);
      } catch (error) {
        unavailable.push({ gridZone, regions: refs, reason: error instanceof Error ? error.message : String(error) });
        return;
      }
      shortestHorizon = Math.min(shortestHorizon, forecast.points.length);
      const window = bestWindow(forecast.points, options.durationHours, withinHours);
      if (!window) {
        unavailable.push({ gridZone, regions: refs, reason: `forecast covers ${forecast.points.length} hours, too short for this job` });
        return;
      }
      const start = forecast.points[window.startIndex]!.datetime;
      const end = new Date(Date.parse(start) + options.durationHours * HOUR_MS).toISOString();
      found.push({
        gridZone,
        country: regions[0]!.country,
        regions: regions.map((r) => ({
          provider: r.provider,
          id: r.id,
          name: r.name,
          location: r.location,
          ...(r.gridZoneNote ? { gridZoneNote: r.gridZoneNote } : {}),
        })),
        bestStart: start,
        bestEnd: end,
        bestStartLocal: local(start),
        bestEndLocal: local(end),
        bestIntensity: round1(window.average),
        startNowIntensity: round1(window.startNowAverage),
        savingsVsNowPercent: window.startNowAverage > 0 ? round1((1 - window.average / window.startNowAverage) * 100) : 0,
        estimatedKgCO2e: kg(window.average, options.energyKwh),
        estimatedKgCO2eIfStartedNow: kg(window.startNowAverage, options.energyKwh),
        forecastUpdatedAt: forecast.updatedAt ?? null,
      });
    }),
  );

  if (found.length === 0) {
    const reasons = [...new Set(unavailable.map((u) => u.reason))].join(" | ");
    throw new Error(`No forecast was available for any matching region. ${reasons}`);
  }

  found.sort(
    (a, b) =>
      a.bestIntensity - b.bestIntensity ||
      Date.parse(a.bestStart) - Date.parse(b.bestStart) ||
      a.gridZone.localeCompare(b.gridZone),
  );
  unavailable.sort((a, b) => a.gridZone.localeCompare(b.gridZone));

  const notes = [
    timezone
      ? `bestStart and bestEnd are UTC; bestStartLocal and bestEndLocal are in ${timezone}.`
      : "Times are UTC and the user's time zone is unknown. Ask the user for it, or call again with timezone, instead of guessing a conversion.",
    "The first forecast hour stands in for starting now.",
    "Forecasts are estimates and change hourly; re-check shortly before starting.",
    "Live carbon data source: ElectricityMaps.com.",
  ];
  if (shortestHorizon < withinHours) {
    notes.push(`Some forecasts cover only ${shortestHorizon} hours, so later start times were not considered.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    durationHours: options.durationHours,
    withinHours,
    timezone,
    evaluatedRegions: candidates.length,
    evaluatedZones: byZone.size,
    results: found.slice(0, options.limit ?? 5).map((r, i) => ({ rank: i + 1, ...r })),
    unavailable,
    notes,
  };
}
