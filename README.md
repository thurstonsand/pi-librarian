# pi-librarian

A GitHub research subagent for the [pi coding agent](https://github.com/badlogic/pi-mono) inspired by [Amp](https://ampcode.com/): deep-dive questions about specific repos ("how does drizzle-orm implement prepared statements?") and discovery across the ecosystem ("compare the most popular TypeScript SQL ORMs").

## How it works

The `librarian` tool spawns a nested research agent with purpose-built tools:

- **`checkout_repo`** — clone into a local cache; pi's own `grep`/`read`/`find` then work on real files, and `git log -S`/`blame`/`diff` cover history.
- **`search_repos`** — GitHub repository discovery (stars, topics, language).
- **`search_code`** — cross-repo public code search via [Grep](https://grep.app/) (regex, global discovery, repo/language/path filters).
- **`search_github_code`** — GitHub REST code search over public code and private repositories your configured GitHub auth can access.
- **`read_github_file`** — single-file API reads for quick peeks without cloning.

Private repos work through your existing `gh` auth for GitHub-backed tools.

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
    "extensions": ["~/.pi/agent/extensions/parallel-web-tools"],
    "disabledTools": [],
    "cacheDir": "/tmp/pi-librarian",
  },
}
```

| Setting         | Recommended                                 | Default                                  |
| --------------- | ------------------------------------------- | ---------------------------------------- |
| `model`         | `openai-codex/gpt-5.5`                      | current session model                    |
| `thinkingLevel` | `off`                                       | current session thinking level           |
| `extensions`    | `[]` unless extra research tools are needed | `[]`                                     |
| `disabledTools` | `[]`                                        | `[]`; `write`/`edit` are always excluded |
| `cacheDir`      | `/tmp/pi-librarian`                         | `/tmp/pi-librarian`                      |

## Development

```bash
npm run check                       # biome + tsc + vitest
pi -e ./extensions/librarian.ts     # run pi with this extension loaded
```
