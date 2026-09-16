import type { CarbonForecast } from "./types.js";

const LATEST_URL ="https://api.electricitymaps.com/v4/carbon-intensity/latest";
const FORECAST_URL = "https://api.electricitymaps.com/v4/carbon-intensity/forecast";

/** Longest forecast horizon requested. Plans may return fewer hours. */
export const MAX_FORECAST_HOURS = 72;

export interface LatestIntensity {
  intensity: number;
  datetime: string;
}

export class ElectricityMapsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ElectricityMapsError";
  }
}

interface RequestOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

async function getJson(url: URL, zone: string, token: string, options: RequestOptions): Promise<unknown> {
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(url, {
      headers: { "auth-token": token, Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
  } catch (error) {
    throw new ElectricityMapsError(`request failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    // Plans only cover some zones and signals, so 401/403 per zone is expected.
    throw new ElectricityMapsError(`HTTP ${response.status} for zone ${zone}`, response.status);
  }
  return response.json().catch(() => null);
}

function isIntensityPoint(value: unknown): value is { carbonIntensity: number; datetime: string } {
  const v = value as { carbonIntensity?: unknown; datetime?: unknown } | null;
  return typeof v?.carbonIntensity === "number" && Number.isFinite(v.carbonIntensity) && typeof v.datetime === "string";
}

/** Fetches the latest carbon intensity for one Electricity Maps zone. */
export async function fetchLatestIntensity(zone: string, token: string, options: RequestOptions = {}): Promise<LatestIntensity> {
  const url = new URL(LATEST_URL);
  url.searchParams.set("zone", zone);

  const data = await getJson(url, zone, token, options);
  if (!isIntensityPoint(data)) throw new ElectricityMapsError(`unexpected response for zone ${zone}`);
  return { intensity: data.carbonIntensity, datetime: data.datetime };
}

/** Fetches the hourly carbon intensity forecast for one Electricity Maps zone. */
export async function fetchForecast(zone: string, token: string, options: RequestOptions = {}): Promise<CarbonForecast> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("zone", zone);
  url.searchParams.set("horizonHours", String(MAX_FORECAST_HOURS));
  url.searchParams.set("temporalGranularity", "hourly");

  const data = (await getJson(url, zone, token, options)) as { forecast?: unknown; updatedAt?: unknown } | null;
  if (!Array.isArray(data?.forecast) || data.forecast.length === 0 || !data.forecast.every(isIntensityPoint)) {
    throw new ElectricityMapsError(`no usable forecast for zone ${zone}`);
  }
  const points = data.forecast
    .map((p) => ({ datetime: p.datetime, intensity: p.carbonIntensity }))
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
  return { points, ...(typeof data.updatedAt === "string" ? { updatedAt: data.updatedAt } : {}) };
}
