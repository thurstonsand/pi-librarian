# Deferred librarian tool activation

## Status

Deferred. As is, requires that it be a tool (e.g. `load_librarian`) and cannot be a slash command. Keep current semantics, even if they're not quite as cache friendly.

## Decision Summary

Pi-librarian is the only current local tool package worth considering for dynamic activation because its deep repository research capability is useful but not needed in most sessions. An opt-in loader could keep the `librarian` schema inactive until requested, but the likely token savings are modest and every first use gains an extra tool round trip, so implementation is deferred until there is evidence that the tradeoff is worthwhile.

## Problem Statement / Background

The top-level `librarian` tool is registered and active in every Pi session even when no repository research is needed. Pi 0.80.7 can record tools activated during a tool call and expose them through provider-native deferred definitions on supported models, allowing an initially small tool set to grow without replacing the cached prompt prefix.

Pi-librarian already keeps its five **Repo tools** inactive unless the user explicitly enables **Attach** mode. This design concerns only the top-level `librarian` tool used to start a **Librarian run**. The nested Librarian's own tool set remains unchanged.

The current `librarian` schema is not especially large, so replacing it with a loader does not guarantee a meaningful reduction. The design is worth retaining as a bounded experiment, not as assumed optimization.

## Goals

- Keep the top-level `librarian` tool out of the initial active tool schemas when deferred activation is enabled.
- Preserve the existing `librarian` name and parameters after activation.
- Preserve the prompt-cache prefix while activation adds the tool on providers that support Pi's deferred-tool metadata.
- Keep Attach mode and nested Librarian behavior independent from top-level tool activation.
- Measure schema savings and first-use latency before considering deferred activation as the default.

## Non-Goals

- Dynamically install the pi-librarian package or load extension code after session startup.
- Defer the Repo tools inside a Librarian run.
- Replace `/librarian on|off|status`, which controls Attach mode rather than the top-level research tool.
- Build a repository-independent tool marketplace or global catalog.
- Automatically unload `librarian` after a run.

## Exposed Shape

An opt-in `librarian.deferTool` boolean setting would preserve current behavior by default during the experiment.

When enabled, the initial main-session tool set contains a small `load_librarian` tool instead of `librarian`. Its description and stable prompt guidance explain that it activates deep, multi-step GitHub and cross-repository research. It takes no research query; its only operation is activation.

Calling `load_librarian` adds `librarian` to the current active tools without removing any other tool. The result tells the model to call `librarian` with the research question and optional repository scope. Pi records `librarian` in the loader result's `addedToolNames`, so a supporting provider can introduce the schema as a deferred definition on the next model turn.

Once activated, `librarian` remains active for the rest of the runtime. Session restart behavior follows the setting and Attach state rather than adding a new persisted activation record. Attach mode continues to control only `search_repos`, `search_code`, `search_github_code`, `checkout_repo`, and `read_github_file`.

## Design Decisions

### 1. Defer activation, not registration or installation

Both tools are registered when the extension loads. `load_librarian` is initially active and `librarian` is initially inactive. This uses Pi's supported active-tool mutation and avoids runtime package installation, extension reload ordering, and partially initialized dependencies.

### 2. Keep activation additive

The loader reads the current active tool names and adds `librarian`. It must never replace the complete active set, because other extensions and user settings own their tools independently.

### 3. Keep prompt guidance stable

The current `librarian` `promptSnippet` and `promptGuidelines` cannot become active only after loading: adding them would change the system prompt and lose the cache-prefix benefit the design is meant to test. In deferred mode, equivalent discovery guidance belongs to the always-active loader. The activated `librarian` contributes its tool schema but no new system-prompt text.

### 4. Activation lasts for the runtime

Follow-up research and `continue_from` should not require repeated loader calls. Automatic unloading adds state transitions and cache churn for little gain.

### 5. Attach mode remains orthogonal

Attach exposes Repo tools directly in the main session; deferred activation exposes the nested research entry point. `/librarian on` does not imply that the model should start a Librarian run, and loading `librarian` does not attach lower-level Repo tools.

### 6. Start opt-in and measure

The loader schema, discovery guidance, and extra round trip may cost more than the compact `librarian` schema saves. The experiment should record serialized schema size, tool-selection behavior, and first-use latency before changing the default.

## Edge Cases & Failure Modes

- **Loader called more than once:** return that `librarian` is already active without changing the active set.
- **Other extensions mutate active tools:** activation merges into the latest active set and preserves their ordering.
- **Provider lacks cache-preserving deferred definitions:** activation still works on the next turn, but no cache benefit is claimed.
- **Session resumes after a prior Librarian run:** `librarian` begins inactive again when deferral is enabled; the model can reload it for a follow-up using the visible run id.
- **Attach state is restored:** Repo tools follow their persisted attach entry while `librarian` follows deferred activation independently.
- **Model never calls the loader:** no Librarian run occurs; this is ordinary tool-selection failure and should be measured rather than hidden with automatic activation.

## Alternatives

### Keep `librarian` always active

- **Status:** Open
- **Open Issue:** The existing schema may already be cheaper and more reliable than adding a loader.
- **Discussion:** This remains the default and baseline for measurement.
- **Next step:** Compare serialized schemas and representative tool-selection traces against the opt-in prototype.

### Generic shared tool catalog

- **Status:** Open
- **Open Issue:** A catalog amortized across several deferred packages would have a stronger token argument, but pi-librarian is the wrong owner for a global extension protocol.
- **Discussion:** Pi-librarian could expose metadata to such a catalog later without embedding that system here.
- **Next step:** Revisit only if another substantial tool family also needs deferred activation.

### Activate from `before_agent_start`

- **Status:** Rejected
- **Decision:** Activating before the first request sends the same schema as today's behavior and provides no dynamic-tool benefit.

### Defer the Repo tools through the same loader

- **Status:** Rejected
- **Decision:** They are already inactive by default and have an explicit, persisted Attach workflow with different semantics.

## Implementation Plan

- [ ] Phase 1: Establish the opt-in boundary
  - Goal: Add deferred mode without changing default behavior.
  - Files: `extensions/librarian/settings.ts`, `extensions/librarian.ts`, settings tests.
  - Work: Add and validate `librarian.deferTool`; extract top-level tool construction so prompt metadata can be assigned to either the active librarian tool or the loader without duplication.
  - Validation: Settings tests and snapshots of active tool names and prompt guidance in default versus deferred mode.

- [ ] Phase 2: Add additive activation
  - Goal: Activate `librarian` during a loader tool call while preserving every other active tool.
  - Files: a focused loader/activation module, `extensions/librarian.ts`, unit tests.
  - Work: Register `load_librarian`; make deferred session initialization remove only `librarian`; add it during loader execution; return concise next-step guidance; keep Attach state independent.
  - Validation: Tests for initial state, additive activation, repeated activation, Attach restoration, and unchanged default mode.

- [ ] Phase 3: Prove the external behavior
  - Goal: Determine whether the optimization earns its complexity.
  - Files: integration tests and measurement notes in this design.
  - Work: Verify Pi records `addedToolNames: ["librarian"]`; inspect provider requests before and after activation; compare serialized schema bytes and first-use turns with the always-active baseline.
  - Validation: Full package checks plus live sessions on one provider with native deferred definitions and one fallback provider. Keep the setting opt-in unless the measurements justify changing the default.
