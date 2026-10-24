# Where tool guidance lives: a rule set for pi extensions

Research for the [tool surface](tool-surface.md). Every claim about pi is against pi 1.3.0's source, `packages/*/src` (abbreviated `ca/` for `coding-agent/src`, `ai/` for `ai/src`), plus one live smoke run against an installed `@earendil-works/pi-coding-agent@1.3.0`. Repo paths are relative to `pi-librarian/` unless stated.

## 1. Verification

### The customPrompt finding holds

Chain, each link cited:

1. `extensions/librarian/run.ts:168-172` builds the loader with `systemPromptOverride: () => buildLibrarianSystemPrompt(cacheDir)`.
2. `ca/core/resource-loader.ts:657-659`: `this.systemPrompt = this.systemPromptOverride ? this.systemPromptOverride(baseSystemPrompt) : baseSystemPrompt`. The closure runs **once, at `reload()`**, before any session exists.
3. `ca/core/agent-session.ts:1714,1724` (`_rebuildSystemPrompt`): `customPrompt: this._resourceLoader.getSystemPrompt()`.
4. `ca/core/system-prompt.ts:152-162`: `if (customPrompt) { preamble = customPrompt } else { preamble = default; tools = "- name: snippet" lines; rules = buildRules(...); docs = ... }`. The `tools`, `rules`, and `docs` sections exist **only in the else branch**.

So inside a librarian run, `promptSnippet` and `promptGuidelines` never reach the model.

**Smoke test** (inline `node --experimental-transform-types` script, nothing written; replicates `run.ts`'s loader with `search_repos` and `search_code`, then reads `session.systemPrompt` and `session.agent.state.tools`):

```text
section tags: [ 'project_context', 'cwd' ]
contains Use read to examine: false          ← built-in read's guideline
contains search_repos guideline: false
contains promptSnippet text: false
starts with librarian preamble: true
project_context paths: [ '/Users/…/.pi/agent/AGENTS.md' ]
declared: search_repos | label= Search repos metadata | desc= "Discover GitHub repositories."
search_repos sort schema: {"anyOf":[…],"description":"Result ordering. Default: stars."}
getAllTools guidelines: [["read",[…]],["bash",[…]],["search_repos",[…]],["search_code",[…]]]
```

Two things the draft did not say, both confirmed by that output:

- **It is not only the repo tools.** Built-in `read`/`bash` guidelines and every **extra tool's** guidelines are dropped too. `web_fetch` builds its guidelines from its configured fetchers (`pi-web-tools/extensions/web-tools/fetch.ts:116-119`), and the GitHub fetcher's line ("Use web_fetch directly on GitHub URLs for … issues, PRs …", `fetchers/github/index.ts:76-78`) is exactly what a librarian needs and never sees.
- **The guidelines are still available inside the run**, just unrendered: `session.getAllTools()` returns them (`ca/core/agent-session.ts:1499-1511`).

### `label` is rendered nowhere

`ToolDefinition.label` is documented as "Human-readable label for UI" (`ca/core/extensions/types.ts:583`) and `AgentTool.label` as "for UI display" (`agent/src/types.ts:467-468`). The only reads are copies in `ca/core/tools/tool-definition-wrapper.ts:14,49`. The default tool row renders `this.toolName` (`ca/modes/interactive/components/tool-execution.ts:143,397`); the HTML export uses `toolCall.name` (`ca/core/export-html/template.js:670-672`); `toToolDeclaration` drops `label` before anything is sent or persisted (`ai/utils/transcript.ts:123-130`). This repo's trace verbs come from `formatTraceLine`, not `label`. Built-ins set `label` equal to `name` (`ca/core/tools/read.ts:95`, `edit.ts:149`). Grep-based, so absence of a consumer in third-party renderers is not proven, but nothing in pi reads it.

### Can an extension read active tools' guidelines?

Yes, through three APIs:

| API | gives | where |
| --- | --- | --- |
| `pi.getAllTools()` / `AgentSession.getAllTools()` | `ToolInfo` with `promptGuidelines` (raw, unnormalized), for every **registered** tool | `ca/core/extensions/types.ts:1769,2122-2131`; `ca/core/agent-session.ts:1499-1511` |
| `ToolLoadout.getPromptGuidelines(name)` | normalized guidelines, inside a tool's `prepareLoadout` hook | `types.ts:551-563`; `agent-session.ts:1598` |
| `before_agent_start` → `event.systemPromptOptions` | the full mutable prompt input: `customPrompt`, `selectedTools`, `hiddenTools`, `toolSnippets`, `toolGuidelines`, `sections` | `types.ts:932-938`; `ca/core/system-prompt.ts:9-36`; applied at `agent-session.ts:1899-1938` |

pi itself uses this: `codemode` renders each listed tool's guidelines into its own description because "the system prompt only has [them] for declared tools" (`ca/extensions/codemode/tool.ts:142-155,315,338`). The docs say the same for orchestrators: "the orchestrating tool should present their guidelines itself" (`docs/extensions.md`, _Tool exposure_). That is the precedent for `buildLibrarianSystemPrompt` doing it.

### How each field travels

| field | normalisation | default prompt (attach / main session) | librarian run | provider |
| --- | --- | --- | --- | --- |
| `name` | none | listed in `tools` only if it has a snippet | declaration only | `name` of the tool definition |
| `description` | none in pi; may be **replaced** by another tool's `prepareLoadout` (`agent-session.ts:1600-1622`) | declaration | declaration | `description`, verbatim, no truncation (Anthropic `ai/api/anthropic-messages.ts:1653-1655`; OpenAI Responses `ai/api/openai-responses-shared.ts:411-414`; Chat Completions `ai/api/openai-completions.ts:1509-1514`) |
| parameter schema + descriptions | none | declaration | declaration | Anthropic (non-strict): **only root `properties` and `required` are kept** (`anthropic-messages.ts:1639-1651`), so a root-level `Type.Object({...}, { description })` is dropped; nested property descriptions survive. OpenAI: schema passed whole. Strict mode only when `constrainedSampling` is set (`ai/api/constrained-sampling.ts:142-145,225-249`), which wraps optional props as `anyOf[prop, null]` but keeps their descriptions (`:116-121`). |
| `promptSnippet` | collapsed to one line (`agent-session.ts:1681-1688`) | `- name: snippet` in `<tools>`, followed by "In addition to the tools above, you may have access to other custom tools" (`system-prompt.ts:157-160`) | **dropped** | n/a (system text) |
| `promptGuidelines` | trimmed, exact-duplicate removal per tool (`agent-session.ts:1690-1703`), then across all tools (`system-prompt.ts:95-100`) | one **flat** `<rules>` list: pi's bash fallback rule, then each active tool's bullets in `selectedTools` order, then extension `promptGuidelines`, then "Be concise…" (`system-prompt.ts:108-125`). Bullets carry **no** tool heading. | **dropped** | n/a |
| `label` | none | nowhere | nowhere | stripped |

Further mechanics that affect "when the model reads it":

- **Section order** of the default prompt: preamble, `tools`, `rules`, `docs`, `addendum`, `project_context`, `skills`, `cwd`, then extension `sections` (`system-prompt.ts:152-190`). Every non-preamble section is wrapped in `<name>…</name>` (`:188-191`).
- **Tool declarations precede the system prompt** on Anthropic: the API builds "Here are the functions available in JSONSchema format: {{ TOOL DEFINITIONS }} {{ USER SYSTEM PROMPT }}" ([Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools), _Tool use system prompt_). OpenAI: "functions are injected into the system message in a syntax the model has been trained on" ([Function calling](https://developers.openai.com/api/docs/guides/function-calling), _Token Usage_). Either way, the model has read every declaration, parameters included, before it reads our prose.
- **Attach mode arrives mid-conversation.** `/librarian` calls `setActiveTools` (`extensions/librarian/attach.ts:33-43`); pi then appends a system message with the changed `tools`/`rules` sections and `toolsAdded` declarations before the next request (`docs/extensions.md`, _Activate tools dynamically_; `agent-session.ts:1743-1758`; Anthropic native `tool_addition` blocks at `anthropic-messages.ts:1378-1396`). Providers without mid-conversation system messages get a full checkpoint, invalidating the cache.
- **codemode can rewrite or absorb declarations in attach mode.** With codemode `on`, each callable tool's description gets a `Codemode: tools.x(args) resolves to …` suffix (`codemode/tool.ts:304-306`). With `only`, direct tools' declarations are hidden, the default prompt leaves them out of `tools` and `rules` (`system-prompt.ts:150`), and codemode's description lists them as description + guideline bullets (`codemode/tool.ts:142-155`). So a guideline can end up rendered **directly under its own tool's description**, or in a flat list with nobody else's context. It has to read correctly in both.
- **No length limits in pi.** No truncation of description, parameter description, snippet, or guideline anywhere in `ai/` or `ca/`. Vendor limits found: Anthropic tool `name` must match `^[a-zA-Z0-9_-]{1,128}$` (Define tools, parameter table). OpenAI's guide states no description limit; it advises "fewer than 20 functions available at the start of a turn" and notes definitions are billed as input tokens.

### Side finding, out of scope but worth a look

A librarian run's prompt also contains `project_context` with the user's **global** `~/.pi/agent/AGENTS.md` (smoke output above), because `createLibrarianResourceLoader` passes `agentDir: getAgentDir()` and not `noContextFiles` (`extensions/librarian/resource-loader.ts:25-38`; loader at `ca/core/resource-loader.ts:232-246,646-653`). A global `APPEND_SYSTEM.md` would land in `addendum` the same way (`resource-loader.ts:663-673,1227-1238`). So the librarian inherits the main persona and personal working rules. Possibly intended; worth deciding explicitly.

## 2. Theory of mind: what each field is for

The model never sees "fields". It sees **two documents**: the tool declarations (name, description, schema) and the system prompt text. Everything else is about which document a sentence lands in, and when.

- **The declaration travels with the tool.** Same text in every mode, every provider, inside codemode listings, and in any future host. It is read at selection time, next to the tool's own parameters. Its weakness: it cannot know which _other_ tools exist.
- **The system prompt knows the whole loadout**, but only the default prompt renders snippets and guidelines, and we own the prompt only in librarian runs.

`description` versus `promptSnippet`, the confusion that started this: they are not two places for the same content at different lengths. **The description is the tool's documentation; the snippet is the tool's entry in a table of contents.** pi's built-ins show the relationship: `read`'s description is a paragraph of behavior and truncation limits (`ca/core/tools/read.ts:96`), its snippet is "Read file contents" (`:20-23`). The snippet adds no information. What it adds is _presence_ in the system prompt's tool list, which is opt-in for custom tools ("Custom tools are omitted from that section when this is not provided", `types.ts:587`).

`promptGuidelines` are not documentation either. They are **rules of conduct the host adds to its own rule list while the tool is active**. pi's built-ins use them for one thing: steering away from a worse habit. "Use read to examine files instead of cat or sed", "Use write only for new files or complete rewrites", `edit`'s four rules about `oldText` (`read.ts:20-23`, `write.ts:16-19`, `edit.ts:43-51`). Each names its own tool, because the list is flat.

### Vendor guidance, and where it disagrees

- Anthropic: descriptions are "by far the most important factor in tool performance"; explain what it does, "when it should be used (and when it shouldn't)", what each parameter means, caveats and limitations, "at least 3–4 sentences" ([Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools), _Best practices_). Name prefixes by service for unambiguous selection (same page; and [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents), _Namespacing your tools_, which adds that prefix-versus-suffix "effects vary by LLM"). Errors should carry "specific and actionable improvements" (same post, _Returning meaningful context_).
- OpenAI: "Explicitly describe the purpose of the function and each parameter (and its format)", but "**Use the system prompt to describe when (and when not) to use each function**"; "Use enums and object structure to prevent invalid states"; "Pass the intern test" ([Function calling](https://developers.openai.com/api/docs/guides/function-calling), _Best practices for defining functions_). The GPT-4.1 guide: use the `tools` field rather than injecting schemas into the prompt (measured +2% SWE-bench), keep descriptions "thorough but relatively concise", and put usage examples in an `# Examples` section of the system prompt rather than in the description ([`openai-cookbook/examples/gpt4-1_prompting_guide.ipynb`](https://github.com/openai/openai-cookbook/blob/main/examples/gpt4-1_prompting_guide.ipynb), _Tool Calls_).

The disagreement is real: Anthropic puts "when not to use" in the description, OpenAI in the system prompt. It resolves cleanly once "when not" is split in two. **When-not that depends only on the tool** ("public code only", "no regex") is a capability fact, true wherever the tool goes: description. **When-not that depends on a neighbour** ("use Y instead") is only true when Y is loaded: system prompt, assembled from the loadout. pi's own core does precisely this for its one cross-tool rule: "Use bash for file operations like ls, rg, find" is emitted by the prompt builder only when `grep`, `find`, and `ls` are all absent (`system-prompt.ts:108-116`). No tool owns it.

All sources above were reachable. Nothing was inferred from an unreachable page.

## 3. The rule set

**Rule 0 — one owner per fact.** A fact lives on the narrowest element it is true of. Every other mention is a reference, not a restatement. Exactly-identical guideline strings on several tools are the one sanctioned exception: pi deduplicates them (`system-prompt.ts:95-100`), so a shared constant has one owner and several carriers.

### `name`

- Is: the call identifier and the strongest selection signal; it appears in every declaration and every tool call.
- Belongs: family first, engine last (`search_code_github`), snake_case, within `^[a-zA-Z0-9_-]{1,128}$`.
- Does not belong: anything that changes with configuration. A name is referenced from errors, other descriptions, and prompts; renaming is a breaking change for every one of them.
- Both modes identical.

### `label`

- Is: a required string nothing renders.
- Rule: short sentence-case phrase, never relied on, never reviewed for model impact. If pi starts rendering it, revisit. Human-facing wording that matters lives in `renderCall`/`renderResult` and `formatTraceLine`.

### `description`

- Is: the only tool-level text that reaches the model in **both** modes, every provider, and codemode listings.
- Belongs — facts true of the tool as a whole, independent of other tools:
  - the corpus and reach ("code on GitHub, including private repositories your token can read"; "public code only"),
  - what a result is and what it is not (shape, ordering, whether it is ranked or complete),
  - whole-call limits and costs (rate limits, result ceilings, time budget),
  - when it is the wrong tool, **stated as a capability**, not as a neighbour's name.
- Does not belong: anything true of a single argument (goes on that argument); names of other optional tools; conduct rules ("call once"); restatements of the schema.
- Length: as many sentences as there are tool-level facts. Anthropic's "3–4 sentences" is a floor for tools with no parameter descriptions; with rich parameter descriptions, 2–3 is typical. The draft's "one sentence" convention (`tool-surface.md`, _Conventions this follows_) is stricter than either vendor and should be relaxed to "no argument-level facts" instead.
- Both modes identical, except codemode may append a suffix in attach mode. Never assume the description is the last thing in its block.

### Parameter schema and per-parameter descriptions

- Is: part of the declaration, read at the moment the model fills the argument.
- First, **schema over prose**: anything the schema can express goes in the schema: `Type.Optional` versus required, enums (`StringEnum`), `minimum`/`maximum`, `maxItems`. "A description the model reads cannot make an argument optional" (`tool-surface.md`, `search_code_gitlab`). OpenAI: "Use enums and object structure to prevent invalid states".
- Then the description: meaning, format with an example, default as `Default: X.`, matching semantics, the cost of using it, and when to pick a value ("Use stars to find what is popular").
- Cross-argument constraints the schema cannot express ("Requires owner") go on the **dependent** argument and are **also enforced at the edge** with an actionable error. The prose prevents the bad call; the check catches it anyway.
- A cost warning goes on the argument that incurs it, only on the engine where it is true. Do not advertise what is cheap.
- Never put the description on the root `Type.Object`: Anthropic's non-strict adapter drops it.
- Both modes identical.

### `promptSnippet`

- Is: a table-of-contents line in the default prompt's `<tools>` list, attach mode / main session only.
- Belongs: a compression of the description's first clause, under ~8 words, adding no fact the description lacks.
- Rule: include it only for a tool you want the main agent to _think of_ unprompted. That is the `librarian` tool itself (`extensions/librarian.ts:95-96`), the entry point. For the repo tools in attach mode, omit it: the user attached them deliberately, their declarations arrive in the same system patch, and ten near-copies of their descriptions in `<tools>` would be the duplication Rule 0 forbids. If attached tools turn out to be under-used, a snippet is the first lever to try, and that is an evaluation question, not a placement one.
- Librarian runs: irrelevant (dropped) unless the composer renders it, and it should not.

### `promptGuidelines`

- Is: bullets in a flat, deduplicated `<rules>` list in attach mode; inside a run, nothing until composed; under codemode `only`, bullets under the tool's own description.
- Belongs: a conduct rule about **using this tool**, true and harmless whatever else is loaded:
  - sequencing and termination ("provide_results ends the turn; call it once…"),
  - steering off a worse habit that is always available ("Do not clone repos directly with `git`; always use checkout_repo").
- Form: one imperative sentence that **names its own tool** (the list carries no headings; pi's built-ins all do this) and stands alone without the description beside it.
- Does not belong: capabilities and caveats (description); argument advice (parameter description); comparisons with another optional tool (see below).
- Naming another tool: allowed only if the sentence stays true when that tool is absent. "Instead of cat or sed" passes, because it only discourages. "Use search_github_code when private access is required" fails when that tool is disabled or never registered, and both conditions are routine here: `librarian.tools.disabled`, and per-source registration in `tool-surface.md` (_Zero, one, or many_).

### Cross-tool contrast ("prefer X over Y")

- First ask whether it is **derivable** from the two descriptions. If X says "including private repositories" and Y says "public code only", the preference is already in context; drop the rule.
- If it is a genuine policy (a ranking the descriptions cannot imply, such as "prefer the engine that reports completeness"), it belongs to **whoever knows the loadout**, emitted only when every named tool is active, the way pi's core emits its bash rule. In a run, that is `buildLibrarianSystemPrompt`. In attach mode, we own no prompt; either the two tools are always registered together, so a static guideline is safe, or the rule is accepted as missing.

### The system prompt

- Librarian runs (`prompt.ts`): role, the job's workflow, evidence and citation policy ("search hits are candidates, not evidence"), workspace rules, finishing protocol, and the composed per-tool guidelines. It may name a tool only if the run cannot work without it (`provide_results`). Every conditional tool name comes from the composer.
- Attach mode: pi's default; not ours. Guidance about the user's job (citations) does not reach it, which is correct: the main agent is not writing findings. Guidance about _using our tools_ goes in guidelines.
- OpenAI's GPT-4.1 advice places tool usage **examples** in the system prompt. If examples are ever needed for runs, they go in `prompt.ts` and are composed like guidelines; for attach mode, a short example inside a parameter description (`e.g. "defineConfig("`) is the only portable form.

### Not a definition field at all

- **Recovery guidance belongs in errors**, delivered exactly when it is true: "If the repo name is uncertain, resolve it with search_repos first" (`tool-surface.md`, _Conventions_), "rate limit resets in 42s". An error may name another tool, because at error time the tool knows what it is talking about. Make it conditional on that tool's presence if it can be absent.
- **Truncation guidance belongs in the result** ("Full results: …/results.jsonl"), as `docs/extensions.md` _Tools_ asks ("tell the model where to read the complete output").

## 4. Decision procedure

Given a piece of guidance, ask in order and stop at the first yes.

1. **Is it for a human looking at the UI?** → `renderCall` / `renderResult` / trace summary. Not `label`, which nothing renders.
2. **Can the schema enforce it?** (required, enum, range, array length) → schema. Then go on to step 3 only if the model still needs to know _why_.
3. **Is it true of exactly one argument** (meaning, format, default, cost, dependency on another argument, when to choose a value)? → that argument's description; if it is a cross-argument dependency, also validate at the edge.
4. **Is it only true after something happened** (an error, a truncation, a limit hit)? → the error message or result content.
5. **Is it a fact about the tool as a whole** (corpus, reach, auth, result shape, ordering, completeness, limits, cost) or a "wrong tool when…" stated as a capability? → `description`.
6. **Is it a rule of conduct for this tool** that stays true no matter what else is loaded? → `promptGuidelines`, one sentence, naming the tool. In a run it only arrives if the composer renders it.
7. **Does it compare two optional tools?** → if derivable from their descriptions, delete it. Otherwise → the prompt builder that knows the loadout (`buildLibrarianSystemPrompt`), emitted only when all named tools are active.
8. **Is it about the job rather than any tool** (evidence, citations, finishing, workspace)? → the librarian system prompt. Not reachable in attach mode, by design.
9. **Is it a one-line advertisement that the tool exists?** → `promptSnippet`, only for entry-point tools in the main session.

If a sentence seems to fit two steps, it is two facts. Split it.

## 5. Anti-patterns

Each is from this repo or pi unless marked hypothetical.

1. **Guidance that never arrives.** Every `promptGuidelines` entry on today's repo tools (`tools/*.ts`), every extra tool's guidelines inside a run, `checkout_repo`'s "Do not clone repos directly with `git`" among them. Verified by the smoke run.
2. **A second owner that drifts.** `search_github_code`'s guideline says it "is literal/tokenized and does not support regex" (`tools/search-github-code.ts:93-95`), while its `pattern` description says only "GitHub REST code search pattern." The measurement in `tool-surface.md` showed the tokenized claim is wrong: substrings match. The wrong fact lived in the one field that never reached the librarian, and the field that did reach it said nothing. A pattern fact belongs on `pattern`.
3. **Hardcoded tool names in the system prompt.** `prompt.ts` _Search Strategy_ names `search_repos`, `search_code`, `search_github_code`, `read_github_file`, `checkout_repo`, and repeats the candidates-not-evidence rule that `search_code`'s guideline also states. Every planned rename breaks it, and any `librarian.tools.disabled` entry makes it point at a tool that is not there.
4. **A guideline naming a tool that may be absent.** `search_code`: "use search_github_code when private repository access is required" (`tools/search-code.ts:64-67`). Disable `search_github_code` and the rule sends the agent to a phantom.
5. **A snippet that adds facts.** `search_github_code`'s snippet "Search GitHub code (incl. private repos)" restates the description's reach; the "private" fact now has two owners. A snippet should compress, never inform.
6. **Argument advice parked in guidelines.** `read_github_file`: "Use read_github_file's offset/limit for larger files" (`tools/read-github-file.ts:51-55`). That is a fact about `offset`/`limit` and belongs on them, where it also reaches runs.
7. **Prose standing in for schema.** Today's `search_github_code` takes `repos[]` and `owners[]` side by side and emits `repo:` and `user:` together, which GitHub rejects with `422 unable to parse query!` (`tool-surface.md`, _search_code_github_). No description fixes a schema that can represent the contradiction.
8. **Advertising what is cheap.** "Path and language filters are fast" on Sourcegraph (hypothetical). Noise the model reads on every call; the warning belongs only on the expensive argument.
9. **Root-level schema description.** `Type.Object({...}, { description: "Search options" })` (hypothetical): Anthropic's non-strict adapter discards it.
10. **Deliberate triple repetition, copied by accident.** pi's `edit` states the `oldText` uniqueness rule in its description, its parameter descriptions, and its guidelines (`ca/core/tools/edit.ts:22-40,43-51,151`). That is pi's choice for its most error-prone tool, presumably backed by evaluation. It is not the default. Repeat a fact across fields only with evidence that one placement was not enough.
11. **Relying on `label`.** Writing user-facing wording there and expecting to see it.

## 6. Worked examples

### `search_code_github`

Draft (`tool-surface.md`, _search_code_github_):

```ts
name: "search_code_github",
label: "Search GitHub code",
description: "Search code on GitHub, including private repositories your token can read. Limited to 10 searches a minute.",
promptGuidelines: [
  "Prefer search_code_github over search_code_grepapp when the code may be private.",
],
```

After the rules:

```ts
const Params = Type.Object({
  pattern: Type.String({
    description:
      'Code to find. Matches substrings; quote a phrase to keep it together, e.g. "defineConfig(". Regex is not supported: a pattern wrapped in /…/ is rejected.',
  }),
  owner: Type.Optional(
    Type.String({ description: "Restrict to repositories owned by this user or organization." }),
  ),
  repos: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Restrict to these repositories under owner, by bare name, e.g. drizzle-orm. Requires owner.",
      maxItems: 20,
    }),
  ),
  path: Type.Optional(Type.String({ description: "Restrict to file paths matching this pattern." })),
  language: Type.Optional(Type.String({ description: "Restrict to a language, e.g. typescript." })),
});

defineTool({
  name: "search_code_github",
  label: "Search GitHub code",
  description:
    "Search code on GitHub, including private repositories your token can read. Returns matching files with short excerpts. Limited to 10 searches a minute.",
  parameters: Params,
  // no promptSnippet, no promptGuidelines
});
```

What moved, and why:

| fact | from | to | rule |
| --- | --- | --- | --- |
| reach: GitHub, private with token | description | description (kept) | tool-level corpus fact, step 5 |
| 10 searches a minute | description | description (kept) | whole-call limit, step 5. The reset time goes in the rate-limit **error** (step 4). |
| substring, quoted phrase, no regex | draft prose says "the description states the regex failure", draft code has it on `pattern` | `pattern` only, plus edge rejection mentioned so the model knows it is enforced | one argument, step 3; one owner |
| result shape (excerpts, not whole files) | absent | description | Anthropic: say what it returns; it is also what makes "read before citing" sensible |
| `repos` requires `owner` | `repos` description | kept, **plus** edge validation | cross-argument, step 3 |
| "Prefer … over search_code_grepapp when private" | guideline | **deleted** | derivable: this description says "including private", grepapp's says "public code only" (step 7). As a guideline it would also name a tool that may be absent. |
| snippet | absent | absent | step 9: not an entry point |

### `search_repos_sourcegraph`

The draft gives parameters only. Full definition after the rules:

```ts
// `source` appears only when several Sourcegraph instances are declared (tool-surface.md, "Zero, one, or many").
const Params = Type.Object({
  source: StringEnum(sourceNames, {
    description: `Sourcegraph instance to search: ${sourceLabels}.`,
  }),
  name: Type.Optional(Type.String({ description: "Regex matched against repository names." })),
  topic: Type.Optional(Type.String({ description: "Restrict to a topic." })),
  contains_path: Type.Optional(
    Type.String({ description: "Only repos with a file whose path matches this regex, e.g. ^go\\.mod$." }),
  ),
  contains_content: Type.Optional(
    Type.String({
      description:
        "Only repos where some file's text matches this regex, e.g. go\\.opentelemetry\\.io/otel. Searches file contents, not file names.",
    }),
  ),
  changed_after: Type.Optional(
    Type.String({
      description:
        "Only repos with a commit after this date, e.g. 2026-01-01. Walks git history rather than reading an index — expect tens of seconds instance-wide, so narrow with a name pattern first.",
    }),
  ),
  include_forks: Type.Optional(Type.Boolean({ description: "Include forks. Default: false." })),
  include_archived: Type.Optional(Type.Boolean({ description: "Include archived repos. Default: false." })),
});

defineTool({
  name: "search_repos_sourcegraph",
  label: "Search Sourcegraph repos",
  description:
    "Find repositories on a Sourcegraph instance by name, topic, or the files they contain, including private repositories the instance indexes. Returns every match, unranked: there is no popularity ordering and no limit.",
  parameters: Params,
  // no promptSnippet, no promptGuidelines
});
```

What moved, and why:

| fact | placement | rule |
| --- | --- | --- |
| which instances exist and what each name means | `source` enum (machine) + `sourceLabels` in its description (meaning) | schema first, then the meaning the enum cannot carry; step 2–3 |
| `contains_content` is file text, not names | `contains_content` | one argument |
| `changed_after` walks history, tens of seconds, narrow by `name` first | `changed_after` only, as approved | cost on the argument that incurs it, only on the engine where it is true; naming a sibling **argument** is fine, it is always present |
| no sort, no limit, unranked | description | a result-shape fact the model would otherwise get wrong (it expects top-N by stars from `search_repos_github`); step 5 |
| reaches private repos | description | corpus fact; lets the model derive "prefer this over `search_repos_github` for internal code" without a guideline |
| `contains_path` + `contains_content` compile to one predicate | nowhere model-facing | implementation detail; the model's call is the same either way |
| "path and topic are cheap" | nowhere | approved: do not advertise cheap filters |

The same procedure applied to the draft's `search_code_sourcegraph` guidelines, as a check: "Start with detail:repos or detail:files…; detail:matches on a broad pattern can return megabytes" is about one argument, so it moves to `detail`'s description. "Prefer search_code_sourcegraph over the code-host searches when it is available; it is the only one that reports completeness" is a non-derivable ranking across optional tools, so it moves to the composer (step 7). That tool ends with no guidelines either.

## 7. Recommendation: compose the strategy from active tools

**Yes.** Do it as the prefactor before the renames. Three reasons, all from evidence above: today's guidelines never arrive; extra tools' guidelines (the `web_fetch` GitHub hint) never arrive; and `prompt.ts` is a second owner of facts that are about to change name.

What the composer renders:

1. The active tools' `promptGuidelines`, in `selectedTools` order, minus `hiddenTools`, exact-text deduplicated: the same semantics as pi's `buildRules` (`system-prompt.ts:95-121`), so a guideline reads the same in a run and attached.
2. Conditional cross-tool rules owned by `prompt.ts` itself, each guarded by the presence of every tool it names, in the style of pi's bash rule (`system-prompt.ts:108-116`). Short list; most contrasts should have been deleted under step 7.
3. The static preamble: role, workflow in terms of _intent_ ("clone for a deep dive, read one file for a peek") rather than tool names, evidence and citation policy, workspace, finishing.

How, given the APIs. Two workable designs:

**A. A pure function fed by `run.ts`.** `buildLibrarianSystemPrompt(cacheDir, guidelines: ToolGuidelines[])`, where `run.ts` collects them from the `repoTools` definitions it already holds and from the parent's `pi.getAllTools()` for extras (already called at `extensions/librarian.ts:120`), filtered by the same list it passes to `setActiveToolsByName` (`run.ts:210-217`). Plain dependency injection, trivially unit-tested in `prompt.test.ts`. Its gap: tools that exist only in the nested session, loaded through `librarian.extensions` (the escape hatch in `extra-tools.ts:88-110`), are not in the parent's registry, so their guidelines would be silently missing. The prompt would also be computed before pi has applied its allowlist and loadout.

**B. A `before_agent_start` handler in an inline extension of the nested session (recommended).** Register an `extensionFactories` entry in `createLibrarianResourceLoader` whose handler reads `event.systemPromptOptions.selectedTools`, `.hiddenTools`, and `.toolGuidelines` (already normalized by pi) and sets `event.systemPromptOptions.customPrompt = buildLibrarianSystemPrompt(cacheDir, guidelines)`. That is the documented route: "Prefer changing prompt sections, selected tools, or guidelines so Pi can append a transcript delta" (`docs/extensions.md`, _Events and concurrency_), and pi applies the mutated options through its normal diffing (`agent-session.ts:1899-1938`). It sees the authoritative loadout, so extras from every path, the disabled list, and hidden declarations are handled by pi rather than re-derived. It is idempotent across the reminder prompts and `continue_from`, since every run starts from the base options. `buildLibrarianSystemPrompt` stays a pure function of `(cacheDir, guidelines)`, so it tests exactly as in A.

B costs one change elsewhere: `stripExtensionHooks` (`resource-loader.ts:7-15`) currently clears handlers from **every** extension, which would clear this one too. It needs to spare the librarian's own inline extension, identified by a named factory, not by guessing at `<inline:N>` paths (`ca/core/resource-loader.ts:1142-1145`).

Choose A if the escape-hatch extras' guidelines are judged not to matter; choose B otherwise. I would choose B: it is the one where "what the librarian is told" and "what the librarian has" cannot disagree, which is the whole point of the exercise.

Do not render snippets in the composer. Inside a run the declarations are already present, and a tool index would be the duplicate Rule 0 forbids.

One judgment call either way: composing every active tool's guidelines brings in `bash`'s "You can inspect PI_* environment variables…" (smoke output). It is harmless, and filtering it would mean a hand-kept exclusion list, which is a second owner again. I would accept it.

## Corrections to the draft's _What reaches the model_

- The table is right for the repo tools, but understates the blast radius: built-in and extra tools lose their guidelines in runs too.
- "`label` — nowhere I could find": confirmed, with the citations above.
- "Keep `promptGuidelines` for cross-tool contrast only": inverted. Cross-tool contrast is the one thing a static `promptGuidelines` array handles **badly**, because it cannot know whether the other tool is loaded. Guidelines are for single-tool conduct rules. Contrasts are deleted when derivable and owned by the loadout-aware prompt builder when not.
- "`description` is one sentence": stricter than both vendors. Prefer "tool-level facts only", typically 2–3 sentences.
- The `search_code_github` example's guideline should go, per section 6.
