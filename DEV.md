# DEV.md

## Commands

```bash
mise trust && mise bootstrap

# Full quality gate — run before committing
mise run check

# Individual steps
mise run lint
mise run format
mise run typecheck
mise run test

# Single test by name pattern
mise run test -- -t "parses sourcegraph stream matches"

# Single test file
mise run test -- test/search-code.test.ts
```

No build/compile step — the pi framework loads extensions directly from TypeScript source.

## Code Style

- Use TypeBox to ensure runtime type safety
- Do not change production types to make tests easier; mock the real type instead.
- Never be afraid to break backwards compatibility if it serves to better solve the current goal
- Avoid `Pick`, `Omit`, `Partial`, `ReturnType`, indexed-access type derivations like `Foo["bar"]`, other kinds of utility-type derivations unless they are clearly justified.
- use `.ts` extensions for repo-local imports

## Project structure

- **Entrypoint**: `extensions/librarian.ts` — registers the `librarian` tool and `/librarian` command.
- **Research tools**: `extensions/librarian/tools/` — `search_repos`, `search_code`, `checkout_repo`, `read_github_file`, `provide_results`.
- **Clients**: `extensions/librarian/github.ts` (REST + gh auth), `extensions/librarian/sourcegraph.ts` (stream search API).
- **Checkout cache**: `extensions/librarian/checkout.ts` — blob-less partial clones under `~/.cache/pi-librarian/repos/`.
- **Runtime**: `extensions/librarian/run.ts` — nested agent session, `provide_results` enforcement.
- **Presentation**: `extensions/librarian/view.ts` — tool-call trace and findings rendering.
- **Attach**: `extensions/librarian/attach.ts` — `/librarian` toggle with session-entry persistence.
- **Settings**: `extensions/librarian/settings.ts` — `librarian.*` keys in pi's global settings.
