# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0]

First public release.

### Added

- `rank_regions` tool: ranks cloud regions by grid carbon intensity,
  optionally balanced against estimated latency, with hard limits for
  countries, latency and carbon intensity, and job emissions estimates.
- `list_regions` tool: lists regions and the grid zone each one draws from.
- Dataset of all 134 public AWS, Google Cloud and Azure regions, mapped to
  Electricity Maps grid zones, with notes where a mapping relies on an
  assumption.
- Annual carbon intensity that works with no setup: grid-level for the US
  (EPA eGRID with Ember lifecycle factors) and national elsewhere (Ember).
- Optional live grid data with your own Electricity Maps API token, cached per
  zone and falling back to annual averages.
- `EU` and `EEA` country groups for data residency filters.
- Scripts to refresh annual data from Ember and EPA eGRID.

[Unreleased]: https://github.com/stevensu04/eco-router-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/stevensu04/eco-router-mcp/releases/tag/v0.1.0
