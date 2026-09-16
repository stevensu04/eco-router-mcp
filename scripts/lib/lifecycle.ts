import type { EmberRow } from "./ember.js";

/** Ember's figures for one country and year, keyed by Ember "Electricity source". */
export interface EmberCountryYear {
  /** Implied lifecycle factor per source, gCO2e/kWh. */
  factors: Map<string, number>;
  generationTwh: Map<string, number>;
  emissionsMt: Map<string, number>;
  /** Ember's published intensity for total generation, gCO2e/kWh. */
  intensity: number;
}

export function emberCountryYear(rows: readonly EmberRow[], iso3: string, year: number): EmberCountryYear {
  const matching = rows.filter((r) => r["ISO 3 code"] === iso3 && Number(r.Year) === year);
  const result: EmberCountryYear = { factors: new Map(), generationTwh: new Map(), emissionsMt: new Map(), intensity: NaN };
  for (const r of matching) {
    const source = r["Electricity source"]!;
    if (source === "Total generation") result.intensity = Number(r["Emissions intensity (gCO2e/kWh)"]);
    const twh = Number(r["Generation (TWh)"]);
    if (r["Is aggregated source"] !== "False" || source === "Net imports" || !(twh > 0)) continue;
    const mt = Number(r["Emissions (MtCO2e)"]);
    result.generationTwh.set(source, twh);
    result.emissionsMt.set(source, mt);
    result.factors.set(source, (mt / twh) * 1000);
  }
  if (!Number.isFinite(result.intensity) || result.factors.size === 0) {
    throw new Error(`Ember has no data for ${iso3} in ${year}`);
  }
  return result;
}

/** Generation-weighted factor across several Ember sources, gCO2e/kWh. */
export function blendedFactor(ember: EmberCountryYear, sources: readonly string[]): number {
  let mt = 0;
  let twh = 0;
  for (const s of sources) {
    mt += ember.emissionsMt.get(s) ?? 0;
    twh += ember.generationTwh.get(s) ?? 0;
  }
  if (twh === 0) throw new Error(`Ember has no generation for ${sources.join(", ")}`);
  return (mt / twh) * 1000;
}

/**
 * Lifecycle intensity of a generation mix, gCO2e/kWh. Each entry pairs an
 * amount of generation (any unit) with its factor. Non-positive generation,
 * such as net pumped storage, is ignored.
 */
export function mixIntensity(mix: readonly { generation: number; factor: number }[]): number {
  let emissions = 0;
  let generation = 0;
  for (const { generation: g, factor } of mix) {
    if (!(g > 0)) continue;
    emissions += g * factor;
    generation += g;
  }
  if (generation === 0) throw new Error("Mix has no generation");
  return emissions / generation;
}

/** Fails when a method applied to national data drifts from Ember's own figure. */
export function checkNational(label: string, computed: number, ember: number, maxDeviation = 0.05): number {
  const deviation = computed / ember - 1;
  console.error(`${label}: mix with Ember factors ${computed.toFixed(1)} vs Ember ${ember} (${(deviation * 100).toFixed(1)}%)`);
  if (Math.abs(deviation) > maxDeviation) {
    throw new Error(`${label}: national check failed; review the fuel mapping before publishing new values.`);
  }
  return deviation;
}
