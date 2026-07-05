# pi-librarian

A GitHub research subagent for the [pi coding agent](https://github.com/badlogic/pi-mono) inspired by [Amp](https://ampcode.com/): deep-dive questions about specific repos ("how does drizzle-orm implement prepared statements?") and discovery across the ecosystem ("compare the most popular TypeScript SQL ORMs").

## How it works

The `librarian` tool spawns a nested research agent with purpose-built tools:

- **`checkout_repo`** — clone into a local cache; pi's own `grep`/`read`/`find` then work on real files, and `git log -S`/`blame`/`diff` cover history.
- **`search_repos`** — GitHub repository discovery (stars, topics, language).
- **`search_code`** — cross-repo public code search via [Grep](https://grep.app/) (regex, global discovery, repo/language/path filters).
- **`search_github_code`** — GitHub REST code search over public code and private repositories your configured GitHub auth can access.
- **`read_github_file`** — single-file API reads for quick peeks without cloning.

## GitHub auth for private repos

Public GitHub reads work without configuration. To let the librarian search and read private GitHub repositories, provide a token in one of these ways:

1. Set `GITHUB_TOKEN` or `GH_TOKEN` in the environment before starting pi.
2. Or authenticate the GitHub CLI so `gh auth token` returns a token:

The token is loaded once per pi session and passed to GitHub REST calls used by `search_repos`, `search_github_code`, `checkout_repo`, and `read_github_file`. For private repositories, use a token with read access to the target repos.

## Usage

- Ask pi a question involving other repos; it delegates to the `librarian` tool.
- Ask follow-up questions to earlier librarian runs.
- `/librarian` attaches the research tools directly to your session for manual lookups.

## Configuration

In pi's global `settings.json`:

```jsonc
{
  "librarian": {
    "model": "openai-codex/gpt-5.5",
    "thinkingLevel": "off",
    "tools": ["search_web", "fetch_web"],
    "extensions": ["~/.pi/agent/extensions/parallel-web-tools"],
    "cacheDir": "/tmp/pi-librarian",
  },
}
```

| Setting         | Recommended                                   | Default                        |
| --------------- | --------------------------------------------- | ------------------------------ |
| `model`         | `openai-codex/gpt-5.5`                        | current session model          |
| `thinkingLevel` | `off`                                         | current session thinking level |
| `tools`         | names of extra tools to activate, when needed | `[]`                           |
| `extensions`    | escape hatch paths for tools not loaded in pi | `[]`                           |
| `cacheDir`      | `/tmp/pi-librarian`                           | `/tmp/pi-librarian`            |

`librarian.tools` is the activation gate for extra tools. `librarian.extensions` only adds extension paths to the search space when a named tool is not already loaded in the main pi session; listing an extension path does not activate every tool in that bundle. Librarian runs exclude `write` and `edit`.

## Development

```bash
npm run check                       # biome + tsc + vitest
pi -e ./extensions/librarian.ts     # run pi with this extension loaded
```
