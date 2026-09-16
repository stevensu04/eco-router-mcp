# Eco Router MCP

An [MCP](https://modelcontextprotocol.io) server that helps AI agents pick the
lowest-carbon cloud region for a workload.

The same GPU job can emit several times more CO₂ depending on which grid powers
the datacenter. Eco Router maps AWS, Google Cloud and Azure regions to the
electricity grids they draw from, so an agent can ask:

> "Where should I run this training job? Data must stay in the EU and latency
> should be under 150 ms."

and get back a ranked shortlist with the reasoning behind it.

> **Status: early development (v0.1).** The server runs and lists a seed set of
> regions. Carbon ranking is in progress, see [Roadmap](#roadmap).

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
      "args": ["-y", "eco-router-mcp"]
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `list_regions` | Lists known cloud regions and the grid zone each one draws power from. Filter by `provider` (`aws`, `gcp`, `azure`) or `country`. |

## Roadmap

- [x] MCP server skeleton over stdio
- [ ] Full AWS, Google Cloud and Azure region dataset with sources
- [ ] Carbon data: published annual averages by default, live data with an
      optional Electricity Maps API token
- [ ] `rank_regions`: rank regions by carbon intensity and estimated latency,
      with hard limits such as allowed countries or a carbon ceiling
- [ ] Publish to npm and the MCP Registry

## Development

```bash
npm install
npm test           # unit tests, no network needed
npm run typecheck
npm run build      # compiles to dist/
npm run dev        # runs the server over stdio from source
```

## Credits

Eco Router started as a hackathon project. Thanks to the original team for the
scoring design this project builds on: Chris, Joli ([@L-Joli](https://github.com/L-Joli)),
Bob ([@Loic0927](https://github.com/Loic0927)), Irene Tsai ([@YunTong09](https://github.com/YunTong09))
and Steven Su ([@stevensu04](https://github.com/stevensu04)).

## License

[MIT](LICENSE)
