# Contributing to Eco Router

Thanks for helping. Bug reports, data corrections and code are all welcome.

## Good first contributions

- **Fix a grid mapping.** Twelve regions rely on an assumption about where
  their datacenters are. They are listed in
  [docs/regions.md](docs/regions.md#assumptions). If you can find a public
  source that settles one, open a
  [grid mapping correction](https://github.com/stevensu04/eco-router-mcp/issues/new?template=grid-mapping.yml).
- **Add a new cloud region** when a provider launches one.
- **Add grid-level annual data** for a country that still uses a national
  average, such as Canada, Australia, India, Japan or Brazil. The data needs
  a license that allows redistribution.

## Development setup

Requires Node.js 22 or later.

```bash
git clone https://github.com/stevensu04/eco-router-mcp.git
cd eco-router-mcp
npm install
npm test
```

Useful commands:

| Command | What it does |
|---|---|
| `npm test` | Runs all tests. No network or API token needed. |
| `npm run typecheck` | Type-checks source, tests and scripts. |
| `npm run build` | Compiles to `dist/`. |
| `npm run dev` | Runs the server over stdio from source. |

To try your build in Claude Code:

```bash
claude mcp add eco-router-dev -- node /absolute/path/to/eco-router-mcp/dist/index.js
```

## Pull requests

1. Open an issue first for anything larger than a small fix, so we can agree
   on the approach.
2. Keep each pull request focused on one change.
3. Add or update tests. Tests must not call external APIs; inject a fake
   `fetch` or `CarbonProvider` instead.
4. Run `npm run typecheck && npm test` before pushing. CI runs the same checks.
5. Update `CHANGELOG.md` under **Unreleased** if users will notice the change.

## Data changes

Every value in `src/data/` must be traceable to a public source.

- **Region entries** (`src/data/regions.ts`): cite the provider's official
  region list. If the grid zone depends on an assumption, add a
  `gridZoneNote` that says what was assumed.
- **Generated files** (`baseline-intensity.ts`, `zone-baseline-intensity.ts`):
  do not edit them by hand. Change the script under `scripts/` and run it.
- **Licenses**: only use data whose license allows redistribution in an MIT
  project, and add attribution to the README and the generated file header.

## Reporting security issues

Please do not open a public issue. See [SECURITY.md](SECURITY.md).
