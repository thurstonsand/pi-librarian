# Continuable librarian runs

## Status

Draft

## Decision Summary

Persist librarian run transcripts as real pi session files in a librarian-owned directory, and add an optional `continue_from: <run uuid>` parameter to the `librarian` tool that reopens a prior run with its full research context. The run id is the durable transcript identifier: a continuation appends to the same run id rather than minting a second per-invocation id. Follow-up questions ("just one more thing about that flow you traced") reuse everything the run already read instead of starting cold. One machinery for both cheap follow-ups and full second research legs.

## Problem Statement / Background

A librarian run often answers 90% of a question, and the main session discovers the missing 10% only after reading the findings — "you traced the D1 prepared-statement flow; does the same apply to batch()?" Today every run is ephemeral (`SessionManager.inMemory`, disposed on completion), so the follow-up pays full price: re-clone context, re-grep, re-read, re-derive. The run's accumulated context — files read, structure understood, dead ends eliminated — is exactly the asset a follow-up needs.

pi already has the machinery: `SessionManager.create(cwd, sessionDir)` persists transcripts to any directory, `SessionManager.listAll(sessionDir)` lists sessions in an arbitrary directory, and `SessionManager.open(path)` reopens a specific file.

## Goals

- A follow-up to a prior run answers from that run's context when sufficient — potentially zero new tool calls — and researches further when not, with no special-casing between the two.
- The run uuid is discoverable by both the main agent (in the tool result content) and the human (in the rendered output), so continuation survives compaction boundaries: the user can supply the uuid if the agent lost it.
- Continuations work across pi restarts and from different main sessions.

## Non-Goals

- No integration with pi-sessions indexing/search in v1 (see Alternatives).
- No transcript eviction policy in v1 (mirrors the checkout-cache decision; `rm -rf /tmp/pi-librarian/sessions` is the manual escape for default settings).
- No lighter-weight result shape for cheap follow-ups — `provide_results` ceremony applies to every run.

## Exposed Shape

- `librarian` tool gains `continue_from?: string` — the uuid of a prior run. When present, the run resumes that transcript; `query` carries the follow-up question. `repos`/`owners` scope params remain usable.
- Every librarian tool result with an associated transcript ends with a `run: <uuid>` line (for the agent). On success this is appended after rendered findings; on error or abort it is appended after the error text.
- The final render shows the same uuid as a muted line above the footer (for the human), whether the run succeeded, errored, or aborted.
- `LibrarianRunDetails` carries `runId`. Its `trace` remains the live UI trace for the current librarian tool invocation, not the durable transcript history.
- Tool description documents: pass `continue_from` for follow-ups to earlier research; omit it for new topics.

## Design Decisions

### 1. Transcripts are pi session files in a librarian-owned directory

New runs use `SessionManager.create(cacheDir, <cacheDir>/sessions)` instead of `inMemory`. Continuations list `<cacheDir>/sessions` with `SessionManager.listAll(sessionDir)`, match the requested run id, and reopen via `SessionManager.open(path)`. The directory lives outside pi's default session store, so runs never appear in resume pickers and are invisible to pi-sessions indexing.

**Tradeoff**: research memory stays siloed from the pi-sessions "sessions are memory" thesis. Deliberate for v1 — see Alternatives.

### 2. Continuation rebuilds the runtime, the transcript provides the memory

Tools, system prompt, and model are never read from the transcript; each continuation re-registers the current repo tools, rebuilds the system prompt, and resolves the model fresh (configured → current session model — possibly a different model than the original run; pi handles resumed transcripts under a new model). Only the message history is resumed. This keeps continuation semantics identical to fresh runs — including `provide_results` enforcement and the reminder loop — and means prompt/tool improvements apply retroactively to old runs.

### 3. One machinery for cheap follow-ups and big second legs

No fast path. A follow-up that the prior context already answers naturally produces a zero-tool-call run ending in `provide_results`; a big second leg just runs longer. The system prompt gains a continuation expectation: runs may be resumed later; on resume, answer from prior context when it suffices, research further when it does not, cite evidence from the available transcript context, and always finish with `provide_results`.

### 4. uuid surfaced in two places, by design redundancy

The agent reads `run: <uuid>` from the result content; the human sees it in the render. If the agent loses the uuid across a compaction boundary, the user can paste it back. Inelegant, deliberately so — one fallback beats zero.

## Edge Cases & Failure Modes

- **Unknown/missing `continue_from` uuid**: structured error result telling the agent the run was not found and to start a fresh run (the sessions dir may have been cleaned, or an early-aborted run may never have flushed a session file). Fresh runs surface the session id pi gives us without post-run filesystem verification.
- **Concurrent continuations of the same run**: not locked; last write wins. Documented, not defended — a single-user tool.
- **Original run errored or was aborted**: if pi persisted the transcript, it is continuable; the follow-up prompt simply lands after the failure. Often the right move ("try again, but look at X").
- **Model changed between runs**: allowed; transcript resumes under the newly resolved model.
- **Aborted continuation**: same abort path as fresh runs; the transcript keeps whatever was persisted, and remains continuable.

## Alternatives

### Persist into the normal pi session store (pi-sessions integration)

- **Status:** Deferred
- **Open issue:** Landing runs in the regular store would let pi-sessions index them — past research searchable, askable, and linked into lineage. It also pollutes resume pickers with untitled subagent sessions and couples the packages.
- **Retained discussion:** The cleaner future shape is probably pi-sessions optionally indexing `<cacheDir>/sessions` as an additional source, keeping picker separation while gaining research memory.
- **Next step:** Revisit once continuations prove their worth in practice.

### In-memory session map for the pi process lifetime

- **Status:** Rejected
- **Decision or open issue:** Dies on restart and cannot serve a different main session; disk persistence costs nearly nothing given pi's existing machinery.

### Lighter result shape for one-line follow-ups

- **Status:** Rejected
- **Decision or open issue:** Two result shapes for the main agent to handle; `provide_results` on a zero-tool-call run is cheap enough.

## Implementation Plan

- [ ] Phase 1: Persistent run sessions + `continue_from`
  - Goal: Runs persist to `<cacheDir>/sessions/`; `continue_from` resumes them end to end.
  - Files: `extensions/librarian/run.ts`, `extensions/librarian.ts`, `extensions/librarian/prompt.ts`.
  - Work: swap `SessionManager.inMemory` for `create(cacheDir, sessionsDir)`; capture `session.sessionManager.getSessionId()` into `LibrarianRunDetails.runId` and append `run: <uuid>` to all result content when a run id exists; add `continue_from` param, resolve uuid via `SessionManager.listAll(sessionsDir)`, `SessionManager.open`, structured not-found error; system prompt continuation expectation; tool description guidance.
  - Validation: `npm run check` green and live smoke covers fresh run plus continuation.

- [ ] Phase 2: Render the run id
  - Goal: Human-visible uuid in the final rendered state.
  - Files: `extensions/librarian/view.ts`.
  - Work: muted `run <uuid>` line above the footer in the final render (fresh and continued runs alike, including error and abort results).
  - Validation: view unit test; visual check in TUI.

- [ ] Phase 3: Live smoke
  - Goal: Continuation proven in a real pi session.
  - Files: `SMOKE.md`.
  - Work: run a deep dive; ask a follow-up via `continue_from` in the same session (expect few/zero tool calls); restart pi and continue the same run from a fresh session using the rendered uuid; record evidence.
  - Validation: SMOKE.md entries with captured output.
