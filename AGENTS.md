# AGENTS.md

`pi-librarian` gives a pi session the ability to research open source code: deep dives into specific repos ("how does feature X work in repo Y") and discovery across the ecosystem ("compare the most popular SQL ORMs for TypeScript"). It exposes a `librarian` tool that spawns a nested research agent with purpose-built GitHub tools, and a `/librarian` command that attaches those tools directly to the main session.

## Project context

See @CONTEXT.md for project vocabulary.

## Ethos

Agents thrive on reading code for themselves, and projects ALWAYS involve external dependencies. Thus, it's natural to think that it should be easy to point an agent at source code for everything that is involved in a project, even if it's not readily available. Sure, you can always point an agent at a git repo and have it clone it down and start poking around, but that gets cumbersome to type out every time, and most of the time, this exploratory work arrives at a specific answer that doesn't need all of the fidelity of hundreds to thousands of lines of source code to back it up. So it seems natural to give agents a tool that lets them learn about any code external to its own repo that deliver the results without any of the interim.

And this doesn't even touch on the advantages of giving the agent an efficient tool for doing cross-repo comparisons, tracing, market research, etc.

## Core principles

- Build on pi-native concepts, types, and extension APIs where available; read pi source when helpful
- The librarian is read-only: no write/edit tools, clones live only in the checkout cache
- Prioritize ergonomics of the exposed interaction surface over internal implementation

See @DEV.md for code style and development commands.
