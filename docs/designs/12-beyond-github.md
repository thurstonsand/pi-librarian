# Research beyond GitHub

## Status

Implemented

## Decision Summary

The librarian researches any code its user can reach, not only GitHub: declared GitLab, Bitbucket Server, and Sourcegraph instances, configured entirely in settings, with no MCP dependency. Each engine gets its own honestly named search tools over one delivery contract, so the agent always knows what it searched, whether the search was complete, and where the full results are. pi-web-tools folded in along the way, so the web tools ship here and every run has them.

This record summarizes what was built. The reasoning lives in the [wayfinding map](../wayfinding/beyond-github/map.md), its tickets, and [the tool surface](../wayfinding/beyond-github/tool-surface.md), which holds every tool's literal text.

## What was built

- **Sources.** `librarian.sources` declares instances by `name`, `url`, and `kind` (`github`, `gitlab`, `bitbucket-server`, `sourcegraph`); `github` is built in and `gitlab.com` can be switched on. A kind decides URL layout and possible roles (`clone`, `code-search`, `repo-search`); `disabled` declines roles. Tokens come from the environment only, by `tokenEnv` or the kind's conventional variable, and a source without one still clones. An optional `description` of up to 300 characters carries what the agent cannot discover, at the end of every tool that reaches the source. Ticket [04](../wayfinding/beyond-github/tickets/04-authenticating-to-code-hosts-and-backends.md), [05](../wayfinding/beyond-github/tickets/05-reaching-a-repo-reference-forms-and-clone-resolution.md), [11](../wayfinding/beyond-github/tickets/11-user-supplied-hints-about-a-source.md).
- **One tool per engine.** `search_code_<engine>` and `search_repos_<engine>` for each engine with an instance, plus `find_definition` on Sourcegraph, `read_file` on every code host, and `checkout_repo`. A tool takes `source` only when it has two or more instances, and `checkout_repo` needs none when only one source clones. Ticket [01](../wayfinding/beyond-github/tickets/01-charting-the-way-beyond-github.md), [02](../wayfinding/beyond-github/tickets/02-native-search-versus-a-search-backend.md), [03](../wayfinding/beyond-github/tickets/03-handling-uneven-gitlab-search-capability.md).
- **Delivery.** Every search writes all it fetched to `<cacheDir>/searches/<call-id>/results.jsonl` and returns a digest: what was found, whether the search was complete (an allowlist, per engine), what is shown, and the artifact's path. `limit` defaults to 10 and caps at 50; a search past 15 seconds is an error that cancels the request. Ticket [06](../wayfinding/beyond-github/tickets/06-delivering-search-results-without-drowning-the-context.md).
- **Wording.** Descriptions hold facts about one tool, name no sibling, and carry no "do not use when" clauses; the librarian's prompt is composed from the tools a run has, renders their `promptGuidelines`, and says that no results on one source is not absence. Runs load no user context files. Ticket [09](../wayfinding/beyond-github/tickets/09-tool-exposure-wording-and-arguments.md).
- **The `librarian` tool** takes `query` and `continue_from` only; repositories and their source are named in the query, since `repos` and `owners` could not say which host they meant.
- **Web tools.** `web_search` (Parallel) and `web_fetch` (GitHub, then Parallel, then a local browser) ship here, in the main session and every run. One GitHub client per source serves the repo tools and `web_fetch`, so GitHub Enterprise URLs resolve too; an issue carries its timeline filtered to closes, reopens, and references. Settings sit under `librarian.web.*`, and the whole `librarian` block refuses unknown keys. Ticket [12](../wayfinding/beyond-github/tickets/12-folding-pi-web-tools-into-the-librarian.md).
- **A usage log** at `<cacheDir>/usage.jsonl` records how runs used their search results, as evidence for the default `limit` and attach-mode weight.

## Rejected

- **History search across repositories**: real, otherwise impossible, and too rare to earn a tool. `checkout_repo` plus git answers every other history question. Ticket [07](../wayfinding/beyond-github/tickets/07-does-history-search-earn-its-place.md).
- **Duplicate and vendored-copy handling on native search**: verification by reading already corrects what it would improve. Ticket [10](../wayfinding/beyond-github/tickets/10-forks-vendored-code-and-duplicate-results.md).
- **`find_references`, `compare_revisions`, extra tools, Bitbucket Cloud, an MCP dependency, and fanning GitLab search out across projects**, each for the reason the map's _Out of scope_ or the tool surface gives.

## Deferred

- **Attach-mode weight.** `/librarian` adds every repo tool to the main session; whether attach needs a narrower set waits on the usage log.
- **Caching search responses** within a run. Unexamined; clones are already cached.
- **Measurements this machine cannot make**: grep.app, gitlab.com advanced search, Parallel, and Firecrawl's Developer Index were measured from an orb and recorded in the [tool surface](../wayfinding/beyond-github/tool-surface.md). What only the work machine can check is left to deploying there.
