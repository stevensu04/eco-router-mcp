# How ranking works

`rank_regions` runs in four stages.

1. **Filter.** Keep regions that match `providers` and `countries`.
2. **Look up carbon.** Get a carbon intensity reading for each remaining
   region (see [Carbon data](#carbon-data)).
3. **Apply hard limits.** Drop regions above `maxCarbonIntensity`, or above
   `maxLatencyMs` when an `origin` is given. The response counts how many
   regions each limit excluded.
4. **Score.** Normalise carbon and latency across the regions that are left,
   so the best value scores 1 and the worst scores 0, then combine them:

   ```
   score = 100 × (carbonWeight × carbonScore + (1 − carbonWeight) × latencyScore)
   ```

   `carbonWeight` defaults to 0.7. Without an `origin`, ranking uses carbon
   only. Ties are broken by lower carbon, then lower latency, then region id.

Scores are relative to the candidate set. A score of 100 means "best of these
candidates", not "zero carbon".

## Carbon data

Without a token, each region uses the most specific annual average available.
With a token, live data is used and the annual average becomes the fallback.

| | US grid average | National average | Live (with a token) |
|---|---|---|---|
| Used for | US regions | All other regions | Every region, when available |
| Source | [US EPA eGRID](https://www.epa.gov/egrid) generation mix, with Ember lifecycle factors | [Ember Yearly Electricity Data](https://ember-energy.org/data/yearly-electricity-data/) | [Electricity Maps API](https://www.electricitymaps.com/) `carbon-intensity/latest` |
| Granularity | Balancing authority, annual | Country, latest year | Grid zone, hourly |
| Emissions scope | Lifecycle, gCO2e/kWh | Lifecycle, gCO2e/kWh | Lifecycle, gCO2e/kWh (API default) |
| Setup | None, shipped in the package | None, shipped in the package | `ELECTRICITY_MAPS_API_TOKEN` |
| License | Public domain (eGRID), CC BY 4.0 (Ember factors) | CC BY 4.0 | Your Electricity Maps plan: free for academic and personal non-commercial use, paid for commercial use |

All three report lifecycle emissions, so they can be compared. They still
differ in two ways. The annual averages describe electricity **generated** in
an area over a year, while Electricity Maps describes electricity **consumed**
in a zone in the last hour, including imports. Read close scores between
sources as roughly equal.

When a token is set, each grid zone is requested once and cached for 30
minutes. If the request fails (for example, a zone outside your plan), that
region falls back to its annual average. The result then names the reason in
`reason` and in the reading's `fallbackReason`.

Whenever live values appear in a result, `notes` includes the attribution
"Live carbon data source: ElectricityMaps.com", as the Electricity Maps terms
require for data shown externally.

### US grid averages

eGRID reports direct combustion emissions for each balancing authority. To
keep them comparable with Ember's lifecycle figures, Eco Router does not use
eGRID's emission rates directly. It takes each balancing authority's net
generation by fuel and applies Ember's US lifecycle factor for each fuel in the
same year:

```
intensity = Σ (generation by fuel × Ember US factor for that fuel) / Σ generation
```

As a check, the same method applied to eGRID's US total gives 400.2
gCO2e/kWh for 2023, within 2% of Ember's published 392.9. The update script
refuses to write new values if this check drifts by more than 5%.

The values describe generation inside each balancing authority. A grid that
imports much of its power, such as LADWP, may have a consumed-electricity
intensity that differs from its generation.

EPA paused eGRID after the eGRID2023 edition (data year 2023), so US values
are older than most national averages.

### Limits of the national average

Several countries outside the US also contain grids with very different carbon
profiles, such as Canada, Australia, India, Japan and Brazil. With annual
averages only, every region in such a country gets the same value and the
ranking cannot tell them apart. `rank_regions` adds a note when this affects
the results.

### Updating the annual averages

Ember publishes a new release every year. To regenerate the data files, run:

```bash
npm run update:baseline   # national averages, src/data/baseline-intensity.ts
npm run update:egrid      # US grid averages, src/data/zone-baseline-intensity.ts
```

## Latency estimate

Latency is estimated from the great-circle distance between `origin` and the
region's metro area:

```
estimatedRttMs = 5 + 0.02 × distanceKm
```

This approximates a fibre round trip with typical routing detours. It is a
proxy for comparing regions, not a measurement. Real latency depends on
peering and network paths.

## Job emissions

When `energyKwh` is given:

```
estimatedKgCO2e = carbonIntensity × energyKwh / 1000
```

This covers grid electricity only. Datacenter overhead (PUE) and embodied
hardware emissions are not included.
