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
mise run test -- -t "accepts SSH repository URLs"

# Single test file
mise run test -- test/search-code.test.ts

# Release Unreleased as 1.2.3, once its entries are reviewed (see docs/release.md)
mise run release 1.2.3
```

`mise run build` compiles `src/core` and `src/pi` into `dist/` with `tsc`, and bundles the CLI and fetch worker into `dist/cli/` with tsdown, inlining `typebox` so `npx` needs no pi peer. `npm pack` and `npm publish` build first. Node refuses to strip types under `node_modules`, so the package ships only the compiled tree; pi still loads `src/pi/librarian.ts` directly during development.

## Code Style

- Use TypeBox to ensure runtime type safety
- Do not change production types to make tests easier; mock the real type instead.
- Never be afraid to break backwards compatibility if it serves to better solve the current goal
- Avoid `Pick`, `Omit`, `Partial`, `Exclude`, `ReturnType`, indexed-access type derivations like `Foo["bar"]`, other kinds of utility-type derivations unless they are clearly justified.
- use `.ts` extensions for repo-local imports

## Project structure

`src/core/` is shared by both bindings and must not import pi; biome fails an import of `@earendil-works/*` or `src/pi` from it.

- **Research tools**: `src/core/tools/` — one `search_code_<engine>` / `search_repos_<engine>` file per engine, plus `read-file.ts` and `checkout-repo.ts`. `tools/index.ts` builds the set and the per-source clients from settings; `tools/shared.ts` holds the `limit` and `source` arguments and edge validation. `tool.ts` is the harness-neutral tool shape.
- **Delivery**: `src/core/delivery.ts` — the artifact every search writes and the digest it returns; `budget.ts` — the search time limit as an error, cancelling the request.
- **Clients**: `src/core/github.ts` (Octokit behind `get`/`getRaw`/`graphql`, each validated with TypeBox; gh auth), `grep-app.ts`, `gitlab.ts`, `bitbucket.ts`, `sourcegraph.ts`.
- **Web tools**: `src/core/web/` — `index.ts` builds `web_search` and `web_fetch`; `router.ts` runs the fetcher chain; `fetchers/github/` resolves GitHub URLs through `github.ts`; `parallel.ts` is the Parallel REST client; `fetchers/local/` is the browser fallback, run in a separate worker process, one per user across every harness, so no host imports `playwright-core`.
- **Checkout cache**: `src/core/checkout.ts` — blob-less partial clones under `~/.cache/agents/librarian/repos/` by default.
- **Settings and paths**: `src/core/settings.ts` reads `~/.config/agents/librarian/config.json`; `paths.ts` resolves the XDG directories; `migrate.ts` moves settings and the browser profile out of pi's directory.
- **Pi binding**: `src/pi/librarian.ts` registers the `librarian` tool, the web tools, and the `/librarian` and `/browser` commands; `run.ts` is the nested agent session with `provide_results` enforcement; `view.ts` and `web-render.ts` render; `attach.ts` is the `/librarian` toggle.
- **CLI binding**: `src/cli/program.ts` builds the commander program from the configured tools, taking each tool's options from its parameter schema; `setup-codex.ts` writes the Codex role and rule.
- **Claude plugin**: `plugin/`, listed by `.claude-plugin/marketplace.json`. `agents/librarian.md` is also the Codex role's prompt; `hooks/permissions.mjs` grants the librarian subagent its command and cache.
