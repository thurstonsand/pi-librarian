# Pi 0.80.6 attach entries, thinking, and model resolution

## Status

Accepted

## Decision Summary

Adopt Pi 0.80.6's custom-entry renderer, CLI model resolver, and `max` thinking level. Attach state changes become durable transcript accordions with historical tool snapshots; configured models follow Pi's native model-pattern semantics and fall back to the current session model only when Pi cannot resolve them.

## Problem Statement / Background

Pi-librarian already persists `/librarian` attach state as `pi-librarian:attach` custom entries, but those entries are invisible in the transcript. The command compensates with transient notifications, so a resumed session can restore its state without showing when or how the state changed.

Pi 0.80.4 added `registerEntryRenderer`, which can present state records without sending them to the model. The rendered entry must snapshot the affected tool names so historical entries remain accurate if pi-librarian's attachable toolset changes later; older incomplete shapes are deliberately unsupported.

Configured librarian models currently use local fuzzy matching over `modelRegistry.getAvailable()`. Pi exports `resolveCliModel`, the canonical resolver for exact references, bare and provider-scoped fuzzy patterns, and custom model IDs. Pi-librarian should use that behavior directly rather than impose a separate availability policy.

Pi 0.80.6 extends the public `ThinkingLevel` type with `max`. Pi exposes model-specific `getSupportedThinkingLevels`, but no public runtime list of every accepted setting value, so settings validation must keep one local runtime list aligned with Pi's public type.

## Goals

- Make actual attach and detach changes visible as durable, compact transcript history without duplicate notifications.
- Preserve the exact toolset affected by each new historical entry.
- Reject attach entries that do not match the current data shape without migration behavior.
- Use Pi's canonical configured-model resolution and fallback to the current session model only on resolution failure.
- Make every configured-model fallback visible and actionable.
- Accept and preserve Pi 0.80.6's `max` thinking level from settings through nested runs.

## Non-Goals

- Persist `/librarian status` queries or repeated explicit `on`/`off` no-ops.
- Send attach state entries to the LLM.
- Change nested-run extension loading to use `InlineExtension`.
- Add a separate authentication or availability gate after Pi resolves a configured model.
- Choose a different fallback model when no current session model exists.

## Exposed Shape

### `/librarian` command feedback

An actual state change appends one `pi-librarian:attach` custom entry and does not also show a notification. `/librarian status` remains a transient notification. `/librarian on` while attached and `/librarian off` while detached remain transient no-ops, using symmetrical wording:

- `Librarian tools already attached.`
- `Librarian tools already detached.`

### Attach transcript entry

The compact line is stable when expanded:

- `Librarian tools attached`
- `Librarian tools detached`

Attached state uses success styling; detached state uses muted styling. Expanding a current entry reveals the exact affected tool names beneath the unchanged compact line. Tool names appear in their registered order.

New entries persist:

```ts
{
  attached: boolean;
  tools: string[];
}
```

Both attach and detach entries snapshot the complete affected tool list. Any entry that does not match the complete current shape renders `Librarian attach state unavailable` and does not influence restored state.

### Thinking-level settings

`librarian.thinkingLevel` accepts `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`. The selected value crosses settings, model resolution, and nested-run boundaries unchanged; provider/model capability handling remains Pi's responsibility. Because Pi has no public runtime constant for the complete setting vocabulary, pi-librarian keeps one local list checked against Pi's public `ThinkingLevel` type.

### Configured model resolution

`librarian.model` accepts the same patterns as Pi: exact or fuzzy bare patterns such as `opus`, provider-scoped patterns such as `anthropic/opus`, and custom model IDs supported by `resolveCliModel`. `resolveLibrarianModel` passes the pattern directly to Pi against `modelRegistry.getAll()` and accepts any returned model. Resolver warnings, including custom-ID fallback warnings, are shown without rejecting the model.

When configured resolution returns an error or no model, each librarian invocation:

1. falls back to `ctx.model` when present;
2. emits a warning naming the configured model, the failure reason, and the current fallback model; and
3. runs with the requested librarian thinking level unchanged.

If no current model exists, the librarian tool retains its existing execution error. No warning is needed in the successful configured-model or unconfigured current-model paths.

## Design Decisions

### 1. Entries record state changes, not every command response

Only actual state changes belong in durable transcript history. Status queries and repeated explicit states do not change session state, so notifications remain the appropriate surface. Removing the transition notification avoids presenting the same event twice.

### 2. New entries snapshot the affected tools

Deriving names from the current `ATTACHABLE_TOOL_NAMES` would make old transcript entries change meaning after the toolset evolves. Storing the names adds minor duplication but preserves historical truth. Detach entries retain the list because removal has the same affected scope as attachment.

### 3. Entry rendering has no compatibility shape

Attach entries either match the complete current `{ attached, tools }` shape or render the generic unavailable-state line. Carrying a legacy branch would preserve data that cannot satisfy the historical-toolset requirement.

### 4. Expansion is additive

Expanded rendering keeps the compact line unchanged and adds details below it. This treats transcript expansion as an accordion rather than substituting one representation for another.

### 5. Pi owns model resolution

`resolveCliModel` owns provider normalization, fuzzy matching, priority, and custom model-ID fallback. Pi-librarian accepts its result directly. Authentication and provider failures belong to nested execution rather than a second model-selection policy.

### 6. Fallback warnings occur on every affected invocation

Repeated warnings are intentional. Every run that differs from configured intent should say so at the point of use; silently deduplicating could hide a continuing configuration problem from later research runs.

## Edge Cases & Failure Modes

- **Old or malformed attach entry:** does not alter restored state and renders a neutral unavailable-state line.
- **Toolset changes after an entry was written:** new rendering uses the entry's snapshot, preserving historical scope.
- **Repeated explicit state:** appends no entry and reports that tools are already attached or detached.
- **Unknown provider:** warns with Pi's resolution reason and falls back to the current model.
- **Resolved but unauthenticated model:** is selected; nested execution reports any resulting authentication failure.
- **Resolver-created custom model ID:** is selected and Pi's warning is shown.
- **No configured model:** uses the current model without warning.
- **No usable configured or current model:** librarian execution throws the existing no-model error.

## Alternatives

### Keep transient transition notifications alongside entries

- **Status:** Rejected
- **Decision:** It duplicates one event in two UI surfaces. The durable entry is sufficient feedback for an actual state change.

### Derive tool names while rendering

- **Status:** Rejected
- **Decision:** Historical entries would silently change when the attachable toolset changes.

### Version the entry immediately

- **Status:** Rejected
- **Decision:** There is one accepted shape and no migration behavior. A version adds ceremony without distinguishing supported semantics.

### Filter resolved models through `getAvailable()`

- **Status:** Rejected
- **Decision:** It diverges from Pi's native model-pattern behavior and blocks intentional custom or differently authenticated models. Nested execution owns operational model failures.

### Warn once at startup or once per session

- **Status:** Rejected
- **Decision:** Each resolver warning or fallback should remain explicit at its point of use.

## Implementation Plan

- [x] Phase 1: Raise the Pi dependency floor
  - Goal: Make the new Pi APIs and thinking level part of pi-librarian's supported runtime contract.
  - Files: `package.json`, `package-lock.json`, `extensions/librarian/settings.ts`, tests.
  - Work: Raise relevant `@earendil-works/pi-*` development and peer dependency minimums to 0.80.6, refresh the npm lockfile, and accept `max` through a local runtime list checked against Pi's public `ThinkingLevel` type.
  - Validation: Inspect root constraints and resolved package versions; include package validation in the full quality gate.

- [x] Phase 2: Render durable attach state
  - Goal: Replace duplicate transition notifications with strict-shape transcript accordions.
  - Files: `extensions/librarian/attach.ts`, `extensions/librarian.ts`, `test/attach.test.ts`.
  - Work: Define the current entry shape; snapshot tool names from `ATTACHABLE_TOOL_NAMES`; register the entry renderer; preserve compact content while expanded; render every non-current shape generically; remove actual-transition notifications; make no-op wording symmetrical.
  - Validation: Focused tests for state restoration, persisted snapshots, compact and expanded rendering, generic invalid-shape rendering, and active-tool mutation.

- [x] Phase 3: Adopt canonical model resolution
  - Goal: Use `resolveCliModel` with Pi-native model-pattern and fallback behavior.
  - Files: `extensions/librarian/model.ts`, `extensions/librarian.ts`, `test/model.test.ts`.
  - Work: Resolve bare and provider-scoped configured patterns through Pi; accept returned models and warnings directly; return a specific warning when falling back to the current model; preserve no-model behavior.
  - Validation: Focused tests for bare and provider-scoped fuzzy resolution, Pi model priority, custom-ID fallback, resolution errors, warning text, current fallback, missing fallback, and preservation of `max`.

- [x] Phase 4: Integration validation
  - Goal: Prove the upgrade works as one coherent change.
  - Files: implementation and test files above; design status only if implementation materially diverges.
  - Work: Run focused tests, typecheck against the upgraded Pi API, and inspect the final staged/unstaged split without altering it.
  - Validation: `npm test -- test/attach.test.ts test/model.test.ts test/settings.test.ts`; `npm run check`.
