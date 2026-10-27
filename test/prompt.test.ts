import { describe, expect, it } from "vitest";
import { buildLibrarianSystemPrompt } from "../extensions/librarian/prompt.ts";

describe("buildLibrarianSystemPrompt", () => {
  it("points at the cache layout", () => {
    const prompt = buildLibrarianSystemPrompt("/tmp/pi-librarian", [{ name: "checkout_repo" }]);

    expect(prompt).toContain("/tmp/pi-librarian/repos/<host>/<path>");
  });

  it("names only the search tools a run has", () => {
    const prompt = buildLibrarianSystemPrompt("/tmp/pi-librarian", [
      { name: "search_code_github" },
      { name: "search_code_grepapp" },
      { name: "checkout_repo" },
    ]);

    expect(prompt).toContain(
      '- "Who does X across repos": search_code_github or search_code_grepapp to gather candidates, then verify the promising ones with checkout_repo.',
    );
    expect(prompt).toContain(
      "No results means that source has no match, not that the code does not exist",
    );
    expect(prompt).not.toContain("What's out there");
    expect(prompt).not.toContain("Single-file peek");
  });

  it("sends issue questions to web_fetch and the open web to web_search only when they exist", () => {
    const withWeb = buildLibrarianSystemPrompt("/tmp/pi-librarian", [
      { name: "search_repos_github" },
      { name: "web_search" },
      { name: "web_fetch" },
    ]);
    expect(withWeb).toContain(
      "- \"What's out there / what's popular\": search_repos_github, plus web_search for ecosystem context.",
    );
    expect(withWeb).toContain("- Issues, pull requests, discussions, releases, CI runs: web_fetch");
    expect(withWeb).toContain(
      "- Documentation, announcements, anything not in a repository: web_search, then web_fetch the most relevant sources.",
    );

    const fetchOnly = buildLibrarianSystemPrompt("/tmp/pi-librarian", [
      { name: "search_repos_github" },
      { name: "web_fetch" },
    ]);
    expect(fetchOnly).toContain("- \"What's out there / what's popular\": search_repos_github.");
    expect(fetchOnly).toContain("web_fetch on the GitHub URL");
    expect(fetchOnly).not.toContain("web_search");
  });

  it("leaves search guidance out of a run with no search tools", () => {
    const prompt = buildLibrarianSystemPrompt("/tmp/pi-librarian", [{ name: "checkout_repo" }]);

    expect(prompt).not.toContain("CANDIDATES");
    expect(prompt).not.toContain("No results means");
    expect(prompt).not.toContain("Callers of a symbol");
  });

  it("renders each active tool's guidelines as its rules", () => {
    const prompt = buildLibrarianSystemPrompt("/tmp/pi-librarian", [
      { name: "checkout_repo", promptGuidelines: ["Do not clone repositories with git directly."] },
      { name: "provide_results", promptGuidelines: ["Call provide_results last."] },
    ]);

    expect(prompt).toContain(
      "## Tool rules\n\n- Do not clone repositories with git directly.\n- Call provide_results last.",
    );
  });
});
