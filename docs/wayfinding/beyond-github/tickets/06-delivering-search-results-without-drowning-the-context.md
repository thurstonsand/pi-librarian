---
status: closed
type: grilling
blocked-by: []
---

# Delivering search results without drowning the context

## Question

Cross-repo search can return anything from three kilobytes to a hundred megabytes. How much reaches the context window, how much lands on disk, and what does a tool return so the agent can decide whether to go deeper?

## What the head-to-head measured

The numbers are in [Native search versus a search backend, head to head](02-native-search-versus-a-search-backend.md). The ones that shape this decision:

**There is a resolution ladder, and each rung is cheap enough to inform the next.**

| resolution | returns                               | cost                                          |
| ---------- | ------------------------------------- | --------------------------------------------- |
| repo-level | which repositories match              | **2,952 bytes** instance-wide, 12 repos, 1.2s |
| file-level | which files, ranked, with commit shas | **7,472 bytes** at project scope; 8% of full  |
| full       | matched lines                         | scales with volume, unbounded                 |

File-level returns the **identical file list in identical rank order** as full — verified by diff — keeping `repository`, `path`, `commit`, `language`, `branches`. Everything a pinnable citation needs, at 8% of the cost.

**But 8% is a property of that query, not of the projection.** Ticket 07 re-measured on a saturating instance-wide query: `select:file` returned 4.59 MB against 5.27 MB full, a **13%** saving across 13,055 matched files. The projection works by dropping snippets, so it saves enormously when a few files carry many matches each and almost nothing when thousands of files carry one match each. The middle rung is therefore worth 8% or 87% depending on match density, which the caller cannot know in advance — an argument for making the rung an explicit argument rather than an inference, and against quoting any single savings figure in a tool description.

### Completeness is an allowlist, not a denylist

Carried from ticket 07, where this was a live bug rather than a hypothesis. Incompleteness arrives through `skipped[]`, and there is more than one way to be incomplete:

- `shard-timeout` — repositories that could not be searched in time.
- `shard-match-limit` — the `count:` budget was reached and the search stopped early; the title reads "result limit hit".
- `repository-fork`, `repository-archived` — **benign**, both are deliberate default exclusions.

Ticket 07's probe harness checked for `shard-timeout` alone and pronounced a truncated 250-match search complete. So the rule is to treat any reason outside the benign set as incomplete, because checking only for the failures you thought of is how a confident lie ships. This applies to `search_code` today, not to a future tool.

Worse, and relevant to any "showing N of M" wording: `repositoriesCount` in the progress event counts repositories **with matches**, not repositories searched. The streaming API cannot express coverage as a fraction at all. `skipped` says something was missed and never how much.

**A naive limit parameter is not available.** The backend's `count:N` is a match budget, not a file budget: `count:20` returned one file, `count:100` returned two, and the ground-truth answer was absent from both. Whatever bounds results, it is not a passed-through limit.

**Volume is selectivity times breadth, not scope.** The same project scope cost 7,472 bytes for a selective symbol and 753,636 bytes for stemmed common terms. So a scope requirement would not have bounded anything; only asking for a coarser resolution does.

## The candidate answer

Make file-level the default response shape and full snippets a deliberate second act. This is a genuine improvement over the digest-and-spill pattern that was this ticket's original premise: a digest over a truncated result set is a lossy summary of an incomplete answer, whereas file-level is a **complete** answer at lower resolution — nothing hidden, nothing capped, and the agent chooses where to spend context rather than the tool guessing for it.

The `pi-web-tools` fetch tools remain worth reading for the second act — `extensions/web-tools/delivery.ts` writes bodies under a per-call artifact directory and returns a digest of on-disk paths with line counts and sizes, plus an uncapped `highlights` field for the content the agent actually asked for. That pattern likely still earns a place where full-resolution output is large. It is no longer the primary mechanism.

## To resolve

- **How the ladder is exposed.** A `resolution` argument on one search tool, separate tools per rung, or an automatic coarsening when a result set exceeds a budget. Automatic is friendliest and least predictable; explicit is more surface but the agent can reason about cost. A hybrid — explicit argument, automatic coarsening as a safety net with a stated reason — is plausible and needs arguing.
- **What the second act looks like.** Fetching snippets for a shortlist could re-run the search narrowed to those files, or read the files directly from a code host, or read them from a clone. The third is cheapest if a clone already exists and worst if it does not.
- **Whether the artifact directory survives.** With file-level as default, a full-resolution response may be rare enough that spilling to disk is unnecessary complexity — or it may be exactly what makes an unbounded response safe. Depends on whether full resolution is ever the right first call.
- **Where artifacts live and how they are cleaned**, if they survive. Clones live under `cacheDir` at a stable `/tmp/pi-librarian` — deliberately reclaimable by the system rather than durable, so a one-off research repo does not occupy disk forever. Search output is per-run and shorter-lived still. Whether that argues for a different subtree, a different lifetime, or nothing at all is this ticket's call, inherited from the deleted configuration ticket.
- **How native paths join the ladder.** Neither host offers a repo-level or file-level projection; both return matches and page crudely. Whether the tool synthesises the rungs by post-processing, or whether native paths simply have fewer rungs and say so.
- **How a capped result set is signalled.** The backend reports skip reasons, but `severity` is useless — a real truncation carries `severity: "info"`, so only the `reason` string distinguishes a complete search from a trimmed one. A silently truncated search reads as evidence of absence, which is the worst possible failure for a research agent.
- **Whether counts can be shown at all.** Result units differ across every remote path: the backend counts files, one host counts files _usually_, the other counts matches, and a host's `total: 10000` is a saturation sentinel rather than a number. Any shared "N of M" phrasing would be wrong somewhere.
- **Whether attached tools behave the same.** In attach mode the main agent is the consumer, its context is more valuable, and it already has `read` and `grep`. The same shape probably works; the budget arguably should not be the same.
- **What the trace renderer shows.** `view.ts` renders one line per call; "12 repos" and "88 files" and "wrote 240 matches to disk" are three different lines.

## Resolution

**Answered by building the [delivery contract](../tool-surface.md#the-delivery-contract).** Every search writes all it fetched to an artifact and returns a digest; each question above has a section there.

- **How the ladder is exposed**: explicitly, as `detail` (`repos`, `files`, `matches`) where an engine has the rungs, and `limit` for how many come back. See [`detail` changes what comes back](../tool-surface.md#detail-changes-what-comes-back-not-how-long-the-search-takes) and [The agent chooses how many](../tool-surface.md#the-agent-chooses-how-many-limit).
- **The second act** is `read_file` or `checkout_repo` on the hit's commit, never a narrowed re-search.
- **The artifact survives**, unconditionally: [Writing is unconditional](../tool-surface.md#writing-is-unconditional), under `<cacheDir>/searches/<call-id>/` per [Where artifacts live](../tool-surface.md#where-artifacts-live).
- **Native paths have fewer rungs**, stated per engine in the [capability matrix](../tool-surface.md#capability-matrix), rather than synthesised.
- **A capped result set** is reported by an allowlist: a search is complete only when its engine says so. See [Completeness is an allowlist](../tool-surface.md#completeness-is-an-allowlist-not-a-denylist).
- **Counts** separate what the engine says exists, what was fetched, and what is shown, each in the engine's own unit. See [Three numbers, not two](../tool-surface.md#three-numbers-not-two).
- **Attach mode** uses the same shape; whether attach should carry fewer tools is deferred until the usage log has evidence.
