# Context

## Language

**Librarian**:
The research agent spawned by the `librarian` tool; runs in a nested agent session with its own toolset and system prompt.

**Librarian run**:
One invocation of the librarian: query in, findings out, with a recorded tool-call trace.
_Avoid_: session (reserved for pi sessions)

**Run id**:
The pi session uuid of a librarian run, so that it may be continued for follow up questions.

**Findings**:
The structured output of a librarian run, produced by `provide_results`: summary, locations, optional description.

**Repo tools**:
The repository research tools this package registers, built from the configured sources: one `search_code_<engine>` and `search_repos_<engine>` tool per engine with an instance, plus `read_file`, `checkout_repo`, and `provide_results`. Exclusive to librarian runs unless attached.

**Source**:
A declared instance the librarian can reach.

**Kind**:
The software a source runs: `github`, `gitlab`, `bitbucket-server`, `sourcegraph`. Determines clone URL layout, API shape, and which roles are possible.

**Role**:
Something a source may do: `clone`, `code-search`, `repo-search`.

**Backend**:
Service that answers a code search.

**Digest**:
What a search tool returns to the agent: what was found, whether the search was complete, what is shown versus fetched, and the path of its artifact, then the first results.

**Artifact**:
The `results.jsonl` file every search writes under `<cacheDir>/searches/<call-id>/`, holding every result it fetched at full detail.
_Avoid_: cache (reserved for clones)

**Inherited tools**:
Pi built-ins granted to librarian runs (`read`, `grep`, `find`, `ls`, `bash`); `write`/`edit` are not included.

**Web tools**:
`web_search` and `web_fetch`. Registered in the main session and granted to every librarian run; not toggled by **Attach**.

**Fetcher**:
One way `web_fetch` resolves a URL: `github`, `parallel`, or `local`, tried in that order. The first to produce a document wins; a failure passes the URL to the next.

**Document**:
What a fetcher returns for one URL: a title, facts, an excerpt, and one or more bodies written under `<cacheDir>/fetches/<call-id>/`.

**Attach / attached tools**:
Loading the repo tools into the main pi session via `/librarian`, making them directly usable by the main agent alongside the `librarian` tool.
_Avoid_: load, enable

## Relationships

- A **Librarian run** ends with exactly one **Findings**, containing zero or more **Locations**.
- **Attached tools** are the same **Repo tools** a **Librarian** uses, minus `provide_results`.
- A librarian run has the **Repo tools**, the **Inherited tools**, and the **Web tools**, less anything in `librarian.tools.disabled`.
- The `github` **Fetcher** uses the same client per **Source** as the **Repo tools**, so one token and one error path serve both.
- a **Librarian run** is persisted in its own session directory, identified by a **Run id**.
- A **Kind** decides which **Roles** are possible, unless `disabled`. `sourcegraph` is the only kind that never has `clone`, which is why the list is `sources` and not `hosts`.
- Every **Source** with a search role is a **Backend**; not every **Backend** is a **Source**.
