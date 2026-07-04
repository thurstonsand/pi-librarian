export const LIBRARIAN_TOOL_NAMES = {
  searchRepos: "search_repos",
  searchCode: "search_code",
  searchGitHubCode: "search_github_code",
  checkoutRepo: "checkout_repo",
  readGitHubFile: "read_github_file",
  provideResults: "provide_results",
} as const;

export const ATTACHABLE_TOOL_NAMES = [
  LIBRARIAN_TOOL_NAMES.searchRepos,
  LIBRARIAN_TOOL_NAMES.searchCode,
  LIBRARIAN_TOOL_NAMES.searchGitHubCode,
  LIBRARIAN_TOOL_NAMES.checkoutRepo,
  LIBRARIAN_TOOL_NAMES.readGitHubFile,
] as const;

export const LIBRARIAN_RUN_TOOL_NAMES = [
  ...ATTACHABLE_TOOL_NAMES,
  LIBRARIAN_TOOL_NAMES.provideResults,
] as const;
