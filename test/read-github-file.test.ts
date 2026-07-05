import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { GitHubClientApi, ReadContentsParams } from "../extensions/librarian/github.ts";
import { createReadGitHubFileTool } from "../extensions/librarian/tools/read-github-file.ts";

function context(): ExtensionContext {
  return {} as ExtensionContext;
}

function unavailable(method: string): never {
  throw new Error(`${method} should not be called`);
}

function githubWithText(text: string): GitHubClientApi {
  return {
    searchRepositories: async () => unavailable("searchRepositories"),
    searchCode: async () => unavailable("searchCode"),
    readContents: async () => ({ kind: "file", text }),
    getRepo: async () => unavailable("getRepo"),
  };
}

describe("read_github_file schema", () => {
  it("uses native-read-like offset and limit parameters", () => {
    const tool = createReadGitHubFileTool(async () => {
      throw new Error("not used");
    });

    expect(tool.parameters.properties.offset).toMatchObject({ type: "number", minimum: 1 });
    expect(tool.parameters.properties.limit).toMatchObject({ type: "number", minimum: 1 });
    expect(tool.parameters.properties).not.toHaveProperty("range");
  });

  it("rejects invalid offset and limit before loading the GitHub client", async () => {
    const tool = createReadGitHubFileTool(async () => {
      throw new Error("github client should not be loaded for invalid read bounds");
    });

    await expect(
      tool.execute(
        "tool-call-id",
        { owner: "owner", repo: "repo", path: "README.md", offset: 0 },
        undefined,
        undefined,
        context(),
      ),
    ).rejects.toThrow("offset must be greater than or equal to 1.");

    await expect(
      tool.execute(
        "tool-call-id",
        { owner: "owner", repo: "repo", path: "README.md", limit: 0 },
        undefined,
        undefined,
        context(),
      ),
    ).rejects.toThrow("limit must be greater than or equal to 1.");
  });

  it("reads from the requested offset and limit", async () => {
    const tool = createReadGitHubFileTool(async () => githubWithText("one\ntwo\nthree\nfour"));

    const result = await tool.execute(
      "tool-call-id",
      { owner: "owner", repo: "repo", path: "README.md", offset: 2, limit: 2 },
      undefined,
      undefined,
      context(),
    );

    expect(result.content).toEqual([
      { type: "text", text: "two\nthree\n\n[1 more lines in file. Use offset=4 to continue.]" },
    ]);
    expect(result.details).toMatchObject({ lineCount: 2, isDirectory: false });
  });

  it("reports offset past EOF like the native read tool", async () => {
    const tool = createReadGitHubFileTool(async () => githubWithText("one\ntwo"));

    await expect(
      tool.execute(
        "tool-call-id",
        { owner: "owner", repo: "repo", path: "README.md", offset: 3 },
        undefined,
        undefined,
        context(),
      ),
    ).rejects.toThrow("Offset 3 is beyond end of file (2 lines total)");
  });

  it("clips large files and gives an offset continuation", async () => {
    const text = Array.from({ length: 2001 }, (_, index) => `line ${index + 1}`).join("\n");
    const tool = createReadGitHubFileTool(async () => githubWithText(text));

    const result = await tool.execute(
      "tool-call-id",
      { owner: "owner", repo: "repo", path: "README.md" },
      undefined,
      undefined,
      context(),
    );

    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("[Showing lines 1-2000 of 2001. Use offset=2001 to continue.]"),
    });
  });

  it("passes ref through to the GitHub client", async () => {
    let observedRef: string | undefined;
    const tool = createReadGitHubFileTool(async () => ({
      searchRepositories: async () => unavailable("searchRepositories"),
      searchCode: async () => unavailable("searchCode"),
      readContents: async (params: ReadContentsParams) => {
        observedRef = params.ref;
        return { kind: "file", text: "contents" };
      },
      getRepo: async () => unavailable("getRepo"),
    }));

    await tool.execute(
      "tool-call-id",
      { owner: "owner", repo: "repo", path: "README.md", ref: "abc123" },
      undefined,
      undefined,
      context(),
    );

    expect(observedRef).toBe("abc123");
  });
});
