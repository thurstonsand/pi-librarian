import {
  isCodeSearchTool,
  isRepoSearchTool,
  LIBRARIAN_TOOL_NAMES,
  WEB_TOOL_NAMES,
} from "./tools/names.ts";

export interface PromptTool {
  name: string;
  promptGuidelines?: string[];
}

function list(names: string[]): string {
  return names.join(" or ");
}

// Strategy names only the tools a run actually has; tools.disabled and per-source registration
// mean any of them may be absent.
function strategy(names: string[]): string[] {
  const has = (name: string) => names.includes(name);
  const codeSearch = names.filter(isCodeSearchTool);
  const repoSearch = names.filter(isRepoSearchTool);
  const read = has(LIBRARIAN_TOOL_NAMES.readFile) ? LIBRARIAN_TOOL_NAMES.readFile : undefined;
  const verify = [LIBRARIAN_TOOL_NAMES.checkoutRepo, ...(read ? [read] : [])].join(" or ");

  const lines = [
    "- Question about a SPECIFIC repo (behavior, implementation, flow): checkout_repo first, then grep/read/find/ls on the local clone. This is your workhorse. Use `git -C <path> log -S <term>` / blame / diff for history questions.",
  ];
  const webSearch = has(WEB_TOOL_NAMES.webSearch);
  const webFetch = has(WEB_TOOL_NAMES.webFetch);
  if (repoSearch.length > 0) {
    lines.push(
      `- "What's out there / what's popular": ${list(repoSearch)}${webSearch ? ", plus web_search for ecosystem context" : ""}.`,
    );
  }
  if (codeSearch.length > 0) {
    lines.push(
      `- "Who does X across repos": ${list(codeSearch)} to gather candidates, then verify the promising ones with ${verify}.`,
    );
    if (!has(LIBRARIAN_TOOL_NAMES.searchCodeSourcegraph)) {
      lines.push(
        "- Callers of a symbol: search code for its name, then clone and grep to confirm each candidate.",
      );
    }
  }
  if (read) {
    lines.push(
      `- Single-file peek (a package.json, one README): ${read} — don't clone for one file.`,
    );
  }
  if (webFetch) {
    lines.push(
      "- Issues, pull requests, discussions, releases, CI runs: web_fetch on the GitHub URL. To learn whether a bug was fixed, fetch the issue and read its timeline: a closing commit or a merged cross-referenced PR is evidence of a fix, while closed as `completed` alone can mean the reporter was answered. Search one repository's issues with web_fetch on https://github.com/<owner>/<repo>/issues?q=<terms>.",
    );
  }
  if (webSearch) {
    lines.push(
      `- Documentation, announcements, anything not in a repository: web_search${webFetch ? ", then web_fetch the most relevant sources" : ""}.`,
    );
  }
  return lines;
}

export function buildLibrarianSystemPrompt(cacheDir: string, tools: PromptTool[]): string {
  const names = tools.map((tool) => tool.name);
  const searches = names.some((name) => isCodeSearchTool(name) || isRepoSearchTool(name));
  const guidelines = tools.flatMap((tool) => tool.promptGuidelines ?? []);

  const sections = [
    "You are the Librarian, a codebase-understanding agent. You answer questions about large, multi-repository codebases using the provided tools. You run as an isolated subagent and your answer is relayed verbatim back to the main agent.",
    [
      "## Search Strategy",
      "",
      "Pick the cheapest instrument that answers the question:",
      "",
      ...strategy(names),
      ...(searches
        ? [
            "",
            "Search results are CANDIDATES, not evidence. Never cite a search hit you have not verified by reading the file.",
            "",
            "No results means that source has no match, not that the code does not exist: a source covers only what it hosts or indexes. Before reporting something absent, say which sources you searched.",
            "",
            "Every search stores its full results in the file its digest names. To look further into a result set, read or grep that file rather than searching again.",
          ]
        : []),
      "",
      "Work with common sense: start with the most informative call, expand only when needed, and stop as soon as you have enough evidence to answer confidently. Prefer parallel tool calls for independent lookups.",
    ].join("\n"),
    ...(guidelines.length > 0
      ? [["## Tool rules", "", ...guidelines.map((guideline) => `- ${guideline}`)].join("\n")]
      : []),
    `## Workspace\n\nClones live under ${cacheDir}/repos/<host>/<path>. They are read-only research material: never modify, commit, or push. Keep bash usage to inspection (git log/blame/diff, wc, jq); file content questions go through grep/read.`,
    [
      "## Citations",
      "",
      "- Only cite files you actually read within context.",
      "- Cite as source + repo + file path + line range when you have one.",
      "- If evidence is partial, say what is confirmed and what remains uncertain.",
      "- If access fails (404/403, private repo), report that constraint plainly.",
    ].join("\n"),
  ];
  return sections.join("\n\n");
}

export function buildProvideResultsReminder(): string {
  return "You have not called provide_results yet. Call it now with your findings (summary, locations, optional description). If you could not answer the query, say so in the summary and cite whatever partial evidence you have.";
}
