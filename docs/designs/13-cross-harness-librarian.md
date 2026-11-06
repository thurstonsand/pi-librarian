# Cross-harness librarian

## Status

Accepted

## Decision Summary

The librarian becomes usable from Claude Code and Codex as well as pi. The research capabilities split into a core that knows nothing of pi, with two bindings on top: the existing pi extension, and a `librarian` CLI that Claude and Codex subagents run through their shell. The CLI is the only harness-neutral way to keep the research surface out of the main agent's context: an MCP server is visible to the main agent in Codex, and in Claude whenever it ships in a plugin. The package ships compiled JavaScript, keeps one settings file for every harness, and stores clones, results, and the browser profile in shared XDG directories so all three harnesses share one cache and one browser.

## Problem Statement / Background

Claude Code and Codex have an Oracle equivalent but no librarian. The obvious port, an MCP server holding the research tools, fails the librarian's core property, that its tools live only in the librarian's context:

- Codex silently drops `mcp_servers` from a custom agent role (`apply_role_cannot_expand_parent_authority` in `codex-rs/core/src/agent/role_tests.rs`), and every MCP filter is per server, never per agent. Any server the librarian can call, the main agent can find through tool search.
- Claude scopes an inline `mcpServers` entry to a subagent only for agents in `~/.claude/agents/`; plugin agents ignore the field, and a plugin's `.mcp.json` is session-wide.

A command on `PATH` that only the librarian's prompt mentions works in both harnesses and in both Claude distributions (a plugin's `bin/`, or an npm install). Smoke tests on Claude Code 2.1.318 and Codex 0.166/0.167 confirmed the main agent never sees it while the subagent runs it.

Separately, the npm package ships `.ts` source. Node refuses to strip types under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so the local fetch worker, spawned as `node fetch-worker.ts`, fails in every npm install of 0.8.0 today.

## Goals

- One core, pi-free, that both bindings call; the pi extension keeps its tools, `/librarian`, `/browser`, and continuable runs unchanged in behavior.
- A `librarian` CLI whose commands exist only for what is configured, with progressive `--help`.
- A Claude Code plugin needing no setup in the default (unsandboxed) configuration.
- Codex support through `librarian codex setup`, which writes the agent role and one execpolicy rule, and `librarian codex uninstall`, which removes them.
- One settings file, migrated automatically from pi's settings.
- Shared cache, state, and browser across harnesses, with exactly one fetch worker per user.
- The package runs from npm and `npx` with compiled JavaScript.

## Non-Goals

- Supporting Claude's or Codex's explicit sandbox modes beyond Codex's default `workspace-write`. Claude sandbox users add `permissions.allow: ["Bash(librarian *)"]` themselves.
- An MCP server.
- Renaming the package or repository.
- Amp support; Amp has its own librarian.

## Exposed Shape

Package:

- `bin`: `{ "librarian": "./dist/cli/librarian.js" }`, the only bin, so `npx -y @thurstonsand/pi-librarian <args>` runs it without repeating the name.
- `pi.extensions`: `./dist/pi/librarian.js`.
- Pi packages and `typebox` are optional peers, so `npx` does not install pi.

Paths, honoring `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, and `XDG_STATE_HOME`:

- Settings: `~/.config/agents/librarian/config.json`.
- Cache, holding clones, search artifacts, and fetched documents: `~/.cache/agents/librarian/`.
- State, holding the browser profile and the worker's socket, pid file, and spawn lock: `~/.local/state/agents/librarian/`.

Settings keep today's strict schema, with the harness-specific keys moved into per-harness sections:

```jsonc
{
  "sources": [],
  "builtInSources": { "github": true, "gitlab.com": false },
  "search": { "timeoutSeconds": 15, "defaultLimit": 10 },
  "web": { "parallel": {}, "fetch": { "browser": {}, "challenge": {} } },
  "cacheDir": "~/.cache/agents/librarian",
  "pi": {
    "model": "...",
    "thinkingLevel": "low",
    "tools": { "disabled": [] },
    "debug": { "persistRuns": false }
  },
  "codex": { "model": "...", "reasoningEffort": "low" }
}
```

CLI, first draft; the command set is expected to change through use. Positional arguments and the source are declared per command; each command's options come from its tool's parameter schema, so flags and their help match what the pi tool documents:

```
librarian --help                          configured sources and global commands
librarian <source> code <query>           code search on a source with code-search
librarian <source> repos <query>          repository search on a source with repo-search
librarian <source> read <repo> <path>     one file or directory, without cloning
librarian <source> clone <repo>           clone into the cache
librarian <source> definition <symbol>    sourcegraph sources only
librarian grepapp <regex>                 public code search
librarian clone <git-url>                 clone by full URL
librarian web search <objective>          when a Parallel key is configured
librarian web fetch <url...>
librarian codex setup | uninstall
```

A source contributes only the commands its roles and credentials allow. Its `description` becomes its help text. Source names may not collide with the global commands. Each command prints the same digest the matching pi tool returns.

Claude plugin, in `plugin/`, listed by `.claude-plugin/marketplace.json` at the repository root:

- `agents/librarian.md`: the librarian prompt, `model: sonnet`, with `Bash` and `Read`.
- `bin/librarian`: runs `npx -y @thurstonsand/pi-librarian@<plugin version>`; the release script keeps the plugin's version equal to the package's.
- `hooks/hooks.json`: one `PreToolUse` hook, effective only when `agent_type` is the librarian. It allows `Read` under the cache and state directories, a bare `librarian` command, and read-only inspection (`grep`, `rg`, `find`, `ls`, `cat`, `head`, `tail`, `wc`, `jq`, `git -C <clone>` with a read subcommand) whose every absolute path lies in those directories. Claude Code 2.1.319 has no search tool of its own and refuses a shell search outside the workspace, which a hook's allow overrides.

Codex 0.167 loads a plugin's skills, MCP servers, and hooks, but no agents, rules, or `bin/`. A skill that tells the main agent to spawn a default subagent and have it read the prompt was built and dropped: its prompt arrives as command output rather than developer instructions, its description sits in the skills list rather than `spawn_agent`, and it still needed the rule in the default sandbox. The role is the only Codex install.

`librarian codex setup` writes `~/.codex/agents/librarian.toml`, built from the plugin agent's prompt plus the `codex` settings, and `~/.codex/rules/librarian.rules` holding `prefix_rule(pattern=["librarian"], decision="allow")`. It writes without asking and reports each file as created, updated, or unchanged, then says Codex must restart. `librarian codex uninstall` names whichever of the two files exist, asks once, and removes them only on yes. The role's description tells the main agent to spawn it with `fork_turns: "none"`.

## Design Decisions

### 1. A CLI, not MCP

See the background. The CLI also gives progressive disclosure for free: the prompt says to start with `librarian --help`, and each command's help documents its engine's query syntax.

### 2. Core and bindings

`src/core/` holds clients, operations, settings, delivery, the fetch worker, and paths, and imports nothing from pi. `src/pi/` holds the extension entry, tool definitions, the nested run, rendering, attach, and the settings migration. `src/cli/` holds the commander entry and commands. An operation takes validated arguments and returns its digest text and artifact paths. Each binding declares its own arguments by hand, because a CLI's positional query and a tool's JSON schema are different interfaces.

### 3. Build

TypeScript 7's `tsc` compiles everything into `dist/` with `rewriteRelativeImportExtensions`. tsdown bundles only the CLI entry and the fetch worker into `dist/cli/`, inlining `typebox` so `npx` needs no pi peer. `playwright-core` stays an ordinary dependency, because it resolves its own files from its install directory and breaks when bundled. The worker is resolved beside the module that spawns it, with that module's extension. A check after the build fails if the worker is not beside its resolver.

### 4. Git installs

Pi installs git sources with `npm install --omit=dev`, so no build can run at install time, and `dist/` is not committed on `main`. The `downgrade` branch, which the work machine installs from git, gets a workflow that builds and commits `dist/` whenever the branch is pushed, as one build commit above the pin commit that later runs amend.

### 5. Shared directories and one worker

The worker's socket, pid file, and spawn lock live beside the browser profile, so every harness converges on one worker and one Chrome. A test starts several clients at once and asserts that exactly one worker starts and that every request is answered.

### 6. Browser resolution

Configured `executablePath`, then installed Chrome, then a `chromium` on `PATH`, then Playwright's downloaded Chromium. When none exists, the first local fetch downloads Playwright's Chromium and says so in its result.

### 7. Settings migration

On load, either binding moves a `librarian` key in pi's global settings into the settings file, since Claude or Codex may run before pi does after an upgrade. `model`, `thinkingLevel`, `tools`, and `debug` go under `pi`, and the key is removed from pi's settings. It also moves `~/.pi/agent/browser-profile` into the state directory. When both the key and the file exist, it fails and names both rather than choosing one.

### 8. Clone context

A clone's output ends by listing `AGENTS.md` and `CLAUDE.md` at the repository root, when present. Nested files are not searched, and neither file's content is inlined.

### 9. Model overrides

`pi` and `codex` carry their harness's model settings. Codex applies them when `codex setup` writes the role. Claude Code has no section: it reads a plugin agent's model only from the plugin's frontmatter, with no per-agent override in its settings (anthropics/claude-code#79866 asks for one), so a `claude.model` key would validate and change nothing. `CLAUDE_CODE_SUBAGENT_MODEL` remains, applying to every subagent.

### 10. Codex's default sandbox

Codex's default `workspace-write` blocks both the cache write and the network, and under `on-request` it does not offer an unsandboxed retry. An `allow` execpolicy rule runs the command without approval and outside the sandbox when every segment matches. Codex itself writes such rules to `~/.codex/rules/default.rules`, and other installers ship their own rules file. `codex setup` writes its own file, which `codex uninstall` removes, and a stricter user rule still wins.

## Validation

The exit condition is all of:

1. `mise run check` passes, including the concurrent-spawn test and a check that `src/core/` imports nothing from pi.
2. From an `npm pack` tarball installed outside the repository, `librarian --help` lists only the configured sources. A `web fetch` that needs the local browser succeeds, which proves the worker starts from `node_modules`.
3. Pi loads the packed extension with every tool. A pi settings file holding a `librarian` key migrates to the settings file, and the key is removed.
4. Claude with the plugin: the librarian subagent answers a real question through the CLI, the main agent's tool list and tool search show no librarian command, and the subagent reads its cache without a prompt in default permission mode.
5. Codex after `librarian codex setup`, under both the default configuration and full access: the librarian role answers a real question, and the root thread's first request never mentions the CLI.

## Implementation Order

1. Move into `src/core`, `src/pi`, `src/cli` without behavior changes.
2. Build, worker resolution, optional peers, and the concurrent-spawn test.
3. XDG paths, the settings file, and the migration.
4. The CLI.
5. Clone context and browser resolution.
6. The plugin, hooks, agent prompt, and `codex setup` and `uninstall`.
7. Documentation and changelog.
8. Release: the `downgrade` workflow, publish, and the matching ansiblonomicon change.
