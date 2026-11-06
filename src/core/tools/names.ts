export const LIBRARIAN_TOOL_NAMES = {
  searchCodeGitHub: "search_code_github",
  searchCodeGrepApp: "search_code_grepapp",
  searchCodeSourcegraph: "search_code_sourcegraph",
  searchCodeGitLab: "search_code_gitlab",
  searchCodeBitbucket: "search_code_bitbucket",
  searchReposGitHub: "search_repos_github",
  searchReposSourcegraph: "search_repos_sourcegraph",
  searchReposGitLab: "search_repos_gitlab",
  searchReposBitbucket: "search_repos_bitbucket",
  findDefinition: "find_definition",
  readFile: "read_file",
  checkoutRepo: "checkout_repo",
  provideResults: "provide_results",
} as const;

export const WEB_TOOL_NAMES = {
  webSearch: "web_search",
  webFetch: "web_fetch",
} as const;

export const REPO_TOOL_NAMES: readonly string[] = Object.values(LIBRARIAN_TOOL_NAMES);

export function isCodeSearchTool(name: string): boolean {
  return name.startsWith("search_code_");
}

export function isRepoSearchTool(name: string): boolean {
  return name.startsWith("search_repos_");
}
