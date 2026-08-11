---
status: closed
type: grilling
blocked-by: []
---

# Authenticating to code hosts and search backends

## Question

The librarian is about to need credentials for up to four services instead of one. Where does each come from, in what precedence, and what happens when one is missing?

## What is known

Today there is one path: `GITHUB_TOKEN`, then `GH_TOKEN`, then `gh auth token`, resolved once per session and shared by every GitHub-touching tool. That CLI fallback is the ergonomic win — most users are already authenticated and never configure anything.

The same trick generalizes. GitLab ships `glab`, which an internal tool already leans on entirely, checking `glab auth status` at session start and telling the user how to fix it rather than handling tokens itself. Bitbucket Server has no equivalent official CLI. A search backend has a token and nothing else.

So the shape is probably: environment variable first, CLI fallback where one exists, and nothing otherwise. But that leaves real questions.

## To resolve

- Precedence per service, and whether it is uniform. Uniformity is easier to document; per-service quirks may be unavoidable when only some have a CLI.
- Environment variable naming. Reusing a host's own conventional variable is friendlier but collides with other tooling; a namespaced variable is unambiguous but nobody has it set.
- Whether credentials may live in settings at all. Settings are a file on disk in a repo-adjacent location — a plausible place for a token to be committed by accident. The existing settings hold no secrets, and keeping that property is worth something.
- Cost of the CLI fallback. `gh auth token` is one subprocess resolved lazily and once. Four services means up to four subprocesses; whether they resolve eagerly at startup or lazily on first use changes startup latency against error timing.
- What "unavailable" means and when it is decided. A backend with no credential should contribute no tool — but a credential that exists and is *rejected* is a different case, discovered mid-research, and needs to fail in a way the model can act on.
- Whether a missing credential warrants a startup notification. There is precedent — extra-tool warnings already surface at session start — but four services makes four possible warnings, and warning about a service the user does not use is noise.

## Interfaces to pin down

- The provider seam: today `createGitHubClientProvider` is a lazily-memoized `() => Promise<Client>`. Whether that generalizes to a registry of providers, or each backend carries its own, determines how availability is tested.
- What a tool receives at registration versus at execution. Availability is a registration-time fact; a rejected credential is an execution-time fact. Both need a home.

## Resolution

### The line: secrets in the environment, everything else in settings

Credentials never appear in settings. Two reasons beyond the obvious one: the settings file is a plausible accidental-commit location and it currently holds no secrets, which is cheap to keep and expensive to regain; and settings are read from pi's *global* store, so a token placed there would apply to every project on the machine — strictly worse than an environment variable rather than more convenient.

Endpoints, capability declarations, and the *name of the variable holding a credential* live in settings. A host entry therefore declares `tokenEnv`, not `token` — it holds an identifier, never a secret. Naming it `token` would be a lie that invites someone to paste one in, so the field name is doing safety work. Its value should be validated at load as a plausible variable name and rejected if it looks like a credential (a recognisable token prefix, or length and case that no environment variable has), which conforms the input at the one edge where it enters.

### Multi-instance falls out for free

An earlier position here was one instance per kind, on the grounds that an environment variable cannot say which host it belongs to. That was an artifact of putting endpoints in the environment. Once a host is declared in settings, the variable only carries the secret and the declaration keys it — so a second GitLab, or a GitHub Enterprise Server alongside `github.com`, is just another entry naming a different `tokenEnv`. The constraint was invented and is withdrawn.

`github.com` remains implicitly available with no declaration, because it is the only backend that works unauthenticated and it already behaves that way.

### Precedence

Uniform across kinds, and it reads in one line: explicit configuration, then convention, then an opt-in CLI.

1. A host declared in settings supplies the endpoint. For every kind but GitHub, no declaration means the backend does not exist.
2. Its credential comes from the variable named by `tokenEnv`, or from the kind's conventional variable when `tokenEnv` is absent — `GITHUB_TOKEN` or `GH_TOKEN`, `GITLAB_ACCESS_TOKEN`, `BITBUCKET_TOKEN`, `SRC_ACCESS_TOKEN`.
3. Only if enabled, a CLI fills what is still missing.

Conventional names beat namespaced ones. A collision is the feature: a GitLab token in the environment is *for* the user's GitLab, and the librarian using it is correct. Our own `GITHUB_TOKEN` handling already set this precedent, and nobody has a namespaced variable set, which would make the unconfigured path the unfriendly one.

### CLI discovery is opt-in, and does two jobs

Measured, both available CLIs are **host-aware** in a way environment variables cannot be:

```
glab auth status          → host, credential source, and REST endpoint
gh auth token --hostname  → the token for a named host
```

So when enabled, a CLI can both discover a host that was never declared and supply a credential for one that was declared without a reachable variable. Both jobs, always after explicit configuration, never overriding it. Off by default: it spawns subprocesses, it is invisible in the settings file, and a librarian whose reachable hosts depend on ambient CLI state is hard to reason about when it misbehaves.

No CLI is ever required. Bitbucket Server has no official one, and Sourcegraph's `src` is a wrapper over the same GraphQL and streaming endpoints this package already calls directly — depending on it would reintroduce the indirection that dropping MCP removed, for nothing. Settings plus a conventional variable must always be sufficient.

### Cost decides eager versus lazy, so there is nothing to arbitrate

Reading a credential and validating one differ by an order of magnitude:

```
gh auth token       0.06s   keyring read, no network
glab auth status    0.45s   validates over the network
```

Four eager validations would cost roughly two seconds at session start, which is not payable. Four eager reads cost a few hundred milliseconds, which is payable but pointless. So the two questions separate along the cost seam:

- **Which tools exist** is decided by endpoint presence: a synchronous settings read, free. An unconfigured backend contributes no tool and no prompt text, exactly as already decided.
- **Whether a credential works** is decided on first use. `createGitHubClientProvider`'s lazily-memoized `() => Promise<Client>` is already the right shape; each backend gets its own, and that generalises without change.

A consequence worth stating plainly: **a rejected credential is necessarily an execution-time discovery.** Not a preference — making it a startup fact costs the two seconds. It also means `glab auth status` is the wrong call for discovery precisely because it validates; discovery should use whatever non-validating path the CLI offers.

### Missing means absent; rejected means loud

A configured endpoint with no resolvable credential is treated as **not configured**: no tool, no prompt text, no warning. There is no startup notification for a missing credential, because with no endpoint there is nothing to warn about, and with an endpoint but no credential the honest place to say so is first use, where it is actionable, rather than session start, where it is noise for a session that may never search. The extra-tools warning precedent does not transfer — that reports a config file naming a tool which does not exist, which genuinely is a startup-time fact.

A `401` or `403` raises. It must never collapse into an empty result set. This is the same failure family as a native path's silent zero on a regex and a silently truncated result set: an auth failure that reads as absence produces a confident "no such code exists", which is the worst outcome a research agent can produce. Stated once here as a cross-cutting rule rather than three times on three tickets — see [Delivering search results without drowning the context](06-delivering-search-results-without-drowning-the-context.md) and [Tool exposure: wording, arguments, and upstream inspiration](09-tool-exposure-wording-and-arguments.md).

### Providers stay explicit

Four named providers, each a memoized `() => Promise<Client>`, passed to the tools that need them. No registry: there are four, they are known at build time, and their clients share nothing, so a registry would force either a lowest-common-denominator interface or a union across four unrelated types to buy nothing.

### Left to another ticket

The concrete shape of the host declaration belongs to [Reaching a repo: sources, host configuration, and clone resolution](05-reaching-a-repo-reference-forms-and-clone-resolution.md), which absorbed the configuration ticket rather than deciding the schema in the abstract. It landed on a single list discriminated by `kind`, as anticipated here — the **Code host** / **Backend** distinction describes the roles an entry plays, not a split in the settings file, and a GitLab plays both.

One narrowing this ticket did not foresee: **cloning needs no credential from us at all.** With every token stripped from the environment, ambient git credential helpers authenticated GitLab, GitHub and Bitbucket Server unaided. So `tokenEnv` serves API calls — search and lookup — and never appears in the checkout path. That also explains the nondeterministic `user:token@host` clone failures measured earlier: a URL credential fighting an ambient helper.
