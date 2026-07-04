# Context

## Language

**Librarian**:
The research agent spawned by the `librarian` tool; runs in a nested, in-memory agent session with its own toolset and system prompt.

**Librarian run**:
One invocation of the librarian: query in, findings out, with a recorded tool-call trace.
_Avoid_: session (reserved for pi sessions)

**Findings**:
The structured output of a librarian run, produced by `provide_results`: summary, locations, optional description.

**Repo tools**:
The repository research tools this package registers: `search_repos`, `search_code`, `search_github_code`, `checkout_repo`, `read_github_file`, `provide_results`. Exclusive to librarian runs unless attached.

**Inherited tools**:
Pi built-ins granted to librarian runs (`read`, `grep`, `find`, `ls`, `bash`) plus tools from allowlisted extensions. Never `write`/`edit`.

**Attach / attached tools**:
Loading the repo tools into the main pi session via `/librarian`, making them directly usable by the main agent alongside the `librarian` tool.
_Avoid_: load, enable

## Relationships

- A **Librarian run** ends with exactly one **Findings**, containing zero or more **Locations**.
- **Attached tools** are the same **Repo tools** a **Librarian** uses, minus `provide_results`.
