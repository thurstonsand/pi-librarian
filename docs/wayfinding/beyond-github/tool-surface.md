# Tool surface: inputs, outputs, and wording

**Status: ready for interface review.** Every tool below has been reworked against measured behaviour — dedicated spikes against GitHub, a Sourcegraph 7.7 instance, and a self-hosted GitLab — and against the rule set in [Where tool guidance lives](tool-guidance.md). Open decisions are collected at the end.

## The surface at a glance

What the agent can call, and the one-line result summary the user sees, which follows a subject naming the source — every rendered state is in [What the user sees](#what-the-user-sees). `[source]` appears only when two or more instances of that engine are declared; a tool with no instances is not registered.

| tool | arguments | user-facing summary |
| --- | --- | --- |
| `search_code_github` | `pattern`, `owner?`, `repos?`, `path?`, `filename?`, `extension?`, `language?`, `limit?` | `412 files · 63 repos` |
| `search_code_grepapp` | `pattern`, `regex?`, `repo?`, `language?`, `path?`, `limit?` | same shape |
| `search_code_sourcegraph` | `[source]`, `pattern`, `pattern_type?`, `detail?`, `repos?`, `path?`, `language?`, `limit?` | same shape, `, incomplete` when short |
| `search_code_gitlab` | `[source]`, `pattern`, `project` (optional with advanced search), `ref?`, `filename?`, `path?`, `extension?`, `limit?` | same shape |
| `search_code_bitbucket` | `[source]`, `pattern`, `project?`, `repo?`, `limit?` | same shape |
| `search_repos_github` | `text?`, `in_readme?`, `language?`, `topics?`, `min_stars?`, `pushed_after?`, `include_forks?`, `include_archived?`, `sort?`, `limit?` | `10 of 1,284 repos` |
| `search_repos_sourcegraph` | `[source]`, `name?`, `topics?`, `contains_path?`, `changed_after?`, `include_forks?`, `include_archived?`, `limit?` | same shape |
| `search_repos_gitlab` | `[source]`, `name?`, `topics?`, `changed_after?`, `include_archived?`, `sort?`, `limit?` | same shape |
| `search_repos_bitbucket` | `[source]`, `name?`, `project?`, `limit?` | same shape |
| `find_definition` | `[source]`, `symbol`, `kind?`, `repos?`, `language?`, `include_vendored?`, `limit?` | `2 definitions` |
| `read_file` | `source`, `repo`, `path`, `ref?`, `offset?`, `limit?` | none on success |
| `checkout_repo` | `repo`, `source?`, `ref?` | `1117 files @ a1b2c3d` |
| `provide_results` | `summary`, `locations[{source, repo, file, lines?, note}]`, `description?` | the findings block |

The rules every search tool shares, each argued in its own section:

- **The agent receives a digest**: what was found, whether the search finished, what is shown versus stored; 10 results by default, up to 50 by `limit`; the full result set always in `results.jsonl`.
- **Identifiers are printed as `checkout_repo` takes them**: the source once, repository paths per entry.
- **Fifteen seconds, then an error** that keeps the counts, drops the results, says how to narrow — and cancels the query rather than abandoning it.
- **Inputs an engine would silently misread are rejected at the edge**, with a pointer to the argument that does the job.
- **No `promptSnippet`, few guidelines**: everything per-tool lives in the description and the arguments, the only text that reaches the model in both modes.
- **The user sees a trace line in a run, and a `web_search`-style list when attached**, both headed by the same summary string — every state in [What the user sees](#what-the-user-sees).

## Who sees what

Three consumers. Earlier drafts of this document got this wrong more than once, so it is worth stating precisely.

**The agent** receives `content: [{ type: "text", text }]` — the **digest**: a header saying what was found, whether the search finished, and where the full result set is stored, then the first entries. The only thing that costs context and the only thing the model can reason about. What else reaches the model — descriptions, guidelines — is its own section below, because it differs between modes.

**The user** sees rendered tool rows, in two places: inside a librarian run's block, as trace lines, and in the main session when the tools are attached. Every shape the user can see is in [What the user sees](#what-the-user-sees), and nowhere else.

**`details` is read**, by `summarizeToolResult` in `trace.ts`, which switches on `details.kind` and returns the one-line result summary both renderings show. So `details` is not inert metadata: it is the sole input to everything the user sees about a result. Every field in a `Details` interface is there because the digest, the summary, the attach renderer, or a test needs it.

### In attach mode

`/librarian` registers the repo tools in the main session with a `renderCall` already — bold verb plus the same subject the trace uses — but **no `renderResult`**, so their results fall back to pi's default rendering of the raw digest. This finishes the job, modelled on `web_search`.

**Reuse `summarizeToolResult`.** A second summariser for attach mode would give two answers to "what did this call return" that could drift apart. So the attach-mode header _is_ the trace summary.

**One shared renderer, not ten.** `web_search` and `web_fetch` each carry their own because a search result and a fetched document have nothing in common. The repo tools are siblings: each returns a summary plus a list of entries. So one `renderResult` in `view.ts`, used by all of them.

**This forces `details` to carry the entries.** A renderer that receives only the digest text cannot show labels collapsed and metadata expanded without parsing its own output back apart. So every search tool's `Details` gains the slice the digest showed:

```ts
interface ShownEntry {
  group?: string; // clone source, for Sourcegraph results spanning hosts: "example-bb"
  label: string; // "drizzle-team/drizzle-orm" — passable to checkout_repo as repo
  url?: string; // web page for the hyperlink
  meta?: string; // "★27104 · TypeScript · last modified 2026-08-19"
  detail?: string; // description, or matched lines
}
```

`web_search` does exactly this — its `details.results` holds title and URL per result. The alternative is building the digest text _from_ `entries`, giving one source of truth; that is an implementation choice rather than an interface one.

**Where the two modes genuinely differ.** The main agent's window holds the user's actual work, where a run's window is disposable; it already has `read` and `grep`, so the artifact path is more useful attached; and a failed call is read by a human immediately rather than scrolling past in a trace, so error wording earns its place most there.

## What the user sees

The single place for every user-facing shape: the librarian run block, then each tool in each state. Examples use placeholder sources — `example-gl` (GitLab), `example-bb` (Bitbucket Server), `example-sg` (Sourcegraph) — and real public GitHub repositories.

### Anatomy

**In a librarian run**, each tool call is one trace line:

```text
  {icon} {verb} {subject} ({summary}) · {timing}
```

`icon` is a braille spinner while running, `✓` done, `✗` failed. `verb` and `subject` come from `formatTraceLine`, from the call's **arguments only**, so they exist before any result does. `summary` is absent while running, the result's one line when done, and the error's first line when failed. `timing` is `Elapsed …` while running and `Took …` after, from pi's recorded duration, matching pi's own rows.

**When attached**, each tool call is a pi tool box: a header from `renderCall`, then a body from `renderResult` in one of four states — running, failed, collapsed, expanded. `ctrl+o` (`app.tools.expand`) toggles collapsed and expanded. The body mirrors `web_search`'s: a counter while running; when done, the summary in the success colour, then entries in the accent colour, numbered, each an OSC 8 hyperlink to its page on the host where the terminal supports it; metadata dim beneath each entry when expanded; `Took …` last.

**Collapsed shows five entries; expanded shows every entry the digest showed** — ten by default, up to 50 by `limit`. `web_search` lists every title collapsed, which it can afford at eight; ten entries carrying matched lines cannot.

**Every subject names its source**, so a row says which engine answered while it is still running, and the summary does not repeat it. `incomplete` and `unranked` append to the summary in the warning colour.

| tool | verb | subject | summary |
| --- | --- | --- | --- |
| `search_code_*` | `search` | `code {pattern} in {source}[:{scope}]` | `{n} files · {r} repos` — `repos` or `matches` per `detail` |
| `search_repos_*` | `search` | `repos {filters} in {source}` | `{fetched} of {total} repos`, or `{n} repos` when all are fetched |
| `find_definition` | `definition` | `[{kind}] {symbol} in {source}` | `{n} definitions` |
| `read_file` | `read` | `{source}:{repo}/{path}[@{ref}][:{lines}]` | none on success; the error's first line on failure |
| `checkout_repo` | `checkout` | `{source}:{repo}[@{ref}]`, or the URL | `{files} files @ {sha7}` |
| `provide_results` | `results` | — | `{n} locations` |

`{scope}` is whatever narrowed the search — `owner/repos`, `project`, `repos` patterns — shortened to 40 characters. `{filters}` are the arguments given, as `key:value`. The `source:` prefix is display only; the agent never reads it, and `checkout_repo` never parses it.

In-flight verbs, attached: `Searching…`, `Locating…`, `Reading…`, `Cloning…`.

### The librarian run block

The whole run renders as one block in the main session: the query, then the trace or the findings, then a footer. Unchanged by this design except for the trace lines inside it.

**Running, collapsed** — the last 3 calls, older ones counted:

```pi_user
Librarian
Which services implement exponential backoff, and do they agree on jitter?

  … 4 earlier calls (ctrl+o to expand)
  ✓ search code computeBackoff in example-sg (412 files · 63 repos) · Took 1.7s
  ✓ checkout example-bb:PROJ/widget-sdk@9f8e7d6 (1117 files @ 9f8e7d6) · Took 9.2s
  ⠺ read widget-sdk/src/retry.ts · Elapsed 0.3s

7 tool calls · 22.1s · Claude 5 Opus (medium)
```

**Running, expanded** — every call, and the query untruncated.

**Done, collapsed** — the trace **disappears** once findings exist; a completed run shows its answer instead of its work:

```pi_user
Librarian
Which services implement exponential backoff, and do they agree on jitter?

(3 locations and details hidden, ctrl+o to expand)
Three services implement it independently and two disagree on jitter: widget-sdk
uses full jitter, deploy-cli uses none.

run 019fc95d-0b2d-7dd1-b138-d683d89c0974
7 tool calls · 22.1s · Claude 5 Opus (medium)
```

**Done, expanded** — summary, location bullets, optional description. With `source` now on every location, each bullet names it and links to the file on its host:

```pi_user
Librarian
Which services implement exponential backoff, and do they agree on jitter?

Three services implement it independently and two disagree on jitter: widget-sdk
uses full jitter, deploy-cli uses none.

- `example-bb:PROJ/widget-sdk/src/retry.ts:29-44` — full-jitter implementation
- `example-bb:CORE/deploy-cli/internal/backoff.go:12-20` — no jitter
- `example-bb:CORE/deploy-agent/retry.go:55` — vendored copy of the above

…extended description…

run 019fc95d-0b2d-7dd1-b138-d683d89c0974
7 tool calls · 22.1s · Claude 5 Opus (medium)
```

**Failed** — the error under the trace, which stays visible because there are no findings to replace it:

```pi_user
Librarian
Which services implement exponential backoff, and do they agree on jitter?

  ✓ search code computeBackoff in example-sg (412 files · 63 repos) · Took 1.7s
  ✗ checkout example-g:PROJ/widget-sdk (Unknown source "example-g". Use one of: github, example-bb.) · Took 0.2s

  Librarian was not able to report findings.

3 tool calls · 4.1s · Claude 5 Opus (medium)
```

### `search_code_*`

One shape for all five engines; the subject names the source, and the summary's unit follows `detail` where the engine has one.

**In a run:**

```pi_user
  ⠺ search code computeBackoff in example-sg · Elapsed 0.4s
  ✓ search code computeBackoff in example-sg (412 files · 63 repos) · Took 1.7s
  ✓ search code retry policy in example-sg (1,000 files · 87 repos, incomplete) · Took 2.4s
  ✓ search code defineConfig in github:drizzle-team/drizzle-orm (37 files · 1 repo) · Took 0.5s
  ✓ search code worktree in example-gl:platform/widget-sdk (50 files · 1 repo, unranked) · Took 0.4s
  ✗ search code retry in example-sg (15s limit hit; 212 files in 40 repos found.) · Took 15.4s
  ✗ search code useState in github (GitHub code search rate limit reached; resets in 42s.) · Took 0.2s
```

**Attached, running and failed:**

```pi_user
search code computeBackoff in example-sg
Searching… Elapsed 0.4s
```

```pi_user
search code retry in example-sg
15s limit hit; 212 files in 40 repos found.
Took 15.4s
```

**Attached, collapsed.** Sourcegraph results are grouped under the clone source each maps to; one-source engines have no group lines:

```pi_user
search code computeBackoff in example-sg
412 files · 63 repos
example-bb
 1. PROJ/widget-sdk — src/retry.ts
 2. CORE/deploy-cli — internal/backoff.go
 3. CORE/deploy-agent — retry.go
 4. PROJ/widget-sdk — src/client.ts
 5. CORE/queue — consumer/backoff.go
 … 5 more (ctrl+o to expand)
Took 1.7s
```

**Attached, expanded**, at `detail: "matches"` — every shown entry with its commit and matched lines, then the artifact:

```pi_user
search code computeBackoff in example-sg
1,204 matches · 63 repos
example-bb
 1. PROJ/widget-sdk — src/retry.ts (a1b2c3d)
      30  export function computeBackoff(
      47  const backoff = computeBackoff(attempt, opts);
 2. CORE/deploy-cli — internal/backoff.go (9f8e7d6)
      13  func computeBackoff(attempt int, base time.Duration) time.Duration {
 …
not a declared source
10. github.com/acme/retry-kit — retry.go (c4d5e6f)
      8  def compute_backoff(attempt):
Full results: /tmp/pi-librarian/searches/tc_01H9/results.jsonl (1,204 lines, 2.8 MB)
Took 2.1s
```

At `detail: "files"` the same without matched lines; at `detail: "repos"` the labels are repositories alone.

### `search_repos_*`

**In a run:**

```pi_user
  ✓ search repos orm language:typescript in github (10 of 1,284 repos) · Took 0.8s
  ✓ search repos name:^git\.example\.com/CORE/ contains_path:^go\.mod$ in example-sg (212 repos) · Took 1.1s
  ✓ search repos name:deploy in example-bb (19 repos) · Took 0.3s
  ✗ search repos changed_after:2026-01-01 in example-sg (changed_after covers 5,642 repositories; narrow with name to under 1,000.) · Took 0.6s
```

**Attached, collapsed:**

```pi_user
search repos orm language:typescript in github
10 of 1,284 repos
 1. drizzle-team/drizzle-orm
 2. prisma/orm
 3. mikro-orm/mikro-orm
 4. typeorm/typeorm
 5. sequelize/sequelize
 … 5 more (ctrl+o to expand)
Took 0.8s
```

**Attached, expanded** — the metadata a source has, and only that:

```pi_user
search repos orm language:typescript in github
10 of 1,284 repos
 1. drizzle-team/drizzle-orm
    ★27104 · TypeScript · last modified 2026-08-19
    Headless TypeScript ORM with a head
 2. prisma/orm
    ★41230 · TypeScript · last modified 2026-08-21
    Next-generation ORM for Node.js & TypeScript
 …
Full results: /tmp/pi-librarian/searches/tc_01HA/results.jsonl (10 lines, 6.2 KB)
Took 0.8s
```

```pi_user
search repos name:deploy in example-bb
19 repos
 1. CORE/deploy-cli
    Deployment CLI and release tooling
 2. CORE/deploy-agent
 …
Full results: /tmp/pi-librarian/searches/tc_01HC/results.jsonl (19 lines, 4.4 KB)
Took 0.3s
```

### `find_definition`

**In a run:**

```pi_user
  ✓ definition computeBackoff in example-sg (2 definitions) · Took 0.9s
  ✓ definition function NewClient in example-sg (14 definitions) · Took 1.6s
```

**Attached, collapsed:**

```pi_user
definition computeBackoff in example-sg
2 definitions
example-bb
 1. PROJ/widget-sdk — src/retry.ts:30
 2. CORE/deploy-cli — internal/backoff.go:13
Took 0.9s
```

**Attached, expanded** — each with its context lines:

```pi_user
definition computeBackoff in example-sg
2 definitions
example-bb
 1. PROJ/widget-sdk — src/retry.ts:30 (a1b2c3d)
      29  /** Exponential backoff with full jitter. */
      30  export function computeBackoff(
      31    attempt: number,
 2. CORE/deploy-cli — internal/backoff.go:13 (9f8e7d6)
      12  // computeBackoff returns the delay before the next attempt.
      13  func computeBackoff(attempt int, base time.Duration) time.Duration {
Full results: /tmp/pi-librarian/searches/tc_01HB/results.jsonl (2 lines, 3.9 KB)
Took 0.9s
```

### `read_file`

The one tool whose body is content rather than entries, so it follows pi's own `read` rendering: collapsed shows the first lines, expanded shows what the agent received.

**In a run:**

```pi_user
  ✓ read example-gl:platform/widget-sdk/src/retry.ts@a1b2c3d · Took 0.4s
  ✓ read github:drizzle-team/drizzle-orm/drizzle-kit/src · Took 0.2s
  ✓ read example-bb:CORE/deploy-cli/vendor/protocol · Took 0.5s
  ✗ read github:drizzle-team/drizzle-orm/missing.ts (Not found) · Took 0.2s
```

**Attached, collapsed:**

```pi_user
read example-gl:platform/widget-sdk/src/retry.ts@a1b2c3d
2000 of 3401 lines
import { RetryOptions } from "./options";

/** Exponential backoff with full jitter. */
export function computeBackoff(
… 1996 more lines (ctrl+o to expand)
Took 0.4s
```

**Attached, expanded** — the full digest, including the continuation footer the agent sees:

```pi_user
read example-gl:platform/widget-sdk/src/retry.ts@a1b2c3d
2000 of 3401 lines
import { RetryOptions } from "./options";
…
[Showing lines 1-2000 of 3401 (50.0 KB limit). Use offset=2001 to continue.]
Took 0.4s
```

### `checkout_repo`

**In a run:**

```pi_user
  ⠺ checkout example-gl:platform/widget-sdk@main · Elapsed 4.2s
  ✓ checkout example-gl:platform/widget-sdk@main (1117 files @ a1b2c3d) · Took 9.2s
  ✓ checkout https://gitlab.com/acme/tooling (402 files @ 77e1f0a) · Took 3.0s
```

**Attached, collapsed** — the local path is what matters, so it shows even collapsed:

```pi_user
checkout example-gl:platform/widget-sdk@main
1117 files @ a1b2c3d
/tmp/pi-librarian/repos/gitlab.example.com/platform/widget-sdk
Took 9.2s
```

**Attached, expanded** — no difference:

```pi_user
checkout example-gl:platform/widget-sdk@main
1117 files @ a1b2c3d
/tmp/pi-librarian/repos/gitlab.example.com/platform/widget-sdk
Took 9.2s
```

### `provide_results`

Never attached — it exists only inside runs. Its trace line is the last one in a run, visible only while the findings render:

```pi_user
  ✓ results (3 locations) · Took 0.0s
```

## What reaches the model

Asked in review: `label`, `description`, `promptSnippet`, and `promptGuidelines` overlap — how does each actually show up? Read off pi 1.3's source, the answer is that **it depends on the mode, and in a librarian run two of the four are dropped entirely.**

| field                  | librarian run                  | attach mode                                 |
| ---------------------- | ------------------------------ | ------------------------------------------- |
| `name`                 | tool definition sent to the provider | same                                  |
| `description`          | tool definition                | tool definition                             |
| parameter descriptions | tool definition                | tool definition                             |
| `promptSnippet`        | **dropped**                    | `- name: snippet` under the tools list      |
| `promptGuidelines`     | **dropped**                    | bullets in the guidelines section           |
| `label`                | nowhere                        | nowhere I could find                        |

The mechanism: `run.ts` gives the nested session a `systemPromptOverride`, which pi passes on as `customPrompt`. `buildSystemPromptSections` in pi's `system-prompt.ts` builds the tools list and the guidelines only in the branch where there is _no_ `customPrompt`. So inside a run, the librarian sees each tool's name, description, and parameter schema, and nothing else.

That means every `promptGuidelines` entry on today's repo tools has never reached the librarian. The librarian behaves as if it had, because `prompt.ts` restates the same advice by hand in its _Search Strategy_ section — a fact with two owners, naming `search_code` and `search_github_code` explicitly, and about to be wrong for every tool this document renames.

### Where guidance goes

The full rule set, with citations, a decision procedure, and anti-patterns from this repo, is [Where tool guidance lives](tool-guidance.md). The short form:

- **The description is the tool's documentation; `promptSnippet` is its entry in a table of contents.** The snippet adds presence in the system prompt's tool list, not information. So the repo tools omit it; only the `librarian` tool itself, the entry point, has a reason to be listed.
- **Each fact goes on the narrowest element it is true of**, once. Anything the schema can enforce — required, enum, range — goes in the schema. A fact about one argument goes in that argument's description. A fact about the whole tool — what it searches, what it returns, limits, when it is the wrong tool, said as a capability — goes in `description`.
- **`promptGuidelines` are conduct rules for one tool**, naming that tool and true whatever else is loaded. Not cross-tool contrast: a static guideline cannot know whether the other tool is registered, and with `tools.disabled` and per-source registration it often is not. An earlier draft of this section had that backwards.
- **"Prefer X over Y" is deleted when the two descriptions already imply it**, and otherwise owned by the prompt builder that knows which tools are active, emitted only when both are. pi's own core does exactly this for its one cross-tool rule about `bash`.
- **Recovery hints go in errors**, where they are true at the moment they are read. Truncation hints go in the result.
- **`label` is required and rendered nowhere.**
- **`description` is tool-level facts, usually two or three sentences**, not the one sentence this document's conventions used to demand — stricter than either vendor's guidance.

**The librarian prompt composes its strategy from the active tools' guidelines** rather than restating them, as a pure function built at startup. With extra tools removed (decided below), every tool a run can have is one this package defines or a pi built-in, so startup sees the whole set and no hook is needed. A prefactor before the renames, because the renames are what break `prompt.ts`'s hardcoded names. [Where tool guidance lives](tool-guidance.md) recommends a `before_agent_start` hook; that recommendation assumed extra tools would stay.

**And librarian runs load the user's global `AGENTS.md`.** The nested session's resource loader receives the agent directory and does not set `noContextFiles`, so every run carries the user's personal instructions — persona, git workflow, everything — into a research agent that needs none of it. For a published package that is every user's file. The fix is one option; it is on the decisions list because someone may want it on purpose.

So a tool definition in this document looks like:

```ts
name: "search_code_github",
label: "Search GitHub code",
description:
  "Search code on GitHub, including private repositories your token can read. Returns matching files with short excerpts. Limited to 10 searches a minute.",
// no promptSnippet, no promptGuidelines
```

## One tool per engine

Ticket 01 decided three honest search tools rather than one router. An earlier draft of this document reopened that as a "fork" without admitting it was reopening anything. Withdrawn.

**Names put the family first and the engine last**: `search_code_github`, `search_code_sourcegraph`, `search_repos_github`. The common prefix sorts the family together in a tool list that may hold ten of these, and reads as what it is — one operation, several engines. `search_github_code` is renamed rather than kept, since it is the odd one out the moment a third exists.

### The split runs deeper than `pattern_type`

The first argument was that `pattern_type: regexp` cannot mean different things for different values of `source`. True, and far too narrow. **Every filter argument is engine-specific.** `has_path` and `has_content` are Sourcegraph predicates with no equivalent elsewhere. `stars` exists on GitHub and GitLab only. `topic` exists on three engines, spelled three ways. `detail` — the resolution ladder ticket 06 is built on — is a Sourcegraph `select:` projection that no other engine offers.

A single tool spanning engines has three bad options for every argument: present it everywhere and fail at runtime on most sources, present it everywhere and silently ignore it, or model the intersection and lose nearly everything. Per-engine tools have a fourth: **each tool's arguments are its engine's capabilities**, and the schema stops being able to lie.

### The inventory

| family      | engine           | tool                                 | split?                 |
| ----------- | ---------------- | ------------------------------------ | ---------------------- |
| code search | GitHub REST      | `search_code_github`                 | yes                    |
|             | grep.app         | `search_code_grepapp`                | yes                    |
|             | Sourcegraph      | `search_code_sourcegraph`            | yes                    |
|             | GitLab           | `search_code_gitlab`                 | yes                    |
|             | Bitbucket Server | `search_code_bitbucket`              | yes                    |
| repo search | GitHub REST      | `search_repos_github`                | yes                    |
|             | Sourcegraph      | `search_repos_sourcegraph`           | yes                    |
|             | GitLab           | `search_repos_gitlab`                | yes                    |
|             | Bitbucket Server | `search_repos_bitbucket`             | yes                    |
| symbols     | Sourcegraph      | `find_definition`                    | no engine to split from |
| file read   | any              | `read_file`                          | **no**                 |
| clone       | any clone source | `checkout_repo`                      | **no**                 |

`read_file` and `checkout_repo` do not split, and the rule says why: **there is no query language in a file read.** A path is a path on every engine, so those two keep a `source` argument spanning kinds, as `checkout_repo` does today. A rule that gives different answers for a stated reason is a rule rather than a preference.

Symbol search has one engine, so `find_definition` needs no suffix yet. If a second engine grows a symbol index it earns one then — cheaper than carrying `_sourcegraph` on a tool with no sibling.

Firecrawl's Developer Index is absent from this table on purpose. It does not index source code; see its own section below.

The surface stays small in practice because **it is built from configuration**. No declared sources means two code-search tools and one repo-search tool. One Sourcegraph adds three.

## Source values, concretely

`sourceList` and `sourceNames` are **two projections of one array**, which is what `checkout_repo` already does:

```ts
const clonable = cloneSources(sources);
const sourceNames = clonable.map((source) => source.name);
const sourceList = clonable.map((s) => `${s.name} (${new URL(s.url).host})`).join(", ");
```

`sourceNames` is the enum's permitted values — machine-facing, exact. `sourceList` is prose for the parameter description, pairing each name with its hostname, because the enum constrains what the agent may say without telling it what any name _means_. With `example-sg` and `other-sg` both declared, the enum alone gives no basis for choosing. Both are needed; `sourceList` should be renamed `sourceLabels`.

### Zero, one, or many

Each tool wraps one engine, so its source enum holds only that engine's instances, and the count decides the schema:

| instances of that engine | tool           | `source` argument                     |
| ------------------------ | -------------- | ------------------------------------- |
| none                     | not registered | —                                     |
| one                      | registered     | **omitted**; the instance is implicit |
| several                  | registered     | required enum, no default             |

**Instances never become tools.** An engine is one tool however many instances are declared; the instances only change the `source` argument. Two Sourcegraphs give one `search_code_sourcegraph` with:

```ts
source: StringEnum(["example-sg", "other-sg"], {
  description: "Which Sourcegraph to search: example-sg (search.example.com), other-sg (sg.other.example).",
}),
```

and one Sourcegraph gives the same tool with no `source` at all, the instance fixed at registration. A `StringEnum` of one member is noise the model reads on every call, and an argument with one legal value is a question with one answer.

**Zero is the common case, not an edge case.** For Sourcegraph, GitLab, and Bitbucket Server it is the default — nobody declares one, so no tool appears. For the built-in sources it happens through `librarian.builtInSources` — `github` on by default, `gitlab.com` off — and for grep.app, which is a backend rather than a source, through `librarian.tools.disabled`.

`gitlab.com` is off by default, so someone with nothing declared sees three tools — `search_code_github`, `search_code_grepapp`, `search_repos_github` — plus the clone, read, and finish tools.

Given these settings:

```jsonc
{
  "librarian": {
    "sources": [
      { "name": "example-gl", "url": "https://gitlab.example.com", "kind": "gitlab" },
      { "name": "example-bb", "url": "https://git.example.com", "kind": "bitbucket-server" },
      { "name": "example-sg", "url": "https://search.example.com", "kind": "sourcegraph" },
    ],
  },
}
```

| tool                      | `sourceNames`                                          | `source` argument     |
| ------------------------- | ------------------------------------------------------ | --------------------- |
| `search_code_sourcegraph` | `["example-sg"]`                                       | omitted               |
| `search_code_gitlab`      | `["example-gl"]`                                       | omitted               |
| `search_code_github`      | —                                                      | omitted, built in     |
| `checkout_repo`           | `["github", "gitlab.com", "example-gl", "example-bb"]` | optional, spans kinds |

`example-sg` is absent from `checkout_repo` because `sourcegraph` never has the clone role. `github` and `gitlab.com` are present without being declared because they are built in. `search_code_gitlab` has one instance here because `gitlab.com` is off by default.

## Conventions this follows

Read off the existing tools rather than invented, so that new tools read as though they were always here.

- `defineTool<typeof Params, Details>`, with a `Details` interface carrying `kind: "<tool_name>"` as its discriminant.
- Parameters are a `Type.Object` with a `description` on every field. Optional fields state their default in the description, as `Default: X.`
- `label` is a short imperative phrase in sentence case: `Search repos metadata`, `Checkout repo`.
- `description` holds **tool-level facts only**, usually two or three sentences — capability, what a result is, whole-call limits, when it is the wrong tool said as a capability. Argument facts live on the argument. See [Where tool guidance lives](tool-guidance.md).
- `promptSnippet` is **omitted** on repo tools.
- `promptGuidelines` are conduct rules for one tool, naming it, true whatever else is loaded. Usually there are none.
- Digests open with a **header line**, then a blank line, then the body.
- Errors `throw` with an actionable message, and may append a next step: `If the repo name is uncertain, resolve it with search_repos first.`
- `createXTool(deps)` factory when the tool needs settings or a client; a plain exported constant when it does not.
- `StringEnum` from `@earendil-works/pi-ai` for enums whose members come from configuration.

## The delivery contract

Search sits between the two tools we already have, and each solves half of it.

|              | `web_search`                               | `web_fetch`                           | code search                  |
| ------------ | ------------------------------------------ | ------------------------------------- | ---------------------------- |
| shape        | numbered aggregation                       | one entry per document                | **aggregation**              |
| volume       | bounded by construction, `max_results` ≤ 8 | unbounded per document                | **unbounded, unpredictable** |
| output       | entirely inline                            | entirely on disk, digest is a pointer | **both**                     |
| completeness | warnings only                              | not applicable                        | **must be stated**           |

`web_search` can be entirely inline because eight results with short excerpts is a few kilobytes whatever was asked. We have no such ceiling: one project scope cost 7,472 bytes for a selective symbol and 753,636 for stemmed common terms, and an instance-wide `count:all` reached 27 MB. So take the presentation from `web_search` and the storage from `web_fetch`.

### Truncating the display is not truncating the search

Ticket 06 rejects a digest over a **truncated search** — a summary whose missing data exists nowhere, so the agent cannot tell absence from omission. That objection does not apply to a **capped display over a complete artifact**. The search ran to completion, every result is on disk, and the digest is a window onto it. One `grep` reaches the rest.

Three separate facts, and conflating any two is how a confident lie ships:

1. **What was found.** `13,055 files across 412 repos`
2. **Whether the search was complete.** `incomplete: result limit hit`
3. **What is shown versus stored.** `showing 10; full results at <path>`

### Ranking makes the cap meaningful

Measured on the backend: match objects carry no score, weight, or rank field, so ordering is implicit in position. But the order is **deterministic** — two runs of one query returned identical sequences — and **truncation is a prefix**: `count:30` returned exactly the first 30 of `count:all`'s 326, in order. It is genuine relevance ordering rather than enumeration; 326 files across 163 repositories arrived in 290 contiguous runs, so files from different repositories are ranked against each other rather than grouped.

So "showing 10 of 13,055" shows the best 10 — on this engine; see the caveats. Two caveats belong in the wording:

- This is a property of **one backend**. Neither native host offers a projection at all, and one has demonstrably unstable ordering elsewhere in its API. "The first N are the best N" cannot be shared phrasing.
- When a search is incomplete, results are the top of _what was searched_, and coverage is not expressible as a fraction. So `showing 10 of 13,055 found; search incomplete` is honest and `the 10 best matches` is not.

### `detail` changes what comes back, not how long the search takes

Where `detail` exists it is Sourcegraph's `select:` projection, and ticket 07 measured it as **not work-reducing**: the engine finds every match first and projects afterwards, so `detail: "repos"` takes as long as `detail: "matches"`. What it changes is the bytes:

| detail    | what each result carries   | size, measured                                                                      |
| --------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `repos`   | a repository name          | ~3 KB for an instance-wide repo list                                                |
| `files`   | repository, path, revision | 13% smaller than `matches` on a saturating query, 92% smaller on a dense one        |
| `matches` | the above plus every matched line | 27 MB at its worst, instance-wide `count:all`                                |

So `files` is a modest saving when each file matches once and a large one when files match many times; `repos` is the rung that is always cheap. Going finer is a **second call**, narrowed by what the first returned — or `read_file` and `checkout_repo`, which read files better than a search API does.

**Only Sourcegraph can project.** GitHub REST, grep.app, GitLab, and Bitbucket return files with fragments and offer no way to ask for less, so on those engines a `detail` argument could only drop text after paying for it — a display filter wearing a request filter's name. So `detail` appears on `search_code_sourcegraph` alone, and ticket 06's resolution ladder is a Sourcegraph capability rather than a property of code search. For four of five engines the only lever is the digest cap.

### The agent chooses how many: `limit`

Every search tool takes `limit`: **how many results come back to the agent**. Default 10, from `librarian.search.defaultLimit`; maximum 50, or lower where the engine's single request returns fewer. No pagination is added to reach the maximum — where one request returns fewer than 50, that is the ceiling.

| tool | one request returns at most | `limit` maximum |
| --- | --- | --- |
| `search_code_github` | 100 (`per_page`) | 50 |
| `search_repos_github` | 100 (`per_page`) | 50 |
| `search_code_grepapp` | whatever its MCP server's `searchGitHub` returns, unmeasured | that, up to 50 |
| `search_code_sourcegraph` | no limit; `count:` is ours to set | 50 |
| `search_repos_sourcegraph` | no limit | 50 |
| `find_definition` | no limit | 50 |
| `search_code_gitlab` | 99 — `per_page=100` can stop at exactly 100 with no next page | 50 |
| `search_repos_gitlab` | 100 | 50 |
| `search_code_bitbucket` | unmeasured; the window is 1,000 | 50, pending measurement |
| `search_repos_bitbucket` | unmeasured | 50, pending measurement |

Fifty because the cost is context: 50 file entries are about 5 KB, and 50 entries with matched lines run 25–50 KB, half of what pi lets a `bash` call return before spilling to a file. The argument's description says so, since it is the one place the model decides how much to pay:

```ts
limit: Type.Optional(
  Type.Number({
    minimum: 1,
    maximum: 50,
    description:
      "How many results to return. Default: 10. Raise it only when the first results did not answer the question; each result with matched lines costs about 1 KB of context.",
  }),
),
```

The tool fetches at least `limit` results — exactly that many where fetching more costs time, more where it is free, as with a Sourcegraph repository list — and the artifact holds everything fetched at full detail, every matched line included. The digest header keeps the three numbers apart: what the engine found, what was fetched, what is shown.

On Sourcegraph at `detail: "matches"`, `count:` counts highlight ranges, not files, so the tool reads the stream until it has `limit` files, then cancels the rest.

### Writing is unconditional

Every search writes `results.jsonl` under a per-call artifact directory, one result object per line, regardless of size. Matching `writeDocumentBody`, which has no threshold anywhere.

A tool that writes above some byte count and inlines below it changes contract shape at a boundary the model cannot predict, which is how a model reads a path that was never created. One sentence beats a threshold, and the cost of always writing a 3 KB repo list is a file nobody opens.

JSONL rather than the backend's raw response, because raw form differs per backend and server-sent events are miserable to grep.

### Completeness is an allowlist, not a denylist

Any `skipped` reason outside `repository-fork` and `repository-archived` means incomplete. Ticket 07's own probe harness checked for `shard-timeout` alone and reported a truncated 250-match search as complete; the same bug is live in `search_code` today.

Coverage cannot be a fraction. `repositoriesCount` counts repositories _with matches_, not repositories searched. The honest form is a count of what was found plus a named reason for the shortfall.

A `401`/`403` raises rather than returning empty, per ticket 04.

### A time budget, enforced as an error

The librarian exists to collect context faster than the main agent could, so a search that runs for two minutes has already failed at its job, whatever it returns. **Every search gets a 15-second budget, and exceeding it is an error** telling the librarian to narrow the query.

Fifteen holds up under measurement. The Sourcegraph spike timed 36 realistic research queries twice each, cold and warm:

| | p50 | p90 | p95 | max | over 15s |
| --- | --- | --- | --- | --- | --- |
| all 72 samples | 1.34s | 3.56s | 11.1s | 59.8s | 2 |
| excluding `repo:has.commit.after` | — | ~2.2s | — | 6.8s, cold | 0 |

Every sample over 5 seconds but one involves the history predicate, whose cost is linear — about 10 ms per repository in scope. A 905-repository project took 9.6–14.6s; the whole instance, about 57s. GitHub never came within five seconds of the budget across 280 requests, because it stops code searches itself at about 9.2 seconds with a `408`. So 15 seconds is roughly ten times a typical search and twice the worst cold one, and it fires on exactly one class of query, which gets its own handling in `search_repos_sourcegraph`. It is a setting, `librarian.search.timeoutSeconds`, defaulting to 15; the client deadline is always three seconds past it.

**Detecting a timeout uses the server's clock, not ours.** Sourcegraph's repository predicates, when they run out of time, return zero or partial results with a clean `done`, no `skipped` entry, no alert — and facets claiming `"exhaustive": true`. So the stream's own report cannot be trusted, but nor can our wall clock, which carries 0.4–0.8s of overhead and would race the server's `done`. The rule that cannot race: **the final `progress.durationMs` reaching the timeout, or `shard-timeout` in `skipped`, or no `done` before the client deadline.** Every complete query in the spike finished well under its timeout, so `durationMs >= 15000` had no false positives. GitHub's equivalent is its `408`. GitHub's `incomplete_results` means something else entirely — see `search_code_github`.

**The error keeps the counts and discards the results:**

```pi_agent
15s limit hit; 212 files in 40 repos found.
Narrow it before retrying: restrict repos, add a name pattern, or drop changed_after.
```

A partial result set reads as an answer, and the librarian would cite it. The counts stay because they say whether narrowing is worth it — 212 files says the query is too broad; 0 says it may be wrong.

**Hitting the budget cancels the query rather than abandoning it.** No point making a shared server finish work nobody will read. Two layers:

- **The server stops itself.** Sourcegraph gets `timeout:15s` in the query, and returns a `done` 0.4–0.7s later, with the counts the error wants.
- **The client stops waiting at 18 seconds.** An `AbortSignal` with a three-second grace closes the connection if the server overruns — which is not hypothetical: `count:all` ran 36 seconds server-side under `timeout:20s`. Sourcegraph's open-source streaming handler runs the search on the request's context and the instance serves HTTP/2, so a closed stream cancels the server's work. That is established from the code; a non-admin token cannot see the server-side trace to confirm it. GitHub and GitLab REST have no server-side cancel, so closing the connection is all there is.

The server limit is meant to fire first: an abort discards the final counts. The same `AbortSignal` also carries the librarian's own cancellation, so a user aborting a run aborts its in-flight searches.

A consequence: **incompleteness becomes rare.** With timeouts raised, what remains is a result ceiling — Sourcegraph's match budget, Bitbucket's 1,000-result window — and the occasional unknown `skipped` reason, which the allowlist rule already treats as incomplete.

### Where artifacts live

`<cacheDir>/searches/<call-id>/`, alongside `<cacheDir>/repos/`. Same reclaimable root, because search output is shorter-lived than a clone. Per-call rather than per-run, matching `web_fetch`.

---

## The `search_code_*` family

Five engines, five tools. They share the digest shape, the summary, the artifact contract, and the time budget; every filter differs.

### What they share

Summary: `{resultCount} {unit} · {repoCount} repos[, incomplete]`, where `unit` is `repos`, `files`, or `matches` per `detail`; the source is in the row's subject. Today's strings say `hits` unconditionally, which is wrong the moment `detail` exists. Every state is in [What the user sees](#what-the-user-sees).

Every one takes `limit` — see _The agent chooses how many_. The digest header carries the three facts from the delivery contract: what was found, whether the search finished, what is shown versus stored. Every one writes `results.jsonl`. Identifiers are printed as `checkout_repo` takes them — the source once, repository paths per entry; see _Identifiers must be passable to the next tool_ under the `search_repos_*` family.

### Capability matrix

The honest reason for five tools. **Measured** marks what was tested against a live engine for this document; `?` is unverified and must be measured before it ships.

|                    | `_github`                                  | `_grepapp`       | `_sourcegraph`                        | `_gitlab`                        | `_bitbucket`        |
| ------------------ | ------------------------------------------ | ---------------- | ------------------------------------- | -------------------------------- | ------------------- |
| pattern            | substring, words ANDed, quoted phrase      | literal or regex | literal, keyword, regex — always encoded | exact string of the whole query, measured | `?`                 |
| substring match    | **yes**, measured                          | yes              | yes                                   | yes | `?`                 |
| regex              | **no**; `/…/` is literal text, `OR` is silently AND, measured | yes         | yes                                   | no                               | no                  |
| path filter        | `path:`                                    | yes              | `file:`                               | `path:`, `filename:`, `extension:` — project scope, measured             | `?`                 |
| language filter    | `language:`                                | yes              | `lang:`                               | no; `extension:`             | `?`                 |
| repo scope         | `repo:`, `user:` = `org:`, measured        | repo prefix      | `repo:` regex                         | one project unless advanced, measured | project, repo       |
| projection         | no                                         | no               | **yes**                               | no                               | no                  |
| private repos      | yes, with auth                             | **no**           | yes                                   | yes                              | yes                 |
| completeness       | `incomplete_results` = scope unsearchable  | none             | `skipped` allowlist                   | none                             | 1,000-result window |
| result ceiling     | 1,000                                      | `?`              | match budget                          | none; `x-total` a lower bound | **1,000, hard**     |
| rate limit         | 10/min, measured by hitting it             | `?`              | none in 311 requests                  | **30/min per user**, measured | `?`                 |

Three rows deserve attention. **grep.app reaches no private code**, which makes it the wrong choice for anyone with declared sources and the only choice for anyone without. **Three of five engines give no completeness signal**, so their digests can report what they found and must stay silent about what they missed — not fixable from our side. And **GitHub reads `OR` as AND without saying so**, the worst kind of failure, handled below.

The grep.app cells are `?` because grep.app is unreachable from the network this was measured on. They are in [`PERSONAL_TASKS.md`](PERSONAL_TASKS.md).

### `search_code_github`

Measured by a dedicated spike — 284 logged requests against public repositories. The findings that shape the tool:

| behaviour | measured |
| --- | --- |
| matching | case-insensitive substring; `neConf` finds `defineConfig` |
| several words | **all must appear** in the file — AND |
| `OR` | **silently read as AND**: `defineConfig OR drizzleKit` returns 0, same as without `OR` |
| quotes | exact phrase |
| `-word`, `NOT word` | exclusion works |
| parentheses, unbalanced quotes | `422 unable to parse query!` |
| `/…/` | **literal text**, not a failed regex — `/node_modules/` finds 4 files |
| special characters `.` `(` `::` `.*` | literal |
| `path:` | directory prefix **anchored at the repository root**; no globs, no file names — `path:src` misses `drizzle-kit/src/` |
| `filename:`, `extension:` | substring/suffix of the file name; `ts` and `.ts` both work |
| unknown `word:value` in the pattern | silent zero |
| indexed | default branch only; files under about 350 KiB; forks only if GitHub chose to index them |
| fragments | 1–2 per file, no line numbers |
| `incomplete_results: true` with 0 items | **the scope could not be searched** — missing, private, renamed (GitHub does not follow the rename), or an unindexed fork |
| server time limit | GitHub returns `408` itself at about 9.2s |
| ceiling | 1,000 results; page 11 is a `422` |
| rate limit | 10 a minute, `403` with no `retry-after`; reset is `x-ratelimit-reset` minus the response's `Date`; `408`s and `422`s count against it |

Two of my earlier claims were wrong, in opposite directions. I first said GitHub tokenizes, so substrings fail — they match. Then I said `/…/` is a regex that silently returns zero, and proposed rejecting it — it is literal text, and rejecting it would have blocked a real search for `/node_modules/`. What _is_ silently wrong is `OR`, which the model's training on GitHub's web search will reach for.

**Does the agent need the query language spelled out?** Not the qualifiers — the arguments build those. It needs `pattern`'s semantics, because that is where its training on GitHub's web UI misleads it: regex in `/…/`, `OR`, grouping. So the description states the real rules, and the edge rejects the inputs that are silently wrong or uselessly fatal:

- bare `OR` — silently AND, so the agent believes it asked for something it did not
- parentheses outside quotes, and an unbalanced `"` — GitHub's `422` names none of them
- `word:value` outside quotes — a qualifier smuggled through the pattern bypasses the typed arguments, and an unknown one is a silent zero

Each rejection names the argument that does the job instead.

**Scope: `owner` plus bare `repos`.** Your proposal, generalised slightly. Measured: `repo:A/x repo:B/y` and `user:A user:B` are each an OR; `org:` and `user:` are interchangeable for both users and organisations; `repo:A/x user:B` is `422 unable to parse query!`. So the contradiction is loud but tells the agent nothing, and **today's tool already has this bug**: it takes `repos: [{owner, repo}]` and `owners: [...]` side by side. One `owner` per call makes the contradiction unrepresentable. `repos` are bare names under it; `drizzle-team/drizzle-orm` is rejected with a pointer to the split form. `owner` rather than your `org`, because the two are interchangeable here and many repositories are user-owned.

**An unsearchable scope is an error, not an empty result.** `incomplete_results: true` with no items reads as "no matches" and means "I could not look". The tool raises instead, and resolves the commonest cause itself: a `GET /repos/{owner}/{repo}`, about 150 ms, follows renames, so `facebook/react` can be answered with "renamed to `react/react`".

```ts
const Params = Type.Object({
  pattern: Type.String({
    description:
      'Text to find, matched case-insensitively as a substring. Space-separated words must all appear in the file; quote a phrase to match it exactly; -word excludes. No regex, no OR, no parentheses.',
  }),
  owner: Type.Optional(
    Type.String({ description: "Restrict to repositories owned by this user or organization." }),
  ),
  repos: Type.Optional(
    Type.Array(Type.String(), {
      description: "Restrict to these repositories under owner, by bare name, e.g. drizzle-orm. Requires owner.",
      maxItems: 20,
    }),
  ),
  path: Type.Optional(
    Type.String({
      description: "Directory from the repository root, e.g. drizzle-kit/src. Not a glob and not a file name.",
    }),
  ),
  filename: Type.Optional(Type.String({ description: "File name or suffix, e.g. drizzle.config.ts." })),
  extension: Type.Optional(Type.String({ description: "File extension, e.g. ts." })),
  language: Type.Optional(Type.String({ description: "Restrict to a language, e.g. typescript." })),
});
```

`filename` and `extension` are new because they are what an agent means by `path:*.ts`, and `path` cannot say it. An unknown `language` is a loud `422` on code search, so it passes through and the error is translated.

```ts
name: "search_code_github",
label: "Search GitHub code",
description:
  "Search code on GitHub's default branches, including private repositories your token can read. Returns matching files with short excerpts, without line numbers; files over about 350 KB are not indexed. Limited to 10 searches a minute.",
```

No guideline. "Prefer this over grep.app for private code" follows from this description saying "including private repositories" and grep.app's saying "public code only", and as a guideline it would name a tool that may not be registered.

The rate limit is in the description because the librarian runs parallel calls by preference and ten a minute is easy to exhaust in one turn; the spike hit it, and so did I. The rate-limit error says when the window resets, computed from the headers.

The 15-second budget never bites here — GitHub stops itself at about 9 seconds — so a `408` is translated into the same narrowing error the budget would have produced.

### `search_code_grepapp`

Today's `search_code`, renamed, arguments unchanged because they already fit the engine. The wording changes, because the current description implies it is _the_ code search:

```ts
name: "search_code_grepapp",
label: "Search public code",
description: "Search public open-source code by literal pattern or regex (grep.app; public code only).",
```

### `search_code_sourcegraph`

The only tool with `detail`, and the only one that can report coverage. A dedicated spike — 311 requests against a 7.7 instance, plus a read of Sourcegraph's open-source query transformer and streaming handler — settled most of its shape.

**The query parser is a trap, so the agent's text never reaches it raw.** Measured:

| mode | behaviour |
| --- | --- |
| standard — **the default** with no pattern type | literal text, plus `/…/` as an RE2 regex |
| `patternType:regexp` | whitespace becomes `.*?`: `retry backoff jitter` means "those three, in that order, on one line" — 264 files where the literal found 0. A `[ ]` character class is silently split; an unbalanced `(` is silently made literal |
| `patternType:keyword` | every term somewhere in the file, any order, matching substrings; quotes keep a phrase; `NOT` and `OR` work; **a leading `-term` searches for the text `-term`** |
| every mode | `and`, `or`, `not`, in any case, are boolean operators — so a literal phrase containing "and" becomes two terms |
| literal mode | quotes are literal characters |

Two forms parse a pattern atomically, and the tool uses only those:

| `pattern_type` | sent as | effect |
| --- | --- | --- |
| `literal` | `content:"…"`, escaping `\` and `"` | the exact text, spaces and "and" included, under any mode |
| `regexp` | `/…/` under standard, escaping `/` | RE2 with real spaces; an invalid regex is a loud alert instead of a silent literal |
| `keyword` | the pattern as given | the keyword semantics above |

`patternType:regexp` is never sent. The previous draft said the default was literal; it is standard, which is why the encoding matters even when no type is chosen. And `structural` stays dropped.

**Always sent with every query:** `type:file`, because a bare pattern also returns repository-name and path matches mixed in with code; `count:` in the unit `detail` selects — as built, 5,000 repositories, 1,000 files, or 2,000 matched ranges, read to the end of the stream so the digest has the final counts; and `timeout:15s`. Reaching that limit is reported as incomplete, "reached the result limit for one search". This replaces the delivery contract's "read the stream until it has `limit` files, then cancel", which would have thrown away the counts the header and the narrowing error need. `count:` without `timeout:` silently raises the timeout to the site maximum, and `count:all` is still a finite limit that ran past its timeout.

**`detail` changes the unit `count:` counts.** Under `select:file`, a 5,000-result limit means 5,000 files, so on a broad query `files` returned _more_ bytes than full matches — 1.46 MB against 1.04 MB. Under `select:repo`, the same limit exceeded the 1,701 matching repositories, so that search ran to completion where the full one hit its limit. Server time is the same for all three. So `repos` is the cheap, complete-at-scale rung, and `files` is a different resolution rather than a cheaper one.

**Errors, and the silent zeros the tool prevents:**

| input | engine's response | the tool |
| --- | --- | --- |
| bad token | `401`, plain text | raises |
| invalid `/regex/` | alert | raises with the alert's text |
| `repos` matching nothing, or an unknown predicate | alert "No repositories found" | raises — the actionable form of a typo |
| a result set with an alert | results and an alert | keeps the results, attaches the warning |
| invalid `repo:` or `file:` regex | **silent zero** | validates `repos` and `path` locally first |
| unknown filter, e.g. `lnag:go` | **silent zero** — searched as text | never passes agent text unencoded |
| quoted predicate argument | silent zero, or an error event | builds predicates from typed arguments |

Every `progress` event also carries an internal trace URL, stripped before anything reaches the model. No rate limiting was seen in 311 requests.

```ts
const Params = Type.Object({
  pattern: Type.String({ description: "Code to find, as it appears in files." }),
  pattern_type: Type.Optional(
    StringEnum(["literal", "keyword", "regexp"], {
      description:
        "How to read the pattern. literal: the exact text, spaces and punctuation included. keyword: every term somewhere in the same file, any order, matching substrings; quote a phrase to keep it together, join alternatives with OR, exclude with NOT — a leading - is searched as text. regexp: RE2, matched within one line. Default: literal.",
    }),
  ),
  detail: Type.Optional(
    StringEnum(["repos", "files", "matches"], {
      description:
        "What each result is: a repository, a file, or a file with its matched lines — and so what the result limit counts. repos stays complete across the whole instance; files and matches may hit the limit on a broad pattern. Default: files.",
    }),
  ),
  repos: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Restrict to repositories whose names match these RE2 patterns, e.g. ^git\\.example\\.com/PROJ/. The only filter that makes a search faster.",
      maxItems: 20,
    }),
  ),
  path: Type.Optional(Type.String({ description: "Restrict to file paths matching this RE2 pattern." })),
  language: Type.Optional(Type.String({ description: "Restrict to a language, e.g. go." })),
});
```

`source` appears only when more than one Sourcegraph is declared.

```ts
name: "search_code_sourcegraph",
label: "Search code across repos",
description:
  "Search code across every repository the Sourcegraph instance indexes, and report whether the search covered them all. Results are ranked across repositories; line numbers are from the indexed commit.",
promptGuidelines: [
  "To find callers of a symbol across repositories with search_code_sourcegraph, search the name as a regexp with word boundaries, e.g. \\bNewClient\\b.",
],
```

That guideline is the rule set's conduct rule — it names only its own tool — and it replaces `find_references`; see below.

### `search_code_gitlab`

A dedicated spike — 743 sequential reads against a self-hosted instance without advanced search — measured the project-scoped search this tool rests on:

| behaviour | measured |
| --- | --- |
| matching | case-insensitive **fixed string of the whole query** — no AND, quotes are literal characters, no regex |
| a one-character pattern | silent `200 []` |
| ordering | **none**: files whose path matches come first, then content chunks in path order |
| each hit | the match plus two lines either side; `startline` is the first _context_ line, not the match |
| `filename:`, `path:`, `extension:` | **work without advanced search**, at project scope |
| `extension:.go`, with the dot | silent zero |
| filters, cost | applied after a full scan: 0.4–0.8s on an ordinary project; 20–56s on a 13.7 GB one, where they can end in a `500` |
| unfiltered, cost | 0.3–0.4s on ordinary projects; 8–10s for a rare term on the 13.7 GB one |
| `per_page=100` | can stop at exactly 100 hits with no next page; `x-total` is a lower bound until the last page |
| rate limit | **30 a minute per user, across all projects**; every page and every `400` counts; the `429` carries `Retry-After: 60` whatever is left |
| renamed project | lookup follows a `301`, but search under the old path redirects to a broken URL that `404`s |
| `200 []` that is not "no matches" | a missing ref; a project whose repository is restricted to you |
| advanced-search refusal, group or global scope | `400 Scope supported only with advanced search or exact code search` |

So the previous draft was wrong in its main claim: filters are not an advanced-search feature. **The flag decides only whether `project` is required.**

**Where the setting lives: on the source, not under a global `gitlab.*` key.** Two GitLab instances can differ, and a source declaration is where per-instance facts already live. GitLab's own name for the feature is what an operator will recognise:

```jsonc
{ "name": "example-gl", "url": "https://gitlab.example.com", "kind": "gitlab", "advancedSearch": true }
```

Valid only on `kind: "gitlab"`; anywhere else it is rejected at load. **Default `false`, including for `gitlab.com` until measured.** Both wrong answers are loud — the `400` above — so the choice is about cost: wrong at `false` means naming a project that need not be named; wrong at `true` means a `400` on every unscoped search, each one counting against the 30-a-minute limit. Whether gitlab.com offers advanced search to an ordinary account decides its built-in value, and is in [`PERSONAL_TASKS.md`](PERSONAL_TASKS.md).

The flag changes the schema, which is why prose could not have carried it — ticket 11's open question has its first concrete answer. **A description the model reads cannot make an argument optional.**

**What the tool does at the edge**, from the table:

- **Resolves `project` to a numeric id first**, which follows renames and avoids the broken redirect; then searches by id.
- **Rejects a pattern under two characters**, and **strips a leading dot from `extension`**, both silent zeros otherwise.
- **Pages at 50**, never 100, and treats `x-total` as a lower bound. Fetches page 1 first and only pages on when the digest needs more.
- **Holds a client-side limit of 30 searches a minute per source**, shared across the librarian's parallel calls, so the librarian waits or fails with a reset time rather than burning its quota on `429`s.
- **Raises on an empty result when `ref` was given and does not exist** — one cheap ref lookup tells "no matches" from "nothing to search".
- **Translates the advanced-search `400`** into "this source searches one project at a time; name one."

```ts
// advancedSearch: false — project required
const Params = Type.Object({
  pattern: Type.String({
    description:
      "Text to find, matched case-insensitively as one exact string — spaces and quotes included. No regex, and several words are a phrase, not separate terms. At least two characters.",
  }),
  project: Type.String({ description: "Project path, e.g. platform/widget-sdk." }),
  ref: Type.Optional(Type.String({ description: "Branch, tag, or commit. Default: the default branch." })),
  filename: Type.Optional(Type.String({ description: "File name, wildcards allowed, e.g. *_test.go." })),
  path: Type.Optional(Type.String({ description: "Directory within the project, e.g. internal/git." })),
  extension: Type.Optional(Type.String({ description: "File extension without the dot, e.g. go." })),
});

// advancedSearch: true — project becomes optional
project: Type.Optional(Type.String({ description: "Restrict to one project, e.g. platform/widget-sdk." })),
```

```ts
name: "search_code_gitlab",
label: "Search GitLab code",
description:
  "Search the code of one GitLab project for an exact string. Results are unranked — files whose path matches come first, then matches in path order. Filters scan the whole project, which is slow on very large repositories. Limited to 30 searches a minute.",
```

`filename`, `path`, and `extension` together cover what the advanced flavour's syntax offers at project scope, so the two shapes differ only in `project`. With `advancedSearch: true` the description loses "of one GitLab project".

**The budget bites here, and correctly.** Every unfiltered search measured fits in 15 seconds — the slowest, a rare term on the 13.7 GB repository, took about 10 — and the filtered scans on that repository do not. Those are the queries the budget exists to stop, and the narrowing error points at them: "on a project this size, search without filters, then read the files." A budget under about 11 seconds would break ordinary rare-term searches on that repository, so 15 is not just generous here; it is close to the floor.

### `search_code_bitbucket`

Correct, cheap, and not growing — Bitbucket Server is being replaced by self-hosted GitLab over roughly two years.

It rests on an **undocumented** REST endpoint with a hard 1,000-result window. The tool pages up to the window and stops. Reaching it is reported as incomplete, because it is the engine refusing to go further rather than a limit we chose:

```pi_agent
1,000 files across 87 repos (example-bb). Incomplete: reached Bitbucket's 1,000-result window.
Showing 10. Full results: /tmp/pi-librarian/searches/tc_01HD/results.jsonl (1,000 lines, 212 KB)
```

```ts
const Params = Type.Object({
  pattern: Type.String({ description: "Code to find." }),
  project: Type.Optional(Type.String({ description: "Restrict to a project key." })),
  repo: Type.Optional(Type.String({ description: "Restrict to one repository in project. Requires project." })),
});
```

`repo` requires `project`, for the reason `repos` requires `owner` on GitHub.

## The `search_repos_*` family

Four engines. Most of this section answers questions raised in review, directly.

### `source` is required, and usually absent

The `github` default is gone, and so is the argument in the common case. `search_repos_github` _is_ the GitHub instance, so there is nothing to default and nothing to pass. `source` appears only where an engine has several declared instances.

### No `help: true`; the schema is the help

A fair instinct — the vocabulary differs per engine and the agent cannot know it — but the premise can be removed instead. `help` is a lazy loader for documentation, worth having only if the documentation is too expensive to carry in context. It costs a round-trip to learn how to make a call, and it is a boolean that changes the return type. **Make the filters typed arguments and the schema becomes the help**: already in context, no round-trip, validated before anything runs.

The stronger reason is the failure mode. A qualifier an engine does not recognise is often not an error — it is searched for as text, and the result is confident and wrong. **A filter the engine does not understand is worse than one it refuses.**

What we give up is anything the arguments do not model: boolean `OR` between qualifiers, alternation on names, qualifiers nobody has asked for. Those become recorded gaps, and an argument gets added when something needs one.

### No filter is universal

| filter           | `_github`                            | `_sourcegraph`                  | `_gitlab`                          | `_bitbucket` |
| ---------------- | ------------------------------------ | ------------------------------- | ---------------------------------- | ------------ |
| name / free text | terms over name, description, readme | `repo:` regex                   | substring over path, name, description | substring |
| language         | `language:`                          | no                              | no                                 | no           |
| stars            | `stars:>N`                           | no                              | sort only                          | no           |
| topic            | `topic:`                             | `repo:has.topic()`              | `topic=`                           | no           |
| contains path    | no                                   | `repo:has.path()`               | no                                 | no           |
| contains content | no                                   | `repo:has.content()`            | no                                 | no           |
| both at once     | no                                   | `repo:has.file(path: content:)` | no                                 | no           |
| changed after    | `pushed:>date`                       | `repo:has.commit.after()`       | `last_activity_after`              | no           |
| archived / fork  | `archived:`, `fork:`                 | `archived:`, `fork:`            | `archived=`                        | no           |
| sort             | best-match, stars, updated           | **none**                        | see below                          | `?`          |

`changed_after` exists on three engines and is a cheap index lookup on two of them and a git history walk on the third, so its cost warning belongs on one tool's argument and would be a lie on the others. The warning goes on the argument, only on the slow one; naming what is fast is noise.

### `search_repos_github`

**Sort: default to `best-match`, which is GitHub's own default.** It only differs from `stars` when there is free text:

| query                      | `best-match`, GitHub's default | `stars`                              |
| -------------------------- | ------------------------------ | ------------------------------------ |
| `http client language:go`  | `gorilla/http` ★269 first      | `go-resty/resty` ★11817 near the top |
| `language:go stars:>20000` | identical to `stars`           | identical                            |

Best-match answers "find me the thing called X"; stars answers "what is popular". The argument's description says when to pick stars. `sort` must be an enum regardless: GitHub silently ignores an unknown value and returns best-match.

**What GitHub validates loudly, and what it does not**, measured:

| input | result |
| --- | --- |
| malformed date: `garbage`, `2026-13-45`, `1 month ago`, `01/02/2026` | `422` with an ISO 8601 hint — relayed as is |
| malformed star count | `422` |
| unknown owner | `422` |
| **unknown language** | **silently dropped** — the search widens to every language |
| unknown qualifier | silent zero |
| unknown sort | silently best-match |
| **whitespace in a value**: `pushed_after: "2026-01-01 stars:>5"` | **a second qualifier, silently applied** — 6,007 results become 302 |
| the same value quoted | silent zero |

So the tool relays GitHub's date errors and does no date parsing, but **rejects whitespace and quotes in every value it interpolates** — escaping by quoting turns injection into a silent zero, so there is no safe escaping. And `language` is **validated before sending** against GitHub's language list, because an unknown one silently returns results in every language. That list is Linguist's, which GitHub publishes; how to vendor it is an implementation detail.

**Free text searches name, description, and topics — not READMEs.** The previous draft said readme. `in:readme` _replaces_ those fields and is about 30 times wider, so it is an explicit boolean if it exists at all.

**Topics: an array, ANDed.** Repeated `topic:` qualifiers are AND; a comma-joined list is OR. AND is the narrowing an agent expects from "these topics".

**Forks are excluded by default**, which is GitHub's own default too, so `include_forks` only emits a qualifier when true.

```ts
const Params = Type.Object({
  text: Type.Optional(Type.String({ description: "Terms matched against name, description, and topics." })),
  in_readme: Type.Optional(
    Type.Boolean({ description: "Search README text instead of name and description — far broader. Default: false." }),
  ),
  language: Type.Optional(Type.String({ description: "Restrict to a primary language, e.g. typescript." })),
  topics: Type.Optional(
    Type.Array(Type.String(), { description: "Only repos tagged with every one of these topics.", maxItems: 10 }),
  ),
  min_stars: Type.Optional(Type.Number({ minimum: 0, description: "Only repos with at least this many stars." })),
  pushed_after: Type.Optional(
    Type.String({ description: "Only repos pushed to after this ISO 8601 date, e.g. 2026-01-01." }),
  ),
  include_forks: Type.Optional(Type.Boolean({ description: "Include forks. Default: false." })),
  include_archived: Type.Optional(Type.Boolean({ description: "Include archived repos. Default: true." })),
  sort: Type.Optional(
    StringEnum(["best-match", "stars", "updated"], {
      description: "Ordering. Use stars to find what is popular. Default: best-match.",
    }),
  ),
  limit: Type.Optional(
    Type.Number({ minimum: 1, maximum: 50, description: "Max results to fetch. Default: 10." }),
  ),
});
```

Every field is optional, so an empty call would ask for all of GitHub; the tool rejects a call with no filter rather than making `text` required, because `min_stars: 50000` alone is a legitimate question. `limit` stays small on purpose: 100 per page costs 3–5 seconds against about 1.3 at 30.

### `search_repos_sourcegraph`

```ts
const Params = Type.Object({
  name: Type.Optional(Type.String({ description: "Regex matched against repository names." })),
  topics: Type.Optional(
    Type.Array(Type.String(), { description: "Only repos with every one of these topics.", maxItems: 10 }),
  ),
  contains_path: Type.Optional(
    Type.String({ description: "Only repos with a file whose path matches this regex, e.g. ^go\\.mod$." }),
  ),
  changed_after: Type.Optional(
    Type.String({
      description:
        "Only repos with a commit after this date, e.g. 2026-01-01. Walks git history, about 10 ms per repository in scope, so it is refused above about 1,000 repositories — narrow with name first.",
    }),
  ),
  include_forks: Type.Optional(Type.Boolean({ description: "Include forks. Default: false." })),
  include_archived: Type.Optional(Type.Boolean({ description: "Include archived repos. Default: false." })),
});
```

**`changed_after` gets a pre-flight count instead of a bigger budget.** Its cost is linear at about 10 ms per repository in scope, so 15 seconds covers about 1,200 repositories, and an instance-wide history walk measured 57 seconds. Counting the name-scoped repository set first costs 0.4–0.8s. So when `changed_after` is given, the tool counts the scope, and above about 1,000 repositories refuses with the narrowing error before spending the budget — cheaper and more honest than letting the call time out.

`topics` match nothing for Bitbucket Server repositories, which have no topics; it works for repositories mirrored from GitHub and GitLab.

No `sort`: the engine offers no ordering. `limit` works as on every search tool, but the fetch is always the whole list — around 3 KB instance-wide — so the artifact and the count are complete even when the digest shows ten. A caller who wants "the top 10" is asking something this engine cannot answer.

**No `contains_content`, because that question already has an owner.** "Which repositories contain this code" is `search_code_sourcegraph` with `detail: "repos"` — the same engine, the same index, and better at it: keyword and literal pattern types, path and language filters, and complete at instance scale. Keeping a second spelling here would mean two tools answering one question, which the rule set forbids. The strongest scope filter measured, `repo:has.file(path: content:)` — repositories whose `go.mod` mentions `cobra`, 1,371 in 1.26s — is that search too: `pattern: "cobra"`, `path: "^go\.mod$"`, `detail: "repos"`.

What stays is what code search cannot ask. `contains_path` needs no pattern — "repositories with a `Dockerfile`" — and `name`, `topics`, `changed_after`, and the fork and archive switches describe the repository rather than its contents. So the split is clean: **`search_repos_*` asks what a repository is; `search_code_*` asks what it contains.**

### `search_repos_gitlab`

Measured by the same spike:

| behaviour | measured |
| --- | --- |
| `search=` | substring, case-insensitive; **all terms must match in the same field** — path, name, or description — so one term in each finds nothing |
| short words | words under three characters are dropped; a query of only short words becomes an exact-name match |
| `search_namespaces=true` | adds group-path matching, so `platform/widget` works, at no extra cost |
| `simple=true` | 21% of the bytes and about 2.6 times faster, but drops `archived` and `empty_repo` |
| `archived` absent | **archived projects included** |
| `sort` | **descending by default for every order**, so name ordering runs Z to A |
| `order_by=similarity` | exactly the projects you are a member of — confirmed, 102 projects became 6 |
| `updated_after` without `order_by=updated_at` | a loud `400 … must be paired` |
| `last_activity_after: 10/01/2026` | **accepted and read as 10 January** — lenient, and silently wrong for US-style dates |
| `topic=` | exact, case-sensitive; several are ANDed |
| latency | under 2s throughout |
| rate limit | none on project search |

**GitLab does have a best-match sort, and it is a trap.** `similarity` is the relevance ordering, and it **silently shrinks the result set to projects you belong to**. A sort that is secretly a filter does not go in the enum.

GitLab's default order is `created_at`, which answers no research question, so the default is `activity`, mapped to `last_activity_at`, newest first. The tool always sends `sort` explicitly — descending for dates and stars, ascending for name.

Date filtering uses `last_activity_after`. The previous draft said `updated_after` would be silently ignored under another sort; it is a loud `400`, so the choice is about meaning rather than safety — activity is what "changed recently" means. But `last_activity_after` is the lenient one, and it misreads `10/01/2026` without complaint, so **the tool validates `YYYY-MM-DD` at the edge** before sending.

The tool always sends `search_namespaces=true` and `simple=true`, and `archived=false` unless `include_archived` is set — which both restores GitHub-like defaults and makes `simple`'s missing `archived` field irrelevant.

```ts
const Params = Type.Object({
  name: Type.Optional(
    Type.String({
      description:
        "Text matched against project path, name, group path, or description. Every word must appear in the same one of those; words under three characters are ignored.",
    }),
  ),
  topics: Type.Optional(
    Type.Array(Type.String(), {
      description: "Only projects with every one of these topics, exact and case-sensitive.",
      maxItems: 10,
    }),
  ),
  changed_after: Type.Optional(
    Type.String({ description: "Only projects with activity after this date, YYYY-MM-DD." }),
  ),
  include_archived: Type.Optional(Type.Boolean({ description: "Include archived projects. Default: false." })),
  sort: Type.Optional(
    StringEnum(["activity", "stars", "updated", "created", "name"], {
      description: "Ordering. Default: activity, most recently active first.",
    }),
  ),
});
```

### `search_repos_bitbucket`

```ts
const Params = Type.Object({
  name: Type.Optional(Type.String({ description: "Substring matched against repository name." })),
  project: Type.Optional(Type.String({ description: "Restrict to a project key." })),
});
```

Two filters, and that is the whole surface. It looks impoverished beside GitHub's eight, and the asymmetry is real; a shared tool would have hidden it behind six arguments that quietly did nothing.

### Three numbers, not two

`1,284 repositories match; showing 10` conflated three quantities:

| number         | meaning                     | lives in     |
| -------------- | --------------------------- | ------------ |
| `matchCount`   | what the engine says exists | the header   |
| `fetchedCount` | how many we retrieved       | the artifact |
| `shownCount`   | how many the digest lists   | the digest   |

So yes — in your reading, GitHub reported 1,284 and we fetched 10. **Fetching fewer than exist is a limit, not an incompleteness.** A limit is a choice we made and can undo by asking again; an incomplete search is the engine failing to cover what was asked. One word for both would tell the agent to retry when retrying cannot help, or to trust a result it should not.

```pi_agent
1,284 repositories match (github). Fetched 10 (limit); showing all 10.
Full results: /tmp/pi-librarian/searches/tc_01HA/results.jsonl (10 lines, 6.2 KB)

 1. drizzle-team/drizzle-orm — ★27104 · TypeScript · last modified 2026-08-19
    Headless TypeScript ORM with a head
    topics: database, orm, postgresql, sql, typescript
 2. prisma/orm — ★41230 · TypeScript · last modified 2026-08-21
    Next-generation ORM for Node.js & TypeScript
…
```

A source with thinner metadata, where the optional fields simply do not appear:

```pi_agent
19 repositories match (example-bb). Fetched all 19; showing all 19.
Full results: /tmp/pi-librarian/searches/tc_01HA/results.jsonl (19 lines, 4.4 KB)

 1. tooling/deploy-cli
    Deployment CLI and release tooling
 2. tooling/deploy-agent
…
```

### Identifiers must be passable to the next tool

The old digest rendered `example-bb/tooling/deploy-cli`, which does not say where the source name ends. The previous draft's fix was to render `source:repo` and call it pasteable. The Sourcegraph spike pointed out it is not: `checkout_repo` takes `source` and `repo` as separate arguments and has no parser for the joined form.

And teaching it one would be worse than a missing feature. `checkout_repo` already accepts scp-style clone URLs, `host:path`, and `gitlab.com` is both a built-in source name and a hostname — so `gitlab.com:platform/widget-sdk` would mean two different things. **So identifiers are printed as `checkout_repo` takes them: the source once, the repository path per entry.**

For a tool that searches one source, the header already names it, and entries are bare paths:

```pi_agent
19 repositories match (example-bb). Fetched all 19; showing all 19.
Full results: /tmp/pi-librarian/searches/tc_01HA/results.jsonl (19 lines, 4.4 KB)

 1. tooling/deploy-cli
    Deployment CLI and release tooling
```

For Sourcegraph, whose results span every code host it indexes, entries are grouped under the clone source each maps to:

```pi_agent
412 files across 63 repos (example-sg). Complete.
Showing 10. Full results: /tmp/pi-librarian/searches/tc_01H9/results.jsonl (412 lines, 96 KB)

example-bb — clone with source: example-bb
 1. PROJ/service-a — src/retry.go (9f8e7d6)
 2. CORE/search-lib — client/backoff.go (1c2d3e4)
not a declared source
 3. github.com/acme/retry-kit — retry.go (a1b2c3d)
```

**The mapping**, measured: Bitbucket Server repositories are named `git.example.com/PROJ/slug`, project keys uppercase. Stripping the first segment when it equals a declared source's hostname leaves exactly the `repo` `checkout_repo` wants, and `deriveReference` builds the `/scm/` clone URL from it. When the prefix matches no declared hostname — the site may use a custom path pattern — GraphQL's `externalRepository.serviceID` is the fallback. A repository that maps to no declared source shows its instance name and no clone hint, never a guessed source: one mirrored repository on the instance is `serviceType: other`, so a code-host kind cannot be inferred from a name prefix.

In `results.jsonl` the source and path are separate fields, so nothing downstream parses the display form.

GitLab-hosted names are unmeasured, because the instance indexes no GitLab.

### Metadata is optional fields, not per-engine rendering

```ts
type RepoResult = {
  source: string;
  repo: string;
  description?: string;
  stars?: number;
  language?: string;
  pushedAt?: string;
  topics?: string[];
  archived?: boolean;
  fork?: boolean;
};
```

A new source needs a mapping, not a renderer. And absence carries information: a repository with no star count is not a repository with zero stars, and a shared renderer printing `★0` would be inventing data.

### Details

**One interface per tool, discriminated by `kind`**, accepting near-duplicates. Decided in review: copying now is cheaper than unpicking a shared shape when a new engine turns out to be drastically different.

```ts
export interface SearchReposGitHubDetails {
  kind: "search_repos_github";
  source: string;
  matchCount: number;
  fetchedCount: number;
  shownCount: number;
  complete: boolean;
  incompleteReason?: string;
  artifactPath: string;
  entries: ShownEntry[];
}
```

### What the user sees

In [What the user sees](#what-the-user-sees), with every state.

## Firecrawl's Developer Index is not code search

Proposed as a future engine playing grep.app's role. Its documentation says otherwise: the index covers **issues, merged pull requests, READMEs, curated documentation sites, and agent-skill files** — not source files. A query is a natural-language question; a result is a ranked artifact with an id such as `issue:owner/repo#123` and its matched passages in markdown. Optional filters pick artifact types and scope by repository or documentation source, and seven repository-attribute filters (`language`, `topic`, `license`, `min_stars`, `max_stars`, `archived`, `fork`) overlap `search_repos_github` almost exactly. Source: `features/developer.mdx` in `firecrawl/firecrawl-docs`.

So it does not fit the `search_code_*` family. What it adds is narrower than it first looks, because folding in pi-web-tools — [ticket 12](tickets/12-folding-pi-web-tools-into-the-librarian.md) — already brings issues and pull requests: `web_fetch` reads any of them with their conversations, and searches one repository's issues and PRs through a listing URL with `?q=`. What the Developer Index adds on top is **search across repositories**, and **natural-language questions over READMEs and documentation**.

**Where I would put it: beside `web_search`.** It is a hosted search over web artifacts, with a bounded result count and passages — `web_search`'s delivery model exactly, not this document's artifact contract. Its own `/search` endpoint even serves it as a web-search category. After the merge that is the same package.

Two constraints:

- **It is unreachable from at least one corporate network**, where a category filter blocks it at the proxy. It cannot be the only path to anything.
- **Nothing about it gets measured here.** Every open question — query behaviour, result ceiling, keyless rate limits, whether it beats `web_search` on a library question, how its repository filters compare with GitHub's — is in [`PERSONAL_TASKS.md`](PERSONAL_TASKS.md).


## `find_definition`, and why there is no `find_references`

The Sourcegraph spike settled this one with evidence, and the answer is one tool, not two.

**`find_definition` is cheap and works.** `type:symbol` matches symbol names — substring, case-insensitive — so the tool sends `^name$` as a regex for an exact name, optionally narrowed by kind with `select:symbol.function` and its siblings. Latency was 0.4–1.9s. One finding shapes the default: `^NewMultiMatchQuery$` returned 16 definitions, and **13 of them are vendored copies** — the spike reported 5; reading the artifact's paths during implementation found 13, leaving 3 real definitions. So vendored paths are excluded by default — which is ticket 10's question arriving early — with an argument to include them.

**`find_references` does not ship.** The instance has precise code intelligence for about 1,464 repositories, and `usagesForSymbol` works well _within_ one: from a definition, 4 precise usages plus search-based mentions, in 3.4s. But **across repositories it only resolves definitions.** From a widely used definition it returned usages in the defining repository alone, while text search found callers in six others. Precise symbol names embed the dependency version, so a consumer pinned to another version never links.

That leaves two meanings of "find references", and neither needs a tool:

- **"Who calls this, everywhere"** — a word-boundary regex search, `\bName\b`. That is `search_code_sourcegraph`, so a separate tool would only rename it. Its guideline says so.
- **"Precise references inside one repository"** — `checkout_repo` and `grep` answer it, faster than a GraphQL round-trip per position.

Revisit if precise cross-repository references are ever configured.

### Inputs

```ts
const Params = Type.Object({
  symbol: Type.String({ description: "Exact symbol name, e.g. NewClient." }),
  kind: Type.Optional(
    StringEnum(["function", "method", "class", "struct", "interface", "enum", "variable", "constant", "field", "property"], {
      description: "Only definitions of this kind.",
    }),
  ),
  repos: Type.Optional(
    Type.Array(Type.String(), { description: "Restrict to repositories matching these RE2 patterns.", maxItems: 20 }),
  ),
  language: Type.Optional(Type.String({ description: "Restrict to a language." })),
  include_vendored: Type.Optional(
    Type.Boolean({ description: "Include copies under vendor/ directories. Default: false." }),
  ),
});
```

`kind` is a fine argument name now that the tool is singular — the collision with the `Details` discriminant was only ever a problem for a mode switch, and there is no mode any more. Its enum is measured: the instance reports FUNCTION, METHOD, CLASS, STRUCT, INTERFACE, ENUM, VARIABLE, CONSTANT, FIELD, PROPERTY, TYPEPARAMETER, PACKAGE, and UNKNOWN, and `select:symbol.type` is an "Invalid field" alert, so `type` is not offered.

```ts
name: "find_definition",
label: "Find definition",
description:
  "Locate where a symbol is defined, by exact name, across every repository the Sourcegraph instance indexes. Returns definition sites with 1-based line numbers; a miss can mean the language or repository is not indexed for symbols.",
```

### Details

```ts
export interface FindDefinitionDetails {
  kind: "find_definition";
  source: string;
  symbol: string;
  resultCount: number;
  complete: boolean;
  incompleteReason?: string;
  artifactPath: string;
  entries: ShownEntry[];
}
```

No `shownCount`: a symbol with more definitions than fit is the answer, not a display problem.

### What the agent receives

Grouped like `search_code_sourcegraph`'s results. **Implemented without context lines**: a symbol match carries no content, and the raw endpoint measured 2.3–2.7s warm and 6.8s cold per file, so context for ten definitions would spend most of the budget on three lines each. Each entry names its kind and container instead, and `read_file` is one call away. As built:

```pi_agent
2 definitions of computeBackoff (example-sg). Complete.
Fetched 2; showing all 2. Full results: /tmp/pi-librarian/searches/tc_01HB/results.jsonl (2 lines, 914B)

example-bb — clone with source: example-bb
 1. PROJ/widget-sdk — src/retry.ts:30 (a1b2c3d) — function in retry
 2. CORE/deploy-cli — internal/backoff.go:13 (9f8e7d6) — function in backoff
```

The draft it replaced:

```pi_agent
2 definitions of computeBackoff (example-sg). Complete.
Full results: /tmp/pi-librarian/searches/tc_01HB/results.jsonl (2 lines, 3.9 KB)

example-bb — clone with source: example-bb
 1. PROJ/widget-sdk — src/retry.ts:31 (a1b2c3d)
    29:  /** Exponential backoff with full jitter. */
    30:  export function computeBackoff(
    31:    attempt: number,
 2. CORE/deploy-cli — internal/backoff.go:14 (9f8e7d6)
    13:  // computeBackoff returns the delay before the next attempt.
    14:  func computeBackoff(attempt int, base time.Duration) time.Duration {
```

Line numbers are 1-based here and 0-based in Sourcegraph's content matches; the tool normalises both to 1-based so a definition and a search hit in the same file agree.

### What the user sees

In [What the user sees](#what-the-user-sees), with every state.

## `read_file`

Generalises `read_github_file`, which is otherwise the only tool that cannot reach a declared source. It reads from **clone sources** — the code hosts — and not from Sourcegraph: every Sourcegraph result is grouped under the clone source it maps to, so the host can always serve the read, and one read path per host is enough. Same offset/limit semantics, which already work well.

`repo` plus `path` rather than `owner` plus `repo` plus `path`, because owner/repo is a GitHub shape and a declared source may have any number of path segments — the reasoning that shaped `checkout_repo` in ticket 05.

**What the hosts actually return**, from the spikes:

| case | GitHub contents API | GitLab files and tree APIs |
| --- | --- | --- |
| file over 1 MB | JSON gives `200` with **empty content**; the raw media type works | raw works; ignores `Range`, so a 19 MB file is downloaded whole, 2.1s |
| binary file | arrives with a text content type | non-`text/plain` content type |
| submodule | raw is ignored; JSON says `submodule` | raw is an empty `200`, **identical to an empty file** |
| symlink | a directory symlink returns its target path as content | raw returns the target path as text |
| directory | JSON listing; raw ignored | tree endpoint, uncapped `per_page`, keyset pagination |
| bad ref | its own `404` message | empty result or `404` |
| missing or private | **identical `404`** | `404`; a project with a restricted repository gives `403` |
| renamed repository | `301`, followed | lookup follows a `301`; resolve to a numeric id first |
| latency | p50 164 ms | 0.3–2.1s |

So the tool **learns what an entry is before reading it**: GitHub's JSON response carries `type`, and on GitLab the parent directory's tree entry carries the mode — one extra call, needed because GitLab's raw body cannot tell a submodule from an empty file or a symlink from a one-line text file. Then:

- a binary file is refused with its size, rather than dumped into context
- a submodule says so, and names its target
- a symlink says so, and names its target
- a file above about 5 MB is refused with "clone it instead", because neither host honours ranges and every offset page would download the whole file again
- "not found, or private to you" is the honest wording on GitHub, which cannot tell the two apart

### Inputs

```ts
const Params = Type.Object({
  repo: Type.String({ description: "Repository path, e.g. platform/widget-sdk." }),
  path: Type.String({ description: "File or directory path within the repository." }),
  source: StringEnum(sourceNames, { description: `Source for the code: ${sourceLabels}.` }),
  ref: Type.Optional(
    Type.String({
      description:
        "Branch, tag, or commit. To check a search result, pass its commit so line numbers agree. Default: the default branch.",
    }),
  ),
  offset: Type.Optional(Type.Number({ minimum: 1, description: "Line number to start reading from, 1-based." })),
  limit: Type.Optional(
    Type.Number({ minimum: 1, description: "Maximum number of lines to read. Default: 2000." }),
  ),
});
```

`source` is required and has no `github` default, for the same reason `search_repos_github` lost its: the agent names where the code lives. With only `github` configured the enum has one member and the argument disappears.

```ts
name: "read_file",
label: "Read file",
description:
  "Read one file, or list one directory, from a repository without cloning it. Long files come back in pages of up to 2,000 lines; files over about 5 MB and binary files are refused. For exploring several files, cloning is faster.",
```

No guidelines. Today's three move: "quick peeks" and "prefer checkout for several files" are tool-level facts now in the description, and "use offset/limit for larger files" is a fact about those arguments, said by the truncation footer exactly when it is true.

### Details

```ts
export interface ReadFileDetails {
  kind: "read_file";
  source: string;
  repo: string;
  path: string;
  entryType: "file" | "directory" | "symlink" | "submodule";
  shownLines: number;
  totalLines: number;
}
```

### What the agent receives

A file, with today's truncation footer:

```pi_agent
{
  "name": "widget-sdk",
  "version": "4.2.0",
  …
}

[Showing lines 1-2000 of 3401 (50.0 KB limit). Use offset=2001 to continue.]
```

A directory:

```pi_agent
src/client.ts
src/retry.ts
src/internal/
```

The refusals, each saying what the entry is:

```pi_agent
vendor/protocol is a submodule pointing at https://git.example.com/scm/CORE/protocol.git — read it from that repository.
```

### What the user sees

In [What the user sees](#what-the-user-sees), with every state.

### Notes

The deliberate exception that writes **no artifact**: it already truncates with a continuation hint, and its output is a file the agent named rather than a result set of unknown size.

**Not through Sourcegraph, but recorded in case:** the spike found Sourcegraph's raw endpoint a good reader — no size cap, real `404`s, directory listings — and GraphQL `blob { content }` a trap, with a hard 1.5 MiB cap that line ranges do not avoid and `null` in place of every not-found error. If a source is ever indexed but not declared, raw is the way.

## `checkout_repo`

Shape unchanged from ticket 05; output and wording changed by this review.

### Inputs

```ts
repo: Type.String({ description: "Repository path, e.g. platform/widget-sdk, or a full HTTPS or SSH clone URL." }),
source: Type.Optional(StringEnum(sourceNames, {
  description: `Source for the code: ${sourceLabels}. Omit when repo is a full clone URL.`,
})),
ref: Type.Optional(Type.String({
  description: "Branch, tag, or commit. To check a search result, pass its commit so line numbers agree. Default: the default branch.",
})),
```

`ref`'s new sentence carries a fact the code already guarantees. An explicit `ref` always fetches from the origin, whatever the 15-minute fetch debounce says, so a search hit's commit is checked out exactly; only a default-branch checkout can be up to 15 minutes old. That closes the map's open question about the debounce: it never affects a pinned read, so nothing needs fixing.

Repositories a Sourcegraph result maps to no declared source — a mirrored public repository, say — are reached with a full clone URL, which is why that form stays.

```ts
name: "checkout_repo",
label: "Checkout repo",
description:
  "Clone a repository into a local cache and check out a branch, tag, or commit, returning its path for grep, read, and git. Clones are reused across calls.",
promptGuidelines: ["Do not clone repositories with git directly; use checkout_repo."],
```

The guideline survives the rule set: it is a conduct rule, names only its own tool, and stays true whatever else is loaded. Today it never reaches a librarian run; under the composed prompt it will. The other current guideline — "deep dive, then grep/read/find/ls on the path and git log/blame/diff" — is the description's last clause now.

### Details

```ts
export interface CheckoutRepoDetails {
  kind: "checkout_repo";
  source: string;
  repo: string;
  path: string;
  ref: string;
  headSha: string;
  fileCount: number;
}
```

`reusedClone` is gone. Caching is an implementation detail, not a property of the answer — the repository is at that commit either way, and a reader who sees `cached` has no action available.

### What the agent receives

```pi_agent
Checked out platform/widget-sdk (example-gl) at main, commit a1b2c3d4e5f6.
Local path: /tmp/pi-librarian/repos/gitlab.example.com/platform/widget-sdk
1117 files.
```

### What the user sees

In [What the user sees](#what-the-user-sees), with every state.

## `provide_results`

Inputs and output unchanged. One gap, by the rule this document applied everywhere else.

### Inputs

`summary` (1–3 sentences, no preamble), `locations[]` of `{ repo, file, lines?, note }`, optional `description` in markdown.

**Proposal: `locations[]` gains a required `source`.** The main agent receives these findings and may want to act on one — read the file, clone the repository. A location of `platform/widget-sdk` with no source is the same unpassable identifier this document removed from every digest. Required rather than optional, because every location the librarian read came from exactly one source.

### What the agent receives

```pi_agent
Findings recorded. You are done; do not call more tools.
```

"Call it once, last, by itself" is a conduct rule for this tool and moves from the librarian prompt's _Finishing_ section into its `promptGuidelines`, where the composed prompt renders it. That is where it belongs by the rule set; in practice the text the librarian reads does not change.

### What the user sees

In [What the user sees](#what-the-user-sees), with every state.

## What this leaves open

### Decided in review

- **`provide_results` locations carry a required `source`.**
- **`read_file` reads from code hosts only**, not Sourcegraph.
- **Firecrawl's Developer Index sits beside `web_search`**, in the package ticket 12 creates.
- **Librarian runs load no prompt files but ours**: `noContextFiles: true` for `AGENTS.md`, and `appendSystemPromptOverride: () => []` for `APPEND_SYSTEM.md`, which leaks the same way.
- **The search budget defaults to 15 seconds and is a setting**, `librarian.search.timeoutSeconds`.
- **`search_repos_sourcegraph` loses `contains_content`**, because "which repositories contain this code" is `search_code_sourcegraph` with `detail: "repos"`. Repository search asks what a repository is; code search asks what it contains.
- **Sourcegraph's agentic search does not overlap**, settled by probing rather than a spike. Deep search's quota is `limit: 0` for an ordinary account, so it is off. The MCP server is enabled, and its eight tools — keyword, natural-language, commit, and diff search, file reads, file and repository listing, an evaluator — are the primitives ticket 02 already chose to call directly.

### Decided in the second review

- **Identifiers are printed as `checkout_repo` takes them.**
- **No `find_references`, with or without Sourcegraph.** Without Sourcegraph the nearest approximation is searching code for the name in whatever engine is configured, then cloning and grepping to confirm — and every piece of that is already a tool. A `find_references` spanning engines would be the router ticket 01 rejected; one per engine would rename `search_code_*`, and GitHub cannot even do the word boundary. So the feature survives as **strategy, not a tool**: the composed librarian prompt says how to find callers using whichever code search is present. `find_definition` stays Sourcegraph-only for the same reason; without it, definitions come from code search plus a clone.

### Decided in the third review

- **Built-in sources are all or nothing, with a switch each.** `github` defaults on and `gitlab.com` defaults off, symmetrically:

  ```jsonc
  { "librarian": { "builtInSources": { "github": true, "gitlab.com": false } } }
  ```

  Off means the source does not exist — no shorthand clones, no search tools — rather than the previous draft's clone-only half state. Nothing useful is lost by it: `checkout_repo` builds a full clone URL for any host, declared or not, so `https://gitlab.com/group/project` still clones with `gitlab.com` off. Built-in names stay reserved; the switch is the only way to change them. The assumption behind the defaults is that everyone wants GitHub and most people do not want gitlab.com search tools they never asked for — and gitlab.com code search needs a token regardless.
- **Extra tools are removed entirely.** `librarian.tools.extra` and `librarian.extensions` existed to give runs tools the librarian did not provide, and web tools were the reason; ticket 12 brings them in. After that, a run's tools are the inherited built-ins plus this package's own tools, configured by sources and nothing else. What goes: both settings, `extra-tools.ts` and its tests, the extension paths and `stripExtensionHooks` in `resource-loader.ts` (the nested loader keeps `noExtensions: true` and loads nothing), and the session-start validation warnings. The librarian prompt becomes a pure function of the active tools, built at startup, with no hook. `librarian.tools.disabled` stays, for trimming tools that are ours or built in. Lands with ticket 12, so web tools never disappear in between; CONTEXT.md's _Extra tools_ entry and design 04's mechanism are retired with it.
- **Searches return 10 results by default**, as `librarian.search.defaultLimit`, the same in both modes, and the agent may ask for up to 50 with `limit` — fewer where the engine's single request returns fewer; GitLab's digest says "unranked"; implementation logs how often a run reads `results.jsonl` or re-searches, to settle the number with evidence.

### Measured during implementation, on this machine

- The `kind` enum on `find_definition`, against the symbol kinds the instance reports.
- Whether a lowercase project key works in a Bitbucket `/scm/` clone URL, since Sourcegraph reports keys uppercase.

- Bitbucket pattern semantics — substring, phrase, regex — against the declared instance, the way GitHub's and GitLab's were measured here. Needs a Bitbucket credential on this machine.
- Whether aborted GitLab searches count against its 30-a-minute limit.
- Bitbucket's sort options and query modifiers, the `?` cells.

### Measured elsewhere

Everything that needs a personal machine or a personal account is in [`PERSONAL_TASKS.md`](PERSONAL_TASKS.md): grep.app's cells, gitlab.com's advanced-search availability, and every Firecrawl question.
