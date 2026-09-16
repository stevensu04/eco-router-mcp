import type { CloudRegion } from "../data/regions.js";

export interface CarbonReading {
  /** Lifecycle emissions intensity, gCO2e/kWh. */
  intensity: number;
  source: "electricity-maps" | "epa-egrid-annual" | "ember-annual";
  /** Whether the value describes the region's grid zone or its whole country. */
  granularity: "grid-zone" | "country";
  /** ISO timestamp for live data, or the calendar year for an annual average. */
  asOf: string;
  /** Set when live data was requested but the annual average was used instead. */
  fallbackReason?: string;
}

export interface ForecastPoint {
  /** Start of the hour, ISO timestamp. */
  datetime: string;
  /** Forecast lifecycle emissions intensity, gCO2e/kWh. */
  intensity: number;
}

export interface CarbonForecast {
  /** Hourly points in time order, starting with the current hour. */
  points: ForecastPoint[];
  updatedAt?: string;
}

export interface CarbonProvider {
  /** True when live grid data can be requested. */
  readonly live: boolean;
  getReading(region: CloudRegion): Promise<CarbonReading>;
  /** Hourly forecast for the region's grid zone. Rejects when forecasts are unavailable. */
  getForecast(region: CloudRegion): Promise<CarbonForecast>;
}
