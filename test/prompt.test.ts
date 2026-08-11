import { describe, expect, it } from "vitest";
import {
  buildLibrarianSystemPrompt,
  buildLibrarianUserPrompt,
} from "../extensions/librarian/prompt.ts";

describe("buildLibrarianSystemPrompt", () => {
  it("points at the cache layout without restating tool arguments", () => {
    const prompt = buildLibrarianSystemPrompt("/tmp/pi-librarian");

    expect(prompt).toContain("/tmp/pi-librarian/repos/<host>/<path>");
    expect(prompt).not.toContain("source");
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
