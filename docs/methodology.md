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

| | Annual average (default) | Live (with a token) |
|---|---|---|
| Source | [Ember Yearly Electricity Data](https://ember-energy.org/data/yearly-electricity-data/) | [Electricity Maps API](https://www.electricitymaps.com/) `carbon-intensity/latest` |
| Granularity | Country, latest year | Grid zone, hourly |
| Emissions scope | Lifecycle, gCO2e/kWh | Lifecycle, gCO2e/kWh (API default) |
| Setup | None, shipped in the package | `ELECTRICITY_MAPS_API_TOKEN` |
| License | CC BY 4.0 | Electricity Maps terms for your plan |

Both sources report lifecycle emissions, so they can be compared. They still
differ in two ways. Ember describes electricity **generated** in a country over
a year, while Electricity Maps describes electricity **consumed** in a zone in
the last hour, including imports. Read close scores between the two sources as
roughly equal.

When a token is set, each grid zone is requested once and cached for 30
minutes. If the request fails (for example, a zone outside your plan), that
region falls back to its annual average. The result then names the reason in
`reason` and in the reading's `fallbackReason`.

### Limits of the annual average

Some countries contain several grids with very different carbon profiles, such
as the United States, Canada, Australia and India. With annual averages only,
every region in such a country gets the same value and the ranking cannot tell
them apart. `rank_regions` adds a note when this affects the results.

Open sub-national datasets, such as EPA eGRID for US balancing authorities,
could close this gap without requiring a token. That work is on the roadmap.

### Updating the annual averages

Ember publishes a new release every year. To regenerate
`src/data/baseline-intensity.ts`, run:

```bash
npm run update:baseline
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
