import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { initTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import type { LibrarianRunDetails, TraceCall } from "../extensions/librarian/run.ts";
import {
  formatToolDuration,
  formatTraceLine,
  relativizeCachePath,
  renderLibrarianResult,
  shorten,
} from "../extensions/librarian/view.ts";

const CACHE = "/home/user/.cache/pi-librarian";

// keyHint reads pi's theme singleton, which every real session initializes
beforeAll(() => {
  initTheme();
});

const theme = {
  fg: (_name: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;

function call(name: string, args: unknown): TraceCall {
  return { id: "t1", name, args, startedAt: 0 };
}

describe("formatToolDuration", () => {
  it("formats sub-minute as seconds with one decimal", () => {
    expect(formatToolDuration(3200)).toBe("3.2s");
    expect(formatToolDuration(80)).toBe("0.1s");
    expect(formatToolDuration(0)).toBe("0.0s");
  });

  it("formats minutes and hours with whole seconds, like pi's rows", () => {
    expect(formatToolDuration(72_000)).toBe("1m 12s");
    expect(formatToolDuration(119_600)).toBe("1m 59s");
    expect(formatToolDuration(3_723_000)).toBe("1h 2m 3s");
  });
});

describe("relativizeCachePath", () => {
  it("strips the cache root, host and owner segments", () => {
    expect(
      relativizeCachePath(
        `${CACHE}/repos/github.com/drizzle-team/drizzle-orm/src/session.ts`,
        CACHE,
      ),
    ).toBe("drizzle-orm/src/session.ts");
  });

  it("leaves non-cache paths alone", () => {
    expect(relativizeCachePath("/etc/sources", CACHE)).toBe("/etc/sources");
  });
});

describe("formatTraceLine", () => {
  it("renders read with relativized path and range", () => {
    const line = formatTraceLine(
      call("read", {
        path: `${CACHE}/repos/github.com/drizzle-team/drizzle-orm/src/session.ts`,
        offset: 80,
        limit: 61,
      }),
      CACHE,
    );
    expect(line).toEqual({ verb: "read", subject: "drizzle-orm/src/session.ts:80-140" });
  });

  it("renders bash with normalized truncated command", () => {
    const line = formatTraceLine(call("bash", { command: "git   log -S foo\n--oneline" }), CACHE);
    expect(line).toEqual({ verb: "bash", subject: "git log -S foo --oneline" });
  });

  it("renders grep with quoted pattern and scope", () => {
    const line = formatTraceLine(
      call("grep", { pattern: "prepareQuery", path: `${CACHE}/repos/github.com/a/b/src` }),
      CACHE,
    );
    expect(line).toEqual({ verb: "grep", subject: '"prepareQuery" b/src' });
  });

  it("renders search_code with scope", () => {
    const line = formatTraceLine(call("search_code", { pattern: "/foo/", repo: "a/b" }), CACHE);
    expect(line).toEqual({ verb: "search", subject: "code /foo/ in a/b" });
  });

  it("renders search_github_code with scope", () => {
    const line = formatTraceLine(
      call("search_github_code", {
        pattern: "foo",
        repos: [{ owner: "a", repo: "b" }],
        owners: ["org"],
      }),
      CACHE,
    );
    expect(line).toEqual({ verb: "search.gh", subject: "code foo in a/b,org/*" });
  });

  it("renders checkout_repo with source and ref", () => {
    const line = formatTraceLine(
      call("checkout_repo", { repo: "a/b", source: "github", ref: "v2" }),
      CACHE,
    );
    expect(line).toEqual({ verb: "checkout", subject: "github:a/b@v2" });
  });

  it("renders read_github_file as repo/path", () => {
    const line = formatTraceLine(
      call("read_github_file", { owner: "a", repo: "b", path: "package.json" }),
      CACHE,
    );
    expect(line).toEqual({ verb: "read.gh", subject: "a/b/package.json" });
  });

  it("falls back to first string arg for unknown tools", () => {
    const line = formatTraceLine(call("web_search", { objective: "orm comparison" }), CACHE);
    expect(line).toEqual({ verb: "web_search", subject: "orm comparison" });
  });
});

describe("renderLibrarianResult", () => {
  function completedResult(): AgentToolResult<LibrarianRunDetails> {
    const query = "What does the librarian do when the question is long enough to truncate?";
    return {
      content: [{ type: "text", text: "Answer" }],
      details: {
        status: "done",
        query,
        modelLabel: "test/model",
        thinkingLevel: "high",
        trace: [
          {
            id: "t1",
            name: "search_code",
            args: { pattern: "librarian" },
            startedAt: 0,
            endedAt: 10,
            resultSummary: "1 hits · 1 repos · grep.app",
          },
        ],
        findings: {
          summary: "The librarian researches repositories.",
          locations: [],
          description: "Details\nIt checks evidence before answering.",
        },
        checkouts: {},
        runId: "run-123",
        startedAt: 0,
        endedAt: 10,
      },
    };
  }

  it("replaces trace lines with full findings after completion when expanded", () => {
    const rendered = renderLibrarianResult(
      completedResult(),
      { expanded: true, isPartial: false },
      theme,
      CACHE,
    )
      .render(120)
      .join("\n");

    expect(rendered).toContain("What does the librarian do");
    expect(rendered).toContain("The librarian researches repositories.");
    expect(rendered).toContain("It checks evidence before answering.");
    expect(rendered).not.toContain("code librarian");
    expect(rendered).not.toContain("grep.app");
  });

  it("shows only the summary after completion when collapsed", () => {
    const rendered = renderLibrarianResult(
      completedResult(),
      { expanded: false, isPartial: false },
      theme,
      CACHE,
    )
      .render(120)
      .join("\n");

    expect(rendered).toContain("The librarian researches repositories.");
    expect(rendered).toContain("run run-123");
    expect(rendered).toContain("1 tool call · 0.0s · test/model (high)");
    expect(rendered).toContain("details hidden");
    expect(rendered).toContain("to expand");
    expect(rendered).not.toContain("\n  1 tool call");
    expect(rendered).not.toContain("It checks evidence before answering.");
  });

  it("times running calls as elapsed and finished calls by their recorded duration", () => {
    const now = Date.now();
    const rendered = renderLibrarianResult(
      {
        content: [{ type: "text", text: "Researching" }],
        details: {
          status: "running",
          query: "How long did each call take?",
          modelLabel: "test/model",
          thinkingLevel: "high",
          trace: [
            {
              id: "recorded",
              name: "checkout_repo",
              args: { repo: "a/recorded" },
              startedAt: now - 5_000,
              endedAt: now - 5_000,
              durationMs: 90_400,
            },
            {
              id: "never-ran",
              name: "checkout_repo",
              args: { repo: "a/never-ran" },
              startedAt: now - 3_000,
              endedAt: now - 700,
              isError: true,
            },
            {
              id: "running",
              name: "checkout_repo",
              args: { repo: "a/running" },
              startedAt: now - 2_000,
            },
          ],
          checkouts: {},
          startedAt: now - 5_000,
        },
      },
      { expanded: true, isPartial: true },
      theme,
      CACHE,
    )
      .render(120)
      .join("\n");

    expect(rendered).toMatch(/a\/recorded · Took 1m 30s/);
    expect(rendered).toMatch(/a\/never-ran · Took 2\.3s/);
    expect(rendered).toMatch(/a\/running · Elapsed 2\.\ds/);
  });

  it("clears a reused result component before rendering", () => {
    const staleContainer = new Container();
    staleContainer.addChild(new Text("stale trace row", 0, 0));

    const rendered = renderLibrarianResult(
      completedResult(),
      { expanded: false, isPartial: false },
      theme,
      CACHE,
      {
        lastComponent: staleContainer,
      },
    )
      .render(120)
      .join("\n");

    expect(rendered).not.toContain("stale trace row");
    expect(rendered).toContain("The librarian researches repositories.");
  });

  it("renders thrown tool errors without run details", () => {
    const rendered = renderLibrarianResult(
      {
        content: [{ type: "text", text: "Librarian run failed: boom" }],
        details: {},
      } as AgentToolResult<LibrarianRunDetails>,
      { expanded: false, isPartial: false },
      theme,
      CACHE,
    )
      .render(120)
      .join("\n");

    expect(rendered).toContain("Librarian run failed: boom");
  });
});

describe("shorten", () => {
  it("collapses whitespace and truncates with ellipsis", () => {
    expect(shorten("a  b\n\nc", 100)).toBe("a b c");
    expect(shorten("abcdef", 3)).toBe("abc…");
  });
});
