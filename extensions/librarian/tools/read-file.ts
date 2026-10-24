import {
  DEFAULT_MAX_BYTES,
  defineTool,
  formatSize,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  EntryTooLargeError,
  type RepoDirectoryEntry,
  type RepoEntry,
  type RepoEntryType,
  type RepoFileReader,
} from "../repo-entry.ts";
import type { LibrarianSource } from "../settings.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";
import { selectInstance, sourceProperties } from "./shared.ts";

// Neither host honours ranges, so every offset page would download the whole file again.
export const MAX_READ_BYTES = 5 * 1024 * 1024;
const DEFAULT_LINE_LIMIT = 2000;

export interface ReadFileDetails {
  kind: "read_file";
  source: string;
  repo: string;
  path: string;
  entryType: RepoEntryType;
  shownLines: number;
  totalLines: number;
}

function isBinary(bytes: Buffer): boolean {
  return bytes.subarray(0, 8000).includes(0);
}

function entrySuffix(type: RepoEntryType): string {
  switch (type) {
    case "directory":
      return "/";
    case "symlink":
      return " (symlink)";
    case "submodule":
      return " (submodule)";
    case "file":
      return "";
  }
}

function listing(path: string, entries: RepoDirectoryEntry[]): string {
  const prefix = path.replace(/^\/+|\/+$/g, "");
  return entries
    .map((entry) => `${prefix ? `${prefix}/${entry.name}` : entry.name}${entrySuffix(entry.type)}`)
    .join("\n");
}

interface Page {
  text: string;
  shownLines: number;
  totalLines: number;
}

function page(content: string, offset: number, limit: number): Page {
  const allLines = content.split("\n");
  const startLine = offset - 1;
  if (startLine >= allLines.length) {
    throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total).`);
  }

  const selectedLines = allLines.slice(startLine, Math.min(startLine + limit, allLines.length));
  const truncated = truncateHead(selectedLines.join("\n"));
  if (truncated.firstLineExceedsLimit) {
    const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine] ?? "", "utf-8"));
    return {
      text: `[Line ${offset} is ${firstLineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit.]`,
      shownLines: 0,
      totalLines: allLines.length,
    };
  }

  const shownLines = truncated.truncated ? truncated.outputLines : selectedLines.length;
  const endLine = offset + shownLines - 1;
  if (endLine >= allLines.length) {
    return { text: truncated.content, shownLines, totalLines: allLines.length };
  }
  const limitNote =
    truncated.truncated && truncated.truncatedBy !== "lines"
      ? ` (${formatSize(DEFAULT_MAX_BYTES)} limit)`
      : "";
  return {
    text: `${truncated.content}\n\n[Showing lines ${offset}-${endLine} of ${allLines.length}${limitNote}. Use offset=${endLine + 1} to continue.]`,
    shownLines,
    totalLines: allLines.length,
  };
}

export function createReadFileTool(
  instances: LibrarianSource[],
  readers: Map<string, RepoFileReader>,
) {
  const Params = Type.Object({
    ...sourceProperties(instances, "Source for the code"),
    repo: Type.String({ description: "Repository path, e.g. platform/widget-sdk." }),
    path: Type.String({ description: "File or directory path within the repository." }),
    ref: Type.Optional(
      Type.String({
        description:
          "Branch, tag, or commit. To check a search result, pass its commit so line numbers agree. Default: the default branch.",
      }),
    ),
    offset: Type.Optional(
      Type.Integer({ minimum: 1, description: "Line number to start reading from, 1-based." }),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        description: `Maximum number of lines to read. Default: ${DEFAULT_LINE_LIMIT}.`,
      }),
    ),
  });

  return defineTool<typeof Params, ReadFileDetails>({
    name: LIBRARIAN_TOOL_NAMES.readFile,
    label: "Read file",
    description:
      "Read one file, or list one directory, from a repository without cloning it. Long files come back in pages of up to 2,000 lines; files over about 5 MB and binary files are refused. For exploring several files, cloning is faster.",
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(_toolCallId, params, signal) {
      const instance = selectInstance(instances, params);
      const reader = readers.get(instance.name);
      if (!reader) {
        throw new Error(`No file reader for source "${instance.name}".`);
      }
      const location = `${params.repo}/${params.path}`;
      const details = (entryType: RepoEntryType, shownLines: number, totalLines: number) =>
        ({
          kind: "read_file",
          source: instance.name,
          repo: params.repo,
          path: params.path,
          entryType,
          shownLines,
          totalLines,
        }) satisfies ReadFileDetails;

      let entry: RepoEntry;
      try {
        entry = await reader.readEntry({
          repo: params.repo,
          path: params.path,
          ref: params.ref,
          maxBytes: MAX_READ_BYTES,
          signal,
        });
      } catch (error) {
        if (error instanceof EntryTooLargeError) {
          throw new Error(
            `${location} is ${formatSize(error.size)}, over the ${formatSize(MAX_READ_BYTES)} read limit. Clone it with checkout_repo and read it locally instead.`,
          );
        }
        throw error;
      }

      switch (entry.type) {
        case "directory": {
          const text = listing(params.path, entry.entries);
          return {
            content: [{ type: "text", text: text || "(empty directory)" }],
            details: details("directory", entry.entries.length, entry.entries.length),
          };
        }
        case "symlink":
          return {
            content: [
              {
                type: "text",
                text: `${location} is a symlink to ${entry.target} — read that path instead.`,
              },
            ],
            details: details("symlink", 0, 0),
          };
        case "submodule":
          return {
            content: [
              {
                type: "text",
                text: `${location} is a submodule${entry.url ? ` pointing at ${entry.url}` : ""} — read it from that repository.`,
              },
            ],
            details: details("submodule", 0, 0),
          };
        case "file": {
          if (isBinary(entry.bytes)) {
            throw new Error(
              `${location} is a binary file (${formatSize(entry.size)}); its content would be noise in context.`,
            );
          }
          const result = page(
            entry.bytes.toString("utf-8"),
            params.offset ?? 1,
            params.limit ?? DEFAULT_LINE_LIMIT,
          );
          return {
            content: [{ type: "text", text: result.text }],
            details: details("file", result.shownLines, result.totalLines),
          };
        }
      }
    },
  });
}
