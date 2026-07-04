# SMOKE.md

Live verification runs for the librarian, executed 2026-07-03 against pi v0.80.2 with
`pi -e ./extensions/librarian.ts`.

## 1. Librarian tool — known-repo deep dive (flow A)

Non-interactive: `pi -p --no-session -e ./extensions/librarian.ts "Use the librarian tool to
research: how does drizzle-orm implement prepared statements for the Cloudflare D1 driver?"`

The librarian checked out `drizzle-team/drizzle-orm` (blob-less clone), grepped and read on the
local clone, and returned findings via `provide_results`, which the main agent relayed with
sha-pinned citations:

> - `SQLiteD1Session.prepareQuery()` calls Cloudflare directly … Citation:
>   `drizzle-orm/src/d1/session.ts:50-75`
>   https://github.com/drizzle-team/drizzle-orm/blob/48e540602710/drizzle-orm/src/d1/session.ts#L50-L75
> - Placeholder values are resolved by shared SQL machinery … `fillPlaceholders()` in
>   `drizzle-orm/src/sql/sql.ts:612-632`
> - In short: Drizzle does not emulate prepared statements for D1 … calls
>   `D1Database.prepare(sql)` … then `bind(...params)` followed by D1's native `run/all/raw`.

Cache verified afterwards: `~/.cache/pi-librarian/repos/drizzle-team/drizzle-orm` — 37M blob-less
partial clone, full history (`git log --oneline -1` → `48e54060`).

## 2. Librarian tool — ecosystem discovery (flow B), TUI rendering

Interactive TUI in tmux: "compare the most popular TypeScript SQL ORMs (stars, philosophy, query
style)". The run made 36 tool calls in 1m 22s across six repos.

Collapsed view while running (query header, last-3 trace with result summaries and per-call
timers, footer):

```
 ⠋ Librarian Compare the most popular TypeScript SQL ORMs by GitHub stars, philosophy, and query style.…
   … 24 earlier calls (Ctrl+O to expand)
   ✓ find **/*.md (25 lines) · 0.0s
   ✓ read sequelize/packages/core/README.md:1-180 (19 lines) · 0.0s
   ✓ read sequelize/packages/core/test/types/typescript-docs/readme.md:1-220 (3 lines) · 0.0s
   27 tool calls · 35.5s · openai-codex/gpt-5.5
```

Expanded trace (Ctrl+O) shows the full research strategy — star lookups via `search repos`,
README peeks via `read.gh` without cloning, `checkout` for repos needing source verification
(note `cached` for the drizzle clone reused from run 1), then grep/read on local clones:

```
   ✓ search repos repo:prisma/prisma (1 of 1 repos) · 0.5s
   ✓ read.gh typeorm/typeorm/README.md (226 lines) · 0.2s
   ✓ checkout drizzle-team/drizzle-orm (cached · 1387 files @ 48e5406) · 0.3s
   ✓ checkout sequelize/sequelize (cloned · 944 files @ c770094) · 1.7s
   ✓ grep "selectFrom" kysely (22 lines) · 0.0s
   ✓ read drizzle-orm/drizzle-orm/src/mysql-core/db.ts:330-424 (97 lines) · 0.0s
   ✓ results (9 locations) · 0.0s
```

Done view kept the query in the header (`✓ Librarian Compare the most popular…`), replaced the
body with the findings (summary, 9 line-cited locations, a 6-row comparison table in the
description), footer `36 tool calls · 1m 22s · openai-codex/gpt-5.5`.

## 3. /librarian attach mode

In the same TUI session:

- `/librarian` → toast: `Attached librarian tools: search_repos, search_code, checkout_repo, read_github_file`
- Prompt: "Use the search_repos tool directly (not the librarian) to find the 3 most starred Rust
  web frameworks" → main agent called `search_repos` itself and answered (dioxus/yew/rocket) —
  no subagent run.
- Killed the pi process entirely, resumed with `pi -ne -e ./extensions/librarian.ts -c`:
  - `/librarian status` → `Librarian tools attached: …` (state restored from the session entry)
  - main agent successfully called `search_repos` again (`topic:terminal language:rust` →
    alacritty) — the tools are genuinely active after restart, not just flagged.
- `/librarian off` → `Detached librarian tools.`

## 4. search_code standalone (Grep backend, regex, repo-scoped)

Executed the Grep client directly:
`{ query: "\\bprepareQuery\\s*\\(", repo: "drizzle-team/drizzle-orm", language: ["TypeScript"], useRegexp: true }` →
10 matches from `grep.app` in 313ms, with repo/path/snippet line numbers parsed from the MCP response.

## 5. Octokit-backed GitHub client refactor

Executed after replacing the custom GitHub REST wrapper with `@octokit/rest`:

```bash
npm exec --package tsx -- tsx --eval "import { createGitHubClientProvider } from './extensions/librarian/github.ts'; (async () => { const github = await createGitHubClientProvider()(); const file = await github.readContents({ repo: { owner: 'octokit', repo: 'rest.js' }, path: 'package.json', ref: undefined }); console.log('file', file.kind, file.kind === 'file' ? file.text.split('\\n')[1]?.trim() : ''); const dir = await github.readContents({ repo: { owner: 'octokit', repo: 'rest.js' }, path: 'src', ref: undefined }); console.log('dir', dir.kind, dir.kind === 'directory' ? dir.entries.map((entry) => entry.path).join(',') : ''); const repos = await github.searchRepositories({ query: 'repo:octokit/rest.js', sort: 'best-match', limit: 1 }); console.log('repos', repos.hits[0]?.repo, repos.totalCount > 0); const code = await github.searchCode({ pattern: 'Octokit', repos: [{ owner: 'octokit', repo: 'rest.js' }], limit: 2 }); console.log('code', code.hits.length, code.totalCount > 0, code.hits[0]?.repo, code.hits[0]?.path); })();"
```

Output:

```text
file file "name": "@octokit/rest",
dir directory src/index.ts,src/version.ts
repos octokit/rest.js true
code 2 true octokit/rest.js README.md
```

This verifies the Octokit client path for raw file reads, directory reads, repository search, and GitHub REST code search while keeping `repo` and `path` separate at the call boundary.

Also executed pi itself inside tmux, attaching the raw librarian tools first and asking the model to call the tools directly:

```bash
pi -p --mode json --no-session -e ./extensions/librarian.ts \
  '/librarian on' \
  'Use the attached librarian tools directly, not the librarian subagent. Call search_repos for repo:octokit/rest.js limit 1, read_github_file with owner octokit, repo rest.js, path package.json, and search_github_code for pattern Octokit in repos [{owner: octokit, repo: rest.js}] limit 1. Report concise evidence.'
```

The JSON transcript contained the expected tool calls:

```json
{"name":"search_repos","arguments":{"query":"repo:octokit/rest.js","limit":1}}
{"name":"read_github_file","arguments":{"owner":"octokit","repo":"rest.js","path":"package.json"}}
{"name":"search_github_code","arguments":{"pattern":"Octokit","repos":[{"owner":"octokit","repo":"rest.js"}],"limit":1}}
```

And successful tool results:

```text
search_repos: 1 repositories match; showing 1. octokit/rest.js (★661 · TypeScript · pushed 2026-07-03)
read_github_file: package.json line 2 => "name": "@octokit/rest"
search_github_code: 1 of 78 matches across 1 repos (github): src/index.ts
```

## Quality gate

`npm run check` (biome + tsc strict + vitest, 51 unit tests) green after the Octokit refactor.
