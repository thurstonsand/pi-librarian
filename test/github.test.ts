import { afterEach, describe, expect, it, vi } from "vitest";
import { createGitHubClient } from "../extensions/librarian/github.ts";

describe("createGitHubClient logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stays silent when GitHub returns a deprecation header", async () => {
    // A console.warn here corrupts pi's interactive TUI; @octokit/request reads
    // its logger from the per-request options, not the Octokit constructor's
    // top-level `log`, so this exercises the full request path.
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { total_count: 0, incomplete_results: false, items: [] },
          {
            status: 200,
            headers: {
              deprecation: "Sat, 27 Mar 2026 00:00:00 GMT",
              sunset: "Sun, 27 Sep 2026 00:00:00 GMT",
              link: '<https://github.blog/changelog/deprecation>; rel="deprecation"',
            },
          },
        ),
      ),
    );

    const client = createGitHubClient(undefined);
    const result = await client.searchCode({ pattern: "spawn_agent", limit: 10 });

    expect(result).toEqual({ totalCount: 0, hits: [] });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
