import { describe, expect, it } from "vitest";
import { renderFindingsMarkdown } from "../extensions/librarian/results.ts";

describe("renderFindingsMarkdown", () => {
  it("renders summary, locations with sha-pinned links, and description", () => {
    const markdown = renderFindingsMarkdown(
      {
        summary: "Prepared statements wrap session.prepareQuery.",
        locations: [
          {
            repo: "drizzle-team/drizzle-orm",
            file: "drizzle-orm/src/d1/session.ts",
            lines: "50-72",
            note: "prepareQuery implementation",
          },
          {
            repo: "https://github.com/unknown/repo",
            file: "README.md",
            note: "usage docs",
          },
          {
            repo: "https://gitlab.com/example/repo",
            file: "README.md",
            note: "non-GitHub evidence",
          },
        ],
        description: "## Flow\n1. build query",
      },
      { "drizzle-team/drizzle-orm": "48e5406027103a9fca6eb66417187c4a8b5c6aa3" },
    );

    expect(markdown).toContain("Prepared statements wrap session.prepareQuery.");
    expect(markdown).toContain(
      "`drizzle-team/drizzle-orm/drizzle-orm/src/d1/session.ts:50-72` — prepareQuery implementation",
    );
    expect(markdown).toContain(
      "https://github.com/drizzle-team/drizzle-orm/blob/48e540602710/drizzle-orm/src/d1/session.ts#L50-L72",
    );
    expect(markdown).toContain("https://github.com/unknown/repo/blob/HEAD/README.md");
    expect(markdown).toContain("`https://gitlab.com/example/repo/README.md` — non-GitHub evidence");
    expect(markdown).not.toContain("https://github.com/https://gitlab.com");
    expect(markdown).toContain("## Flow");
  });

  it("omits the locations section when empty", () => {
    const markdown = renderFindingsMarkdown({ summary: "Nothing found.", locations: [] }, {});
    expect(markdown).toBe("Nothing found.");
  });
});
