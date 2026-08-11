# Research Beyond GitHub

## Destination

An accepted design doc in `docs/designs/` that takes the librarian from GitHub-only research to any code the user can reach — search backends, code hosts, the tool surface they expose, and how results are delivered — complete enough to hand to `/grill-me` Gate 3 for execution planning.

## Notes

**Domain**: the librarian's research toolset.

**Skills to consult**: `/grill-me` for grilling tickets, `/wayfinder` for working the map.

**This repo is public and open source.** No internal hostname, repo name, project key, URL, token, or person appears in any file under this map or anywhere else in the repo. Findings from private instances get generalized before they land: "a GitLab instance without advanced search", not the instance.

**Sister effort**: some decisions here have a twin in a private repo that ships equivalent tooling, and some findings can only be recorded there, tracked through `local-links.md` in this directory.

**Standing preference**: prefer what the librarian can already do. `checkout_repo` plus git covers single-repo history, blame, and diffs better than any API. A new tool earns its place by enabling something otherwise impossible or infeasible, not by being available.

## Decisions so far

- [Charting the way beyond GitHub](tickets/01-charting-the-way-beyond-github.md) — first-class multi-backend support in this public repo, driven entirely by settings; no MCP dependency; three honest search tools rather than one router; `find_symbol` unifies definition and references; `compare_revisions` dropped; `librarian.tools.{extra,disabled}`; the tool surface varies with what is configured and reachable.
- [Native search versus a search backend, head to head](tickets/02-native-search-versus-a-search-backend.md) — recall ties when scoped; the paths separate on ranking, expressiveness, and payload. A **resolution ladder** replaces result limits: repo-level for ~3KB instance-wide, file-level for 8% of full bytes with rank order and commit shas intact, full snippets only for a shortlist. Volume is selectivity times breadth, not scope, so cross-repo search stays at any width. Conceptual and regex shapes are backend-only and fail *silently* on native paths. Nothing measured was weak enough to drop.
- [Handling uneven GitLab search capability](tickets/03-handling-uneven-gitlab-search-capability.md) — closed by the spike, premise disproved: project-scoped search ranked as well as the backend at 58% of the bytes and was the only path to an unindexed repo. Tiers are project or nothing, "exact code search" adds none, and capability detection is impossible because the endpoint is admin-only.
- [Authenticating to code hosts and search backends](tickets/04-authenticating-to-code-hosts-and-backends.md) — secrets live in the environment and nowhere else; endpoints and a `tokenEnv` variable *name* live in settings. Explicit config, then conventional variable names, then an opt-in CLI fallback that is off by default and never required. Endpoint presence decides the tool surface synchronously and for free; credential validity is necessarily discovered on first use, because eager validation costs ~2s. Missing credential means the backend does not exist, silently. A `401`/`403` raises rather than returning empty — a cross-cutting rule, since an auth failure that reads as absence is the worst answer a research agent can give.
- [Reaching a repo: sources, host configuration, and clone resolution](tickets/05-reaching-a-repo-reference-forms-and-clone-resolution.md) — absorbed the configuration ticket, because source declarations are what make everything else here trivial. `librarian.sources` entries take a required `name`, `host` and `kind`, both name and host unique; `source` on `checkout_repo` is a declared **name**, never a kind, so two GitLabs are unambiguous, with `github` reserved and implicit. `kind` decides URL layout and which roles an entry can play, and an optional `disabled` declines roles from `clone | code-search | repo-search`. Clone URLs are **derived** from kind plus host — no lookup, no SSH derivation — which deletes a round-trip, a credential, and a result-ordering trap. **Cloning needs no credential from us at all**: ambient git helpers authenticate every host unaided. Identity stays host-based on disk and in the key, because a raw URL has no name to key by. `cacheDir` becomes a stable `/tmp/pi-librarian`, reclaimable by design.

### Where the last round went wrong

`source` was specified as required and never implemented; hostname-shape guessing grew in its place, and two reviews missed it because both checked the code against itself rather than against the decided forms. Everything downstream — Bitbucket's `/scm/` prefix missing from derived URLs, a two-segment repo path being inexpressible, an ambiguity error for references that were never ambiguous — was a symptom. The correction is a net deletion.

## Not yet specified

- **Rendering symbol results.** `find_symbol` is settled in shape but not in output. Definitions want surrounding context; references want grouping by repo and file. Unclear until the delivery decision lands.
- **Attach-mode weight.** `/librarian` pushes every repo tool into the main session. The surface is about to grow. Whether that stays acceptable, or attach needs its own narrower set, is a question for after the toolset settles.
- **Caching backend responses.** Clones are cached; search responses are not. Whether repeated searches within a run should be, and where the cache would live, is unexamined.
- **Scoping the librarian tool itself.** The `librarian` tool takes `repos` and `owners`. With multiple code hosts, `owners` is ambiguous and `repos` may need a source. Not sharp until repo references are settled.
- **The staleness window.** A reused clone hard-resets to origin, but `FETCH_DEBOUNCE_MS` is 15 minutes, so "latest" means at most 15 minutes stale and nothing tells the agent that. Whether the prompt should say so, or the debounce should change, is unexamined.
- **Testing without a live instance.** CI can reach neither a private search backend nor, apparently, grep.app from every network. The existing pattern is pure parsers over fixtures, which likely extends — but the seam for backend selection and availability is new and untested.

## Out of scope

- **Bitbucket Cloud.** A different API from Bitbucket Server, and no one is asking. Revisit as a fresh effort.
- **`compare_revisions`.** Single-repo by definition; `checkout_repo` plus `git diff` beats it on every axis.
- **Making GitLab advanced search work.** Whether an instance has it is the instance owner's problem. Ours is only to behave correctly either way.
- **Reconstructing global GitLab code search by fanning out across projects.** Measured as technically possible — 10 projects at 5 concurrent in ~1s, extrapolating to about a minute and 1.7 MB for 600 — but it rebuilds recall, which was already a tie, and produces no cross-repo ranking, which is the thing a search backend actually provides.
- **Tooling changes in the sister repo.** Real work, tracked in the sister map, not here.
