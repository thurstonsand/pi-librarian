# Librarian: GitHub research subagent

## Status

Accepted

## Decision Summary

Build a `librarian` tool: a nested research agent that answers questions about GitHub code — both deep dives into specific repos and discovery across the ecosystem. Reliability comes from inverting the usual approach: instead of leaning on GitHub's search APIs, the librarian clones repos locally and researches them with pi's own battle-tested file tools, reserving search APIs for discovery and candidate-finding. Results are returned through a structured `provide_results` tool, enforced by the runtime.

## Problem Statement / Background

Some of the most useful context for coding work lives in *other people's repos*: how a framework implements a feature, what an error deep in a dependency actually means, which of several libraries fits a need. Two concrete scenarios drove this design:

- **Known-repo deep dive**: "How does drizzle-orm handle prepared statements?" — requires mapping an unfamiliar repo, tracing a flow, and citing exact locations.
- **Ecosystem discovery**: "Compare the most popular SQL ORMs for TypeScript" — requires popularity signal, docs context, and enough source inspection to compare honestly.

The prior attempt ([default-anton/pi-librarian](https://github.com/default-anton/pi-librarian)) gave a subagent freeform bash and told it to use `gh search code`. That endpoint is GitHub's *legacy* search engine: default-branch only, files under 384 KB, tokenized matching (no regex), skips less-active repos, 10 requests/minute. Roughly half of all runs ended in "I can't find that" — the model was handed a bad instrument. Its presentation layer was also unsatisfying.

Amp's librarian, by contrast, works essentially every time. Investigation (binary string extraction plus interrogating the subagent itself) revealed its shape: seven *structured* per-repo tools — `read_github` (line-ranged reads), `glob_github`, `list_directory_github`, `search_github` (single-repo, paginated), `commit_search`, `diff`, `list_repositories` — plus `web_search`/`read_web_page`, all against GitHub's code-search index, with a subagent prompt oriented around evidence-backed, line-cited findings. The lesson: structure and evidence discipline, not secret infrastructure.

This design adopts Amp's structure where it earns its keep and beats it on the weak link: within-repo search runs on local clones instead of any search API.

## Goals

- Deep-dive questions about a specific repo succeed reliably, with line-cited evidence — the "can't find that" failure mode is eliminated for reachable repos.
- Discovery questions get real popularity/ecosystem signal (stars, topics, web context), not just code matches.
- Findings return in a structured shape the main agent and the renderer can both consume.
- The user can watch research progress live and expand to a full trace.
- Private repos work through existing `gh` auth with zero extra setup.

## Non-Goals

- Not a general web-research agent; web tools are supporting instruments for GitHub research.
- No writing, PR creation, or repo mutation — the librarian is read-only.
- No runtime verification of citations (v1 trusts the prompt; see Alternatives).
- No turn/cost budget (v1; add if it proves a problem in practice).
- No replication of Amp's `commit_search`/`diff` as dedicated tools — git in a local clone covers history archaeology.

## Exposed Shape

### Main session surface

- **`librarian` tool** — `{ query, repos?, owners? }`. Spawns a librarian run; returns the structured findings. Description steers the main agent: multi-step GitHub research, unknown locations, cross-repo questions.
- **`/librarian` command** — attaches the librarian's repo tools to the main session (via `setActiveTools`), so the main agent wields them directly for quick lookups. Run again to detach. Attach state persists across restarts via a custom session entry. The subagent tool remains available while attached; tool descriptions delineate quick lookup vs. delegated research.

### Librarian run toolset

- **Inherited built-ins**: `read`, `grep`, `find`, `ls`, `bash`. Never `write`/`edit`.
- **Allowlisted extensions** (`librarian.extensions` config): extension paths loaded into the run; defaults to the user's web tools (e.g. parallel-web-tools, whose `fetch_web` is GitHub-aware: issues, PRs, READMEs).
- **Repo tools** (registered by this package, exclusive to librarian runs unless attached):
  - `search_repos(query, language?, topic?, sort?, limit?)` — GitHub `/search/repositories`; star-ranked discovery.
  - `search_code(pattern, regex?, repo?, language?, path?)` — cross-repo public code search through Grep's public MCP endpoint; regex/global discovery plus repo/language/path filters.
  - `search_github_code(pattern, repos?, owners?, language?, path?, limit?)` — GitHub REST code search over public code and private repositories visible to configured GitHub auth; `repos` entries are `{ owner, repo }`.
  - `checkout_repo(repo, ref?)` — partial clone into the checkout cache; returns absolute local path, HEAD sha, default branch.
  - `read_github_file(owner, repo, path, ref?, range?)` — contents-API single-file read without cloning.
  - `provide_results(summary, locations, description?)` — the mandatory structured finish.

### `provide_results` schema

- `summary` — 1–3 sentence direct answer to the query. No preamble.
- `locations` — `[{ repo, file, lines?, note }]`; `lines` is a `"start-end"` range enabling GitHub blob links pinned to the checked-out sha.
- `description` — optional extended findings in markdown (e.g. step-by-step flow tracing).

### Configuration

- `librarian.model` — `provider/model-id` reference; resolved configured → current session model (same machinery as pi-sessions auto-title).
- `librarian.thinkingLevel` — optional pi thinking level (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`); resolved configured → current session thinking level.
- `librarian.extensions` — extension paths loaded into librarian runs.
- `librarian.disabledTools` — inherited built-ins to drop (default: none beyond the hardcoded write/edit exclusion).

### Presentation

Each tool call renders as one line: `verb subject (result summary) timer`, with paths under the checkout cache relativized to `repo/path`:

```
checkout  drizzle-team/drizzle-orm@main (cached · 2.1k files)       3.2s
search    code /prepare\w+\(/ in drizzle-team/* (23 hits · 4 repos)  0.9s
grep      "prepareQuery" drizzle-orm/src (14 matches)                0.3s
read      drizzle-orm/src/pg-core/session.ts:80-140                  0.1s
bash      git log -S prepareQuery --oneline (12 commits)              0.7s
web       "typescript orm comparison 2026" (8 results)                1.1s
results   3 locations                                                 0.1s
```

- **Running, collapsed**: query pinned in header; last 3 tool calls with per-call timers; footer `N tool calls · total time · model (thinkingLevel)`.
- **Expanded** (Ctrl+O): full trace, same header/footer.
- **Done, collapsed**: header keeps the query; body becomes `findings.summary` only. Expanded results show locations and description. Footer retains call count, total time, and `model (thinkingLevel)`.
- Failed calls render in red with the error in place of the result summary. Bash commands are whitespace-normalized and truncated (~120 chars).

## Design Decisions

### 1. Clone-first within-repo research

`checkout_repo` performs a `git clone --filter=blob:none` into `/tmp/pi-librarian/repos/<repo-key>` by default, then pi's own `read`/`grep`/`find`/`ls` operate on the clone. `owner/repo` inputs resolve to GitHub; HTTPS and SSH repository URLs are accepted for other Git hosts and are keyed as `<host>/<path>`, allowing nested GitLab-style group paths. GitHub URLs remain constrained to `owner/repo`. No search API sits in the critical path of the primary use case. Blob-less partial clone brings full commit history with lazily-fetched file contents, so `git log -S`, `git blame`, and `git diff` work via bash — covering Amp's `commit_search` and `diff` tools for free, on any ref (Amp is default-branch-only). The cache is refreshed by fetch when stale (15-minute debounce) and has no eviction beyond normal temp-directory cleanup.

**Tradeoff**: disk usage and initial clone latency on monorepo-scale targets, mitigated by blob-less clones and `read_github_file` for single-file questions.

### 2. `search_code` is a candidate-finder, demoted from evidence source

Cross-repo code search is the one job that requires an API, and every available API has gaps. So the prompt frames `search_code` hits as *candidates to verify* via checkout/read — never as citable evidence. This is the root-cause fix for pi-librarian's failure mode: it treated a lossy index as ground truth.

Backend selection is explicit, not hidden fallback. `search_code` uses Grep for public GitHub code search, including regex and broad/no-repo discovery. `search_github_code` uses GitHub REST code search for authenticated/public GitHub searches, especially private repositories or GitHub-specific visibility. The model chooses the instrument based on the task, and failures are reported directly instead of silently trying another backend.

Grep is accessed through the official public MCP endpoint (`https://mcp.grep.app`) as a plain HTTP JSON-RPC backend, not loaded dynamically as an MCP server. GitHub REST code search remains literal/tokenized and does not support regex, but it is the private-repo path through existing `gh`/token auth.

**Risk accepted**: the anonymous endpoint has undocumented rate limits and could be restricted someday; the GitHub fallback keeps the tool functional, and the primary flow (clone-first) doesn't depend on it at all.

### 3. Nested agent session, not tool proxying

A librarian run is a `createAgentSession` with `SessionManager.inMemory()`, an isolated system prompt, and built-in tools selected by name. `SessionManager.inMemory(cacheDir)` uses `cacheDir` as the nested session cwd; it does not persist a session file. Pi offers no API to execute another extension's tool from outside (`getAllTools()` is metadata-only), so "inheriting" main-session extension tools means *loading extension code* into the nested session.

Full inheritance of the user's global extension dir was rejected: it would activate unrelated hooks (UI companions, session recovery, powerline) inside every headless research run, and the librarian would have to exclude itself to avoid recursion. Instead, `librarian.extensions` is an explicit allowlist of paths loaded via `additionalExtensionPaths` with `noExtensions: true`. Predictable composition; the cost is one settings entry when a new tool should flow in.

`excludeTools` and `setActiveToolsByName` serve different layers. `excludeTools` prevents hard-denied tools from being registered into the nested session at all (`write`/`edit`, plus user-disabled tools). After extension loading, the run turns on every remaining registered tool so allowlisted extension tools are usable without needing a second per-tool allowlist.

Pi tool fields split model-facing text: `description` is the tool schema description sent with the provider tool definition, while `promptSnippet` is optional prose for pi's generated "available tools" section. Built-in tools set both; custom tools without `promptSnippet` are still callable but omitted from that prose section.

### 4. Structured finish with enforced `provide_results`

The librarian must end by calling `provide_results`. The tool returns `terminate: true`, which asks pi's agent loop to stop after that tool batch; the runtime still checks after each turn and, if the run went idle without the call, sends a reminder user message — at most 3 times — then returns an error result carrying `session.getLastAssistantText()`. This makes "did the librarian actually answer?" a structural property instead of a parsing hope, and gives the renderer a reliable shape.

Citation honesty ("only cite files you actually read") is enforced in the prompt only. Runtime verification against the tool-call log was considered and deferred (see Alternatives).

### 5. No turn cap

pi-librarian capped runs at 10 turns, which contributed to thin answers. v1 imposes no turn or time budget (KISS); abort remains available via the parent tool-call signal, and a cap is trivially retrofittable if runaway runs materialize.

### 6. Model and thinking resolution mirror auto-title/handoff

`librarian.model` is parsed as a `provider/model-id` `ModelReference` and matched against `ctx.modelRegistry.getAvailable()`; unset or unavailable falls through to the current session's model. `librarian.thinkingLevel` is resolved alongside the model; unset inherits `pi.getThinkingLevel()` and the nested agent receives it via `createAgentSession({ thinkingLevel })`. pi clamps unsupported levels to the selected model's capabilities. Research quality tracks the user's chosen agent quality by default. No hardcoded fallback model list, and none of pi-librarian's 282-line multi-provider failover in v1.

### 7. `/librarian` attach mode

`setActiveTools` verified to work live (rebuilds the system prompt; takes effect next turn) but does not persist. The extension records attach state as a custom session entry and re-attaches on session load — a pattern proven throughout pi-sessions. Attach and subagent coexist: raw tools for single lookups without subagent latency; the `librarian` tool for context-isolated multi-step research.

## Edge Cases & Failure Modes

- **Librarian never calls `provide_results`**: up to 3 reminder messages, then error result containing the raw final text.
- **Private repo**: `search_github_code`, `checkout_repo`, and `read_github_file` work via existing `gh`/git auth. `search_code` is public-only through Grep. Access failure (403/404) is reported as a finding constraint, not a crash.
- **Repo doesn't exist / ref invalid**: `checkout_repo` returns a structured error the librarian can react to (e.g. re-resolve via `search_repos`).
- **GitHub code-search rate limit (10/min)**: tool result carries the retry-after signal; prompt steers toward clone-first anyway.
- **Grep unavailable/throttled**: `search_code` reports the failure directly; the librarian can choose `search_github_code`, `search_repos`, checkout, or web tools as another avenue.
- **Monorepo-scale clone**: blob-less clone bounds the damage; single-file questions route to `read_github_file`.
- **Stale cache**: fetch on checkout when older than 15 minutes; `ref` checkout happens after fetch.
- **Abort mid-run**: parent tool-call abort signal disposes the nested session; partial trace is preserved in the render with status aborted.
- **Recursion**: the `librarian` tool is not registered inside librarian runs; the package never loads itself via `librarian.extensions`.
- **Attach + subagent confusion**: tool descriptions explicitly scope raw tools to single lookups and the subagent to research tasks.

## Alternatives

### Replicate Amp's API-only toolset 1:1

- **Status:** Rejected
- **Decision or open issue:** Amp's `search_github` rides GitHub's modern code-search index server-side; the public REST equivalent is the legacy engine that caused pi-librarian's failures. Without Amp's infrastructure, the API-only shape inherits the weak link.
- **Retained discussion:** Amp's *tool structure* (per-repo scoping, pagination, line-ranged reads) is adopted; only the retrieval substrate differs.

### Scrape GitHub's Blackbird web search endpoint

- **Status:** Rejected
- **Decision or open issue:** The web UI's search (regex-capable) has no official API; scraping it is fragile and ToS-adjacent. Grep's MCP endpoint provides the public regex/global discovery path without scraping GitHub internals.

### Full inheritance of main-session extensions

- **Status:** Rejected
- **Decision or open issue:** No proxy API exists, so inheritance means loading extension code — and the user's global dir contains UI/session-machinery extensions whose hooks misbehave in headless nested runs. Allowlist chosen; revisit only if the settings-entry friction proves real.

### Runtime citation verification

- **Status:** Deferred
- **Decision or open issue:** Cross-checking `provide_results.locations` against the run's tool-call log would kill hallucinated citations structurally. Deferred for KISS; the bookkeeping (files read, search hits seen, checkouts performed) is cheap to add later since all events already flow through the run's subscription.
- **Next step:** Revisit if fabricated paths appear in real usage.

### Turn budget

- **Status:** Deferred
- **Decision or open issue:** No cap in v1 by explicit choice. Add a config-overridable cap with an end-of-budget reminder if runaway runs occur.

## Implementation Plan

- [x] Phase 1: Repo scaffold
  - Goal: A checkable, empty pi extension package mirroring pi-sessions conventions.
  - Files: `package.json` (`@thurstonsand/pi-librarian`, `pi.extensions` entry), `tsconfig.json`, `biome.json`, `AGENTS.md`, `DEV.md`, `.gitignore`, `extensions/librarian.ts` (entrypoint registering nothing yet), `test/` with a placeholder test.
  - Work: Copy pi-sessions' toolchain shape (biome, tsc, vitest, `npm run check`); pin `@earendil-works/*` peers at the current pi version; TypeBox for all runtime boundaries.
  - Validation: `npm run check` passes on the empty package; pi loads the extension without error.

- [x] Phase 2: GitHub + Grep clients and the research tools
  - Goal: `search_repos`, `search_code`, `checkout_repo`, `read_github_file` as pure, individually testable modules with TypeBox param/result schemas.
  - Files: `extensions/librarian/tools/*.ts`, `extensions/librarian/github.ts`, `extensions/librarian/grep-app.ts`, `extensions/librarian/checkout.ts`, `test/*`.
  - Work: gh-token-aware GitHub REST client (repo search, contents, explicit code search); Grep MCP-backed public code search; blob-less clone + fetch-debounce cache keyed `owner/repo`; structured errors (not-found, auth, rate-limit) as tool results.
  - Validation: unit tests with mocked HTTP/git; live smoke: each tool invoked standalone against real repos (public + one private), evidence recorded in `SMOKE.md`.

- [x] Phase 3: Librarian runtime and the `librarian` tool
  - Goal: End-to-end runs — query in, findings out — with plain-text rendering.
  - Files: `extensions/librarian/run.ts`, `extensions/librarian/prompt.ts`, `extensions/librarian/model.ts`, `extensions/librarian/results.ts`, `extensions/librarian.ts`.
  - Work: `createAgentSession` wiring (in-memory session manager, built-ins allowlist minus write/edit, `librarian.extensions` via `additionalExtensionPaths` + `noExtensions`, repo tools via extension factory); system prompt (clone-first strategy, candidate-verification rule, citation discipline, `provide_results` mandate); `provide_results` idle-check with max-3 reminder loop; `librarian.model` resolution; abort propagation and disposal.
  - Validation: unit tests for the reminder/retry loop and model resolution; live smoke of flows A (drizzle deep dive), B (ORM comparison), C (cross-repo hunt) recorded in `SMOKE.md`.

- [x] Phase 4: Presentation
  - Goal: The full render spec — collapsed last-3 with timers, expanded trace, findings body, footer.
  - Files: `extensions/librarian/view.ts`, render wiring in the tool registration.
  - Work: per-tool-name line formatters (checkout/search/grep/read/read.gh/bash/web/results) with cache-path relativization; timer capture from `tool_execution_start/end`; footer `N tool calls · total time`; done-state body from findings with sha-pinned blob links; red error lines.
  - Validation: visual smoke in a live pi TUI session, collapsed and expanded, running and done; screenshot or transcript in `SMOKE.md`.

- [x] Phase 5: `/librarian` attach command
  - Goal: Attach/detach repo tools in the main session, surviving restarts.
  - Files: `extensions/librarian/attach.ts`, command registration in the entrypoint.
  - Work: toggle via `getActiveTools`/`setActiveTools` (excluding `provide_results`); persist attach state as a custom session entry; re-attach on session load; adjust tool descriptions to delineate quick lookup vs. delegated research.
  - Validation: attach, use a raw tool from the main agent, restart pi, confirm tools remain attached; detach and confirm removal.

- [x] Phase 6: Hardening pass against real usage
  - Goal: The design's edge cases demonstrably handled.
  - Files: as needed.
  - Work: exercise private-repo access, rate-limit fallback, invalid repo/ref, abort mid-run, giant-repo checkout; tune the system prompt against observed failure shapes.
  - Validation: each edge case reproduced and its handling recorded in `SMOKE.md`.
