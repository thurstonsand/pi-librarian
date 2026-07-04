import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { type GrepCodeMatch, searchCodeGrep } from "../grep-app.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";

export interface SearchCodeDetails {
  kind: "search_code";
  pattern: string;
  backend: "grep.app";
  matchCount: number;
  repoCount: number;
}

const SearchCodeParams = Type.Object({
  pattern: Type.String({
    description:
      "Public code search pattern. Literal by default; set regex: true to treat it as a regular expression.",
  }),
  regex: Type.Optional(
    Type.Boolean({
      description:
        "Treat pattern as a regular expression. Grep supports multi-line regex with (?s).",
    }),
  ),
  repo: Type.Optional(
    Type.String({
      description:
        "Restrict to a repository or repository prefix, e.g. drizzle-team/drizzle-orm or vercel.",
    }),
  ),
  language: Type.Optional(Type.String({ description: "Restrict to a language, e.g. TypeScript." })),
  path: Type.Optional(
    Type.String({
      description: "Restrict to file paths matching this pattern.",
    }),
  ),
});

function formatGrepMatches(matches: GrepCodeMatch[]): string {
  return matches
    .map((match) => {
      const snippets = match.snippets
        .slice(0, 2)
        .map((snippet) => {
          const lines = snippet.content
            .split("\n")
            .slice(0, 8)
            .map((line, offset) => `    ${snippet.lineNumber + offset}: ${line.trimEnd()}`)
            .join("\n");
          return lines;
        })
        .join("\n");
      const url = match.url ? `\n    ${match.url}` : "";
      return `  ${match.repo}:${match.path}${url}${snippets ? `\n${snippets}` : ""}`;
    })
    .join("\n");
}

export const searchCodeTool = defineTool<typeof SearchCodeParams, SearchCodeDetails>({
  name: LIBRARIAN_TOOL_NAMES.searchCode,
  label: "Search code across repos",
  description: "Cross-repo code search over public source code.",
  promptSnippet: "Search code across repos",
  promptGuidelines: [
    "Results are CANDIDATES to verify via checkout_repo/read_github_file — never cite them directly.",
    "This searches public GitHub code only. Use search_github_code when private repository access matters.",
  ],
  parameters: SearchCodeParams,

  async execute(_toolCallId, params, signal) {
    const result = await searchCodeGrep(
      {
        query: params.pattern,
        ...(params.regex ? { useRegexp: true } : {}),
        ...(params.repo ? { repo: params.repo } : {}),
        ...(params.language ? { language: [params.language] } : {}),
        ...(params.path ? { path: params.path } : {}),
      },
      signal,
    );
    const repoCount = new Set(result.matches.map((match) => match.repo)).size;
    const body =
      result.matches.length === 0
        ? "No matches. Note: private repositories need search_github_code or checkout_repo + grep."
        : formatGrepMatches(result.matches);
    const header = `${result.matches.length} matches across ${repoCount} repos (grep.app).`;

    return {
      content: [{ type: "text", text: `${header}\n\n${body}` }],
      details: {
        kind: "search_code",
        pattern: params.pattern,
        backend: "grep.app",
        matchCount: result.matches.length,
        repoCount,
      },
    };
  },
});
