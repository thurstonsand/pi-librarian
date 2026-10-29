---
status: closed
type: grilling
blocked-by: []
---

# User-supplied hints about a source

## Question

A source's declaration says what software it runs and which roles it plays. It says nothing about the local truths an operator knows and the librarian cannot discover: what a backend actually indexes, which host holds the code nobody has migrated yet, which of two GitLabs is the one that matters. Should a declaration carry free-text hints, and if so, who reads them?

## The motivating case is measured, not hypothetical

The search backend used throughout this effort indexes **none** of the declared GitLab's six hundred repositories — its only code hosts are the Bitbucket Server instance and one mirrored public repository — and appears to cover the Bitbucket Server host completely. An earlier draft of this ticket said it indexed a dozen GitLab repositories; a later spike showed those were Bitbucket repositories with "gitlab" in their names, which is the very mistake an agent would make. Nothing in the API reports any of it. Ticket 04 established that capability detection is impossible because the endpoint is admin-only, and coverage is a strictly harder question than capability: an instance that _can_ search GitLab tells you nothing about whether it _has indexed_ the repository you care about.

So an agent that searches the backend, finds nothing, and reports "no such code exists" is wrong in a way it cannot detect. The operator knew. There was nowhere to write it down.

## The shape under consideration

A `hints` field on a source, holding prose, surfaced to the agent:

```jsonc
{
  "name": "example-sg",
  "url": "https://search.example.com",
  "kind": "sourcegraph",
  "hints": "Indexes none of example-gl. For GitLab code, search example-gl directly."
}
```

## To resolve

- **Whether prose is the right instrument, or an admission of a missing structured field.** "Indexes none of that GitLab" is a coverage fact and could be declared as one — a repo-pattern allowlist per backend, machine-readable, usable to _route_ a search rather than merely to warn about it. A hint that the agent must interpret is weaker than a fact the tool can act on. The counter-argument is that coverage is one hint among many, most of which have no structure worth inventing, and that a general escape hatch beats a specific mechanism that only covers the case we happened to measure first.
- **Where a hint is read, given that the prompt is not always built.** Ticket 05 found that `attach.ts` never calls `buildLibrarianSystemPrompt`, so anything living only in the librarian's system prompt is absent in attach mode. That already forced the source-to-hostname mapping into a tool parameter description. Hints may face the same constraint, which would mean composing them into tool descriptions — where they are unbounded operator prose sitting in a place the agent treats as authoritative instruction.
- **Whether a hint is per-source or per-relationship.** The motivating hint is not about one source. It says something about _the gap between two_ — that the backend does not cover what the GitLab holds. Hanging it on the backend is arbitrary; the GitLab has an equal claim, and an operator who reads only the GitLab declaration learns nothing.
- **Staleness, and who notices.** The measured coverage gap is exactly the kind of fact that gets fixed without telling anyone. A stale hint is worse than no hint, because it actively steers the agent away from a source that now works. Whether anything can be done about that, or whether it is simply the operator's problem, is worth stating out loud rather than leaving implied.
- **The relationship to never promising completeness.** Ticket 09 holds the rule that the librarian must not report absence as proof. A hint is a _specific_ instance of that general humility, and if the general rule is stated well the hint may be redundant — or the hint may be the only thing that makes the general rule actionable, since "results may be incomplete" is advice an agent cannot act on and "this backend does not index that host" is.
- **Length, and what stops it becoming a second prompt.** Free text with no limit invites a paragraph of operator lore per source. Whether there is a cap, and whether it is enforced or merely documented, decides whether this feature stays small.

## Resolution

**Built: a free-text `description` on a source**, at most 300 characters, trimmed, and refused when blank or longer.

- **Prose, not a structured coverage field.** Coverage is the case we measured, not the only one an operator knows ("holds the services not yet migrated"). A coverage field would route searches only for the one case we happened to find first.
- **Read where every mode reads.** The note ends the description of every tool that reaches that source (its search tools, `read_file`, and `checkout_repo`) as `Notes on its sources:` followed by `- <name>: <description>`. Tool descriptions reach both librarian runs and attach mode; the librarian's system prompt reaches only runs.
- **Per source, not per relationship.** The operator writes the note on whichever source the agent should be warned at, usually the backend, and may name the other source in it, since names are what the agent passes as `source`.
- **Staleness is the operator's problem.** Nothing can detect that a coverage gap was fixed; the README says the field is for what the agent cannot discover.
- **Against the general rule**: the prompt now says that no results on one source is not absence. The note is what makes that rule actionable, by naming where else to look.
- **Length** is enforced by the schema at 300 characters, enough for a gap and a pointer.

Verified in a real run against a declared Sourcegraph whose note says it indexes none of the declared GitLab: the librarian quoted the note from all three Sourcegraph tools and chose `search_code_gitlab` for GitLab code because of it.
