# Eco Router MCP

An [MCP](https://modelcontextprotocol.io) server that helps AI agents pick the
lowest-carbon cloud region for a workload.

The same GPU job can emit several times more CO₂ depending on which grid powers
the datacenter. Eco Router maps AWS, Google Cloud and Azure regions to the
electricity grids they draw from, so an agent can ask:

> "Where should I run this training job? Data must stay in the EU and latency
> should be under 150 ms."

and get back a ranked shortlist with the reasoning behind it.

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

Out of the box, Eco Router uses national annual averages, so it works with no
setup. For hourly, grid-level data, set `ELECTRICITY_MAPS_API_TOKEN` to your
own [Electricity Maps](https://www.electricitymaps.com/) API token. Zones your
plan does not cover fall back to the annual average automatically.

## Tools

| Tool | What it does |
|---|---|
| `rank_regions` | Ranks regions by grid carbon intensity, optionally balanced against estimated latency from an `origin`. Supports `providers`, `countries`, `maxLatencyMs`, `maxCarbonIntensity`, `carbonWeight`, `energyKwh` and `limit`. |
| `list_regions` | Lists cloud regions and the grid zone each one draws power from. Filter by `provider` (`aws`, `gcp`, `azure`) or `country`. |

Example request to `rank_regions`:

```json
{
  "countries": ["DE", "FR", "SE", "NL", "IE"],
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
- [ ] Sub-national annual data without a token (for example EPA eGRID for US grids)
- [ ] Time shifting: suggest when to run, using carbon forecasts
- [ ] Publish to npm and the MCP Registry

## Development

```bash
npm install
npm test           # unit tests, no network needed
npm run typecheck
npm run build      # compiles to dist/
npm run dev        # runs the server over stdio from source
npm run update:baseline  # refreshes annual averages from Ember
```

## Data sources

- Annual carbon intensity: [Ember, Yearly Electricity Data](https://ember-energy.org/data/yearly-electricity-data/),
  licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Live carbon intensity (optional): [Electricity Maps](https://www.electricitymaps.com/),
  using your own API token and subject to its terms.
- Region lists: official AWS, Google Cloud and Azure documentation. See
  [docs/regions.md](docs/regions.md).

## Credits

Eco Router started as a hackathon project. Thanks to the original team for the
scoring design this project builds on: Chris, Joli ([@L-Joli](https://github.com/L-Joli)),
Bob ([@Loic0927](https://github.com/Loic0927)), Irene Tsai ([@YunTong09](https://github.com/YunTong09))
and Steven Su ([@stevensu04](https://github.com/stevensu04)).

## License

[MIT](LICENSE)
