/**
 * Country groups that can stand in for a list of ISO 3166-1 alpha-2 codes,
 * mainly for data residency rules. Membership as of September 2026.
 */

const EU = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

export const COUNTRY_GROUPS: Readonly<Record<string, readonly string[]>> = {
  /** European Union member states. */
  EU,
  /** European Economic Area: the EU plus Iceland, Liechtenstein and Norway. */
  EEA: [...EU, "IS", "LI", "NO"],
};

/**
 * Expands group names into member countries and upper-cases everything.
 * Throws on anything that is neither a two-letter code nor a known group.
 */
export function expandCountries(codes: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    const group = COUNTRY_GROUPS[code];
    if (group) {
      for (const member of group) out.add(member);
    } else if (/^[A-Z]{2}$/.test(code)) {
      out.add(code);
    } else {
      throw new Error(
        `Unknown country or group "${raw}". Use ISO 3166-1 alpha-2 codes or one of: ${Object.keys(COUNTRY_GROUPS).join(", ")}.`,
      );
    }
  }
  return [...out];
}
