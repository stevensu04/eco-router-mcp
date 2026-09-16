/**
 * Cloud regions Eco Router can recommend.
 *
 * Each region is pinned to the electricity grid zone its datacenters draw
 * from, using Electricity Maps zone keys. Carbon intensity is a property of
 * the grid, not the provider, so regions in the same zone share a carbon
 * signal.
 *
 * `name` and `location` follow each provider's official region list.
 * Coordinates are metro-level approximations used only to estimate latency.
 * When the grid zone relies on an assumption about where the datacenters sit,
 * `gridZoneNote` says what was assumed. See docs/regions.md for sources.
 */

export type CloudProvider = "aws" | "gcp" | "azure";

export interface CloudRegion {
  provider: CloudProvider;
  /** The provider's own region code, e.g. "ap-southeast-2". */
  id: string;
  /** The provider's display name for the region. */
  name: string;
  /** Physical location as published by the provider. */
  location: string;
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  lat: number;
  lon: number;
  /** Electricity Maps zone key for the grid this region draws power from. */
  gridZone: string;
  /** Present when the zone mapping depends on an assumption. */
  gridZoneNote?: string;
}

const AWS: CloudRegion[] = [
  { provider: "aws", id: "us-east-1", name: "US East (N. Virginia)", location: "N. Virginia", country: "US", lat: 39.04, lon: -77.49, gridZone: "US-MIDA-PJM" },
  { provider: "aws", id: "us-east-2", name: "US East (Ohio)", location: "Ohio", country: "US", lat: 39.96, lon: -83.0, gridZone: "US-MIDA-PJM" },
  { provider: "aws", id: "us-west-1", name: "US West (N. California)", location: "N. California", country: "US", lat: 37.34, lon: -121.89, gridZone: "US-CAL-CISO" },
  {
    provider: "aws", id: "us-west-2", name: "US West (Oregon)", location: "Oregon", country: "US", lat: 45.84, lon: -119.7, gridZone: "US-NW-BPAT",
    gridZoneNote: "Assumes the eastern Oregon campuses (Morrow and Umatilla counties), inside the Bonneville Power Administration balancing area.",
  },
  { provider: "aws", id: "af-south-1", name: "Africa (Cape Town)", location: "Cape Town", country: "ZA", lat: -33.92, lon: 18.42, gridZone: "ZA" },
  { provider: "aws", id: "ap-east-1", name: "Asia Pacific (Hong Kong)", location: "Hong Kong", country: "HK", lat: 22.32, lon: 114.17, gridZone: "HK" },
  { provider: "aws", id: "ap-east-2", name: "Asia Pacific (Taipei)", location: "Taipei", country: "TW", lat: 25.03, lon: 121.57, gridZone: "TW" },
  { provider: "aws", id: "ap-northeast-1", name: "Asia Pacific (Tokyo)", location: "Tokyo", country: "JP", lat: 35.68, lon: 139.69, gridZone: "JP-TK" },
  { provider: "aws", id: "ap-northeast-2", name: "Asia Pacific (Seoul)", location: "Seoul", country: "KR", lat: 37.57, lon: 126.98, gridZone: "KR" },
  { provider: "aws", id: "ap-northeast-3", name: "Asia Pacific (Osaka)", location: "Osaka", country: "JP", lat: 34.69, lon: 135.5, gridZone: "JP-KN" },
  { provider: "aws", id: "ap-south-1", name: "Asia Pacific (Mumbai)", location: "Mumbai", country: "IN", lat: 19.08, lon: 72.88, gridZone: "IN-WE" },
  { provider: "aws", id: "ap-south-2", name: "Asia Pacific (Hyderabad)", location: "Hyderabad", country: "IN", lat: 17.39, lon: 78.49, gridZone: "IN-SO" },
  { provider: "aws", id: "ap-southeast-1", name: "Asia Pacific (Singapore)", location: "Singapore", country: "SG", lat: 1.35, lon: 103.82, gridZone: "SG" },
  { provider: "aws", id: "ap-southeast-2", name: "Asia Pacific (Sydney)", location: "Sydney", country: "AU", lat: -33.87, lon: 151.21, gridZone: "AU-NSW" },
  { provider: "aws", id: "ap-southeast-3", name: "Asia Pacific (Jakarta)", location: "Jakarta", country: "ID", lat: -6.21, lon: 106.85, gridZone: "ID" },
  { provider: "aws", id: "ap-southeast-4", name: "Asia Pacific (Melbourne)", location: "Melbourne", country: "AU", lat: -37.81, lon: 144.96, gridZone: "AU-VIC" },
  { provider: "aws", id: "ap-southeast-5", name: "Asia Pacific (Malaysia)", location: "Malaysia", country: "MY", lat: 3.14, lon: 101.69, gridZone: "MY-WM" },
  { provider: "aws", id: "ap-southeast-6", name: "Asia Pacific (New Zealand)", location: "New Zealand", country: "NZ", lat: -36.85, lon: 174.76, gridZone: "NZ" },
  { provider: "aws", id: "ap-southeast-7", name: "Asia Pacific (Thailand)", location: "Thailand", country: "TH", lat: 13.76, lon: 100.5, gridZone: "TH" },
  { provider: "aws", id: "ca-central-1", name: "Canada (Central)", location: "Canada (Central)", country: "CA", lat: 45.5, lon: -73.57, gridZone: "CA-QC" },
  { provider: "aws", id: "ca-west-1", name: "Canada West (Calgary)", location: "Calgary", country: "CA", lat: 51.05, lon: -114.07, gridZone: "CA-AB" },
  { provider: "aws", id: "eu-central-1", name: "Europe (Frankfurt)", location: "Frankfurt", country: "DE", lat: 50.11, lon: 8.68, gridZone: "DE" },
  { provider: "aws", id: "eu-central-2", name: "Europe (Zurich)", location: "Zurich", country: "CH", lat: 47.38, lon: 8.54, gridZone: "CH" },
  { provider: "aws", id: "eu-north-1", name: "Europe (Stockholm)", location: "Stockholm", country: "SE", lat: 59.33, lon: 18.07, gridZone: "SE-SE3" },
  { provider: "aws", id: "eu-south-1", name: "Europe (Milan)", location: "Milan", country: "IT", lat: 45.46, lon: 9.19, gridZone: "IT-NO" },
  { provider: "aws", id: "eu-south-2", name: "Europe (Spain)", location: "Spain", country: "ES", lat: 41.65, lon: -0.89, gridZone: "ES" },
  { provider: "aws", id: "eu-west-1", name: "Europe (Ireland)", location: "Ireland", country: "IE", lat: 53.35, lon: -6.26, gridZone: "IE" },
  { provider: "aws", id: "eu-west-2", name: "Europe (London)", location: "London", country: "GB", lat: 51.51, lon: -0.13, gridZone: "GB" },
  { provider: "aws", id: "eu-west-3", name: "Europe (Paris)", location: "Paris", country: "FR", lat: 48.86, lon: 2.35, gridZone: "FR" },
  { provider: "aws", id: "il-central-1", name: "Israel (Tel Aviv)", location: "Tel Aviv", country: "IL", lat: 32.09, lon: 34.78, gridZone: "IL" },
  { provider: "aws", id: "me-central-1", name: "Middle East (UAE)", location: "UAE", country: "AE", lat: 25.2, lon: 55.27, gridZone: "AE" },
  { provider: "aws", id: "me-south-1", name: "Middle East (Bahrain)", location: "Bahrain", country: "BH", lat: 26.23, lon: 50.59, gridZone: "BH" },
  { provider: "aws", id: "mx-central-1", name: "Mexico (Central)", location: "Mexico (Central)", country: "MX", lat: 20.59, lon: -100.39, gridZone: "MX" },
  { provider: "aws", id: "sa-east-1", name: "South America (São Paulo)", location: "São Paulo", country: "BR", lat: -23.55, lon: -46.63, gridZone: "BR-CS" },
];

const GCP: CloudRegion[] = [
  { provider: "gcp", id: "africa-south1", name: "africa-south1", location: "Johannesburg, South Africa", country: "ZA", lat: -26.2, lon: 28.05, gridZone: "ZA" },
  { provider: "gcp", id: "asia-east1", name: "asia-east1", location: "Changhua County, Taiwan", country: "TW", lat: 24.07, lon: 120.54, gridZone: "TW" },
  { provider: "gcp", id: "asia-east2", name: "asia-east2", location: "Hong Kong", country: "HK", lat: 22.32, lon: 114.17, gridZone: "HK" },
  { provider: "gcp", id: "asia-northeast1", name: "asia-northeast1", location: "Tokyo, Japan", country: "JP", lat: 35.68, lon: 139.69, gridZone: "JP-TK" },
  { provider: "gcp", id: "asia-northeast2", name: "asia-northeast2", location: "Osaka, Japan", country: "JP", lat: 34.69, lon: 135.5, gridZone: "JP-KN" },
  { provider: "gcp", id: "asia-northeast3", name: "asia-northeast3", location: "Seoul, South Korea", country: "KR", lat: 37.57, lon: 126.98, gridZone: "KR" },
  { provider: "gcp", id: "asia-south1", name: "asia-south1", location: "Mumbai, India", country: "IN", lat: 19.08, lon: 72.88, gridZone: "IN-WE" },
  { provider: "gcp", id: "asia-south2", name: "asia-south2", location: "Delhi, India", country: "IN", lat: 28.61, lon: 77.21, gridZone: "IN-NO" },
  { provider: "gcp", id: "asia-southeast1", name: "asia-southeast1", location: "Jurong West, Singapore", country: "SG", lat: 1.34, lon: 103.71, gridZone: "SG" },
  { provider: "gcp", id: "asia-southeast2", name: "asia-southeast2", location: "Jakarta, Indonesia", country: "ID", lat: -6.21, lon: 106.85, gridZone: "ID" },
  { provider: "gcp", id: "asia-southeast3", name: "asia-southeast3", location: "Bangkok, Thailand", country: "TH", lat: 13.76, lon: 100.5, gridZone: "TH" },
  { provider: "gcp", id: "australia-southeast1", name: "australia-southeast1", location: "Sydney, Australia", country: "AU", lat: -33.87, lon: 151.21, gridZone: "AU-NSW" },
  { provider: "gcp", id: "australia-southeast2", name: "australia-southeast2", location: "Melbourne, Australia", country: "AU", lat: -37.81, lon: 144.96, gridZone: "AU-VIC" },
  { provider: "gcp", id: "europe-central2", name: "europe-central2", location: "Warsaw, Poland", country: "PL", lat: 52.23, lon: 21.01, gridZone: "PL" },
  { provider: "gcp", id: "europe-north1", name: "europe-north1", location: "Hamina, Finland", country: "FI", lat: 60.57, lon: 27.2, gridZone: "FI" },
  { provider: "gcp", id: "europe-north2", name: "europe-north2", location: "Stockholm, Sweden", country: "SE", lat: 59.33, lon: 18.07, gridZone: "SE-SE3" },
  { provider: "gcp", id: "europe-southwest1", name: "europe-southwest1", location: "Madrid, Spain", country: "ES", lat: 40.42, lon: -3.7, gridZone: "ES" },
  { provider: "gcp", id: "europe-west1", name: "europe-west1", location: "St. Ghislain, Belgium", country: "BE", lat: 50.45, lon: 3.82, gridZone: "BE" },
  { provider: "gcp", id: "europe-west2", name: "europe-west2", location: "London, England", country: "GB", lat: 51.51, lon: -0.13, gridZone: "GB" },
  { provider: "gcp", id: "europe-west3", name: "europe-west3", location: "Frankfurt, Germany", country: "DE", lat: 50.11, lon: 8.68, gridZone: "DE" },
  { provider: "gcp", id: "europe-west4", name: "europe-west4", location: "Eemshaven, Netherlands", country: "NL", lat: 53.44, lon: 6.83, gridZone: "NL" },
  { provider: "gcp", id: "europe-west6", name: "europe-west6", location: "Zurich, Switzerland", country: "CH", lat: 47.38, lon: 8.54, gridZone: "CH" },
  { provider: "gcp", id: "europe-west8", name: "europe-west8", location: "Milan, Italy", country: "IT", lat: 45.46, lon: 9.19, gridZone: "IT-NO" },
  { provider: "gcp", id: "europe-west9", name: "europe-west9", location: "Paris, France", country: "FR", lat: 48.86, lon: 2.35, gridZone: "FR" },
  { provider: "gcp", id: "europe-west10", name: "europe-west10", location: "Berlin, Germany", country: "DE", lat: 52.52, lon: 13.4, gridZone: "DE" },
  { provider: "gcp", id: "europe-west12", name: "europe-west12", location: "Turin, Italy", country: "IT", lat: 45.07, lon: 7.69, gridZone: "IT-NO" },
  { provider: "gcp", id: "me-central1", name: "me-central1", location: "Doha, Qatar", country: "QA", lat: 25.29, lon: 51.53, gridZone: "QA" },
  { provider: "gcp", id: "me-central2", name: "me-central2", location: "Dammam, Saudi Arabia", country: "SA", lat: 26.43, lon: 50.1, gridZone: "SA" },
  { provider: "gcp", id: "me-west1", name: "me-west1", location: "Tel Aviv, Israel", country: "IL", lat: 32.09, lon: 34.78, gridZone: "IL" },
  { provider: "gcp", id: "northamerica-northeast1", name: "northamerica-northeast1", location: "Montréal, Québec", country: "CA", lat: 45.5, lon: -73.57, gridZone: "CA-QC" },
  { provider: "gcp", id: "northamerica-northeast2", name: "northamerica-northeast2", location: "Toronto, Ontario", country: "CA", lat: 43.65, lon: -79.38, gridZone: "CA-ON" },
  { provider: "gcp", id: "northamerica-south1", name: "northamerica-south1", location: "Queretaro, Mexico", country: "MX", lat: 20.59, lon: -100.39, gridZone: "MX" },
  { provider: "gcp", id: "southamerica-east1", name: "southamerica-east1", location: "Osasco, São Paulo, Brazil", country: "BR", lat: -23.53, lon: -46.79, gridZone: "BR-CS" },
  { provider: "gcp", id: "southamerica-west1", name: "southamerica-west1", location: "Santiago, Chile", country: "CL", lat: -33.45, lon: -70.67, gridZone: "CL-SEN" },
  { provider: "gcp", id: "us-central1", name: "us-central1", location: "Council Bluffs, Iowa", country: "US", lat: 41.26, lon: -95.86, gridZone: "US-MIDW-MISO" },
  {
    provider: "gcp", id: "us-east1", name: "us-east1", location: "Moncks Corner, South Carolina", country: "US", lat: 33.2, lon: -80.01, gridZone: "US-CAR-SC",
    gridZoneNote: "Assumes the Berkeley County campus is inside the Santee Cooper (South Carolina Public Service Authority) balancing area.",
  },
  { provider: "gcp", id: "us-east4", name: "us-east4", location: "Ashburn, Virginia", country: "US", lat: 39.04, lon: -77.49, gridZone: "US-MIDA-PJM" },
  { provider: "gcp", id: "us-east5", name: "us-east5", location: "Columbus, Ohio", country: "US", lat: 39.96, lon: -83.0, gridZone: "US-MIDA-PJM" },
  { provider: "gcp", id: "us-south1", name: "us-south1", location: "Dallas, Texas", country: "US", lat: 32.78, lon: -96.8, gridZone: "US-TEX-ERCO" },
  { provider: "gcp", id: "us-west1", name: "us-west1", location: "The Dalles, Oregon", country: "US", lat: 45.59, lon: -121.18, gridZone: "US-NW-BPAT" },
  {
    provider: "gcp", id: "us-west2", name: "us-west2", location: "Los Angeles, California", country: "US", lat: 34.05, lon: -118.24, gridZone: "US-CAL-LDWP",
    gridZoneNote: "Los Angeles is split between LADWP and CAISO (Southern California Edison) service areas. LADWP is assumed.",
  },
  { provider: "gcp", id: "us-west3", name: "us-west3", location: "Salt Lake City, Utah", country: "US", lat: 40.76, lon: -111.89, gridZone: "US-NW-PACE" },
  { provider: "gcp", id: "us-west4", name: "us-west4", location: "Las Vegas, Nevada", country: "US", lat: 36.17, lon: -115.14, gridZone: "US-NW-NEVP" },
];

const AZURE: CloudRegion[] = [
  { provider: "azure", id: "australiacentral", name: "Australia Central", location: "Canberra", country: "AU", lat: -35.28, lon: 149.13, gridZone: "AU-NSW" },
  { provider: "azure", id: "australiacentral2", name: "Australia Central 2", location: "Canberra", country: "AU", lat: -35.28, lon: 149.13, gridZone: "AU-NSW" },
  { provider: "azure", id: "australiaeast", name: "Australia East", location: "New South Wales", country: "AU", lat: -33.87, lon: 151.21, gridZone: "AU-NSW" },
  { provider: "azure", id: "australiasoutheast", name: "Australia Southeast", location: "Victoria", country: "AU", lat: -37.81, lon: 144.96, gridZone: "AU-VIC" },
  { provider: "azure", id: "austriaeast", name: "Austria East", location: "Vienna", country: "AT", lat: 48.21, lon: 16.37, gridZone: "AT" },
  { provider: "azure", id: "belgiumcentral", name: "Belgium Central", location: "Brussels", country: "BE", lat: 50.85, lon: 4.35, gridZone: "BE" },
  { provider: "azure", id: "brazilsouth", name: "Brazil South", location: "Sao Paulo State", country: "BR", lat: -23.55, lon: -46.63, gridZone: "BR-CS" },
  { provider: "azure", id: "brazilsoutheast", name: "Brazil Southeast", location: "Rio", country: "BR", lat: -22.91, lon: -43.17, gridZone: "BR-CS" },
  { provider: "azure", id: "canadacentral", name: "Canada Central", location: "Toronto", country: "CA", lat: 43.65, lon: -79.38, gridZone: "CA-ON" },
  { provider: "azure", id: "canadaeast", name: "Canada East", location: "Quebec", country: "CA", lat: 46.81, lon: -71.21, gridZone: "CA-QC" },
  { provider: "azure", id: "centralindia", name: "Central India", location: "Pune", country: "IN", lat: 18.52, lon: 73.86, gridZone: "IN-WE" },
  { provider: "azure", id: "centralus", name: "Central US", location: "Iowa", country: "US", lat: 41.59, lon: -93.62, gridZone: "US-MIDW-MISO" },
  { provider: "azure", id: "chilecentral", name: "Chile Central", location: "Santiago", country: "CL", lat: -33.45, lon: -70.67, gridZone: "CL-SEN" },
  { provider: "azure", id: "denmarkeast", name: "Denmark East", location: "Copenhagen", country: "DK", lat: 55.68, lon: 12.57, gridZone: "DK-DK2" },
  { provider: "azure", id: "eastasia", name: "East Asia", location: "Hong Kong", country: "HK", lat: 22.32, lon: 114.17, gridZone: "HK" },
  {
    provider: "azure", id: "eastus", name: "East US", location: "Virginia", country: "US", lat: 36.67, lon: -78.39, gridZone: "US-MIDA-PJM",
    gridZoneNote: "Assumes the southern Virginia campus (Boydton), inside the PJM Dominion zone.",
  },
  {
    provider: "azure", id: "eastus2", name: "East US 2", location: "Virginia", country: "US", lat: 36.67, lon: -78.39, gridZone: "US-MIDA-PJM",
    gridZoneNote: "Assumes the southern Virginia campus (Boydton), inside the PJM Dominion zone.",
  },
  { provider: "azure", id: "francecentral", name: "France Central", location: "Paris", country: "FR", lat: 48.86, lon: 2.35, gridZone: "FR" },
  { provider: "azure", id: "francesouth", name: "France South", location: "Marseille", country: "FR", lat: 43.3, lon: 5.37, gridZone: "FR" },
  { provider: "azure", id: "germanynorth", name: "Germany North", location: "Berlin", country: "DE", lat: 52.52, lon: 13.4, gridZone: "DE" },
  { provider: "azure", id: "germanywestcentral", name: "Germany West Central", location: "Frankfurt", country: "DE", lat: 50.11, lon: 8.68, gridZone: "DE" },
  { provider: "azure", id: "indiasouthcentral", name: "India South Central", location: "Hyderabad", country: "IN", lat: 17.39, lon: 78.49, gridZone: "IN-SO" },
  { provider: "azure", id: "indonesiacentral", name: "Indonesia Central", location: "Jakarta", country: "ID", lat: -6.21, lon: 106.85, gridZone: "ID" },
  { provider: "azure", id: "israelcentral", name: "Israel Central", location: "Israel", country: "IL", lat: 32.09, lon: 34.78, gridZone: "IL" },
  { provider: "azure", id: "italynorth", name: "Italy North", location: "Milan", country: "IT", lat: 45.46, lon: 9.19, gridZone: "IT-NO" },
  { provider: "azure", id: "japaneast", name: "Japan East", location: "Tokyo, Saitama", country: "JP", lat: 35.68, lon: 139.69, gridZone: "JP-TK" },
  { provider: "azure", id: "japanwest", name: "Japan West", location: "Osaka", country: "JP", lat: 34.69, lon: 135.5, gridZone: "JP-KN" },
  { provider: "azure", id: "koreacentral", name: "Korea Central", location: "Seoul", country: "KR", lat: 37.57, lon: 126.98, gridZone: "KR" },
  { provider: "azure", id: "koreasouth", name: "Korea South", location: "Busan", country: "KR", lat: 35.18, lon: 129.08, gridZone: "KR" },
  { provider: "azure", id: "malaysiawest", name: "Malaysia West", location: "Kuala Lumpur", country: "MY", lat: 3.14, lon: 101.69, gridZone: "MY-WM" },
  { provider: "azure", id: "mexicocentral", name: "Mexico Central", location: "Querétaro State", country: "MX", lat: 20.59, lon: -100.39, gridZone: "MX" },
  { provider: "azure", id: "newzealandnorth", name: "New Zealand North", location: "Auckland", country: "NZ", lat: -36.85, lon: 174.76, gridZone: "NZ" },
  { provider: "azure", id: "northcentralus", name: "North Central US", location: "Illinois", country: "US", lat: 41.88, lon: -87.63, gridZone: "US-MIDA-PJM" },
  { provider: "azure", id: "northeurope", name: "North Europe", location: "Ireland", country: "IE", lat: 53.35, lon: -6.26, gridZone: "IE" },
  {
    provider: "azure", id: "norwayeast", name: "Norway East", location: "Norway", country: "NO", lat: 59.91, lon: 10.75, gridZone: "NO-NO1",
    gridZoneNote: "Assumes the Oslo area, in bidding zone NO1.",
  },
  {
    provider: "azure", id: "norwaywest", name: "Norway West", location: "Norway", country: "NO", lat: 58.97, lon: 5.73, gridZone: "NO-NO2",
    gridZoneNote: "Assumes the Stavanger area, in bidding zone NO2.",
  },
  { provider: "azure", id: "polandcentral", name: "Poland Central", location: "Warsaw", country: "PL", lat: 52.23, lon: 21.01, gridZone: "PL" },
  { provider: "azure", id: "qatarcentral", name: "Qatar Central", location: "Doha", country: "QA", lat: 25.29, lon: 51.53, gridZone: "QA" },
  { provider: "azure", id: "southafricanorth", name: "South Africa North", location: "Johannesburg", country: "ZA", lat: -26.2, lon: 28.05, gridZone: "ZA" },
  { provider: "azure", id: "southafricawest", name: "South Africa West", location: "Cape Town", country: "ZA", lat: -33.92, lon: 18.42, gridZone: "ZA" },
  { provider: "azure", id: "southcentralus", name: "South Central US", location: "Texas", country: "US", lat: 29.42, lon: -98.49, gridZone: "US-TEX-ERCO" },
  { provider: "azure", id: "southeastasia", name: "Southeast Asia", location: "Singapore", country: "SG", lat: 1.35, lon: 103.82, gridZone: "SG" },
  { provider: "azure", id: "southindia", name: "South India", location: "Chennai", country: "IN", lat: 13.08, lon: 80.27, gridZone: "IN-SO" },
  { provider: "azure", id: "spaincentral", name: "Spain Central", location: "Madrid", country: "ES", lat: 40.42, lon: -3.7, gridZone: "ES" },
  {
    provider: "azure", id: "swedencentral", name: "Sweden Central", location: "Gävle", country: "SE", lat: 60.67, lon: 17.14, gridZone: "SE-SE3",
    gridZoneNote: "Assumes the Gävle and Sandviken campuses are in bidding zone SE3, close to the SE2 border.",
  },
  { provider: "azure", id: "switzerlandnorth", name: "Switzerland North", location: "Zurich", country: "CH", lat: 47.38, lon: 8.54, gridZone: "CH" },
  { provider: "azure", id: "switzerlandwest", name: "Switzerland West", location: "Geneva", country: "CH", lat: 46.2, lon: 6.14, gridZone: "CH" },
  { provider: "azure", id: "uaecentral", name: "UAE Central", location: "Abu Dhabi", country: "AE", lat: 24.45, lon: 54.38, gridZone: "AE" },
  { provider: "azure", id: "uaenorth", name: "UAE North", location: "Dubai", country: "AE", lat: 25.2, lon: 55.27, gridZone: "AE" },
  { provider: "azure", id: "uksouth", name: "UK South", location: "London", country: "GB", lat: 51.51, lon: -0.13, gridZone: "GB" },
  { provider: "azure", id: "ukwest", name: "UK West", location: "Cardiff", country: "GB", lat: 51.48, lon: -3.18, gridZone: "GB" },
  {
    provider: "azure", id: "westcentralus", name: "West Central US", location: "Wyoming", country: "US", lat: 41.14, lon: -104.82, gridZone: "US-NW-WACM",
    gridZoneNote: "Assumes the Cheyenne campus, inside the Western Area Power Administration Colorado-Missouri (WACM) balancing area.",
  },
  { provider: "azure", id: "westeurope", name: "West Europe", location: "Netherlands", country: "NL", lat: 52.37, lon: 4.9, gridZone: "NL" },
  { provider: "azure", id: "westindia", name: "West India", location: "Mumbai", country: "IN", lat: 19.08, lon: 72.88, gridZone: "IN-WE" },
  {
    provider: "azure", id: "westus", name: "West US", location: "California", country: "US", lat: 37.77, lon: -122.42, gridZone: "US-CAL-CISO",
    gridZoneNote: "Assumes a San Francisco Bay Area location inside CAISO.",
  },
  {
    provider: "azure", id: "westus2", name: "West US 2", location: "Washington", country: "US", lat: 47.23, lon: -119.85, gridZone: "US-NW-GCPD",
    gridZoneNote: "Assumes the Quincy campus, served by Grant County PUD.",
  },
  {
    provider: "azure", id: "westus3", name: "West US 3", location: "Phoenix", country: "US", lat: 33.45, lon: -112.07, gridZone: "US-SW-AZPS",
    gridZoneNote: "Assumes the West Valley campuses (Goodyear, El Mirage), served by Arizona Public Service. Parts of Phoenix are in the SRP area instead.",
  },
];

export const REGIONS: readonly CloudRegion[] = [...AWS, ...GCP, ...AZURE];
