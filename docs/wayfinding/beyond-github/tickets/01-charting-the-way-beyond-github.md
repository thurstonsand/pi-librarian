---
status: closed
type: grilling
blocked-by: []
---

# Charting the way beyond GitHub

## Question

The librarian researches GitHub and public code. An existing internal tool researches a self-hosted code-search instance covering tens of thousands of repositories on non-GitHub code hosts. What of that capability belongs here, in a public repo, and in what shape — without any internal detail becoming public?

## Resolution

### Build it here, first-class

The alternative was a private companion package wired in through `librarian.extensions` and `librarian.tools`, which the existing extra-tools seam already supports. Rejected: the plumbing that would be duplicated is not thin — stream parsing, query building, result formatting, trace rendering, settings validation — and duplicated plumbing rots where nobody can see it.

Supporting a code-search product is public knowledge. Only an instance is private. So the client ships here, and the discipline is a set of rules rather than an architecture: no default instance URL (unconfigured means the backend does not exist), every fixture and doc example uses `example.com`, and no smoke evidence from a private instance is ever committed.

This changes what the librarian is. It was "research open source code"; it becomes "research any code you can reach". Ethos statements and README follow.

### No MCP

The internal tool calls a mixture of GraphQL, a streaming search endpoint, and MCP. The MCP dependency is unnecessary and actively worse. Verified on a live instance:

- The stemmed-search MCP tool and the plain streaming endpoint return the **same result set in the same rank order**. Ranking is already in stream emission order.
- MCP returns a pre-rendered markdown blob with no structured payload, truncated server-side at 50KB. The stream returns structured matches carrying `commit`, `language`, `lineMatches`, and `pathMatches` — and the commit sha is what makes citations pinnable, which is the librarian's quality bar.
- The contributor-repos MCP tool had already renamed an argument out from under its caller, breaking it, and silently returns one fewer row than the GraphQL field it wraps.

An independent internal project reached the same conclusion, its source noting that going direct to REST "bypasses MCP layer… no schema overhead."

Everything needed is available as GraphQL fields and streaming search. Also of note: the streaming endpoint accepts a stemmed pattern type directly, so stemmed search costs nothing extra.

### Three search tools, not one router

Considered unifying code search behind a single tool with a `backend` argument. Roughly five arguments overlap across backends, but `repo` scoping means three different things (substring, exact list, regex), and regex, case sensitivity, and stemming are available on some backends and not others.

What settled it: **repo discovery by name is native everywhere** — GitHub search, GitLab's project list, Bitbucket Server's repo list, and a search backend's repo list all do substring matching. So scoping moves out of code search into `search_repos`, and once it does, what remains in each code-search tool is irreducibly backend-specific. Unification would produce an enum sharing one field and disagreeing on the rest.

### Capability findings

Verified live, generalized:

- **Bitbucket Server has global code search** at `POST /rest/search/latest/search` with `{"query": …, "entities": {"code": {"start": 0, "limit": N}}}`, returning `hitContexts` with line numbers. Values are HTML-escaped and carry `<em>` match markers, so unescaping is edge work. A Bitbucket user needs no separate search backend.
- **GitLab code search is project-scoped only** without advanced search: a project-scoped blob search succeeds, group-scoped and global return `400 Scope supported only with advanced search or exact code search`. Instances differ; handling both is its own ticket.
- **Both hosts return authoritative clone URLs** from their repo APIs, including a non-default SSH port. Deriving clone URLs from search-backend metadata is therefore a fallback, not the primary path — the primary path is asking the host.
- **Search-backend coverage is partial.** An instance indexed only one namespace of one host, and did not contain a repo the user owns. A search backend can never be the only route to a repo.
- **grep.app is unreachable from some corporate networks**: TLS interception, then `504` on the search endpoint and `429` on the site. Retries do not help. This is why the tool surface must be dynamic rather than fixed.

### Settled shape

- `find_symbol` with `kind: "definition" | "references"` — the two upstream tools differ by one argument and resolve through the same symbol-usage query, so it is one query with a filter.
- `compare_revisions` dropped; `checkout_repo` plus `git diff` is better.
- History search survives as a **discovery** instrument only — single-repo history belongs to git. Its exact exposure is its own ticket.
- Contributor-repo lookup is described strictly as a **scoping** instrument, never a people lookup.
- Repo references take a required `source`, with `sourcegraph`-style names as one accepted form and raw URLs passed through.
- Settings: `librarian.tools.extra` and `librarian.tools.disabled`, disabled applied last and applied to extras too. Replaces today's `librarian.tools`, breaking compatibility deliberately. No feature detection — assume an endpoint works, and let the user disable what their instance lacks.
- The tool surface and the system prompt are both built at registration from what is configured and reachable. An unavailable backend is not describable, so it cannot be chosen.

### Incidental

`DEV.md` documents `extensions/librarian/sourcegraph.ts` and a test named `"parses sourcegraph stream matches"`. Neither has ever existed in git history — a prototype that was written, tested, and removed before its first commit, leaving only the documentation. Fix as part of this effort.
