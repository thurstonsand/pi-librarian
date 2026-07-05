import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { GitHubApiError, type GitHubClientProvider } from "../github.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";

const MAX_LINES_WITHOUT_RANGE = 1200;

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
  path: Type.String({ description: "File or directory path within the repository." }),
  ref: Type.Optional(
    Type.String({ description: "Branch, tag, or commit sha. Default: the default branch." }),
  ),
  range: Type.Optional(
    Type.Array(Type.Number({ minimum: 1 }), {
      description: "[startLine, endLine] (1-based, inclusive) for large files.",
      minItems: 2,
      maxItems: 2,
    }),
  ),
});

export function createReadGitHubFileTool(githubClient: GitHubClientProvider) {
  return defineTool<typeof ReadGitHubFileParams, ReadGitHubFileDetails>({
    name: LIBRARIAN_TOOL_NAMES.readGitHubFile,
    label: "Read GitHub file",
    description:
      "Read a single file (or list a directory) from a GitHub repo via the API, without cloning.",
    promptSnippet: "Read Github file",
    promptGuidelines: [
      "For quick peeks — package.json, a README, one source file.",
      "For multi-file exploration prefer checkout_repo.",
    ],
    parameters: ReadGitHubFileParams,

    async execute(_toolCallId, params) {
      const range = params.range ? (params.range as [number, number]) : undefined;
      if (range && range[1] < range[0]) {
        throw new Error("range end must be greater than or equal to range start.");
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
        let start = 1;
        let end = allLines.length;
        let clipNote = "";

        if (range) {
          start = Math.min(range[0], allLines.length);
          end = Math.min(range[1], allLines.length);
        } else if (allLines.length > MAX_LINES_WITHOUT_RANGE) {
          end = MAX_LINES_WITHOUT_RANGE;
          clipNote = `\n... clipped at line ${MAX_LINES_WITHOUT_RANGE} of ${allLines.length}; pass range to read further.`;
        }

        const width = String(end).length;
        const numbered = allLines
          .slice(start - 1, end)
          .map((line, index) => `${String(start + index).padStart(width)}\t${line}`)
          .join("\n");

        return {
          content: [{ type: "text", text: `${numbered}${clipNote}` }],
          details: {
            kind: "read_github_file",
            owner: params.owner,
            repo: params.repo,
            path: params.path,
            lineCount: end - start + 1,
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
