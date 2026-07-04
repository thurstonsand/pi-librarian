import { describe, expect, it } from "vitest";
import { createProvideResultsTool } from "../extensions/librarian/tools/provide-results.ts";

describe("provide_results", () => {
  it("terminates the turn after recording findings", async () => {
    const tool = createProvideResultsTool(() => {});
    const result = await tool.execute(
      "call-1",
      { summary: "Done.", locations: [] },
      undefined,
      undefined,
      {} as never,
    );

    expect(result.terminate).toBe(true);
  });
});
