import { expandCountries } from "../data/countryGroups.js";
import { type CloudProvider, type CloudRegion, REGIONS } from "../data/regions.js";

export interface RegionFilter {
  /** Explicit regions as "provider/id" (e.g. "aws/eu-north-1") or a bare region id. */
  regions?: string[];
  providers?: CloudProvider[];
  /** ISO alpha-2 codes or groups such as "EU". */
  countries?: string[];
}

/** Resolves filters to regions. All given filters must match. */
export function selectRegions(filter: RegionFilter, all: readonly CloudRegion[] = REGIONS): CloudRegion[] {
  const countries = filter.countries && expandCountries(filter.countries);
  const explicit = filter.regions?.map((ref) => resolveRegion(ref, all));
  return (explicit ?? all).filter(
    (r) =>
      (!filter.providers?.length || filter.providers.includes(r.provider)) &&
      (!countries?.length || countries.includes(r.country)),
  );
}

function resolveRegion(ref: string, all: readonly CloudRegion[]): CloudRegion {
  const trimmed = ref.trim();
  const [first, second] = trimmed.split("/");
  const matches = second === undefined
    ? all.filter((r) => r.id === first)
    : all.filter((r) => r.provider === first?.toLowerCase() && r.id === second);
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(`Region "${ref}" is ambiguous; use provider/id, e.g. ${matches.map((r) => `${r.provider}/${r.id}`).join(" or ")}.`);
  }
  throw new Error(`Unknown region "${ref}". Use list_regions to see valid ids, written as provider/id (e.g. aws/eu-north-1).`);
}
