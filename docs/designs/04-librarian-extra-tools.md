# Librarian extra tools: name-based opt-in

## Status

Draft

## Decision Summary

Replace extension-path allowlisting as the user-facing control for librarian run composition with `librarian.tools`: a list of tool names, auto-resolved to their providing extensions through the main session's tool registry. Extension loading becomes an internal mechanism (plus a rarely-needed escape hatch), the named tools become the sole activation gate, and loaded bundles contribute tools only — their hooks are stripped. The tradeoff: extension code still loads to make a tool callable (pi has no cross-session tool proxying), so a bundle's other machinery is neutralized rather than never present.

## Problem Statement / Background

Design 01 (decision 3) made `librarian.extensions` — a list of extension paths — the way to grant librarian runs extra tools, with everything a loaded bundle registers activated wholesale. That model misplaces the abstraction: extensions are what users configure, but tools are what the run actually needs. The concrete case is BYO web search: the user has preferred web search/fetch tools provided by a pi extension and wants "use this web search tool in librarian" to be expressible as the tool, not as the path of the bundle it ships in, and without accepting whatever else that bundle registers.

Design 01 rejected name-based composition because `pi.getAllTools()` was believed metadata-only. It still is — `ToolInfo` carries no execute handle — but each `ToolInfo.sourceInfo.path` names the extension path pi loaded the tool from, which is exactly the form `additionalExtensionPaths` accepts. Name → path resolution is therefore a straight lookup against the main session, and the missing piece of design 01's rejected alternative exists.

## Goals

- "Make this tool available in librarian runs" is configured as the tool's name; extension paths are not the primary mental model.
- Librarian runs stay locked down by default: the baseline toolset (inherited built-ins + repo tools) is fixed and always on; extra tools are additive and explicit.
- A loaded bundle's unrequested surface (other tools, hooks, commands) does not leak into runs.
- Misconfiguration is loud at session start, not silently degrading every run.

## Non-Goals

- No skill opt-in. Skills stay hard-off in librarian runs until a concrete use case appears.
- No cross-session tool proxying; this design works within pi's load-code-to-get-tools constraint.
- No subtraction knob for the baseline: `librarian.disabledTools` is deleted, not replaced.
- No change to attach mode; the main session already has the user's tools.

## Exposed Shape

```jsonc
// pi global settings
{
  "librarian": {
    "tools": ["search_web", "fetch_web"],   // extra tools, by name
    "extensions": ["~/path/to/ext.ts"]      // escape hatch: extra search space only
  }
}
```

- **`librarian.tools`** — names of tools to activate inside librarian runs, in addition to the implied baseline (`read`, `grep`, `find`, `ls`, `bash`, plus the repo tools). This is the only thing that activates an extension tool, and may also explicitly opt in built-ins such as `write` or `edit`.
- **`librarian.extensions`** — demoted to an escape hatch: extension paths to load into runs when a named tool's extension is not loaded in the main session. Listing an extension here activates nothing by itself.
- **`librarian.disabledTools`** — removed.
- Unresolvable names produce a one-time warning at session start; runs proceed with whatever resolves.

## Design Decisions

### 1. `librarian.tools` is the sole activation gate

An extension tool is active in a librarian run iff its name appears in `librarian.tools`, regardless of how its code arrived (auto-resolution or the escape hatch). One rule, no bundle ever activates wholesale. This breaks the current `librarian.extensions` behavior deliberately: users who load a bundle must now also name the tools they want from it. The old model's "load path, get everything" was the mismatch this design exists to remove.

### 2. Name resolution rides the main session's registry

At `librarian` tool execution, the extension resolves each configured name via `pi.getAllTools()`: the matching `ToolInfo.sourceInfo.path` is the providing extension's path, collected (deduped) into `additionalExtensionPaths` for the nested run's resource loader. After session creation, `setActiveToolsByName` activates the baseline plus exactly the resolved names. Consequence: auto-resolution only sees tools loaded in the main session — which is the stated contract ("opt existing tools from your pi setup into librarian"), with the escape hatch covering the rest.

Names that resolve to pi-librarian's own registrations (the `librarian` tool, repo tools) are skipped with a warning to guard against recursive self-loading. Names that resolve to built-ins are allowed; no extension path is needed for them.

### 3. Loaded bundles contribute tools only — hooks stripped

The nested loader's `extensionsOverride` clears each loaded extension's `handlers` map before the runner sees it, so no bundle event handlers execute inside librarian runs. This is the lockdown design 01 wanted when it rejected full inheritance (UI companions, session machinery misbehaving in headless runs), now enforced structurally instead of by curating the allowlist.

**Tradeoff:** an extension whose tool depends on hook-based initialization (e.g. `session_start` state setup) breaks silently. Accepted for now; typical BYO tools are execute-only. An opt-out setting is added only when a real tool needs its hooks — not preemptively.

### 4. Validation warns once at session start; runs proceed

On `session_start` (after all main-session extensions are registered), configured names are checked: resolvable in the main session, or accounted for by a dry-load of the escape-hatch paths — the dry-load only happens when the escape hatch is configured and names remain unresolved. Misses produce a `ctx.ui.notify` warning naming the entry. Runs themselves do not fail on unresolved names; they proceed with what resolved. A failing run was rejected because a config typo shouldn't take down research entirely, but a silent miss was rejected too — hence loud-at-startup.

### 5. Name collisions follow pi's rule

If two extensions register the same tool name, pi's runner is first-registration-wins. Resolution inherits the main session's winner; the nested run inherits its own load order. No bespoke arbitration.

## Edge Cases & Failure Modes

- **Configured name matches nothing** (typo, extension removed): session-start warning naming the entry; runs proceed without it.
- **Name resolves to a synthetic path** (`<inline:N>` from in-process `extensionFactories`): deliberately not special-cased — the path flows through like any other, the nested loader fails to load it, and the failure surfaces as a generic loader error. In-process factories are rare enough that this is accepted as undefined behavior.
- **Name is a built-in** (`read`, `write`): activated by name without adding an extension path. Baseline built-ins are already active, but naming them is harmless.
- **Name is `librarian` or a repo tool**: skipped with warning; never loads pi-librarian into its own runs.
- **One extension provides several requested tools**: its path loads once; all requested names activate.
- **Escape-hatch extension fails to load in the nested run**: surfaced from the loader's error list into the run trace; remaining tools unaffected.
- **Tool exists but is deactivated in the main session**: still resolvable — `getAllTools()` returns configured tools regardless of active state, and naming it in `librarian.tools` expresses intent.
- **Hook-dependent tool breaks under stripping**: known accepted risk (decision 3); the fix is a future opt-out, not silent hook execution.

## Alternatives

### Keep extension paths as the loading surface, add a tool filter

- **Status:** Rejected
- **Decision:** Leaves the user managing paths — the exact problem stated. Auto-resolution makes the path bookkeeping mechanical, so the user-facing surface should be the intent (tool names).

### Escape-hatch extensions retain activate-all behavior

- **Status:** Rejected
- **Decision:** Two activation semantics for one run. A single gate (`librarian.tools`) is easier to reason about, and backwards compatibility was explicitly waived.

### Skill opt-in (`librarian.skills`)

- **Status:** Deferred
- **Open issue:** Mechanically straightforward (`skillsOverride` + name filtering against global skill discovery) but no concrete use case yet.
- **Next step:** Revisit when a specific skill would improve librarian research (e.g. a web-research skill).

### MCP tools via pi-mcp-adapter

- **Status:** Open
- **Open issue:** Not supported by this design, for two independent reasons. The adapter's tool executors depend on state initialized in its `session_start` handler, which hook stripping removes — and even with hooks kept, nested librarian sessions never emit `session_start` at all: `bindExtensions()` (which fires it) is called only by pi's modes (interactive/print/rpc), never by bare `createAgentSession`. MCP tools opted in by name would load, register, and then return "MCP not initialized" on every call.
- **Retained discussion:** This is the concrete instance of decision 3's hook-dependent-init risk, discovered by inspection rather than in production. Supporting it would take both a hook-keeping escape for the adapter's bundle and the librarian calling `session.bindExtensions({})` to emit `session_start` in nested runs — which also means MCP server processes spawning per run. The librarian would also have to emit `session_shutdown` before `dispose()` (pi's modes do this; `dispose()` alone does not), or every run leaks whatever the lifecycle hooks spawned.
- **Next step:** Revisit if an MCP-provided tool becomes genuinely wanted inside librarian runs.

### Fail runs on unresolved names

- **Status:** Rejected
- **Retained discussion:** Loud but disproportionate — a typo shouldn't block all research. Startup warning chosen; revisit if degraded runs still go unnoticed in practice.

### Keep `librarian.disabledTools` as a baseline subtraction knob

- **Status:** Rejected
- **Decision:** With extra tools opted in by name, disabling an opted-in tool is just removing it from the list; the only remaining use was dropping a built-in (e.g. `bash`), which nothing currently needs. Deleted for a single-knob model; trivially reintroducible.

## Implementation Plan

- [ ] Phase 1: Settings reshape + resolution + run wiring
  - Goal: `librarian.tools` works end to end — named tools resolve, load, and activate in runs; old semantics gone.
  - Files: `extensions/librarian/settings.ts`, new `extensions/librarian/extra-tools.ts` (resolution module), `extensions/librarian/run.ts`, `extensions/librarian.ts`, tests.
  - Work: settings schema gains `tools`, drops `disabledTools`, keeps `extensions` (escape-hatch semantics); pure resolution function `(toolInfos, settings) → { extensionPaths, toolNames }` implementing the self-guard, built-in handling, and dedupe; `runLibrarian` accepts resolved paths + names, wires them into `additionalExtensionPaths`, strips hooks via `extensionsOverride`, and activates baseline + resolved names via `setActiveToolsByName`; entrypoint passes `pi.getAllTools()` output at execute time.
  - Validation: unit tests for resolution (hit, miss, built-in, self, dedupe, escape-hatch pass-through) and run activation; `npm run check`.

- [ ] Phase 2: Session-start validation warnings
  - Goal: Misconfiguration is loud once, at startup.
  - Files: `extensions/librarian.ts`, `extensions/librarian/extra-tools.ts`, tests.
  - Work: on `session_start`, collect extra-tool warnings against `pi.getAllTools()`; for names still unresolved with `librarian.extensions` configured, dry-load those paths through the same hook-stripping resource-loader factory used by runs to enumerate tools and surface loader errors; `ctx.ui.notify` per unresolved entry or loader failure with the specific reason.
  - Validation: unit tests for warning selection (including the dry-load-only-when-needed rule); manual check that a typo'd name warns at pi startup; `npm run check`.

- [ ] Phase 3: Documentation + live smoke
  - Goal: The new model is documented and proven against the motivating use case.
  - Files: `README.md`, `AGENTS.md`/`CONTEXT.md` cross-references as needed, `SMOKE.md`.
  - Work: document `librarian.tools` and the escape-hatch semantics of `librarian.extensions`; remove `disabledTools` references; run a live librarian query that uses a BYO web search tool opted in by name, and one with a deliberate typo showing the startup warning; record both in `SMOKE.md`.
  - Validation: smoke evidence in `SMOKE.md`; `npm run check`.
