<!-- markdownlint-disable MD024 -->

# Release notes

## 0.3.1

### Changed

- Sharpened the research tools' prompt snippets, guidelines, and descriptions so the librarian names each tool explicitly and reads its guidance as directive instructions.

## 0.3.0

Hardens librarian research tools and aligns GitHub file reads with pi's native `read` tool.

### Changed

- Changed `read_github_file` to use `offset` and `limit` instead of `range`, matching pi's native `read` tool semantics.
- Hardened `checkout_repo` cache reuse so mismatched or malformed cached paths are discarded, while reused checkouts are reset and cleaned before research.

## 0.2.1

Fixes TUI rendering corruption.

### Added

- Added `librarian.debug.persistRuns` to keep nested run session files around for debugging.

### Fixed

- Fixed librarian trace rendering leaving stale "N earlier calls" duplicates in the TUI, caused by unsilenced `@octokit/request` deprecation warnings writing to the console.
- Fixed `search_code` retries riding out a fixed 30s-per-attempt budget; retries now use an escalating timeout schedule so a stalled request recovers in seconds instead of up to a minute.

## 0.2.0

Adds continuable librarian runs and opt-in for extra tools.

### Added

- Added continuation support for prior librarian runs by run id.
- Added `librarian.tools` for opting extra tools into librarian runs by name.
- Added startup warnings for unresolved extra tool names and failed escape-hatch extension loads.

### Changed

- Changed `librarian.extensions` into an escape hatch for resolving named tools not loaded by the main pi agent.
- Stripped extension hooks from extra tools loaded into nested librarian runs.
- Removed `librarian.disabledTools`; baseline librarian tools are fixed, while extra tools are additive by name.

### Fixed

- Fixed tool error handling so pi marks librarian tool failures as errored executions.

## 0.1.1

Adds automated release and dependency maintenance infrastructure.

### Added

- Added GitHub Actions workflows for CI and tag-driven npm publishing.
- Added Renovate configuration for dependency update PRs.
- Added a helper script for annotated release tags.

## 0.1.0

Initial release of `@thurstonsand/pi-librarian`.

### Added

- Added the `librarian` tool for nested GitHub research runs.
- Added repo research tools for repository search, code search, checkout, GitHub file reads, and structured findings.
- Added `/librarian` attached-tool support for using repo tools directly in pi sessions.
