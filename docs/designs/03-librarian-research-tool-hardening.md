# Librarian research-tool hardening

## Status

Partially implemented

## Decision Summary

Capture the hardening work implemented for librarian runs: disposable checkout-cache mechanics and remote file reads that behave like pi's native `read` tool. AST-aware local-code tools and heavier result metadata remain deferred ideas, not active implementation pressure.

## Problem Statement / Background

The current librarian design already makes the main reliability move: within-repo research happens from local blob-less clones, while search APIs are candidate finders. A survey of adjacent implementations suggested several refinements worth preserving before the details are lost:

- Mitsuhiko's librarian skill treats checkouts as stable cached infrastructure: repo references normalize to a predictable cache path, clones are reused, and refreshes are throttled.
- Code-research tools such as Octocode and codebase-research-agent emphasize exact regions, line anchors, and smaller useful code chunks rather than raw search dumps.
- This project should borrow those patterns only where they simplify the librarian's operating surface. It should not become an API-first search tool, a heavy MCP service, or a semantic index whose snippets are mistaken for evidence.

The useful scenario is a repeated question about the same repo: the librarian should reuse the existing clone, force it back to the requested upstream state subject to fetch debounce, clean away any cache-local debris, and let the agent read GitHub files with the same mental model it uses for local files.

## Goals

- Reuse cached clones safely while preserving the librarian's read-only research contract.
- Treat checkout-cache contents as disposable infrastructure, not user-owned worktrees.
- Make `read_github_file` operationally match pi's native `read` tool where possible.

## Non-Goals

- No dependency on Octocode or any external MCP service.
- No shift away from clone-first within-repo research.
- No semantic/vector index as part of this design.
- No AST-aware local-code primitive for now; useful, but not part of this hardening pass.
- No broad tool-result metadata expansion unless a concrete enforcement feature needs it.
- No repo-profile cache for now; the value is less clear than the hardening work captured here.

## Exposed Shape

These additions would preserve the current user-facing `librarian` tool and `/librarian` attach command. The exposed changes would be inside the repo-tool surface:

- `checkout_repo` becomes stricter about cache reuse by resetting and cleaning cache entries deterministically.
- `read_github_file` uses `offset`/`limit` semantics and output conventions that closely mirror pi's native `read` tool.
- Existing `provide_results.locations` remains the final citation surface. Search results are still candidates by prompt discipline, not by a new metadata framework.

## Design Decisions

### 1. Cached checkouts are disposable infrastructure, not worktrees

A reused checkout should be forced back to the requested upstream state, subject only to the fetch debounce. Unlike a human working clone, librarian checkouts are cache infrastructure. If a previous run, aborted process, or manual edit left local changes, generated files, or an old branch behind, `checkout_repo` should not preserve them. Manual edits inside the checkout cache are undefined behavior.

For default-branch checkouts, the desired shape is:

1. verify the cache path is a git repo for the requested normalized remote;
2. fetch from origin unless the fetch debounce says the clone is fresh enough;
3. checkout the default branch;
4. hard reset to `origin/<defaultBranch>`;
5. remove untracked files with `git clean -fdx`;
6. return the pinned HEAD sha and cache status.

For explicit refs, the tool should fetch the requested ref when needed, force checkout/detach to the resolved commit, hard reset to that commit, and clean the tree. If the cached remote does not match the requested repo, or if the cache path is malformed, the safe behavior is to discard the cache path and clone again.

**Tradeoff:** this destroys any local modifications inside the checkout cache. That is acceptable because librarian runs are read-only by contract; cache contents are not user-owned work.

### 2. Remote file reads should behave like local reads

`read_github_file` is most useful when it feels like pi's native `read` tool pointed at GitHub. The agent should not need one mental model for local checkout files and another for remote GitHub files.

The tool should use `offset` and `limit` parameters rather than a bespoke `[startLine, endLine]` range:

- `offset` is a 1-indexed starting line;
- `limit` is the maximum number of lines to return;
- default behavior should match native `read` as closely as practical;
- clipped output should tell the agent how to continue with `offset`/`limit`;
- file output should be directly returned as text, not written to disk;

Directory listings may remain GitHub-specific, but file reads should be operationally interchangeable with local `read` output. This is more useful than extra metadata because it changes the agent's actual operating surface.

**Tradeoff:** changing from `range` to `offset`/`limit` breaks the current tool schema. That is acceptable if it makes the tool more pi-native and easier for agents to use consistently.

### 3. AST and metadata expansion remain deferred

Plain grep plus `read` remains the right baseline because it is universal, fast, and transparent. A future AST-aware addition could still be useful, probably as `read_enclosing_node(path, line, language?)` for TypeScript/JavaScript first, but it should wait until the simpler read and checkout semantics are solid.

Likewise, broad result metadata such as `evidenceKind`, `complete`, `truncated`, `continuation`, and `recoveryHint` should not be added speculatively. Agents primarily use tool text and prompt instructions; hidden metadata only matters when a renderer or validator consumes it. If citation honesty needs more structure later, the better first step is validating `provide_results.locations` against the run trace: files checked out, files read, line ranges observed, and search hits that were only candidates.

**Tradeoff:** this leaves candidate-vs-proof enforcement mostly in the prompt for now. That is acceptable under KISS until there is a concrete validation feature to support.

## Edge Cases & Failure Modes

- **Cached repo remote mismatch:** discard and reclone rather than trying to repair an ambiguous cache entry.
- **Dirty cached checkout:** hard reset and `git clean -fdx`; do not preserve changes.
- **Fetch fails but stale clone exists:** report a structured error instead of silently researching stale code, unless a future explicit offline mode exists.
- **Explicit commit not reachable after fetch:** return a ref-resolution error with a recovery hint to verify the ref or repo.
- **Large GitHub file:** return a clipped line window using native-read-like semantics and tell the agent the next `offset`/`limit` to request.
- **Search result clipped by limits:** keep the text honest about limits; do not add metadata unless a concrete consumer needs it.

## Alternatives

### Keep checkout cache reuse as-is

- **Status:** Rejected
- **Decision:** The current implementation already does a force checkout/reset for the default branch and force checkout for explicit refs, but it does not fully encode the disposable-cache policy described here.
- **Discussion:** The stricter policy is easier to reason about and matches the contract: checkout-cache contents are not user-owned work.

### Add Octocode as a dependency

- **Status:** Rejected
- **Decision**: Octocode is an external code-research/MCP-style system, not a pi-native tool. Its useful contribution here is contract design: exact regions, line anchors, pagination, bulk/error semantics, and candidate-vs-proof discipline.
- **Discussion:** Borrow only the interaction ideas that make pi-native tools easier to use. Do not import the infrastructure or add metadata for its own sake.

### Add repo profiles

- **Status:** Rejected
- **Decision**: Repo profiles are less compelling for now than cache correctness and native-read-like remote file access.
- **Discussion:** A profile cache could store package manager, source roots, manifests, and test commands, but it risks becoming stale orientation data that agents over-trust. Evidence should continue to come from actual file reads.

## Implementation Plan

- [x] Phase 1: Checkout cache hardening
  - Goal: Make reused clones deterministic disposable infrastructure that match the requested upstream ref, subject to fetch debounce.
  - Files: `extensions/librarian/checkout.ts`, `extensions/librarian/tools/checkout-repo.ts`, checkout tests.
  - Work: Verify cached remote identity; discard/reclone on mismatch or malformed cache; fetch with existing debounce; hard reset and `git clean -fdx` for default branch and explicit refs.
  - Validation: Unit tests for dirty checkout cleanup, untracked file cleanup, remote mismatch reclone, explicit ref checkout, malformed cache replacement, and fetch failure behavior; `npm run check`.

- [x] Phase 2: Native-read-like `read_github_file`
  - Goal: Make remote GitHub file reads operationally match pi's native `read` tool.
  - Files: `extensions/librarian/tools/read-github-file.ts`, prompt/tests.
  - Work: Replace `range` with `offset`/`limit`; match native read truncation and continuation language as closely as practical; keep direct text output and directory listing behavior.
  - Validation: Tool tests for default truncation, offset/limit reads, clipped continuation text, invalid ranges, directory listings, and pinned `ref` reads; `npm run check`.

- [ ] Deferred: citation validation
  - Goal: If citation honesty needs structural enforcement, validate `provide_results.locations` against the run trace instead of adding broad metadata first.
  - Work: Track which checked-out or GitHub files were actually read, including covered line ranges; reject or warn on locations sourced only from search candidates.

- [ ] Deferred: AST-aware local-code primitive
  - Goal: Provide a syntactic-region helper only if grep/read chains prove too wasteful.
  - Work: Consider `read_enclosing_node(path, line, language?)`, likely TypeScript/JavaScript first.
