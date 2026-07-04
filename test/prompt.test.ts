import { describe, expect, it } from "vitest";
import { buildLibrarianUserPrompt } from "../extensions/librarian/prompt.ts";

describe("buildLibrarianUserPrompt", () => {
  it("explains that repository and owner scopes are grounding, not hard limits", () => {
    const prompt = buildLibrarianUserPrompt("Find implementations", ["a/b"], ["org"]);

    expect(prompt).toContain("Repository scope: a/b");
    expect(prompt).toContain("Owner scope: org");
    expect(prompt).toContain("not a hard boundary");
  });
});
