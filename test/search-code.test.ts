import { describe, expect, it } from "vitest";
import { buildGitHubCodeQuery } from "../extensions/librarian/tools/search-github-code.ts";

describe("buildGitHubCodeQuery", () => {
  it("strips regex slashes and appends qualifiers", () => {
    const query = buildGitHubCodeQuery({
      pattern: "/prepare\\w+/",
      repos: [{ owner: "a", repo: "b" }],
      language: "typescript",
      path: "src",
    });
    expect(query).toBe("prepare\\w+ repo:a/b language:typescript path:src");
  });

  it("maps owners to user: qualifiers", () => {
    expect(buildGitHubCodeQuery({ pattern: "x", owners: ["vercel"] })).toBe("x user:vercel");
  });
});
