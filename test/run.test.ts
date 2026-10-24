import { describe, expect, it } from "vitest";
import { renderFindingsMarkdown } from "../extensions/librarian/results.ts";
import { resolveLibrarianSettings } from "../extensions/librarian/settings.ts";

const { sources } = resolveLibrarianSettings(
  {
    sources: [
      { name: "example-gl", url: "https://gitlab.example.com", kind: "gitlab" },
      { name: "example-bb", url: "https://git.example.com", kind: "bitbucket-server" },
    ],
  },
  {},
);

describe("renderFindingsMarkdown", () => {
  it("names each location's source and links it at the commit that was checked out", () => {
    const markdown = renderFindingsMarkdown(
      {
        summary: "Two services disagree on jitter.",
        locations: [
          {
            source: "github",
            repo: "drizzle-team/drizzle-orm",
            file: "drizzle-orm/src/d1/session.ts",
            lines: "50-72",
            note: "prepareQuery implementation",
          },
          {
            source: "example-gl",
            repo: "platform/widget-sdk",
            file: "src/retry.ts",
            lines: "29-44",
            note: "full jitter",
          },
          {
            source: "example-bb",
            repo: "CORE/deploy-cli",
            file: "internal/backoff.go",
            lines: "12",
            note: "no jitter",
          },
          {
            source: "codeberg.org",
            repo: "acme/retry-kit",
            file: "retry.go",
            note: "cloned by URL from an undeclared host",
          },
        ],
        description: "## Flow\n1. build query",
      },
      {
        "github.com/drizzle-team/drizzle-orm": "48e5406027103a9fca6eb66417187c4a8b5c6aa3",
        "gitlab.example.com/platform/widget-sdk": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
      },
      sources,
    );

    expect(markdown).toBe(`Two services disagree on jitter.

## Locations

- \`github:drizzle-team/drizzle-orm/drizzle-orm/src/d1/session.ts:50-72\` — prepareQuery implementation
  https://github.com/drizzle-team/drizzle-orm/blob/48e540602710/drizzle-orm/src/d1/session.ts#L50-L72
- \`example-gl:platform/widget-sdk/src/retry.ts:29-44\` — full jitter
  https://gitlab.example.com/platform/widget-sdk/-/blob/a1b2c3d4e5f6/src/retry.ts#L29-44
- \`example-bb:CORE/deploy-cli/internal/backoff.go:12\` — no jitter
  https://git.example.com/projects/CORE/repos/deploy-cli/browse/internal/backoff.go#12
- \`codeberg.org:acme/retry-kit/retry.go\` — cloned by URL from an undeclared host

## Flow
1. build query`);
  });

  it("omits the locations section when empty", () => {
    const markdown = renderFindingsMarkdown(
      { summary: "Nothing found.", locations: [] },
      {},
      sources,
    );
    expect(markdown).toBe("Nothing found.");
  });
});
