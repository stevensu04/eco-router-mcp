# Region dataset

`src/data/regions.ts` lists every public region of AWS, Google Cloud and
Azure, with the electricity grid zone each one draws power from.

Checked against the official lists on 2026-09-17: 34 AWS, 43 Google Cloud and
57 Azure regions, 134 in total. Government, sovereign and China regions are
not included.

## Sources

| Field | Source |
|---|---|
| AWS region codes and names | [AWS Regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html) |
| Google Cloud regions and locations | [Regions and zones](https://cloud.google.com/compute/docs/regions-zones) |
| Azure regions and physical locations | [Azure regions list](https://learn.microsoft.com/en-us/azure/reliability/regions-list) |
| Grid zone keys | [Electricity Maps zone configs](https://github.com/electricitymaps/electricitymaps-contrib/tree/master/config/zones) |

`name` and `location` copy the provider's wording. Coordinates are metro-level
approximations, used only to estimate latency.

## How grid zones are assigned

Most countries are a single Electricity Maps zone, so the mapping follows
directly from the country (for example `DE`, `FR`, `SG`).

Some countries are split into several zones, and the mapping depends on where
the datacenters are:

| Country | Split by | Example |
|---|---|---|
| United States | Balancing authority | `us-east-1` (Northern Virginia) is in `US-MIDA-PJM` |
| Canada, Australia | Province or state | `ca-west-1` (Calgary) is in `CA-AB` |
| Japan, India | Regional grid | `ap-northeast-3` (Osaka) is in `JP-KN` |
| Sweden, Norway, Denmark, Italy | Electricity market bidding zone | `eu-north-1` (Stockholm) is in `SE-SE3` |
| Brazil, Chile, Malaysia | National subsystem | `sa-east-1` (São Paulo) is in `BR-CS` |

## Assumptions

For 12 regions, the provider does not publish a location precise enough to
settle the zone. Each one has a `gridZoneNote`, which is passed on to agents:

| Region | Zone | Assumption |
|---|---|---|
| aws/us-west-2 | `US-NW-BPAT` | Eastern Oregon campuses, in the BPA balancing area |
| gcp/us-east1 | `US-CAR-SC` | Berkeley County campus, in the Santee Cooper balancing area |
| gcp/us-west2 | `US-CAL-LDWP` | LADWP rather than CAISO (Southern California Edison) |
| azure/eastus, azure/eastus2 | `US-MIDA-PJM` | Boydton, Virginia, in the PJM Dominion zone |
| azure/westus | `US-CAL-CISO` | San Francisco Bay Area |
| azure/westus2 | `US-NW-GCPD` | Quincy, Washington, served by Grant County PUD |
| azure/westus3 | `US-SW-AZPS` | West Valley campuses served by Arizona Public Service, not SRP |
| azure/westcentralus | `US-NW-WACM` | Cheyenne, in the WACM balancing area |
| azure/norwayeast | `NO-NO1` | Oslo area |
| azure/norwaywest | `NO-NO2` | Stavanger area |
| azure/swedencentral | `SE-SE3` | Gävle and Sandviken, close to the SE2 border |

## Corrections

If you know a mapping is wrong, open an issue or pull request with a public
source, such as a utility announcement, a provider sustainability report or a
planning filing. Update the entry and its `gridZoneNote`, and remove the note
once the location is confirmed.

When a provider adds a region, add it to the matching provider list and run
`npm test`.
