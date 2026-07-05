import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { createReadGitHubFileTool } from "../extensions/librarian/tools/read-github-file.ts";

describe("read_github_file schema", () => {
  it("uses provider-compatible array bounds for range", () => {
    const tool = createReadGitHubFileTool(async () => {
      throw new Error("not used");
    });

    const schemaJson = JSON.stringify(tool.parameters);
    expect(schemaJson).not.toContain("additionalItems");
    expect(schemaJson).not.toContain('"items":[');
    expect(tool.parameters.properties.range).toMatchObject({
      type: "array",
      minItems: 2,
      maxItems: 2,
    });
  });

  it("rejects ranges whose end is before the start", async () => {
    const tool = createReadGitHubFileTool(async () => {
      throw new Error("github client should not be loaded for an invalid range");
    });

    await expect(
      tool.execute(
        "tool-call-id",
        { owner: "owner", repo: "repo", path: "README.md", range: [10, 5] },
        undefined,
        undefined,
        {} as ExtensionContext,
      ),
    ).rejects.toThrow("range end must be greater than or equal to range start.");
  });
});
