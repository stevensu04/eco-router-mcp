# Releasing

Checklist for maintainers publishing a new version.

## 1. Prepare

1. Make sure `main` is green in CI.
2. Pick the new version (for example `0.2.0`) and update it in:
   - `package.json` (`version`)
   - `server.json` (`version` and `packages[0].version`)
   - `src/server.ts` (`SERVER_VERSION`)

   `tests/metadata.test.ts` fails if these disagree.
3. In `CHANGELOG.md`, move the **Unreleased** entries under a new version
   heading and update the compare links.
4. If a new Ember or eGRID release is out, run `npm run update:baseline` and
   `npm run update:egrid` and review the diff.
5. Run `npm run typecheck && npm test && npm run build`.
6. Check the package contents with `npm pack --dry-run`.

## 2. Publish to npm

```bash
npm login
npm publish
```

`prepublishOnly` runs the type check, tests and build again before uploading.

## 3. Publish to the MCP Registry

Install `mcp-publisher` (see the
[registry quickstart](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)),
then:

```bash
mcp-publisher validate
mcp-publisher login github
mcp-publisher publish
```

The registry checks that `mcpName` in the published npm package matches
`name` in `server.json`, so publish to npm first.

## 4. Tag the release

```bash
git tag v0.2.0
git push origin v0.2.0
```

Then create a GitHub release from the tag, using the changelog entry as the
release notes.
