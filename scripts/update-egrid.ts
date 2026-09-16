/**
 * Regenerates src/data/zone-baseline-intensity.ts with annual carbon intensity
 * for US grid zones, from EPA eGRID balancing authority data.
 *
 *   npm run update:egrid
 *   npm run update:egrid -- --egrid egrid2023_data_rev2.xlsx --ember release_generation_yearly_global.csv
 *
 * eGRID reports direct combustion emissions. To stay comparable with the
 * Ember country averages, this script uses each balancing authority's
 * generation mix and applies Ember's US lifecycle factors for the same year.
 * It checks the method against Ember's US national figure and fails if they
 * differ by more than 5%.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { REGIONS } from "../src/data/regions.js";
import { loadEmberRows } from "./lib/ember.js";
import { readSheet, sheetNames } from "./lib/xlsx.js";

// Latest official release. EPA paused eGRID after this edition.
const EGRID_URL = "https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_rev2.xlsx";
const EGRID_EDITION = "eGRID2023 (Revision 2)";
const OUTPUT = fileURLToPath(new URL("../src/data/zone-baseline-intensity.ts", import.meta.url));
const MAX_NATIONAL_DEVIATION = 0.05;

// eGRID annual net generation columns (suffix after BAGEN / USGEN) -> Ember source.
const FUEL_COLUMNS: Record<string, string> = {
  ACL: "Coal",
  AGS: "Gas",
  AOL: "Other fossil",
  AOF: "Other fossil",
  AOP: "Other fossil",
  ANC: "Nuclear",
  AHY: "Hydro",
  ABM: "Bioenergy",
  AWI: "Wind",
  ASO: "Solar",
  AGT: "Other renewables",
};

const { values } = parseArgs({ options: { egrid: { type: "string" }, ember: { type: "string" } } });

async function egridPath(): Promise<string> {
  if (values.egrid) return values.egrid;
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  console.error(`Downloading ${EGRID_URL}`);
  const res = await fetch(EGRID_URL);
  if (!res.ok) throw new Error(`eGRID download failed: ${res.status} ${res.statusText}`);
  const path = join(mkdtempSync(join(tmpdir(), "egrid-")), "egrid.xlsx");
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

/** Rows keyed by eGRID's short column codes, which sit on the second header row. */
function keyedRows(path: string, prefix: "BA" | "US"): Record<string, string>[] {
  const name = sheetNames(path).find((s) => new RegExp(`^${prefix}\\d{2}$`).test(s));
  if (!name) throw new Error(`No ${prefix} sheet in ${path}`);
  const [, codes, ...rows] = readSheet(path, name);
  return rows.map((r) => Object.fromEntries(codes!.map((c, i) => [c, r[i] ?? ""])));
}

function lifecycleIntensity(row: Record<string, string>, prefix: "BAGEN" | "USGEN", factors: Map<string, number>): number {
  let emissions = 0;
  let generation = 0;
  for (const [suffix, source] of Object.entries(FUEL_COLUMNS)) {
    const mwh = Number(row[prefix + suffix] || 0);
    // Pumped storage can be net negative; it is a load, not a source.
    if (!(mwh > 0)) continue;
    const factor = factors.get(source);
    if (factor === undefined) throw new Error(`No Ember US factor for ${source}`);
    emissions += mwh * factor;
    generation += mwh;
  }
  if (generation === 0) throw new Error("No generation in row");
  return emissions / generation;
}

const path = await egridPath();
const baRows = keyedRows(path, "BA");
const usRow = keyedRows(path, "US")[0]!;
const year = Number(usRow.YEAR);

const ember = await loadEmberRows(values.ember);
const usYear = ember.filter((r) => r["ISO 3 code"] === "USA" && Number(r.Year) === year);
const factors = new Map<string, number>();
for (const r of usYear) {
  const twh = Number(r["Generation (TWh)"]);
  if (r["Is aggregated source"] === "False" && twh > 0 && r["Electricity source"] !== "Net imports") {
    factors.set(r["Electricity source"]!, (Number(r["Emissions (MtCO2e)"]) / twh) * 1000);
  }
}
const emberNational = Number(usYear.find((r) => r["Electricity source"] === "Total generation")?.["Emissions intensity (gCO2e/kWh)"]);
if (!Number.isFinite(emberNational)) throw new Error(`Ember has no US total for ${year}`);

const egridNational = lifecycleIntensity(usRow, "USGEN", factors);
const deviation = egridNational / emberNational - 1;
console.error(`US ${year}: eGRID mix with Ember factors ${egridNational.toFixed(1)} vs Ember ${emberNational} (${(deviation * 100).toFixed(1)}%)`);
if (Math.abs(deviation) > MAX_NATIONAL_DEVIATION) {
  throw new Error("National check failed; review the fuel mapping before publishing new values.");
}

const zones = [...new Set(REGIONS.filter((r) => r.country === "US").map((r) => r.gridZone))].sort();
const entries = zones.map((zone) => {
  // Electricity Maps US zone keys end with the EIA balancing authority code.
  const code = zone.split("-").at(-1)!;
  const row = baRows.find((r) => r.BACODE === code);
  if (!row) throw new Error(`eGRID has no balancing authority ${code} for zone ${zone}`);
  const intensity = Math.round(lifecycleIntensity(row, "BAGEN", factors) * 10) / 10;
  return `  "${zone}": { intensity: ${intensity}, year: ${year} },`;
});

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  OUTPUT,
  `// Generated by scripts/update-egrid.ts on ${today}. Do not edit by hand.
//
// Sources: US EPA ${EGRID_EDITION} balancing authority net generation by fuel
// (https://www.epa.gov/egrid, public domain), and Ember Yearly Electricity Data
// (https://ember-energy.org/data/yearly-electricity-data/, CC BY 4.0) for US
// lifecycle emissions factors in ${year}.
// Changes: intensity = sum(generation by fuel x Ember US factor) / generation,
// rounded to 0.1 gCO2e/kWh. Check: the same method on eGRID's US total gives
// ${egridNational.toFixed(1)} against Ember's ${emberNational} (${deviation >= 0 ? "+" : ""}${(deviation * 100).toFixed(1)}%).

export const ZONE_BASELINE_SOURCE = {
  name: "US EPA ${EGRID_EDITION}, lifecycle-adjusted with Ember factors",
  url: "https://www.epa.gov/egrid",
  license: "Public domain (eGRID); CC BY 4.0 (Ember factors)",
  retrieved: "${today}",
} as const;

/** Annual lifecycle emissions intensity of generation, gCO2e/kWh, by Electricity Maps zone key. */
export const ZONE_BASELINE_INTENSITY: Readonly<Record<string, { intensity: number; year: number }>> = {
${entries.join("\n")}
};
`,
);
console.error(`Wrote ${entries.length} zones to ${OUTPUT}`);
