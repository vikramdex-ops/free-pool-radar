# Changelog

Notable changes to Free Pool Radar. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **README repositioned as open-source infrastructure.** Live figures block,
  three usage modes (hosted / self-hosted / data engine), a fork-and-deploy
  path, screenshots and a contribution path.
- `METHODOLOGY.md` — the rules every figure must satisfy.
- `ARCHITECTURE.md`, `API.md`, `DATASET.md`, `SELF_HOSTING.md`, `MCP.md`,
  `ECOSYSTEM.md` — the developer documentation surface.
- **`/api/stats`** — headline counts and the verification cycle, used to update
  the README automatically.
- **`/api/dataset`**, **`/data/latest.json`** and **`/data/latest.csv`** — open
  dataset exports (CC0).
- **`/feed.xml`** — Atom feed of recent changes.
- **`/ecosystem`** — a public page listing projects built on the radar.
- **`mcp/`** — a dependency-free MCP server so coding agents can query live
  free routes over stdio.
- `.github/ISSUE_TEMPLATE/new-provider.yml`, `changed-offer.yml` and
  `feature.yml` — structured contribution paths.
- `.github/workflows/update-readme-stats.yml`, `verify-data.yml`,
  `discover.yml`, `release.yml`.
- `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/FUNDING.yml`.
- `docs/` — interface illustrations used by the README.

### Changed
- README no longer carries internal process instructions; the philosophy moved
  to `METHODOLOGY.md`.
- `CONTRIBUTING.md` and `PROJECT_STRUCTURE.md` updated to match the new surface.

### Removed
- Internal-only notes ("Do not merge without approval", "Do not add a LICENSE
  file") from the public README.

## [1.0.0] — 2026-09-30

Initial public release: historical tracking, source evidence tracking,
verification levels, five-hour verification cycle, change detection, public
read API, live dashboard, upcoming/ended states and append-only observations.
