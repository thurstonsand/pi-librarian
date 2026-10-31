<!-- markdownlint-disable MD024 -->

# Changelog

## Unreleased

### Fixed

- `find_definition` says that symbol kinds are exact, so an agent no longer misses a method by asking for a `function`.

## 0.7.1

Reads a source's token from a command, so a password manager can hold it.

### Added

- A source's `tokenCommand` reads its token from a command, such as a password manager's CLI, instead of an environment variable. It runs once, on first use, and outside the search time limit.

## 0.7.0

Researches code beyond GitHub: declared GitLab, Bitbucket Server, and Sourcegraph instances, one search tool per engine. Absorbs pi-web-tools: `web_search` and `web_fetch` ship here, in your session and in every librarian run.

### Breaking

- The search tools are renamed by family and engine: `search_code` is `search_code_grepapp`, `search_github_code` is `search_code_github`, and `search_repos` is `search_repos_github`. `read_github_file` is replaced by `read_file`, which takes `repo` as `owner/repo` and reads from any declared code host.
- `search_code_github` takes `owner` plus bare `repos` instead of `repos: [{owner, repo}]` and `owners`, and refuses a bare `OR`, parentheses, unbalanced quotes, and qualifiers in `pattern`, which GitHub silently misreads.
- `search_repos_github` takes typed filters (`text`, `language`, `topics`, `min_stars`, `pushed_after`, …) instead of a raw query, and sorts by best match unless asked for stars.
- `checkout_repo` takes a repository path plus the `source` it lives on, or a full clone URL; a bare `owner/repo` no longer means GitHub. Clones are keyed by hostname and `cacheDir` defaults to `/tmp/pi-librarian` instead of under `$TMPDIR`, so existing clones are fetched again.
- `gitlab.com` is no longer a source by default; switch it on with `librarian.builtInSources`.
- `provide_results` locations require a `source`.
- The `librarian` tool drops `repos` and `owners`, which could not say which code host they meant; name repositories and their source in `query`.
- Librarian runs no longer load the user's `AGENTS.md` or `APPEND_SYSTEM.md`.
- Extra tools are gone: `librarian.tools` no longer lists them, `librarian.extensions` is removed, and runs load no extensions. The web tools they existed for are built in.
- Every key under `librarian` is checked; an unknown or removed one is an error instead of being ignored.
- pi-web-tools is deprecated in favour of this package; uninstall it, since both register `web_search` and `web_fetch`. Its `webTools.*` settings move to `librarian.web.*`, the `~/.pi/agent/github-token` file is no longer read, and Parallel is called over its REST API, so the optional `parallel-web` SDK is not needed.

### Added

- `librarian.sources` declares GitLab, Bitbucket Server, Sourcegraph, and other GitHub instances by `name`, `url`, and `kind`, each with optional `disabled` roles; `checkout_repo` clones from any declared source.
- `librarian.tools.disabled` removes tools from librarian runs.
- `search_code_sourcegraph`, `search_repos_sourcegraph`, and `find_definition` for a declared Sourcegraph; `search_code_gitlab` and `search_repos_gitlab` for a declared GitLab; `search_code_bitbucket` and `search_repos_bitbucket` for a declared Bitbucket Server.
- Every search writes its full results to `<cacheDir>/searches/<call-id>/results.jsonl` and returns a digest saying what was found, whether the search was complete, and what is shown. `limit` takes up to 50 results (10 on grep.app, which returns no more), 10 by default (`librarian.search.defaultLimit`).
- A search running past `librarian.search.timeoutSeconds` (15 by default) is an error that cancels the request and says how to narrow it.
- Sources read API tokens from the variable `tokenEnv` names, or their kind's usual one; a source without a token still clones. `advancedSearch` marks a GitLab with advanced search.
- Attached tools render their results: a summary and the first entries collapsed, metadata and matched lines expanded.
- Findings name each location's source and link it at the commit that was read, on any declared host.
- Runs that search append how they used the results to `<cacheDir>/usage.jsonl`.
- A source's `description` tells the agent what it cannot discover, such as what a Sourcegraph does not index, at the end of every tool that reaches that source.
- `checkout_repo` takes a shorthand `repo` without `source` when only one source can clone.
- `web_search` and `web_fetch`, with the `/browser` command, from pi-web-tools 0.4.3. `web_fetch` writes bodies under `<cacheDir>/fetches/<call-id>/`, resolves GitHub URLs on any declared `github` source, and gives an issue its timeline filtered to closes, reopens, and references, with the commit that closed it.

### Changed

- The librarian's prompt is composed from the tools a run actually has.

## 0.6.3

Keeps `/librarian` attach state per session branch and builds against Pi 1.4.0.

### Changed

- Built and tested against Pi 1.4.0. Pi 1.0.2 remains the minimum supported version.

### Fixed

- `/librarian` attach state now follows the current session branch. It is restored when you navigate with `/tree` and when you resume a session where you toggled it before sending a message.

## 0.6.2

Builds against Pi 1.3.0 and times the trace like Pi's own tool rows.

### Changed

- Trace rows read "Elapsed 2.3s" while a call runs and "Took 1m 30s" once it finishes. They use Pi's recorded tool duration where Pi provides one (Pi 1.1.0+) and Pi's duration format, which also fixes durations shown as "1m 60s".
- Built and tested against Pi 1.3.0. No extension changes were needed for Pi 1.1.0 through 1.3.0, and Pi 1.0.2 remains the minimum supported version.

## 0.6.1

Builds against Pi 1.0.4.

### Changed

- Built and tested against Pi 1.0.4. No extension changes were needed, and Pi 1.0.2 remains the minimum supported version.

## 0.6.0

Builds against Pi 1.0.2 and adopts its tool metadata.

### Added

- Declared tool annotations: the search and read tools are read-only; `checkout_repo` writes only to its own checkout cache and is non-destructive; `librarian` is marked non-destructive because its research agent is instructed to use bash only for inspection.

### Changed

- Requires Pi 1.0.2 or newer.
- Attachable repo tools now register inactive (`defaultActive: false`) instead of being deactivated at session start.

### Fixed

- The librarian now fails with a clear error when the session model is a virtual model, which it does not support. A virtual `librarian.model` falls back to the session model with a warning.

## 0.5.1

### Changed

- Raised the minimum supported Pi version to 0.82.0.

### Fixed

- Fixed the nested librarian session dropping natively registered extension providers.

## 0.5.0

### Changed

- Raised the minimum supported Pi version to 0.80.10.

### Fixed

- Fixed the nested librarian session dropping extension-registered providers by propagating the model runtime into the run.

## 0.4.0

### Added

- Added compact, expandable transcript entries for `/librarian` attach and detach changes, including the exact repo tools affected.
- Added support for Pi's `max` thinking level.

### Changed

- Changed `librarian.model` to use Pi's native model-pattern resolution.
- Raised the minimum supported Pi version to 0.80.6.
- Changed persisted attach entries to require tool snapshots. Older attach entries are now ignored.

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
