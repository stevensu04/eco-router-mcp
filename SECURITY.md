# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub security advisories](https://github.com/stevensu04/eco-router-mcp/security/advisories/new),
not in a public issue. You should get a response within a week.

## Scope

Eco Router runs locally as an MCP server. The areas most worth reporting are:

- handling of the `ELECTRICITY_MAPS_API_TOKEN` value, such as it appearing in
  logs, tool output or error messages
- tool inputs that cause crashes, excessive network requests or unexpected
  file access

Eco Router never needs your cloud provider credentials. If a tool asks for
them, treat it as a bug.
