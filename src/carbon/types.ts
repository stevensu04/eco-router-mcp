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

export interface CarbonProvider {
  /** True when live grid data can be requested. */
  readonly live: boolean;
  getReading(region: CloudRegion): Promise<CarbonReading>;
}
