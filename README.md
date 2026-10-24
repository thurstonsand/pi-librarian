# pi-librarian

A GitHub research subagent for the [pi coding agent](https://github.com/badlogic/pi-mono) inspired by [Amp](https://ampcode.com/): deep-dive questions about specific repos ("how does drizzle-orm implement prepared statements?") and discovery across the ecosystem ("compare the most popular TypeScript SQL ORMs").

![calling the librarian tool](images/librarian-run.png)

![librarian tool results](images/librarian-results.png)

## How it works

The `librarian` tool spawns a research subagent with purpose-built tools:

- **`checkout_repo`** — clone into a local cache, where it can be read locally, and `git log -S`/`blame`/`diff` covers history. Takes a repository path plus a `source` naming one of your configured sources, or a full HTTPS/SSH clone URL on its own.
- **`search_repos`** — GitHub repository discovery (stars, topics, other metadata).
- **`search_code`** — cross-repo public code search via [Grep](https://grep.app/) (regex, global discovery, repo/language/path filters).
- **`search_github_code`** — GitHub REST code search over public code and private repositories your configured GitHub auth can access.
- **`read_github_file`** — single-file API reads for quick peeks without cloning.

## Usage

- Ask pi a question involving other repos; it asks the `librarian`.
- Ask follow-up questions to earlier librarian runs.
- `/librarian` attaches the research tools directly to your session for direct tool usage.
- Recommended: install [pi-web-access](https://pi.dev/packages/pi-web-access) (or your web search of choice, tho this one is zero-config to get started) and add `web_search`, `fetch_content`, `get_search_content` to `librarian.tools.extra` to expand past GitHub-only research.

## GitHub auth for private repos

Public GitHub reads work without configuration. To let the librarian search and read private GitHub repositories, provide a token in one of these ways:

1. Set `GITHUB_TOKEN` or `GH_TOKEN` in the environment before starting pi.
2. Or authenticate the GitHub CLI so `gh auth token` returns a token:

The token is loaded once per pi session and used for GitHub access in `search_repos`, `search_github_code`, and `read_github_file`. For private repositories, use a token with read access to the target repos. `checkout_repo` uses git's built-in credential helpers instead.

## Configuration

In pi's global `settings.json`:

```jsonc
{
  "librarian": {
    "model": "openai-codex/gpt-5.5",
    "thinkingLevel": "off",
    "tools": {
      "extra": ["web_search", "fetch_content", "get_search_content"],
      "disabled": [],
    },
    "sources": [
      {
        "name": "example-gl",
        "url": "https://gitlab.example.com",
        "kind": "gitlab",
        "tokenEnv": "EXAMPLE_GITLAB_TOKEN",
        "advancedSearch": false,
      },
      {
        "name": "example-bb",
        "url": "https://git.example.com",
        "kind": "bitbucket-server",
        "disabled": ["code-search"],
      },
      {
        "name": "example-sg",
        "url": "https://search.example.com",
        "kind": "sourcegraph",
      },
    ],
    "builtInSources": { "github": true, "gitlab.com": false },
    "search": { "timeoutSeconds": 15, "defaultLimit": 10 },
    "extensions": ["~/.pi/agent/extensions/parallel-web-tools"],
    "cacheDir": "/tmp/pi-librarian",
    "debug": { "persistRuns": false },
  },
}
```

| Setting             | Recommended                                      | Default                        |
| ------------------- | ------------------------------------------------ | ------------------------------ |
| `model`             | `openai-codex/gpt-5.5`                           | current session model          |
| `thinkingLevel`     | `off`                                            | current session thinking level |
| `tools.extra`       | names of extra tools to provide the librarian    | `[]`                           |
| `tools.disabled`    | names of tools to remove from librarian runs     | `[]`                           |
| `sources`           | code hosts and search backends                   | `[]`                           |
| `builtInSources`    | switch `github` and `gitlab.com` on or off       | `github` on, `gitlab.com` off  |
| `search.timeoutSeconds` | seconds a search may run before it is an error | `15`                        |
| `search.defaultLimit` | results a search returns unless asked for more (at most 50) | `10`              |
| `extensions`        | extra paths to load extensions for the librarian | `[]`                           |
| `cacheDir`          | `/tmp/pi-librarian`                              | `/tmp/pi-librarian`            |
| `debug.persistRuns` | persist nested session file paths for debugging  | `false`                        |

Each `librarian.sources` entry requires a unique `name`, an HTTPS `url`, and a `kind`: `github`, `gitlab`, `bitbucket-server`, or `sourcegraph`. The `kind` decides which roles a source can play — `clone`, `code-search`, `repo-search` — unless `disabled`. `github` and `gitlab.com` are built in and need no entry; `builtInSources` switches each on or off as a whole, and a switched-off source does not exist at all, though a full clone URL to its host still clones.

Search needs an API token; cloning does not, because it uses git's own credentials. A source reads its token from the environment variable named by `tokenEnv`, or by default from its kind's usual variable: `GITHUB_TOKEN`/`GH_TOKEN`, `GITLAB_ACCESS_TOKEN`, `BITBUCKET_TOKEN`, `SRC_ACCESS_TOKEN`. A source without a token keeps cloning and loses its search tools. `advancedSearch: true`, on a `gitlab` source only, says the instance has GitLab's advanced search, which lets code search span projects. Note that `librarian.tools.disabled` is a different lever: it removes a tool from the run entirely, where a source's `disabled` removes one source from one role.

`librarian.extensions` dynamically loads extra extensions just for the librarian. Add any tools from that extension to `librarian.tools.extra` for the librarian to actually be able to use them. Librarian excludes `write` and `edit`.

## Development

```bash
npm run check                       # biome + tsc + vitest
pi -e ./extensions/librarian.ts     # run pi with this extension loaded
```
