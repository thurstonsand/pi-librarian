---
status: closed
type: research
blocked-by: []
---

# Handling uneven GitLab search capability

## Question

GitLab code search is only fully available on instances with advanced search enabled. Without it, project-scoped blob search works and anything broader is rejected. Some instances will have it, some will not, and gitlab.com behaves differently again. How does one tool behave correctly across all of them?

## What is known

Verified against an instance without advanced search:

```
GET /api/v4/projects/:id/search?scope=blobs&search=…   → 200, real hits
GET /api/v4/groups/:id/search?scope=blobs&search=…     → 400
GET /api/v4/search?scope=blobs&search=…                → 400
                 {"message":"Scope supported only with advanced search or exact code search"}
```

So on such an instance, code search requires knowing the project first — which `GET /api/v4/projects?search=` provides, by substring, with authoritative clone URLs attached. Two calls, both working.

The error message names a second mechanism, "exact code search", which is a distinct newer GitLab feature and was not tested. Whether it offers a middle tier between project-scoped and advanced is unknown and worth establishing.

## To resolve

- What GitLab actually offers at each tier: project, group, global, and whether exact code search changes the picture.
- How the tool learns which tier it has. The options are declaring it in configuration, discovering it from a `400`, or probing once. Configuration is honest but pushes work onto the user; discovery from a `400` is free but produces one wasted call per session. There is a real preference on this map against feature detection — but that preference was set for a case where failure was cheap and visible, and a `400` mid-research is neither. Argue it rather than assuming it.
- Whether a degraded GitLab is worth exposing at all, or whether project-scoped-only search is better folded into a verification role: find the project by name, then search inside it, and never claim to search broadly.
- What the failure reads like to the model. A `400` whose message says "ask your administrator" is not actionable by an agent; the tool should translate it into a usable next step.

## Constraint

Establish behaviour against a public GitLab as well as a private one, so the finding is documentable without reference to any instance.

## Resolution

Closed by [Native search versus a search backend, head to head](02-native-search-versus-a-search-backend.md), which answered both substantive questions and disproved this ticket's premise.

**The premise was wrong.** This ticket was written on the assumption that project-scoped-only search was a degraded sibling, possibly not worth exposing. Measured, it ranked **as well as the search backend on its own repo, at 58% of the bytes** — and it was the only path that could see a repo the backend does not index, returning a hundred results where the backend returned zero. It is a first-class path with a narrower reach, not a degraded one.

**What GitLab offers at each tier**, on an instance with neither advanced nor exact code search: project-scoped blob search returns 200 with real hits; group-scoped and global both return `400 Scope supported only with advanced search or exact code search`. "Exact code search" offers **no middle tier** — confirmed twice independently, once by the scope refusal and once by a separate refusal of a `regex` parameter. So the tiers are project or nothing.

**How the tool learns its tier**: it does not. The capability endpoint that would report it returns **403** — admin-only. This ticket argued the no-feature-detection preference should be re-litigated because a `400` mid-research is not cheap failure. Moot: detection is impossible, so the tier is configured. The preference stands, now on stronger ground than when it was set.

**The one survivor** — translating a `400` whose message says to ask an administrator into something an agent can act on — is not a decision, it is wording. Moved to [Tool exposure: wording, arguments, and upstream inspiration](09-tool-exposure-wording-and-arguments.md).

One consequence worth carrying: because GitLab has no group tier, it is the only measured path with no middle scope. A search backend and a Bitbucket Server instance both handle project-level cross-repo search natively.
