/**
 * Cloud regions Eco Router can recommend.
 *
 * Each region is pinned to the electricity grid zone its datacenters draw
 * from, using Electricity Maps zone keys. Carbon intensity is a property of
 * the grid, not the provider, so two providers in the same zone share a
 * carbon signal.
 *
 * Coordinates are the metro area the provider publishes for the region, not
 * an exact datacenter address. They are only used to estimate latency.
 */

export type CloudProvider = "aws" | "gcp" | "azure";

export interface CloudRegion {
  provider: CloudProvider;
  /** The provider's own region code, e.g. "ap-southeast-2". */
  id: string;
  /** Human-readable location. */
  location: string;
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  lat: number;
  lon: number;
  /** Electricity Maps zone key for the grid this region draws power from. */
  gridZone: string;
}

// Seed list for the skeleton. Step 2 replaces this with the full, sourced
// dataset for AWS, Google Cloud and Azure.
export const REGIONS: readonly CloudRegion[] = [
  {
    provider: "aws",
    id: "ap-southeast-2",
    location: "Sydney",
    country: "AU",
    lat: -33.87,
    lon: 151.21,
    gridZone: "AU-NSW",
  },
  {
    provider: "gcp",
    id: "europe-north1",
    location: "Hamina",
    country: "FI",
    lat: 60.57,
    lon: 27.2,
    gridZone: "FI",
  },
  {
    provider: "azure",
    id: "westeurope",
    location: "Netherlands",
    country: "NL",
    lat: 52.37,
    lon: 4.9,
    gridZone: "NL",
  },
];
