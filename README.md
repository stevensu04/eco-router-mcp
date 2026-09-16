# Eco Router MCP

An [MCP](https://modelcontextprotocol.io) server that helps AI agents pick the
lowest-carbon cloud region for a workload.

The same GPU job can emit several times more CO₂ depending on which grid powers
the datacenter. Eco Router maps AWS, Google Cloud and Azure regions to the
electricity grids they draw from, so an agent can ask:

> "Where should I run this training job? Data must stay in the EU and latency
> should be under 150 ms."

and get back a ranked shortlist with the reasoning behind it.

Carbon figures are location-based grid averages. They describe the grid that
supplies each region, not the renewable energy a provider buys, so regions in
the same grid get the same value. See [what the numbers represent](docs/methodology.md#what-the-carbon-numbers-represent).

> **Status: early development (v0.1).** Not yet published to npm. See
> [Roadmap](#roadmap).

## Install

Requires Node.js 22 or later.

**Claude Code**

```bash
claude mcp add eco-router -- npx -y eco-router-mcp
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "eco-router": {
      "command": "npx",
      "args": ["-y", "eco-router-mcp"],
      "env": { "ELECTRICITY_MAPS_API_TOKEN": "optional" }
    }
  }
}
```

### Live grid data (optional)

Out of the box, Eco Router uses annual averages (per grid in the US, per
country elsewhere), so it works with no setup. For hourly, grid-level data, set `ELECTRICITY_MAPS_API_TOKEN` to your
own [Electricity Maps](https://www.electricitymaps.com/) API token. Zones your
plan does not cover fall back to the annual average automatically.

Your use of live data is governed by your own Electricity Maps plan and its
[terms](https://help.electricitymaps.com/en/articles/11750446-terms-of-service).
At the time of writing, Electricity Maps offers free access for academic and
personal non-commercial use, and a 14-day trial for commercial evaluation.
Commercial use requires a paid license. Eco Router does not provide or share
any token.

## Tools

| Tool | What it does |
|---|---|
| `rank_regions` | Ranks regions by grid carbon intensity, optionally balanced against estimated latency from an `origin`. Supports `providers`, `countries`, `maxLatencyMs`, `maxCarbonIntensity`, `carbonWeight`, `energyKwh` and `limit`. |
| `list_regions` | Lists cloud regions and the grid zone each one draws power from. Filter by `provider` (`aws`, `gcp`, `azure`) or `country`. |

`countries` accepts ISO 3166-1 alpha-2 codes and the groups `EU` and `EEA`.

Example request to `rank_regions`:

```json
{
  "countries": ["EU"],
  "origin": { "lat": 50.11, "lon": 8.68 },
  "maxLatencyMs": 40,
  "energyKwh": 500
}
```

Scoring, data sources and their limits are explained in
[docs/methodology.md](docs/methodology.md).

How regions are mapped to grids, and which mappings rest on assumptions, is
documented in [docs/regions.md](docs/regions.md).

## Roadmap

- [x] MCP server skeleton over stdio
- [x] Full AWS, Google Cloud and Azure region dataset with sources
- [x] Carbon data: published annual averages by default, live data with an
      optional Electricity Maps API token
- [x] `rank_regions`: rank regions by carbon intensity and estimated latency,
      with hard limits such as allowed countries or a carbon ceiling
- [x] US grid-level annual data without a token (EPA eGRID)
- [ ] Grid-level annual data for Canada, Australia, India, Japan and Brazil
- [ ] Time shifting: suggest when to run, using carbon forecasts
- [ ] Publish to npm and the MCP Registry

## Development

```bash
npm install
npm test           # unit tests, no network needed
npm run typecheck
npm run build      # compiles to dist/
npm run dev        # runs the server over stdio from source
npm run update:baseline  # refreshes national averages from Ember
npm run update:egrid     # refreshes US grid averages from EPA eGRID
```

## Data sources

- Annual carbon intensity: [Ember, Yearly Electricity Data](https://ember-energy.org/data/yearly-electricity-data/),
  licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- US grid generation mix: [US EPA eGRID](https://www.epa.gov/egrid) (public domain),
  converted to lifecycle emissions with Ember's US factors.
- Live carbon intensity (optional): Source: [ElectricityMaps.com](https://www.electricitymaps.com/),
  using your own API token and subject to the terms of your plan.
- Region lists: official AWS, Google Cloud and Azure documentation. See
  [docs/regions.md](docs/regions.md).

## Contributing

Corrections to region data are especially welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## Credits

Eco Router started as a hackathon project. Thanks to the original team for the
scoring design this project builds on: Chris, Joli ([@L-Joli](https://github.com/L-Joli)),
Bob ([@Loic0927](https://github.com/Loic0927)), Irene Tsai ([@YunTong09](https://github.com/YunTong09))
and Steven Su ([@stevensu04](https://github.com/stevensu04)).

## License

[MIT](LICENSE)
