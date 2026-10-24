import fs from "node:fs/promises";
import path from "node:path";
import { formatSize } from "@earendil-works/pi-coding-agent";

export interface EntryGroup {
  label: string;
  // Present when the group's repositories can be passed to checkout_repo with this source.
  cloneSource: string | undefined;
}

// One result as the digest showed it, carried in details so the attach renderer can show labels
// collapsed and metadata expanded without parsing the digest text back apart.
export interface ShownEntry {
  group?: EntryGroup;
  label: string;
  url?: string;
  revision?: string;
  meta?: string;
  detail?: string;
}

export interface SearchArtifact {
  path: string;
  lineCount: number;
  byteCount: number;
}

// Every search writes its artifact, whatever its size: a contract that changes shape at a size
// threshold is one the model cannot predict.
export async function writeSearchArtifact(
  cacheDir: string,
  toolCallId: string,
  records: object[],
): Promise<SearchArtifact> {
  const directory = path.join(cacheDir, "searches", toolCallId.replace(/[^\w.-]/g, "_"));
  await fs.mkdir(directory, { recursive: true });
  const artifactPath = path.join(directory, "results.jsonl");
  const body = records.map((record) => `${JSON.stringify(record)}\n`).join("");
  await fs.writeFile(artifactPath, body);
  return { path: artifactPath, lineCount: records.length, byteCount: Buffer.byteLength(body) };
}

export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

export function formatArtifact(artifact: SearchArtifact): string {
  return `${artifact.path} (${plural(artifact.lineCount, "line")}, ${formatSize(artifact.byteCount)})`;
}

export interface DigestHeader {
  // What was found, already phrased: "1,284 repositories match", "412 files across 63 repos".
  found: string;
  source: string;
  // undefined for engines that give no completeness signal: their digests stay silent about it.
  complete: boolean | undefined;
  incompleteReason: string | undefined;
  fetchedCount: number;
  limitHit: boolean;
  shownCount: number;
  artifact: SearchArtifact;
}

export function formatDigestHeader(header: DigestHeader): string {
  const completeness =
    header.complete === undefined
      ? ""
      : header.complete
        ? " Complete."
        : ` Incomplete: ${header.incompleteReason ?? "the engine did not cover every repository"}.`;
  const shown =
    header.shownCount === header.fetchedCount
      ? `showing all ${formatCount(header.shownCount)}`
      : `showing ${formatCount(header.shownCount)}`;
  return [
    `${header.found} (${header.source}).${completeness}`,
    `Fetched ${formatCount(header.fetchedCount)}${header.limitHit ? " (limit)" : ""}; ${shown}. Full results: ${formatArtifact(header.artifact)}`,
  ].join("\n");
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

export function formatEntryHeadline(entry: ShownEntry): string {
  return `${entry.label}${entry.revision ? ` (${entry.revision})` : ""}`;
}

export function formatEntries(entries: ShownEntry[]): string {
  const width = String(entries.length).length;
  const lines: string[] = [];
  let currentGroup: string | undefined;
  for (const [index, entry] of entries.entries()) {
    if (entry.group && entry.group.label !== currentGroup) {
      currentGroup = entry.group.label;
      lines.push(
        entry.group.cloneSource
          ? `${entry.group.label} — clone with source: ${entry.group.cloneSource}`
          : entry.group.label,
      );
    }
    const number = `${String(index + 1).padStart(width)}.`;
    lines.push(` ${number} ${formatEntryHeadline(entry)}${entry.meta ? ` — ${entry.meta}` : ""}`);
    if (entry.detail) {
      lines.push(indent(entry.detail, " ".repeat(width + 3)));
    }
  }
  return lines.join("\n");
}

export function formatDigest(header: DigestHeader, entries: ShownEntry[]): string {
  const headerText = formatDigestHeader(header);
  return entries.length === 0 ? headerText : `${headerText}\n\n${formatEntries(entries)}`;
}
