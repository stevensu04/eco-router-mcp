/**
 * Regenerates src/data/zone-baseline/ca-nir.ts with annual carbon intensity
 * for Canadian provinces, from Canada's National Inventory Report, Annex 7
 * (Electricity in Canada: Summary and Intensity Tables).
 *
 *   npm run update:canada
 *   npm run update:canada -- --annex EN_Annex7_Electricity_Intensity.xlsx --ember release_generation_yearly_global.csv
 *
 * Like the eGRID script, it takes each province's generation by fuel and
 * applies Ember's Canadian lifecycle factors for the same year, then checks
 * the method against Ember's national figure.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { REGIONS } from "../src/data/regions.js";
import { loadEmberRows } from "./lib/ember.js";
import { blendedFactor, checkNational, emberCountryYear, mixIntensity } from "./lib/lifecycle.js";
import { readSheet, sheetNames } from "./lib/xlsx.js";

const ANNEX_URL =
  "https://data-donnees.az.ec.gc.ca/api/file?path=" +
  encodeURIComponent(
    "/substances/monitor/canada-s-official-greenhouse-gas-inventory/C-Tables-Electricity-Canada-Provinces-Territories/EN_Annex7_Electricity_Intensity.xlsx",
  );
const OUTPUT = fileURLToPath(new URL("../src/data/zone-baseline/ca-nir.ts", import.meta.url));

// Province name as it appears in the Annex 7 sheet titles -> Electricity Maps zone key.
const PROVINCE_ZONES: Record<string, string> = {
  "Newfoundland and Labrador": "CA-NL",
  "Prince Edward Island": "CA-PE",
  "Nova Scotia": "CA-NS",
  "New Brunswick": "CA-NB",
  Quebec: "CA-QC",
  Ontario: "CA-ON",
  Manitoba: "CA-MB",
  Saskatchewan: "CA-SK",
  Alberta: "CA-AB",
  "British Columbia": "CA-BC",
  Yukon: "CA-YT",
  "the Northwest Territories": "CA-NT",
  "the Nunavut": "CA-NU",
};

const { values } = parseArgs({ options: { annex: { type: "string" }, ember: { type: "string" } } });

async function annexPath(): Promise<string> {
  if (values.annex) return values.annex;
  console.error(`Downloading ${ANNEX_URL}`);
  const res = await fetch(ANNEX_URL);
  if (!res.ok) throw new Error(`Annex 7 download failed: ${res.status} ${res.statusText}`);
  const path = join(mkdtempSync(join(tmpdir(), "nir-")), "annex7.xlsx");
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

interface AnnexTable {
  area: string;
  /** Generation in GWh for the chosen year, keyed by row label without footnote letters. */
  generation: Map<string, number>;
  /** The report's own direct (combustion) generation intensity, g CO2 eq/kWh. */
  directIntensity: number;
}

/** Row labels carry footnote letters, e.g. "Other Renewablesk". */
function matchesLabel(cell: string, label: string): boolean {
  return cell === label || new RegExp(`^${label}[a-z,]+$`).test(cell);
}

const GENERATION_ROWS = ["Coal", "Natural Gas", "Other Fuels", "Nuclear", "Hydro", "Other Renewables", "Other Generation", "Overall Total"];

function readTable(path: string, sheet: string, year: number): AnnexTable {
  const rows = readSheet(path, sheet);
  const title = rows[0]?.find((c) => c.includes("Electricity Generation and GHG Emission Details for")) ?? "";
  const area = title.replace(/^.*Details for /, "").trim();
  const header = rows.find((r) => r.some((c) => /^\d{4}$/.test(c)))!;
  const column = header.findIndex((c) => c === String(year));
  if (column < 0) throw new Error(`${sheet} has no ${year} column`);

  // Generation rows follow the "Electricity Generation" heading; the rows above it are emissions.
  // Match the heading exactly (plus footnote letters), not the sheet title that also contains the phrase.
  const start = rows.findIndex((r) => r.some((c) => matchesLabel(c, "Electricity Generation")));
  if (start < 0) throw new Error(`${sheet} has no Electricity Generation section`);
  const generation = new Map<string, number>();
  for (const row of rows.slice(start)) {
    const label = row.find((c) => c !== "") ?? "";
    const key = GENERATION_ROWS.find((l) => matchesLabel(label, l));
    if (key && !generation.has(key)) generation.set(key, Number(row[column] || 0));
    if (key === "Overall Total") break;
  }
  const directRow = rows.find((r) => r.some((c) => c.startsWith("Generation Intensity (g CO2 eq / kWh)")));
  const directIntensity = Number(directRow?.[column]);
  if (!Number.isFinite(directIntensity)) throw new Error(`${sheet} has no generation intensity for ${year}`);
  return { area, generation, directIntensity };
}

const path = await annexPath();
const tables = sheetNames(path).filter((s) => /^Table A7/.test(s));

// Latest year that is final: preliminary columns carry a letter, e.g. "2024a".
const firstHeader = readSheet(path, tables[0]!).find((r) => r.some((c) => /^\d{4}$/.test(c)))!;
const year = Math.max(...firstHeader.filter((c) => /^\d{4}$/.test(c)).map(Number));

const all = tables.map((sheet) => readTable(path, sheet, year));
const national = all.find((t) => t.area === "Canada");
if (!national) throw new Error("Annex 7 has no national table");

const ember = emberCountryYear(await loadEmberRows(values.ember), "CAN", year);
const f = (source: string) => {
  const value = ember.factors.get(source);
  if (value === undefined) throw new Error(`No Ember Canada factor for ${source}`);
  return value;
};

const g = (t: AnnexTable, row: string) => t.generation.get(row) ?? 0;
// Provincial tables only report "Other Fuels" as a whole: diesel, fuel oil,
// petroleum coke, biomass and more. Its mix varies too much between provinces
// (diesel-heavy territories, biomass-heavy mills) for a national split, so use
// the fossil factor, which never understates.
const otherFuelsFactor = f("Other fossil");
// "Other Renewables" is wind, solar and tidal combined.
const otherRenewablesFactor = blendedFactor(ember, ["Wind", "Solar", "Other renewables"]);

function intensity(t: AnnexTable): number {
  return mixIntensity([
    { generation: g(t, "Coal"), factor: f("Coal") },
    { generation: g(t, "Natural Gas"), factor: f("Gas") },
    { generation: g(t, "Other Fuels"), factor: otherFuelsFactor },
    { generation: g(t, "Nuclear"), factor: f("Nuclear") },
    { generation: g(t, "Hydro"), factor: f("Hydro") },
    { generation: g(t, "Other Renewables"), factor: otherRenewablesFactor },
    // Unclassified generation (mostly waste-heat steam); treated as fossil to avoid understating.
    { generation: g(t, "Other Generation"), factor: f("Other fossil") },
  ]);
}

// Annex 7 covers only main-activity producers (NAICS 22111). Ember also counts
// industrial autoproducers, mostly gas cogeneration and industrial hydro, which
// adds roughly 80 TWh in 2023. The national figures therefore differ by more
// than the 5% used for eGRID, so allow 15% here and rely on the per-table
// check below to catch mapping mistakes.
const nationalIntensity = intensity(national);
const deviation = checkNational(`Canada ${year} (NIR Annex 7)`, nationalIntensity, ember.intensity, 0.15);

const zones = [...new Set(REGIONS.filter((r) => r.country === "CA").map((r) => r.gridZone))].sort();
const published = zones.map((zone) => {
  const province = Object.entries(PROVINCE_ZONES).find(([, z]) => z === zone)?.[0];
  const table = province && all.find((t) => t.area === province);
  if (!table) throw new Error(`Annex 7 has no table for zone ${zone}`);
  return { zone, table };
});

// Lifecycle intensity includes upstream emissions, so it should not fall below
// the report's direct combustion intensity. A missing or misread fuel would
// break this. Only published provinces and the national table are checked:
// small diesel grids in the territories burn fuel less efficiently than the
// national factor assumes, so they sit right at the limit.
for (const table of [national, ...published.map((p) => p.table)]) {
  const lifecycle = intensity(table);
  if (lifecycle < table.directIntensity) {
    throw new Error(`${table.area}: lifecycle ${lifecycle.toFixed(1)} is below direct ${table.directIntensity.toFixed(1)}; check the fuel mapping.`);
  }
  console.error(`${table.area} ${year}: lifecycle ${lifecycle.toFixed(1)}, direct ${table.directIntensity.toFixed(1)}`);
}

const entries = published.map(
  ({ zone, table }) => `  "${zone}": { intensity: ${Math.round(intensity(table) * 10) / 10}, year: ${year} },`,
);

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  OUTPUT,
  `// Generated by scripts/update-canada.ts on ${today}. Do not edit by hand.
//
// Sources: Environment and Climate Change Canada, National Inventory Report,
// Annex 7: Electricity in Canada: Summary and Intensity Tables
// (https://data-donnees.az.ec.gc.ca/data/substances/monitor/canada-s-official-greenhouse-gas-inventory/),
// provincial generation by fuel. Contains information licensed under the Open
// Government Licence - Canada (https://open.canada.ca/en/open-government-licence-canada).
// Ember Yearly Electricity Data (https://ember-energy.org/data/yearly-electricity-data/,
// CC BY 4.0) supplies Canadian lifecycle emissions factors for ${year}.
// Changes: intensity = sum(generation by fuel x Ember Canada factor) / generation,
// rounded to 0.1 gCO2e/kWh. Check: the same method on the national table gives
// ${nationalIntensity.toFixed(1)} against Ember's ${ember.intensity} (${deviation >= 0 ? "+" : ""}${(deviation * 100).toFixed(1)}%). The gap comes from
// scope: Annex 7 covers main-activity producers only, while Ember also counts
// industrial autoproducers.

export const CA_NIR_SOURCE = {
  name: "Environment and Climate Change Canada, National Inventory Report Annex 7, lifecycle-adjusted with Ember factors",
  url: "https://data-donnees.az.ec.gc.ca/data/substances/monitor/canada-s-official-greenhouse-gas-inventory/",
  license: "Open Government Licence - Canada (NIR); CC BY 4.0 (Ember factors)",
  retrieved: "${today}",
} as const;

/** Annual lifecycle emissions intensity of generation, gCO2e/kWh, by Electricity Maps zone key. */
export const CA_NIR_ZONES: Readonly<Record<string, { intensity: number; year: number }>> = {
${entries.join("\n")}
};
`,
);
console.error(`Wrote ${entries.length} zones to ${OUTPUT}`);
