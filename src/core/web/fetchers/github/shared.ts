import { Type } from "typebox";
import type { GitHubClient } from "../../../github.ts";

// Everything one resolver needs to reach its source and write its document.
export interface GitHubFetchContext {
  client: GitHubClient;
  source: string;
  webUrl: string;
  signal: AbortSignal | undefined;
  artifactDir: string;
}

// GitHub reports a deleted account as a null user.
export const GITHUB_USER_SCHEMA = Type.Union([Type.Object({ login: Type.String() }), Type.Null()]);

export const GIT_ACTOR_SCHEMA = Type.Union([
  Type.Object({ name: Type.Optional(Type.String()), date: Type.Optional(Type.String()) }),
  Type.Null(),
]);

// `open`, `closed/completed`, `closed/merged`, `open/draft`: the state with whatever says how it got
// there. A pull request reports draft or merged in place of a state_reason.
export function formatState(item: {
  state: string;
  state_reason?: string | null | undefined;
  draft?: boolean | undefined;
  pull_request?: { merged_at?: string | null | undefined } | undefined;
}): string {
  const reason = item.pull_request
    ? item.pull_request.merged_at
      ? "merged"
      : item.draft
        ? "draft"
        : undefined
    : item.state_reason;
  return reason ? `${item.state}/${reason}` : item.state;
}

export function truncateUtf8Bytes(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, "utf8");
  if (buffer.byteLength <= maxBytes) return value;

  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let end = maxBytes; end >= 0; end -= 1) {
    try {
      return decoder.decode(buffer.subarray(0, end));
    } catch {
      // Drop the partial code point and try again.
    }
  }
  return "";
}

export function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
