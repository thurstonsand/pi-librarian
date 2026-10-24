import { describe, expect, it } from "vitest";
import {
  buildLibrarianSystemPrompt,
  buildLibrarianUserPrompt,
} from "../extensions/librarian/prompt.ts";

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
    expect(prompt).not.toContain("What's out there");
    expect(prompt).not.toContain("Single-file peek");
  });

  it("leaves search guidance out of a run with no search tools", () => {
    const prompt = buildLibrarianSystemPrompt("/tmp/pi-librarian", [{ name: "checkout_repo" }]);

    expect(prompt).not.toContain("CANDIDATES");
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

describe("buildLibrarianUserPrompt", () => {
  it("explains that repository and owner scopes are grounding, not hard limits", () => {
    const prompt = buildLibrarianUserPrompt("Find implementations", ["a/b"], ["org"]);

    expect(prompt).toContain("Repository scope: a/b");
    expect(prompt).toContain("Owner scope: org");
    expect(prompt).toContain("not a hard boundary");
  });
});
