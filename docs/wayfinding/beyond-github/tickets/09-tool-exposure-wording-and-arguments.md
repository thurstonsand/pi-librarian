---
status: closed
type: grilling
blocked-by: [6, 7, 10]
---

# Tool exposure: wording, arguments, and upstream inspiration

## Question

The toolset is the interface. Once the surface stops moving, what is every tool's exact name, description, prompt snippet, prompt guidelines, and parameter description — as literal text, reviewed as prose?

Blocked on delivery, history search, and fork handling, because all three change what the tools return and what arguments they take. This is the last ticket before the design doc.

## Inherited from the deleted configuration ticket

Host and backend configuration moved into [Reaching a repo](05-reaching-a-repo-reference-forms-and-clone-resolution.md), which decides the settings shape by implementing it. Two of its questions were wording rather than configuration and land here:

- **Never promising completeness.** A backend that indexes part of a code host is the normal case, not an edge case — one measured instance indexed 13 repositories of an entire host, and did not contain repositories its own users owned. An agent told "a search backend is available" will assume it is authoritative. Since coverage cannot be declared usefully or discovered cheaply, the tool descriptions and prompt must simply never claim a backend sees everything.
- **Search ordering.** Largely dissolved: a source excluded from a role by `disabled` *is* the ordering preference, stated declaratively. What remains is ordering among whatever is left enabled, and the head-to-head spike found that part is not instance-dependent — so it belongs in the prompt, here, rather than in settings.

## Hard constraints from the head-to-head spike

These are settled facts that the wording must honour, not open questions:

- **Regex must be refused at the tool boundary** for any native path. A code host given a regex does not error — it returns a **silent zero**, which reads as "no such code exists". The parameter has to be rejected before the request, naming a path that supports it.
- **No naive `limit` parameter.** The backend's count directive is a match budget, not a file budget: asking for 20 returned one file and lost the answer. Whatever bounds results is not a passed-through limit, and no parameter should imply otherwise.
- **"Showing N of M" cannot be shared wording.** Result units differ across every remote path — the backend counts files, one host counts files *usually* (an extension-filtered query returned the same file twice in a page), another counts matches. Each path needs its own phrasing, and the unit has to be named.
- **A saturation sentinel is not a count.** A host returns `total: 10000` for any common term. That number must never reach the model as a total.
- **Truncation is only detectable from a reason string.** Skip entries carry `severity: "info"` even for real caps, so any "results were trimmed" wording has to key off the reason, never the severity.
- **A capability refusal must be actionable.** A `400` telling the reader to ask an administrator is useless to an agent; it has to be translated into a next step it can actually take. (Moved here from [Handling uneven GitLab search capability](03-handling-uneven-gitlab-search-capability.md).)

## Why it is its own ticket

Nine or ten tools are touched. Buried in an implementation plan as "update descriptions", the wording gets written by whoever implements each tool and drifts into inconsistency. Reviewed as one artifact, the set can be read for whether a model could actually choose correctly between its members — which is the only test that matters.

The hard case is the three code-search tools. They do the same thing against different backends, with different capabilities, and the model must pick without trying one first. The spike sharpened what "different capabilities" means: two entire question shapes — conceptual and regex — are backend-only, and on those a native path does not fail loudly, it returns zero or misses. So the descriptions carry more weight than usual: they are the only thing standing between the agent and a confident wrong answer.

## Mining the upstream descriptions

A well-built set of equivalent tool descriptions exists upstream and is worth studying for **structure**, once the toolset is decided. The pattern observed:

- lead with what the tool is for, in one line
- an explicit "use when you need to" list
- an explicit **"do NOT use when"** list, naming the tool to use instead
- define a tool **against its sibling** where two are easily confused — the stemmed-search description opens by contrasting itself with keyword search, which is precisely the problem three code-search tools create
- a tips section covering the non-obvious failure modes
- a guardrail where a tool invites misuse

Two cautions. That text belongs to its author and this repo is public, so what is taken is the structure, and the words are ours. And structure is not length: the upstream descriptions are long because they front-load a skill file, whereas these descriptions are loaded into every session's system prompt, and this project's existing descriptions are deliberately terse. Read the pattern, then decide independently how much prose each tool has earned.

## To resolve

- The final name of every tool, including renames. `read_github_file` and `search_github_code` are wrong once other hosts are first-class; `read_remote` is the leading candidate for the first, chosen to sit legibly beside pi's own `read`.
- Whether every tool needs a "do NOT use when" clause or only the confusable ones.
- How the dynamic surface reads. Descriptions are assembled at registration from what is configured, so a description that references a sibling tool must not reference one that is absent.
- What the system prompt says about search strategy versus what individual descriptions say, and how to keep them from contradicting each other as the available set changes.
- Parameter descriptions, one at a time. These are where the model's mistakes actually originate — a `repo` argument meaning substring on one backend and regex on another is a bug in prose.

## Output

A single review artifact containing the literal text for the whole surface, linked from the resolution. Read as prose, marked up, then implemented from.

## Resolution

**The output is [the tool surface](../tool-surface.md) itself**, reviewed as prose and then implemented from: the final names are in [The surface at a glance](../tool-surface.md#the-surface-at-a-glance), and each tool's literal text is in its own section.

- **Names**: family first, engine last (`search_code_github`, `search_repos_gitlab`); `read_github_file` became `read_file`, not `read_remote`, because it is the only reader and pi's `read` sits beside it unambiguously.
- **"Do not use when" clauses** are not a convention. A cross-tool contrast cannot know whether the other tool is registered, so the prompt builder owns it, emitting it only when both tools are active. See [Where guidance goes](../tool-surface.md#where-guidance-goes) and [Where tool guidance lives](../tool-guidance.md).
- **The dynamic surface** reads correctly because descriptions name no sibling tools, `source` appears only with two or more instances ([Zero, one, or many](../tool-surface.md#zero-one-or-many)), and the librarian's strategy is composed from the tools a run has.
- **Prompt versus descriptions**: [What reaches the model](../tool-surface.md#what-reaches-the-model) found that a run drops `promptGuidelines`; the prompt now renders them, so each fact has one owner.
- **Never promising completeness**: the digest says whether each search was complete, the prompt says that no results on one source is not absence, and a source's `description` ([ticket 11](11-user-supplied-hints-about-a-source.md)) names a known coverage gap.
- **Search ordering** is a source's `disabled`, declared, plus the strategy lines in the prompt.
