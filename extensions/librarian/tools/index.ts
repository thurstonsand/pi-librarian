import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  createGitHubClientProvider,
  createGitHubFileReader,
  type GitHubClientProvider,
  resolveGitHubToken,
} from "../github.ts";
import type { RepoFileReader } from "../repo-entry.ts";
import type { LibrarianSettings, LibrarianSource, SourceKind, SourceRole } from "../settings.ts";
import { createCheckoutRepoTool } from "./checkout-repo.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";
import { createReadFileTool } from "./read-file.ts";
import { createSearchCodeGitHubTool } from "./search-code-github.ts";
import { createSearchCodeGrepAppTool } from "./search-code-grepapp.ts";
import { createSearchReposGitHubTool } from "./search-repos-github.ts";

// One explicit client per source. Each kind's clients share nothing with another kind's, so there
// is no common interface to put in a registry.
export interface RepoClients {
  github: Map<string, GitHubClientProvider>;
  readers: Map<string, RepoFileReader>;
}

export function sourcesWith(
  sources: LibrarianSource[],
  kind: SourceKind,
  role: SourceRole,
): LibrarianSource[] {
  return sources.filter((source) => source.kind === kind && source.roles.includes(role));
}

export function createRepoClients(settings: LibrarianSettings): RepoClients {
  const github = new Map<string, GitHubClientProvider>();
  const readers = new Map<string, RepoFileReader>();

  for (const source of settings.sources) {
    switch (source.kind) {
      case "github": {
        // The built-in source keeps its zero-config path: GITHUB_TOKEN, GH_TOKEN, then gh's token.
        const token = source.token;
        const provider = createGitHubClientProvider(
          source.name === "github" && token === undefined ? resolveGitHubToken : async () => token,
          source.url,
        );
        github.set(source.name, provider);
        readers.set(source.name, createGitHubFileReader(provider));
        break;
      }
      case "gitlab":
      case "bitbucket-server":
      case "sourcegraph":
        break;
    }
  }

  return { github, readers };
}

export function readableSources(
  settings: LibrarianSettings,
  clients: RepoClients,
): LibrarianSource[] {
  return settings.sources.filter(
    (source) => source.roles.includes("clone") && clients.readers.has(source.name),
  );
}

export interface RepoToolSet {
  tools: ToolDefinition[];
  // Tools over a single instance take no source argument; this names the source each one implies.
  impliedSources: Map<string, string>;
}

function implyWhenSingle(
  impliedSources: Map<string, string>,
  toolName: string,
  instances: LibrarianSource[],
): void {
  if (instances.length === 1 && instances[0]) {
    impliedSources.set(toolName, instances[0].name);
  }
}

// The repository tools a session can use, built from configuration: an engine with no instance
// contributes no tool.
export function createRepoTools(settings: LibrarianSettings, clients: RepoClients): RepoToolSet {
  const { cacheDir, search, sources } = settings;
  const tools: ToolDefinition[] = [];
  const impliedSources = new Map<string, string>([
    [LIBRARIAN_TOOL_NAMES.searchCodeGrepApp, "grep.app"],
  ]);

  const githubCode = sourcesWith(sources, "github", "code-search");
  if (githubCode.length > 0) {
    tools.push(createSearchCodeGitHubTool(githubCode, clients.github, cacheDir, search));
    implyWhenSingle(impliedSources, LIBRARIAN_TOOL_NAMES.searchCodeGitHub, githubCode);
  }
  tools.push(createSearchCodeGrepAppTool(cacheDir, search));

  const githubRepos = sourcesWith(sources, "github", "repo-search");
  if (githubRepos.length > 0) {
    tools.push(createSearchReposGitHubTool(githubRepos, clients.github, cacheDir, search));
    implyWhenSingle(impliedSources, LIBRARIAN_TOOL_NAMES.searchReposGitHub, githubRepos);
  }

  const readable = readableSources(settings, clients);
  if (readable.length > 0) {
    tools.push(createReadFileTool(readable, clients.readers));
    implyWhenSingle(impliedSources, LIBRARIAN_TOOL_NAMES.readFile, readable);
  }
  tools.push(createCheckoutRepoTool(cacheDir, sources));

  return { tools, impliedSources };
}
