# Research Beyond GitHub

## Destination

An accepted design doc in `docs/designs/` that takes the librarian from GitHub-only research to any code the user can reach — search backends, code hosts, the tool surface they expose, and how results are delivered — complete enough to hand to `/grill-me` Gate 3 for execution planning.

## Notes

**Domain**: the librarian's research toolset.

**Skills to consult**: `/grill-me` for grilling tickets, `/wayfinder` for working the map.

**This repo is public and open source.** No internal hostname, repo name, project key, URL, token, or person appears in any file under this map or anywhere else in the repo. Findings from private instances get generalized before they land: "a GitLab instance without advanced search", not the instance.

**Sister effort**: some decisions here have a twin in a private repo that ships equivalent tooling, and some findings can only be recorded there, tracked through `local-links.md` in this directory.

**Standing preference**: prefer what the librarian can already do. `checkout_repo` plus git covers single-repo history, blame, and diffs better than any API. A new tool earns its place by enabling something otherwise impossible or infeasible, not by being available.

**Working artifact**: [Tool surface: inputs, outputs, and wording](tool-surface.md) — full tool definitions under review, including the shared delivery contract. It is ticket 09's output arriving early, because the shapes are needed to argue about ticket 06. Draft; nothing in it is decided.

**Personal tasks**: [Personal tasks](PERSONAL_TASKS.md) — measurements that need a personal machine or account: grep.app, gitlab.com advanced search, and the Firecrawl Developer Index.

## Decisions so far

- [Charting the way beyond GitHub](tickets/01-charting-the-way-beyond-github.md) — first-class multi-backend support in this public repo, driven entirely by settings; no MCP dependency; three honest search tools rather than one router; `find_symbol` unifies definition and references; `compare_revisions` dropped; `librarian.tools.{extra,disabled}`; the tool surface varies with what is configured and reachable.
- [Native search versus a search backend, head to head](tickets/02-native-search-versus-a-search-backend.md) — recall ties when scoped; the paths separate on ranking, expressiveness, and payload. A **resolution ladder** replaces result limits: repo-level for ~3KB instance-wide, file-level for 8% of full bytes with rank order and commit shas intact, full snippets only for a shortlist. Volume is selectivity times breadth, not scope, so cross-repo search stays at any width. Conceptual and regex shapes are backend-only and fail *silently* on native paths. Nothing measured was weak enough to drop.
- [Handling uneven GitLab search capability](tickets/03-handling-uneven-gitlab-search-capability.md) — closed by the spike, premise disproved: project-scoped search ranked as well as the backend at 58% of the bytes and was the only path to an unindexed repo. Tiers are project or nothing, "exact code search" adds none, and capability detection is impossible because the endpoint is admin-only.
- [Authenticating to code hosts and search backends](tickets/04-authenticating-to-code-hosts-and-backends.md) — secrets live in the environment and nowhere else; endpoints and a `tokenEnv` variable *name* live in settings. Explicit config, then conventional variable names, then an opt-in CLI fallback that is off by default and never required. Endpoint presence decides the tool surface synchronously and for free; credential validity is necessarily discovered on first use, because eager validation costs ~2s. Missing credential means the backend does not exist, silently. A `401`/`403` raises rather than returning empty — a cross-cutting rule, since an auth failure that reads as absence is the worst answer a research agent can give.
- [Reaching a repo: sources, host configuration, and clone resolution](tickets/05-reaching-a-repo-reference-forms-and-clone-resolution.md) — absorbed the configuration ticket, because source declarations are what make everything else here trivial. `librarian.sources` entries take a required `name`, `url` and `kind`, both name and url unique; `source` on `checkout_repo` is a declared **name**, never a kind, so two GitLabs are unambiguous, with `github` and `gitlab.com` built in. `kind` decides URL layout and which roles an entry can play, and an optional `disabled` declines roles from `clone | code-search | repo-search`. Clone URLs are **derived** from kind plus url — no lookup, no SSH derivation — which deletes a round-trip, a credential, and a result-ordering trap. **Cloning needs no credential from us at all**: ambient git helpers authenticate every host unaided. Identity stays host-based on disk and in the key, because a raw URL has no name to key by. `cacheDir` becomes a stable `/tmp/pi-librarian`, reclaimable by design.

### Where the last round went wrong

`source` was specified as required and never implemented; hostname-shape guessing grew in its place, and two reviews missed it because both checked the code against itself rather than against the decided forms. Everything downstream — Bitbucket's `/scm/` prefix missing from derived URLs, a two-segment repo path being inexpressible, an ambiguity error for references that were never ambiguous — was a symptom. The correction is a net deletion.

- [Does history search earn its place?](tickets/07-does-history-search-earn-its-place.md) — **no.** Technically viable, one streaming call covers the instance in 180s and names its gap, so this is a rejection on demand rather than feasibility. Every history question is either about current state (`search_code`), one repository (git wins outright), or a handful (narrow with `search_repos`, then clone). That leaves only "what used to be true, across repositories you cannot enumerate" — real, otherwise impossible, and rare enough that nobody could name a second instance. The findings that outlive it: **completeness is an allowlist**, not a denylist, since `shard-match-limit` made a truncated search look complete; `repositoriesCount` counts repos *with matches*, so coverage is inexpressible; repo-set filters reduce work while commit-attribute filters (`after:`, `author:`, `message:`) only filter results; and predicate arguments are **unquoted** where `before:`/`after:` are quoted.

## Built

The [tool surface](tool-surface.md) is implemented on `beyond-github`: settings for built-in sources, tokens, and the search budget; runs isolated from the user's prompt files; one search tool per engine for GitHub, grep.app, Sourcegraph, GitLab, and Bitbucket Server, on a shared digest, artifact, and budget; `read_file` on every code host; a composed prompt; the attach renderer; and a usage log for tuning the default result count. Each engine was smoke-tested live where it was reachable. Deviations found while building are recorded in the tool surface where they apply. What could not be tested from here is in [`PERSONAL_TASKS.md`](PERSONAL_TASKS.md). Still to do: removing extra tools, which lands with ticket 12.

## Not yet specified

- **Rendering symbol results** is settled by building it: `find_definition` lists each definition with its kind and container, grouped by clone source; context lines cost a raw read of 2–7s per file, so they were left out.
- **Attach-mode weight.** `/librarian` pushes every repo tool into the main session. The surface is about to grow. Whether that stays acceptable, or attach needs its own narrower set, is a question for after the toolset settles.
- **Caching backend responses.** Clones are cached; search responses are not. Whether repeated searches within a run should be, and where the cache would live, is unexamined.
- **Scoping the librarian tool itself.** The `librarian` tool takes `repos` and `owners`. With multiple code hosts, `owners` is ambiguous and `repos` may need a source. Not sharp until repo references are settled.
- **The staleness window** is settled by reading the code: an explicit `ref` always fetches from the origin regardless of `FETCH_DEBOUNCE_MS`, so a search hit's commit is checked out exactly, and only a default-branch checkout can be up to 15 minutes old. `checkout_repo`'s and `read_file`'s `ref` descriptions now say to pass the hit's commit; see the [tool surface](tool-surface.md).
- **Testing without a live instance** is settled: tests stub `fetch` at the network boundary, so the real clients, query building, and response parsing run, and assert the request each engine receives and the digest the agent gets.
- [User-supplied hints about a source](tickets/11-user-supplied-hints-about-a-source.md) — whether a declaration carries operator prose about local truths the librarian cannot discover, chief among them what a backend actually indexes.
- [Folding pi-web-tools into the librarian](tickets/12-folding-pi-web-tools-into-the-librarian.md) — the merge is decided; open are packaging, the overlaps between `web_fetch`'s GitHub fetcher and the repo tools, settings and tool names, and where Firecrawl's Developer Index lands.

- **Converging with `pi-web-tools`** is now decided: web-tools is deprecated and folds into this package. How is [Folding pi-web-tools into the librarian](tickets/12-folding-pi-web-tools-into-the-librarian.md) — packaging, overlaps with the repo tools, settings, and where Firecrawl's Developer Index lands.
- **Dependencies.** No backend has an official TypeScript search client. `@sourcegraph/src` is a Go CLI shipped through npm; both surveyed Bitbucket packages lack any search method. `@gitbeaker/rest` is credible and available through the internal mirror, and this package already depends on `@octokit/rest` in `github.ts`, so the precedent for a first-party client exists. Whether GitLab work grows enough to earn the dependency is open; one search request is a single authenticated GET.

## Out of scope

- **Bitbucket Cloud.** A different API from Bitbucket Server, and no one is asking. Confirmed unnecessary: the deployment driving this effort is keeping Bitbucket Server on-premise and replacing it with self-hosted GitLab over roughly two years, so Bitbucket Cloud is not on anyone's path. That also means no vendor-official Atlassian client becomes available, and that **GitLab deserves the investment while Bitbucket Server support should stay correct and cheap.**
- **Cross-repo history search.** Closed by ticket 07 on demand rather than feasibility. Search Jobs findings are recorded there as the starting point if it is ever revisited.
- **Windows support.** `cacheDir` is a stable `/tmp/pi-librarian`, which is POSIX-only, and that is accepted rather than worked around. `os.tmpdir()` is not the portable answer: it is `$TMPDIR` with a fallback, so it varies with launch context and would split the cache.
- **`compare_revisions`.** Single-repo by definition; `checkout_repo` plus `git diff` beats it on every axis.
- **Making GitLab advanced search work.** Whether an instance has it is the instance owner's problem. Ours is only to behave correctly either way.
- **Reconstructing global GitLab code search by fanning out across projects.** Measured as technically possible — 10 projects at 5 concurrent in ~1s, extrapolating to about a minute and 1.7 MB for 600 — but it rebuilds recall, which was already a tie, and produces no cross-repo ranking, which is the thing a search backend actually provides.
- **Tooling changes in the sister repo.** Real work, tracked in the sister map, not here.
