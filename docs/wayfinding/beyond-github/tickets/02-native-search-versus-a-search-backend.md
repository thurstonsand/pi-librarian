---
status: closed
type: prototype
claimed: subagent-02
blocked-by: []
---

# Native search versus a search backend, head to head

## Question

For like-for-like queries against the same repositories, does a dedicated search backend return materially better results than a code host's own search API — and better enough to change how the toolset is shaped?

This is the first ticket to work, because the answer moves several others. If native search is close to parity, the design is "native first, backend optional" and a Sourcegraph-less user is a first-class user. If native search is materially worse, the backend becomes the primary instrument and native search is a degraded fallback — which changes the configuration schema, the tool descriptions, and the prompt's search strategy.

## What to build

A throwaway script — not shipped code — that runs the same query set through each available path and dumps comparable output for human judgment. Fidelity over polish: the point is to have something concrete to react to.

Paths to compare, for whichever the operator's environment can reach:

- a code-search backend's keyword mode
- the same backend's stemmed mode
- the code host's own search API (Bitbucket Server global; GitLab project-scoped)
- `checkout_repo` plus `grep`, as the ground-truth baseline

## Query set

Cover the shapes the librarian actually issues. At minimum:

1. An exact symbol that exists in a known repo — precision check, and the baseline tells you the true answer.
2. A symbol common across many repos — does either path rank the definition above incidental uses?
3. A conceptual query with no exact match ("how are database connections pooled") — the case stemmed search exists for.
4. A regex or multi-line pattern — which paths can even express it.
5. A query scoped to one repo, and the same query unscoped — does breadth cost precision?

## What to record

Per query per path: result count, whether the ground-truth answer appears at all, its rank if so, wall-clock latency, payload size, and whether the result set was silently capped. Payload size matters as much as precision — one measured single-repo stemmed search returned 126KB of raw matches, a quarter of it from a lockfile.

## What the answer looks like

A short written comparison, linked from the resolution, ending in a recommendation on ordering: which backend the prompt should reach for first, for which question shapes, and whether any path is weak enough to not be worth building.

Note explicitly whether the honest answer is "it depends on the instance" — a plausible outcome, and one that pushes ordering into configuration rather than into the prompt.

## Constraint

Comparison output almost certainly contains private repository names and code. The written summary is generalized before it lands in the resolution; raw output stays local and uncommitted.

## Resolution

Ten query groups across four paths — a search backend in keyword and stemmed modes, a Bitbucket Server instance's search, a GitLab instance without advanced search, and clone-plus-ripgrep as ground truth — over five cloned repos on two code hosts, plus one host repo the backend does not index. Full write-up, harness, raw captures and metrics in `local-files/` (gitignored). Follow-up measurements closing an evidence gap are recorded below.

### Recall is a tie; the paths separate on rank, expressiveness, and payload

Scoped to a repo, backend and host and ripgrep return **the same file set**. So this was never about finding things.

**Ranking favours the backend.** Definition at rank 1 where a host said 11 of 14; rank 1 of 65 where the host said 11 of 88. Hosts have no fork or vendor awareness, and on a real instance nine of the first eleven hits for a symbol defined in exactly one place were vendored copies, generated stubs, and personal forks — including the same file twice from two copies of one repo. The backend excludes forks by default and reports it in its progress stream. This became its own ticket.

**Two question shapes are backend-only.** Conceptual queries: stemmed mode ranked the right module 2nd; keyword AND-binding missed, and so did both hosts, one returning zero. Regex and multi-line: only the backend can express them, and multi-line matched ripgrep's file set exactly. A host given a regex does not error — it returns a **silent zero**, which is worse than failing because it reads as an answer.

**Payload is where the backend is dangerous rather than better.** Every catastrophic number came from it: 98.9 MB of match JSON for an unscoped one-word query with `count:all` (66,217 files, 4.5s, genuinely uncapped); 1.06 MB for that query at the endpoint's default; 345 KB for a conceptual query against a single 148-file repo, dominated by four test files. Hosts cannot produce numbers like these only because their page ceilings are crude.

**Latency does not discriminate.** All remote paths 330ms–1.9s. Ripgrep is 5–10x faster but needs the clone first.

### The mechanism: a resolution ladder

`count:N` is a **match budget, not a file budget**. `count:20` returned one file; `count:100` returned two; the ground-truth answer was absent from both. There is no way to ask for "the top twenty files", and a user-facing `limit` passed through to `count:` would silently lose answers. **The search tools cannot have a naive limit parameter.**

What works instead is asking for a coarser resolution of the same search. Measured:

| resolution | returns | cost |
| --- | --- | --- |
| `select:repo` | which repositories match | **2,952 bytes** instance-wide, 12 repos, 1.2s |
| `select:file` | which files, ranked, with commit shas | **7,472 bytes** at project scope; 8% of full |
| full | matched lines | scales with volume, unbounded |

`select:file` returns the **identical file list in identical rank order** — verified by diff on both modes — retaining `repository`, `path`, `commit`, `language`, `branches`. Everything a pinnable citation needs, for 8% of the bytes. This should be the default response shape, with full snippets fetched deliberately for a shortlist.

Each rung is cheap enough to inform the next, which is the same progressive refinement the librarian already runs from search to `checkout_repo`.

### Volume, not scope

An earlier reading of this data concluded that a repo scope should be **required**, because unscoped search lost the ground truth on every path. That was wrong, and the correction matters: the spike only tested one repo against the whole instance, never the middle. Follow-up measurements:

- A Bitbucket Server instance accepts a **project modifier alone** — 19 hits across 2 repos, 19 KB. Native cross-repo search at project level works.
- The backend at project-prefix scope, selective symbol: 19 files, 3 repos, 30,980 bytes full / **7,472 with `select:file`**, no caps.
- The **same project scope**, stemmed, common terms: 1,834 files, 70 repos, **753,636 bytes even with `select:file`**.

Identical scope, a hundredfold difference. The axis is **result volume, which is selectivity times breadth** — scoping to one repo merely happened to bound volume. What is broken is an unbounded *full-resolution* search, not a wide one. The tool's job is to make coarse resolutions the natural default and full snippets a deliberate act, not to demand a scope.

Cross-repo search is therefore untouched, at any width. `select:repo` answers "which repositories use this" across an entire instance for 3 KB.

### Recommended ordering

Not instance-dependent, so it belongs in the prompt: the backend's advantage on conceptual and regex shapes; hosts' inability to express either; the ranking gap at width; the resolution ladder.

Instance-dependent, so it belongs in configuration: whether a backend exists at all, what it covers (one measured instance indexed 13 repos of an entire host), whether a GitLab has advanced or exact search, and how polluted a host is by vendored and forked code.

- Conceptual — backend stemmed, `select:file`. No native path serves this shape; without a backend the honest fallback is clone-plus-grep, not a native call.
- Regex or multi-line — backend, or clone-plus-ripgrep. Never native.
- Exact symbol, repo known — either. Prefer the backend on rank and bytes; native is a fine fallback, recall is identical.
- Exact symbol, repo unknown — backend. A host's widest search was the weakest path in the matrix.
- Breadth, "who uses X" — `select:repo`. No native equivalent.
- Single-repo deep work — clone, as the standing preference already says.

Nothing measured was weak enough to drop.

### Corrections to earlier assumptions

- **GitLab's project-scoped search is not the weak sibling.** It ranked as well as the backend on its own repo at 58% of the bytes, and it was the only path that could see a repo the backend does not index — where the backend returned zero it returned a hundred results. It came closest to being written off and earned its place. This closes ticket 03.
- **The backend is more expensive than native**, by two to three orders of magnitude on bad cases. The framing was quality versus availability; the data says quality versus blast radius.
- **Feature detection is impossible, not merely disfavoured.** The capability endpoint that would report search tier returns **403** — admin-only. Configuration wins by default rather than by preference.
- **"Exact code search" offers no middle tier** on an instance with neither it nor advanced search, confirmed twice independently. Ticket 03's open question, closed.
- **`skipped[]` severity is useless for detecting truncation** — entries carry `severity: "info"` including a real cap. The `reason` string is the only signal.

### Incidental constraints for later tickets

- **Result units differ across all three remote paths and none documents it.** The backend is per-file; one host is per-file *usually* (an extension-filtered query returned the same file twice in a page); the other is per-match. Counts are not comparable without normalising, and "showing N of M" wording cannot be shared.
- A host's `total: 10000` for a common term is a **saturation sentinel, not a count**. It must never reach the model as a number.
- **`https://user:token@host/…` clone URLs are unreliable** against a Bitbucket Server instance: one repo failed authentication that way and cloned immediately with `git -c http.extraHeader="Authorization: Bearer …"`. Use the header form only.
- A host's repo modifier alone returns a **null code entity rather than an error**; the project modifier must lead. Encode in the query builder.
