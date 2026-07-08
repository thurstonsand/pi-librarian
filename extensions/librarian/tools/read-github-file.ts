import {
  DEFAULT_MAX_BYTES,
  defineTool,
  formatSize,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { GitHubApiError, type GitHubClientProvider } from "../github.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";

export interface ReadGitHubFileDetails {
  kind: "read_github_file";
  owner: string;
  repo: string;
  path: string;
  lineCount: number;
  isDirectory: boolean;
}

const ReadGitHubFileParams = Type.Object({
  owner: Type.String({ description: "Repository owner or organization." }),
  repo: Type.String({ description: "Repository name." }),
  path: Type.String({
    description: "File or directory path within the repository.",
  }),
  ref: Type.Optional(
    Type.String({
      description: "Branch, tag, or commit sha. Default: the default branch.",
    }),
  ),
  offset: Type.Optional(
    Type.Number({
      minimum: 1,
      description: "Line number to start reading from (1-indexed).",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      minimum: 1,
      description: "Maximum number of lines to read.",
    }),
  ),
});

export function createReadGitHubFileTool(githubClient: GitHubClientProvider) {
  return defineTool<typeof ReadGitHubFileParams, ReadGitHubFileDetails>({
    name: LIBRARIAN_TOOL_NAMES.readGitHubFile,
    label: "Read GitHub file",
    description: `Read a single file (or list a directory) from a GitHub repo via the API, without cloning.`,
    promptSnippet: "Read a file/directory from GitHub",
    promptGuidelines: [
      "Use read_github_file for quick peeks — package.json, a README, one source file.",
      "For multi-file exploration, prefer checkout_repo over read_github_file.",
      "Use read_github_file's offset/limit for larger files.",
    ],
    parameters: ReadGitHubFileParams,

    async execute(_toolCallId, params) {
      const offset = params.offset ?? 1;
      if (offset < 1) {
        throw new Error("offset must be greater than or equal to 1.");
      }
      if (params.limit !== undefined && params.limit < 1) {
        throw new Error("limit must be greater than or equal to 1.");
      }

      try {
        const github = await githubClient();
        const contents = await github.readContents({
          repo: { owner: params.owner, repo: params.repo },
          path: params.path,
          ref: params.ref,
        });

        if (contents.kind === "directory") {
          const listing = contents.entries
            .map((entry) => `${entry.path}${entry.type === "dir" ? "/" : ""}`)
            .join("\n");
          return {
            content: [{ type: "text", text: listing || "(empty directory)" }],
            details: {
              kind: "read_github_file",
              owner: params.owner,
              repo: params.repo,
              path: params.path,
              lineCount: contents.entries.length,
              isDirectory: true,
            },
          };
        }

        const allLines = contents.text.split("\n");
        const startLine = offset - 1;
        if (startLine >= allLines.length) {
          throw new Error(
            `Offset ${offset} is beyond end of file (${allLines.length} lines total)`,
          );
        }

        const selectedLines =
          params.limit === undefined
            ? allLines.slice(startLine)
            : allLines.slice(startLine, Math.min(startLine + params.limit, allLines.length));
        const selectedContent = selectedLines.join("\n");
        const truncated = truncateHead(selectedContent);
        let text: string;
        let lineCount = truncated.outputLines;

        if (truncated.firstLineExceedsLimit) {
          const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine] ?? "", "utf-8"));
          text = `[Line ${offset} is ${firstLineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit.]`;
        } else if (truncated.truncated) {
          const endLine = offset + truncated.outputLines - 1;
          const nextOffset = endLine + 1;
          const limitNote =
            truncated.truncatedBy === "lines" ? "" : ` (${formatSize(DEFAULT_MAX_BYTES)} limit)`;
          text = `${truncated.content}\n\n[Showing lines ${offset}-${endLine} of ${allLines.length}${limitNote}. Use offset=${nextOffset} to continue.]`;
        } else if (
          params.limit !== undefined &&
          startLine + selectedLines.length < allLines.length
        ) {
          const remaining = allLines.length - (startLine + selectedLines.length);
          const nextOffset = startLine + selectedLines.length + 1;
          text = `${truncated.content}\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
          lineCount = selectedLines.length;
        } else {
          text = truncated.content;
          lineCount = selectedLines.length;
        }

        return {
          content: [{ type: "text", text }],
          details: {
            kind: "read_github_file",
            owner: params.owner,
            repo: params.repo,
            path: params.path,
            lineCount,
            isDirectory: false,
          },
        };
      } catch (error) {
        const message =
          error instanceof GitHubApiError && error.status === 404
            ? `${params.owner}/${params.repo}:${params.path} not found (check the path and ref; private repos need gh auth).`
            : error instanceof Error
              ? error.message
              : String(error);
        throw new Error(message);
      }
    },
  });
}
