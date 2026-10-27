---
status: closed
type: grilling
blocked-by: []
---

# Forks, vendored code, and duplicate results

## Question

A code host's search has no notion of a fork or a vendored copy. A search backend excludes forks by default. On a real instance that difference dominated the results for the single most common query shape. What does the librarian do about it?

## The measurement

From [Native search versus a search backend, head to head](02-native-search-versus-a-search-backend.md): searching a Bitbucket Server instance for a symbol **defined in exactly one place**, nine of the first eleven hits were vendored copies, generated documentation stubs, and personal forks — including the same file twice, from two separate copies of one repository. The true definition ranked 11th of 14.

The search backend, same symbol, ranked it **1st of 65**, and its progress stream reported `excluded: repository-fork` so the exclusion was visible rather than silent.

This is not a ranking nicety. It is the difference between a research agent citing the definition and citing a stale vendored copy of it — and a stale copy is a *plausible-looking* wrong answer, which is the worst kind. It also compounds: the agent reads the wrong file, reasons from it, and the error propagates into findings that look properly cited.

## Why it needs deciding rather than assuming

The obvious move — filter forks and vendor directories — is wrong in the general case. Vendored code is sometimes exactly what is being asked about ("which services still bundle the old client"). Forks are sometimes the subject ("what did this team change"). And a fork on one host is a first-class repository on another; the librarian cannot tell from a path.

So this is not "add a filter", it is "decide who gets to decide", and that is a design question with several plausible answers and no obvious winner.

## To resolve

- **Where the knowledge lives.** A backend knows what a fork is because the code host told it. A host's search API knows too but does not use it — the repo API exposes forkability and origin. So the information is often retrievable at extra cost; whether the tool pays that cost, and when.
- **Whether vendor detection is path-based at all.** `vendor/`, `node_modules/`, `third_party/`, `.venv/`, generated doc trees. Path heuristics are cheap, wrong sometimes, and unavoidably ecosystem-specific. A curated default list plus a settings override is the conventional answer; whether conventional is right here is the question.
- **Whether the agent opts in or out.** Excluding by default with an explicit include is safer for the common case and hides evidence for the uncommon one. Including by default and reporting duplicates is honest and noisier. The backend chose exclude-by-default and reports the exclusion, which is a reasonable precedent — but it can do so because it has authoritative fork data, which we may not.
- **Duplicate suppression as a separate concern.** The same file appearing twice from two copies of one repository is not a fork problem, it is a deduplication problem, and it is solvable without knowing anything about forks — identical path plus identical content is a duplicate. Cheaper and less contestable than fork filtering, and possibly the whole answer.
- **What gets reported.** Whatever is suppressed has to be countable and mentioned, or the agent cannot tell a clean result set from a heavily filtered one. This is the same failure mode as silent truncation in [Delivering search results without drowning the context](06-delivering-search-results-without-drowning-the-context.md), and probably wants the same treatment.
- **Whether this is configuration or prompt.** How polluted a given host is varies by instance — one measured instance was badly polluted, and that is not a property of Bitbucket Server, it is a property of how that organisation uses it. Which argues for configuration. But the agent also needs to know, at the point of reading results, that ranking on a native path is less trustworthy than on a backend.

## Resolution

**Not building it.** No duplicate collapsing, vendored-path flags, or fork filtering on native search.

The failure this ticket fears is an agent citing a stale copy, and the librarian already guards against it: search hits are candidates, never evidence, and are verified by reading the file before being cited. A vendored copy that survives being read at its commit is, for the question asked, a correct citation of that copy; one that does not survive is discarded. Every mechanism considered here would add per-engine heuristics, a new argument or digest field, and ecosystem-specific path lists, all to improve ranking that verification already corrects.

What already holds: Sourcegraph leaves forks out of its searches by default, and `find_definition` leaves out code under `vendor/` unless asked for it with `include_vendored`. A user whose native host is badly polluted can declare a Sourcegraph and disable the host's `code-search` role.

If the usage log shows runs repeatedly spending reads on duplicates, collapsing identical hits (same path, same matched lines) is the cheapest first step: it needs no fork data and no heuristics.
