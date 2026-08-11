---
status: open
type: grilling
blocked-by: []
---

# Does history search earn its place?

## Question

Cross-repo commit and diff search is available from a search backend. `checkout_repo` plus git already answers every history question about a repo you have cloned. Does a history search tool belong in the toolset, and if so, described how?

Blocked on nothing now that the head-to-head spike has landed. Its finding that matters here: a backend answers "which repositories match" instance-wide for **2,952 bytes**, and no native path offers an equivalent projection. So cross-repo *discovery* is cheap and backend-only — which is the same argument this tool rests on, already proven for code. Whether it holds for history is the question.

## The case for it

For one repo, the API loses outright: `git log --grep`, `git log -S`, `--author`, and `git diff` are richer, unpaginated, and uncapped. The value is entirely in **not knowing which repos to clone**. "Which services added a call to this deprecated endpoint last quarter", across tens of thousands of repositories, is one streamed query; as clone-and-grep it is not a task.

That puts history search in the role code search already occupies in the librarian's documented strategy: a discovery instrument producing candidates, verified afterward with a clone. Not a new concept to teach the prompt — the existing one, applied to history.

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
