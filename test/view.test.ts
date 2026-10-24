import { stripVTControlCharacters } from "node:util";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { initTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import type { LibrarianRunDetails, TraceCall } from "../extensions/librarian/run.ts";
import { resolveLibrarianSettings } from "../extensions/librarian/settings.ts";
import { summarizeToolResult } from "../extensions/librarian/trace.ts";
import {
  formatToolDuration,
  formatTraceLine,
  relativizeCachePath,
  renderLibrarianResult,
  renderRepoToolResult,
  shorten,
  type TraceContext,
} from "../extensions/librarian/view.ts";

const CACHE = "/home/user/.cache/pi-librarian";
const CTX: TraceContext = {
  cacheDir: CACHE,
  impliedSources: new Map([
    ["search_code_github", "github"],
    ["search_code_grepapp", "grep.app"],
    ["search_repos_github", "github"],
    ["read_file", "github"],
  ]),
  sources: [],
};

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
      CTX,
    );
    expect(line).toEqual({ verb: "read", subject: "drizzle-orm/src/session.ts:80-140" });
  });

  it("renders bash with normalized truncated command", () => {
    const line = formatTraceLine(call("bash", { command: "git   log -S foo\n--oneline" }), CTX);
    expect(line).toEqual({ verb: "bash", subject: "git log -S foo --oneline" });
  });

  it("renders grep with quoted pattern and scope", () => {
    const line = formatTraceLine(
      call("grep", { pattern: "prepareQuery", path: `${CACHE}/repos/github.com/a/b/src` }),
      CTX,
    );
    expect(line).toEqual({ verb: "grep", subject: '"prepareQuery" b/src' });
  });

  it("names the implied source and scope for a code search", () => {
    expect(
      formatTraceLine(call("search_code_grepapp", { pattern: "/foo/", repo: "a/b" }), CTX),
    ).toEqual({ verb: "search", subject: "code /foo/ in grep.app:a/b" });
    expect(
      formatTraceLine(
        call("search_code_github", {
          pattern: "defineConfig",
          owner: "drizzle-team",
          repos: ["drizzle-orm"],
        }),
        CTX,
      ),
    ).toEqual({ verb: "search", subject: "code defineConfig in github:drizzle-team/drizzle-orm" });
  });

  it("prefers an explicit source over the implied one", () => {
    expect(
      formatTraceLine(
        call("search_code_sourcegraph", { pattern: "computeBackoff", source: "example-sg" }),
        CTX,
      ),
    ).toEqual({ verb: "search", subject: "code computeBackoff in example-sg" });
  });

  it("renders a repo search's filters, free text first", () => {
    expect(
      formatTraceLine(
        call("search_repos_github", {
          text: "orm",
          language: "typescript",
          topics: ["sql", "orm"],
          limit: 20,
        }),
        CTX,
      ),
    ).toEqual({
      verb: "search",
      subject: "repos orm language:typescript topics:sql,orm in github",
    });
  });

  it("renders checkout_repo with source and ref", () => {
    const line = formatTraceLine(
      call("checkout_repo", { repo: "a/b", source: "github", ref: "v2" }),
      CTX,
    );
    expect(line).toEqual({ verb: "checkout", subject: "github:a/b@v2" });
  });

  it("renders read_file as source:repo/path with ref and range", () => {
    expect(
      formatTraceLine(
        call("read_file", {
          repo: "a/b",
          path: "src/x.ts",
          ref: "a1b2c3d",
          offset: 2001,
          limit: 100,
        }),
        CTX,
      ),
    ).toEqual({ verb: "read", subject: "github:a/b/src/x.ts@a1b2c3d:2001-2100" });
  });

  it("renders find_definition with its kind", () => {
    expect(
      formatTraceLine(
        call("find_definition", { symbol: "NewClient", kind: "function", source: "example-sg" }),
        CTX,
      ),
    ).toEqual({ verb: "definition", subject: "function NewClient in example-sg" });
  });

  it("shortens a search artifact path to its place under the cache", () => {
    expect(
      formatTraceLine(call("read", { path: `${CACHE}/searches/tc_1/results.jsonl` }), CTX),
    ).toEqual({ verb: "read", subject: "searches/tc_1/results.jsonl" });
  });

  it("falls back to first string arg for unknown tools", () => {
    const line = formatTraceLine(call("web_search", { objective: "orm comparison" }), CTX);
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

  it("links each expanded location to its file on the source's host, at the commit read", () => {
    const result = completedResult();
    if (!result.details) {
      throw new Error("fixture has details");
    }
    result.details.findings = {
      summary: "Backoff lives in one place.",
      locations: [
        {
          source: "example-gl",
          repo: "platform/widget-sdk",
          file: "src/retry.ts",
          lines: "29-44",
          note: "full jitter",
        },
      ],
    };
    result.details.checkouts = {
      "gitlab.example.com/platform/widget-sdk": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    };
    const { sources } = resolveLibrarianSettings(
      { sources: [{ name: "example-gl", url: "https://gitlab.example.com", kind: "gitlab" }] },
      {},
    );

    const rendered = renderLibrarianResult(result, { expanded: true, isPartial: false }, theme, {
      ...CTX,
      sources,
    })
      .render(200)
      .map((line) => stripVTControlCharacters(line).trimEnd());

    expect(rendered.slice(4, 6)).toEqual([
      "- example-gl:platform/widget-sdk/src/retry.ts:29-44 — full jitter",
      "  https://gitlab.example.com/platform/widget-sdk/-/blob/a1b2c3d4e5f6/src/retry.ts#L29-44",
    ]);
  });

  it("replaces trace lines with full findings after completion when expanded", () => {
    const rendered = renderLibrarianResult(
      completedResult(),
      { expanded: true, isPartial: false },
      theme,
      CTX,
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
      CTX,
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
      CTX,
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
      CTX,
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
      CTX,
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

describe("renderRepoToolResult", () => {
  const entries = Array.from({ length: 7 }, (_, index) => ({
    group: { label: "example-bb", cloneSource: "example-bb" },
    label: `PROJ/repo-${index + 1} — src/retry.ts`,
    revision: "a1b2c3d",
    detail: `${30 + index}: export function computeBackoff(`,
  }));
  const result: AgentToolResult<unknown> = {
    content: [{ type: "text", text: "digest" }],
    details: {
      kind: "search_code_github",
      source: "example-sg",
      unit: "files",
      matchCount: 412,
      repoCount: 63,
      fetchedCount: 7,
      shownCount: 7,
      complete: false,
      artifact: {
        path: "/tmp/pi-librarian/searches/tc_1/results.jsonl",
        lineCount: 7,
        byteCount: 2048,
      },
      entries,
    },
  };
  const context = (overrides: { isError?: boolean; durationMs?: number | undefined }) => ({
    state: {},
    executionStarted: true,
    isError: false,
    durationMs: 1700,
    invalidate: () => {},
    ...overrides,
  });
  const lines = (component: { render(width: number): string[] }) =>
    component.render(200).map((line) => stripVTControlCharacters(line).trimEnd());

  it("shows the summary and the first five entries when collapsed", () => {
    expect(
      lines(
        renderRepoToolResult(
          "search_code_github",
          result,
          { expanded: false, isPartial: false },
          theme,
          context({}),
        ),
      ),
    ).toEqual([
      "412 files · 63 repos, incomplete",
      "example-bb",
      " 1. PROJ/repo-1 — src/retry.ts",
      " 2. PROJ/repo-2 — src/retry.ts",
      " 3. PROJ/repo-3 — src/retry.ts",
      " 4. PROJ/repo-4 — src/retry.ts",
      " 5. PROJ/repo-5 — src/retry.ts",
      expect.stringMatching(/^ … 2 more \(.*to expand\)$/),
      "Took 1.7s",
    ]);
  });

  it("adds revisions, matched lines, and the artifact when expanded", () => {
    const rendered = lines(
      renderRepoToolResult(
        "search_code_github",
        result,
        { expanded: true, isPartial: false },
        theme,
        context({}),
      ),
    );
    expect(rendered.slice(0, 4)).toEqual([
      "412 files · 63 repos, incomplete",
      "example-bb",
      " 1. PROJ/repo-1 — src/retry.ts (a1b2c3d)",
      "    30: export function computeBackoff(",
    ]);
    expect(rendered.slice(-2)).toEqual([
      "Full results: /tmp/pi-librarian/searches/tc_1/results.jsonl (7 lines, 2.0KB)",
      "Took 1.7s",
    ]);
  });

  it("shows a verb and a live counter while running, and the error when failed", () => {
    expect(
      lines(
        renderRepoToolResult(
          "checkout_repo",
          result,
          { expanded: false, isPartial: true },
          theme,
          context({ durationMs: undefined }),
        ),
      ),
    ).toEqual([expect.stringMatching(/^Cloning… Elapsed \d+\.\ds$/)]);
    expect(
      lines(
        renderRepoToolResult(
          "search_code_github",
          {
            content: [{ type: "text", text: "15s limit hit; 212 files in 40 repos found." }],
            details: undefined,
          },
          { expanded: false, isPartial: false },
          theme,
          context({ isError: true, durationMs: 15_400 }),
        ),
      ),
    ).toEqual(["15s limit hit; 212 files in 40 repos found.", "Took 15.4s"]);
  });
});

describe("summarizeToolResult", () => {
  it("singularizes a code search's unit", () => {
    const details = {
      kind: "search_code_github",
      source: "github",
      unit: "files",
      matchCount: 1,
      repoCount: 1,
      fetchedCount: 1,
      shownCount: 1,
      complete: undefined,
      artifact: { path: "/tmp/x", lineCount: 1, byteCount: 1 },
      entries: [],
    };
    expect(summarizeToolResult({ content: [], details }, false)).toBe("1 file · 1 repo");
    expect(
      summarizeToolResult(
        { content: [], details: { ...details, unit: "matches", matchCount: 1204, repoCount: 63 } },
        false,
      ),
    ).toBe("1,204 matches · 63 repos");
  });
});
