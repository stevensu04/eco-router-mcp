import { readFileSync } from "node:fs";

export const EMBER_CSV_URL =
  "https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_yearly_global.csv";

export type EmberRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

/** Loads Ember's yearly CSV from a local path, or downloads it. */
export async function loadEmberRows(path?: string): Promise<EmberRow[]> {
  let text: string;
  if (path) {
    text = readFileSync(path, "utf8");
  } else {
    console.error(`Downloading ${EMBER_CSV_URL}`);
    const res = await fetch(EMBER_CSV_URL);
    if (!res.ok) throw new Error(`Ember download failed: ${res.status} ${res.statusText}`);
    text = await res.text();
  }

  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const columns = parseCsvLine(header!);
  for (const required of ["ISO 3 code", "Year", "Area type", "Electricity source", "Is aggregated source", "Generation (TWh)", "Emissions (MtCO2e)", "Emissions intensity (gCO2e/kWh)"]) {
    if (!columns.includes(required)) throw new Error(`Ember CSV is missing column "${required}"`);
  }
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? ""]));
  });
}
