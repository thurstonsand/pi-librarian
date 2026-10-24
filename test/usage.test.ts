import { describe, expect, it } from "vitest";
import type { TraceCall } from "../extensions/librarian/run.ts";
import { summarizeSearchUsage } from "../extensions/librarian/usage.ts";

const call = (name: string, args: unknown): TraceCall => ({ id: name, name, args, startedAt: 0 });

describe("summarizeSearchUsage", () => {
  it("counts searches, reads of their artifacts, and the same search asked again with another limit", () => {
    expect(
      summarizeSearchUsage(
        [
          call("search_code_github", { pattern: "useState", owner: "facebook" }),
          call("read", { path: "/tmp/pi-librarian/searches/tc_1/results.jsonl" }),
          call("grep", { pattern: "hooks", path: "/tmp/pi-librarian/searches/tc_1/results.jsonl" }),
          call("search_code_github", { owner: "facebook", pattern: "useState", limit: 50 }),
          call("find_definition", { symbol: "useState" }),
          call("read", { path: "/tmp/pi-librarian/repos/github.com/facebook/react/README.md" }),
        ],
        "/tmp/pi-librarian",
      ),
    ).toEqual({ searches: 3, artifactReads: 2, repeatedSearches: 1 });
  });
});
