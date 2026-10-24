---
status: closed
type: grilling
blocked-by: []
---

# Does history search earn its place?

## Question

Cross-repo commit and diff search is available from a search backend. `checkout_repo` plus git already answers every history question about a repo you have cloned. Does a history search tool belong in the toolset, and if so, described how?

Blocked on nothing now that the head-to-head spike has landed. Its finding that matters here: a backend answers "which repositories match" instance-wide for **2,952 bytes**, and no native path offers an equivalent projection. So cross-repo *discovery* is cheap and backend-only — which is the same argument this tool rests on, already proven for code. Whether it holds for history is the question.

## What the probe measured

Run against a real 7.6.0 instance indexing ~5,500 repositories, over four rounds. **Read the rounds as a warning as much as a result:** three separate conclusions were drawn and then overturned, because timeout, match budget, and search term were varied together rather than one at a time. The numbers below are the final state, and the corrections are recorded because the mistakes were more instructive than the measurements.

### The two knobs that made the early rounds wrong

`timeout:` is a query filter with a **20-second default** and a **180-second ceiling**; `timeout:300s` is silently capped. Every "wall" in the first round was that default, which is why four unrelated probes landed within 100ms of each other. The published documentation says 10 seconds and a one-minute maximum, so the docs are stale against 7.6.0 here.

Predicate arguments must be **unquoted**, and this is the trap worth remembering: `repo:has.commit.after("2026-07-01")` fails with `invalid time ref`, while `repo:has.commit.after(2026-07-01)` succeeds. Meanwhile `before:` and `after:` *require* quoted arguments. Two date-taking constructs, opposite quoting rules, one of them undocumented. Unquoted, the predicate accepts every format tried, including `1 month ago` and `yesterday`.

### What history search actually costs

| target | scope | latency | outcome |
| --- | --- | --- | --- |
| `type:commit` | 1 repo | 1.2s | complete |
| `type:commit count:all` | 13 repos | 9.9s | complete |
| `type:commit count:all` | 41 repos | 28.2s | complete, **11.7 MB** |
| `type:diff count:all select:repo` | 41 repos | 77.3s | complete |
| `type:commit count:all` @180s | instance-wide | 180.4s | **1 repo short of complete**, 8,485 matches across 139 repos |

Cost is close to linear: **~0.7s per repository for commits, ~1.9s for diffs.** The final figure is the one that overturned the earlier verdict — instance-wide history search does essentially work in a single streaming call, covering all but one repository in 180 seconds, and it names the gap. Earlier rounds reported it as hopelessly incomplete because they ran at the 20-second default.

### Which filters reduce work, and which only filter results

This is the finding most worth keeping, because it is the opposite of everyone's intuition.

**Work-reducing**, because they resolve from the index before any history is walked: `repo:` patterns, `repo:has.path()`, `repo:has.content()`, `repo:has.file(path: content:)`, `repo:has.topic()`. All sub-2s at instance scale — `has.file(path:go\.mod content:cobra)` returned 1,371 repositories in 1.26s, and a plain repo-set count runs in 575-825ms regardless of size, which makes an exact pre-flight essentially free.

**Not work-reducing**, because they are attributes of commits and git must walk history to evaluate them: `after:`, `before:`, `author:`, `message:`, the content pattern, `count:`, and `select:`. Measured: `after:"1 year ago"` produced the same wall and *fewer* results; `author:` instance-wide returned zero and still timed out; `select:repo` cut payload 500x and work not at all.

Sourcegraph's own site configuration documents `commitDiffMaxRepos` at **50** and `commitDiffWithTimeFilterMaxRepos` at 10,000 (an example on the same page says 5,000 — the docs contradict themselves), which would make a time filter a *permission token* that raises the breadth ceiling rather than an optimisation. Not observable on this instance: an unbounded instance-wide commit search reached a known target repository and 139 others, so the cap is configured well above the default or is not enforced in 7.6.

### Three ways this backend answers "nothing" while meaning "I gave up"

`count:N` bounds the **response, never the work**. A common term with `count:250` stopped early at exactly 250 matches in 34.6s; a rare term with the same budget searched the whole instance for 180s and returned zero.

That early stop is reported as `skipped: shard-match-limit` / "result limit hit" — and it fooled this ticket's own probe harness, which checked only for `shard-timeout` and pronounced a truncated search complete. **The rule must be an allowlist**: any `skipped` reason other than `repository-fork` and `repository-archived` means incomplete. Denylisting the known-bad reasons is exactly how the mistake was made.

`repositoriesCount` in the progress event counts repositories **with matches**, not repositories searched, so the streaming API cannot report coverage as a fraction. `shard-timeout` says something was missed and never how much.

An over-broad query at the default timeout returns zero results, a clean `done`, no `skipped` entry, and no error. `repo:has.commit.after(2020-01-01)` instance-wide returns 0 repositories at 20s and 5,116 at `timeout:120s`. An unknown predicate, `repo:has.totally.made.up(x)`, returns 196 bytes and no error at all, so typos are invisible.

## The case for it

For one repo, the API loses outright: `git log --grep`, `git log -S`, `--author`, and `git diff` are richer, unpaginated, and uncapped. The value is entirely in **not knowing which repos to clone**.

The measurement narrows that value without destroying it. "Which services added a call to this deprecated endpoint last quarter" is *not* one streamed query across tens of thousands of repositories — at that breadth it returns nothing, or a partial answer it cannot label as partial. It is one streamed query across a few dozen, which is still a scope where clone-and-grep is a chore and a single query is not. And the narrowing step itself is cheap and exhaustive along the date axis, so "which repositories changed since last quarter" can legitimately feed "what changed in them".

That puts history search in the role code search already occupies in the librarian's documented strategy: a discovery instrument producing candidates, verified afterward with a clone. Not a new concept to teach the prompt — the existing one, applied to history. What is new is that the instrument has a hard breadth limit, and the tool would have to own it rather than pass it to the model.

## The shape under consideration

Commit search and diff search share four arguments of six, hit the same endpoint, and differ only by result type and a content pattern — one tool with an explicit target, pattern required for diffs. Upstream also pluralized several arguments (authors, revisions, content terms, all OR-combined) after the scripts were written, which is worth adopting rather than inheriting the singular forms.

## To resolve

- Whether it survives at all, given the standing preference against tools that duplicate what a clone can do.
- Whether it is backend-only, and whether that is disqualifying. Neither code host offers diff or commit-content search over many repos; the spike confirmed the backend has no native peer for breadth projections. A backend-only tool has a higher bar, and this one has to clear it on the discovery case alone.
- Whether a resolution ladder applies here too. If "which repositories changed this" can be answered for a few kilobytes the way it can for code, that is a much easier tool to justify than one that streams diffs.
- The exposed wording. This is the tool most at risk of being reached for wrongly: a model that sees "search commits" will use it for single-repo history where git is strictly better. The description has to actively push it away from that, in the manner of the upstream descriptions' explicit "do NOT use when" sections.
- Whether the repo scope should be required. Upstream requires it, which forces the model to narrow first — a good default that also makes the tool useless for the open-ended discovery case that justifies its existence.
- Whether commits and diffs are genuinely one tool once the wording is written. If the two descriptions turn out to disagree about when to use them, that is evidence they are two tools.
- Where contributor-repo lookup lands. It is a scoping instrument that narrows a large instance to a handful of repos before a history search — arguably part of this tool's story rather than its own tool, and its own upstream description warns against using it as a people lookup.

## Resolution

**Not building it.** No history search tool. Cross-repo commit and diff search stays unexposed, and history questions are answered by `checkout_repo` plus git.

### What the capability actually reduces to

The tool is technically viable — one streaming call covers the instance in 180 seconds and names its gap — so this is not a rejection on feasibility. It is a rejection on demand.

Every history question falls into one of four groups, and only the last one needs a tool:

Questions about the **current** state are `search_code` questions. "Which services still call the deprecated endpoint" sounds historical and isn't, and in practice that is the shape most migration and audit work takes. Code that is gone is by definition code nothing depends on.

Questions about **one repository** belong to git, which wins outright: `git log --grep`, `git log -S`, `--author`, `git diff`, all richer, unpaginated, uncapped, and available at any ref. Measured 5-10x faster than any remote path in the head-to-head spike.

Questions about **a handful of repositories** are narrow-then-clone. `search_repos` with `has.commit.after(...)` already answers "which repositories changed since X" cheaply and exhaustively along the date axis, which is the narrowing step; the clone answers the rest.

That leaves exactly one group: **what used to be true and no longer is, across repositories you cannot enumerate.** Deleted code across thousands of repositories. Real, otherwise impossible, and rare enough that nobody asking for this feature could name a second instance of it. The strongest case anyone constructed was scanning history for a leaked credential across the fleet, which is incident response rather than code research and should not be a research agent's tool.

A capability with one rare use case does not earn a tool, its own settings, a distinct failure mode, and a paragraph of prompt warning it away from the thing the model will reach for it to do.

### The shape it would have taken

Recorded so the decision is reversible rather than merely made.

A separate tool, not a flag on `search_code`, because the pre-flight needs the repository scope as a **first-class argument**. A free-form query string makes the scope uncountable: given `type:commit deprecated repo:^x/`, stripping `type:` and adding `select:repo` counts repositories *containing the word deprecated in code*, which is a different and smaller number. Getting the right count means parsing query syntax to separate filters from pattern, inside a tool whose whole purpose is to avoid doing too much work.

```
search_history(target: commit | diff, pattern, repos, authors?, after?, before?, detail?)
```

Streaming transport with a hard `timeout:180s`, not Search Jobs. Coverage from the `skipped` allowlist. Projected delivery, since 41 repositories of commit matches is 11.7 MB and instance-wide `count:all` is 27 MB. Roughly a hundred lines, most of it the completeness check that `search_code` needs anyway.

An earlier draft of this design was built on Search Jobs, with a per-source time budget, live `repoStats` polling, cancellation, partial export download, and explicit deletion. That was a subsystem invented to solve a problem `timeout:` already solves, and it is recorded below only because the Search Jobs findings are worth keeping.

### Search Jobs, investigated and declined

Real, present on 7.6.0, and more capable than its own documentation claims. `validateSearchJob` accepts `commit`, `diff`, `file`, and `path`, while the published limitations section says `type:file` only and claims commit and diff are ignored — so the instance is the authority and `validateSearchJob` is a free pre-flight against version drift.

Measured behaviour, none of it documented:

- The JSONL export at `/.api/search/export/<id>.jsonl` is readable **while the job is `PROCESSING`**, and grows: 54 KB / 17 results, then 1.1 MB / 190, then 1.9 MB / 397 at 55 seconds.
- A **cancelled** job keeps serving its partial export indefinitely — one returned 35 MB / 8,697 lines after cancellation.
- `repoStats` gives live `total / completed / inProgress`, which is the only honest coverage fraction anywhere in the API. `total` grows as work is discovered.
- **Cancelling destroys the progress record.** A job that had completed 8,697 units reported `{total: 5, completed: 5}` afterwards. Coverage must be captured from the last poll before cancelling.
- No documented TTL. Jobs and their exports persist until `deleteSearchJob`, so cleanup is the caller's job.

Declined because a bounded run is only better than the streaming path when the streaming path cannot report coverage, and for a tool we are not building that trade never comes due. If cross-repo history search is ever revisited, start here rather than with the streaming API.

### What transfers, and where it goes

The findings outlive the decision. Three of them belong to tools that *are* being built:

- **The `skipped` allowlist is a bug in `search_code` today**, not a hypothetical. `shard-match-limit` made a truncated search look complete to this ticket's own harness. Belongs with delivery and completeness reporting.
- **`select:file` savings vary from 13% to 92%** depending on match density — 4.59 MB against 5.27 MB on a saturating query, versus the 8% the head-to-head recorded on a selective one. The projection drops snippets, so it saves hugely when few files carry many matches and almost nothing when 13,000 files carry one each. Ticket 06 currently states the 8% figure as a property of the projection, which it is not.
- **`repo:has.file(path: content:)`** is the strongest work-reducing scope filter available and was missing from every earlier list.

And one process note: the canonical query documentation is unreadable to an agent. `sourcegraph.com/docs` and `docs.sourcegraph.com` are JavaScript-rendered and return empty bodies; [`github.com/sourcegraph/docs`](https://github.com/sourcegraph/docs) is the live source, current to within a day, and is where this should have started.
