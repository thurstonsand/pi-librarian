---
status: closed
type: task
blocked-by: []
---

# Reaching a repo: sources, host configuration, and clone resolution

## Question

How does the librarian name a repository on any code host, and how does that name become something git can clone?

This ticket absorbed the settings work that used to live in a separate configuration ticket. Host declarations turned out to be the thing that makes every other decision here trivial, so deciding them in the abstract and implementing them later would have been the wrong order.

## What already landed

A first round fixed the parser and the cache layout in `extensions/librarian/checkout.ts`, verified against a real Bitbucket Server instance, a real GitLab instance, and GitHub. All of it stands:

- **Ports survive.** Clone URLs are rebuilt from `url.host`, not `url.hostname`. A ported SSH URL clones.
- **`scm` is not part of a repository's identity.** An HTTPS reference keeps `/scm/` in the URL git receives and drops it from the key.
- **Every clone is namespaced by host**, `repos/github.com/owner/repo` included.
- **Identity is case-insensitive.** A host reported project key `AI` while serving its clone path as `ai`, producing two keys for one repository — and on a case-insensitive filesystem the _failing_ clone under one spelling deleted the good clone under the other. The cache was destroying itself.
- **git errors are scrubbed of credentials.** No URL we build carries one, but a credential helper answered for the host and git printed `https://x-token-auth:<token>@…` in its own failure text. That text reaches the model and the transcript.
- **Clone failure lists every URL tried** with git's own words for each, because the distinction the model needs is in git's text: a login redirect means credentials, `Host key verification failed` means SSH is unusable here, `Repository not found` means the reference is wrong.

Three references to one repository — mixed-case HTTPS with `/scm/`, ported SSH on 7999, and a bare host-qualified name — land on one cache entry.

## What was missed

**`source` was specified and never implemented.** Nothing was argued or deferred; the word appears nowhere in the code. Hostname-shape guessing grew in its place: a `looksLikeHost` heuristic, a two-segment-means-GitHub rule, an ambiguity rejection for anything that looked like a host but had only two segments, and a GitHub check at four separate sites.

(The original ticket called `source` _required_, which was loose. It is required for a shorthand path and rejected alongside a full clone URL, since a URL already names its host. The table below is the accurate statement.)

Every difficulty this ticket has since fought is downstream of that. The bare host-qualified form cannot clone from Bitbucket Server, because derivation emits `https://host/PROJ/repo.git` and Bitbucket serves `/scm/PROJ/repo.git` — we strip that prefix in one direction and never add it in the other. A host with a single-segment repo path is inexpressible. Two reviews of this code missed it, because both reviewed the implementation against itself rather than against the decided forms.

The fix is a net deletion.

## The decided design

### Source declarations

```jsonc
{
  "librarian": {
    "sources": [
      {
        "name": "work-gl",
        "url": "https://gitlab.example.com",
        "kind": "gitlab",
      },
      {
        "name": "work-bb",
        "url": "https://git.example.com",
        "kind": "bitbucket-server",
      },
      {
        "name": "sg",
        "url": "https://search.example.com",
        "kind": "sourcegraph",
        "disabled": ["repo-search"],
      },
    ],
  },
}
```

`name`, `url` and `kind` are all required — no defaults, no inference. `name` and `url` are each unique across declarations; duplicates fail at load.

`kind` is `github | gitlab | bitbucket-server | sourcegraph`. It determines the clone URL layout, the API shape, and which roles the source can play. `bitbucket-server` rather than `bitbucket` because the `/scm/` prefix is Server-specific and Bitbucket Cloud has neither it nor the same API — a precise name now costs nothing and stops being a lie later.

### Built-in hosts

Two public instances are declared implicitly and need no configuration:

| name         | host                 | kind     |
| ------------ | -------------------- | -------- |
| `github`     | `https://github.com` | `github` |
| `gitlab.com` | `https://gitlab.com` | `gitlab` |

Both reserve their name _and_ their hostname, so redeclaring either fails at load.

The naming asymmetry is deliberate. `github` keeps the short name because github.com is the librarian's default host and the only one it has native tooling for. gitlab.com is named after itself so that `gitlab` stays free for the self-hosted instance a user is far likelier to declare — spending the obvious name on the public instance would be the wrong trade.

An earlier draft argued gitlab.com should wait until GitLab search tools exist. That rule was wrong: cloning from gitlab.com works today, because derivation needs only `kind` and `url`. The only real cost was ever the reserved name, and naming it by hostname removes it. The rule worth keeping instead is that **a built-in must be a public instance of a kind already supported** — which is what stops the list growing a limb per code host anyone mentions.

**No credentials, ever.** Not a token, not a `tokenEnv`. Cloning uses git's own machinery, which is enough: with every token stripped from the environment, ambient credential helpers authenticated GitLab, GitHub and Bitbucket Server with zero configuration. A `tokenEnv` will be needed for API calls when search lands; it has no business here.

### The source argument

`checkout_repo` takes `repo` plus an optional `source`:

| form                                           | resolution                                              |
| ---------------------------------------------- | ------------------------------------------------------- |
| full HTTPS/SSH URL, no `source`                | passthrough to git, port preserved                      |
| `source: github` + `owner/repo`                | github.com, reserved and implicit, needs no declaration |
| `source: <declared name>` + host-relative path | derive from that declaration's kind and host            |

`source` is a declared name, not a kind, so two GitLabs are unambiguous. `github` is reserved for github.com; a GitHub Enterprise Server is an ordinary declaration with `kind: github` and its own name.

Deliberately **no default for `source`.** Defaulting to `github` would keep a bare `owner/repo` working, but resurrects exactly the failure being removed — `PROJ/repo` silently becoming a GitHub 404.

The argument stays **flat rather than a union**, even though a union is the truer type. pi ships a `StringEnum` helper specifically because "Google's API and other providers don't support anyOf/const patterns", there is a `sanitizeForOpenApi` path for Claude via Cloud Code Assist, and no pi built-in tool uses `Type.Union` at the top level of its params. The cost is that `repo: "a/b"` with `source` omitted is expressible and must fail at runtime; that is better than a schema shape some providers mangle. Distinguishing a URL from a path is a scheme or scp-shape check — deterministic, not the guessing being deleted.

### Roles

`kind` determines which roles are possible; an optional `disabled` list declines the rest. Opt-out, so zero configuration is the common case and the exception is subtractive.

| role                               | available on                    | why it can be disabled                                      |
| ---------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| `repo-search` — find repos by name | every kind                      | four backends answering "which repos match X" is noise      |
| `code-search`                      | kinds that search globally      | a GitLab without advanced search has nothing worth exposing |
| `clone`                            | code hosts; never `sourcegraph` | you may want a host for search only                         |

This is what `CONTEXT.md`'s **Code host** / **Backend** split was reaching for, and it replaces it: those two terms were roles described as categories of thing. See the Resolution below — **Code host** is deleted and **Backend** is narrowed.

**Scope is a query parameter, not a capability.** Sourcegraph's `repo:^x$` and Bitbucket's `project:X repo:Y` are filters on one code-search capability. GitLab's project endpoint only looks like a separate capability because the filter is mandatory there.

And there is no middle tier to model, because the middle is not worth having. The head-to-head spike found GitLab project-scoped search competitive _with a search backend_ — but never compared it against cloning and grepping, which was that spike's own ground truth and ran 5–10x faster than any remote path. Repo-scoped remote search's only advantage is skipping a download, and `--filter=blob:none` makes downloads cheap. So a GitLab without advanced search sets `disabled: ["code-search"]` and keeps its other two roles.

A declaration that disables every role its kind supports fails at load rather than sitting inert. This is **not** the same mechanism as `librarian.tools.disabled`, which removes a tool outright; this removes one host's participation in one role. Both are useful and the settings docs must say so before someone conflates them.

### Identity and on-disk layout

Identity is **host-based, always** — lowercased, port stripped:

```
<cacheDir>/repos/github.com/drizzle-team/drizzle-orm
<cacheDir>/repos/git.example.com/proj/repo
<cacheDir>/repos/gitlab.example.com/group/subgroup/project
```

Not name-based. A raw URL carries no name, so name-based identity would key the URL form and the shorthand form for the same repository to different directories and clone it twice — the case-collision bug returning through another door. Unique names do not help; the problem is absence, not collision. The reverse map exists for display only, and `view.ts` already drops the host and owner so a trace reads `repo/file`.

**`cacheDir` moves to a stable `/tmp/pi-librarian`** from today's `os.tmpdir()`, and all three reasons to prefer it were measured:

- **`os.tmpdir()` is not stable.** It is `$TMPDIR` with a fallback — a login shell gives `/var/folders/…/T`, a scrubbed environment gives `/tmp`. Two sessions launched differently would key to different caches and re-clone everything. Disqualifying for a cache root.
- **macOS does reap `/tmp`**, via the `com.apple.tmp_cleaner` launch daemon, daily at midnight. Nothing in `/private/tmp` predates the current boot.
- **The path is 44 characters shorter per mention**, and worse than that in tokens, since the `/var/folders` component is a random hash. The agent pays it on every file it reads.

So the librarian gets reuse within a short window, reclamation it does not have to implement, and a legible path — the semantics `os.tmpdir()` only appears to offer. `DEV.md` currently claims `~/.cache/pi-librarian/repos/` and has always been wrong about this.

One open consequence: `/tmp` is POSIX-only, so a published extension needs a platform branch for a Windows root rather than an environment lookup.

### Clone URL derivation

Derived from `kind` plus `url`, deterministically. No lookup call, and **no SSH derivation for the shorthand form** — an SSH port cannot be known without asking, and SSH users pass a URL.

| kind               | derived HTTPS                   |
| ------------------ | ------------------------------- |
| `github`           | `https://{hostname}/{path}.git`     |
| `gitlab`           | `https://{hostname}/{path}.git`     |
| `bitbucket-server` | `https://{hostname}/scm/{path}.git` |

A GitHub path must be exactly two segments, which `kind` knows, so a bad shape is rejected at parse rather than by a 404 from the network.

The `/scm/` prefix is **stripped from a shorthand path before it is applied**, because a path copied out of an HTTPS clone URL carries it and would otherwise derive `/scm/scm/…` _and_ key to a second cache entry — the case-collision bug's twin, with the same ability to let a failing clone clobber a good one. Case-insensitively, since `SCM/` collided too. All of `PROJ/repo`, `scm/PROJ/repo`, `/scm/PROJ/repo`, `SCM/PROJ/repo` and both URL forms resolve to one key and one clone URL.

**Stripping is gated on the host being declared `bitbucket-server`**, which is why the reference parser takes the host registry rather than a single source. Ungated it was worse than the bug it fixed: `scm` is a legitimate group or owner name on any other host, so `https://gitlab.example.com/scm/project` keyed to `gitlab.example.com/project` and _merged_ with a genuinely different repository at that path — one cache directory serving two repos, with the reuse check reporting a hit. A split identity re-clones, which is wasteful; a merged identity answers from the wrong source tree, which is a wrong answer. Kind comes from configuration, so this is a lookup rather than a return to guessing, and an undeclared host is never stripped.

This deletes the host-lookup path the earlier round called authoritative, and the deletion is the point: knowing `kind` makes the request unnecessary, along with its round-trip, its credential, and its result-ordering trap.

Verified end to end against a real instance, including the case that matters most — a search-backend repo name reduced to a shorthand path:

```
backend name   git.example.com/PLATFORM/widget-sdk
strip host  →  PLATFORM/widget-sdk
derive      →  https://git.example.com/scm/PLATFORM/widget-sdk.git   →  clones
```

## Evidence that constrains this

- **Search-backend repo names are `hostname/path`**, so the first segment matches a declared host and the remainder is the shorthand path. Verified across every indexed repository on one instance. But that is a _default_ `repositoryPathPattern` and admins can rewrite it, so it is a convention, not a guarantee; the failure mode is a repository visible in search results and unclonable, recoverable by passing a URL.
- **A search backend cannot supply a clone URL directly.** `mirrorInfo.remoteURL` is null for non-admins. `externalRepository.serviceType` and `serviceID` are readable and amount to kind plus host — which is why a backend needs no `source` of its own once hosts are declared.
- **Name lookup is unreliable and no disambiguation fixes it.** One repository name returned three matches on a Bitbucket Server instance, two of them _exact slug matches in different projects_. A GitLab name search returned three projects, one without the term in its path at all — that endpoint matches name and description, not path. So a checkout resolves a fully qualified path and nothing less; "which repository is called X" is `search_repos`' question, and letting a checkout guess would make an unrecoverable wrong-repo answer look successful.
- **`links.clone[]` order is not stable** on Bitbucket Server — the same instance returned `http` first for one repository and `ssh` first for another. Irrelevant now that lookup is gone, but it is why deriving beats asking when you already know the layout.
- **Re-clone hard-resets to origin**, so it survives force-pushes, but `FETCH_DEBOUNCE_MS` is 15 minutes and inside that window it deliberately does not fetch. "Latest" means at most 15 minutes stale, and the prompt does not say so.

## What to build

- The `librarian.sources` schema, with TypeBox validation, unique-name and unique-host checks, and the all-roles-disabled load error.
- `source` on `checkout_repo` and on `parseRepoReference`, as a dynamic enum of declared names plus `github`.
- Deletion of `looksLikeHost`, the ambiguity rejection and its message, the two-segment-means-GitHub rule, and the remaining GitHub host checks.
- Derivation from `kind` plus `url`, including `/scm/` for `bitbucket-server`.
- `cacheDir` default of `/tmp/pi-librarian`.
- A dynamic tool surface: an undeclared or role-disabled source contributes no enum member and no prompt text.
- `librarian.tools.extra` and `librarian.tools.disabled`, replacing today's `librarian.tools` array — already settled, and this is the ticket that touches settings. Disabled applies last and applies to extras too. A user whose settings stop parsing gets a message naming what to change.
- Prompt and trace follow-through, including the staleness window.

Tests get simpler: most current parse cases exist to pin down guessing that is going away.

## Out of scope

- Credentials of any kind.
- Search behaviour, coverage, and ordering. Declarations gate _whether_ a host searches; how search results are shaped and ranked is elsewhere.
- Bitbucket Cloud.
- Reconstructing global GitLab code search by fanning out across projects. Measured as technically possible — 10 projects at 5 concurrent took 1048ms, extrapolating to roughly a minute and 1.7 MB for 600 — but it rebuilds recall, which was already a tie, while producing no cross-repo ranking, which is the thing a backend actually provides.

## Resolution

Built as designed. Every item above landed, the guessing layer is gone, and `checkout.ts` grew only from 320 to 360 lines despite absorbing source declarations — the deletions paid for most of the additions.

What the design above does not record, because it was learned while building:

### The reference parser needs the host registry, not one source

The first implementation passed a single resolved source. That works for a shorthand path and fails for a URL, because a URL has no source and the `/scm/` rule needs to know the host's kind. So `parseRepoReference(input, hosts, sourceName?)` takes the whole registry and resolves the name itself, which also moved source resolution and its error out of the tool and next to the other reference errors.

Stripping `/scm/` ungated was worse than the bug it fixed. `scm` is an ordinary group or owner name elsewhere, so `https://gitlab.example.com/scm/project` keyed to `gitlab.example.com/project` and _merged_ with a different repository at that path — one directory serving two repos, with the reuse check reporting a hit. A split identity wastes a clone; a merged identity answers from the wrong source tree.

### Three structural corrections found in review

All three were one disease — a fact with two owners — and all three were caught only by asking where a fact was stated twice:

- `GITHUB_CLONE_SOURCE` in `checkout.ts` duplicated the `github` reservation in settings. Fixed by emitting the built-ins as ordinary resolved declarations, which deleted `CloneSource`, `cloneSources` and the synthetic prepend.
- `disabled` was carried through to the resolved type, so every consumer re-derived capability that validation already knew. Resolving `roles` at the edge deleted `hostSupportsRole` and the query-time role table.
- `CloneHostKind = Exclude<HostKind, "sourcegraph">` restated clone capability by exclusion, where the role table stated it as data. Replaced by `CLONE_HOST_KINDS`, from which both the type and the role resolution derive. Verified: adding a clonable kind now fails to compile until its URL rule exists.

### Fail-fast gaps the design missed

A GitHub path is exactly two segments, and `kind` knows that — but the arity check went out with the guessing layer, so `github` plus `justonesegment` derived a URL and learned it was wrong from the network. Restored where the derivation rule lives.

A declared source that cannot clone reported `Unknown source`, which is false and sends the model hunting for a typo instead of reaching for a URL. It now names the reason, and separates a fact about the kind from a choice in settings.

### Verified against real hosts

Four kinds cloned fresh: github.com, gitlab.com, a self-hosted GitLab with nested groups, and a Bitbucket Server instance. Then five further spellings of the Bitbucket repository — `scm/` in the shorthand, a leading slash, a lowercased project key, the full HTTPS URL, and a ported SSH URL — all reused the first clone, and `find` confirmed **one** directory on disk. Gating held on the same run: `/scm/` stripped for the declared Bitbucket host, preserved for a declared GitLab and for an undeclared host.

### The list is `sources`, not `hosts`

The settings key and the vocabulary were both wrong at first, and the tell was that `librarian.hosts` contained Sourcegraph declarations — Sourcegraph hosts nothing, it indexes what others host. That misnaming pushed `host` into meaning two things at once, the entity and the base URL, which is why `CONTEXT.md` could not define **Kind** without defining it in terms of **Source**, and **Source** was a name pointing at a thing that had no name.

Resolved by making **Source** the entity: `librarian.sources`, with the field renamed `host` → `url`. That frees "hostname" to mean the URL component it always meant in the cache-identity rule. **Code host** was deleted from the vocabulary because it is exactly "a source with the `clone` role" and carried no residual meaning. **Backend** survives with a sharper definition — whatever answered a search, which includes grep.app and the GitHub REST API, neither of which is a declared source and neither of which roles can describe. `search-code.ts` had already been stamping `backend: "grep.app"` on its results, so the code was ahead of the glossary.

### Left open

- `/tmp` is POSIX-only and this ships as an npm package, so a Windows root needs a platform branch. `os.tmpdir()` is not the answer: it is `$TMPDIR` with a fallback, so it varies with launch context and would split the cache.
- `checkoutRepo` now takes six positional parameters with two adjacent optional strings. It wants an options object.
- The 15-minute fetch debounce is invisible to the model. Recorded on the map.
