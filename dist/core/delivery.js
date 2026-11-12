import fs from "node:fs/promises";
import path from "node:path";
import { formatSize } from "./truncate.js";
// Every search writes its artifact, whatever its size: a contract that changes shape at a size
// threshold is one the model cannot predict.
export async function writeSearchArtifact(cacheDir, toolCallId, records) {
    const directory = path.join(cacheDir, "searches", toolCallId.replace(/[^\w.-]/g, "_"));
    await fs.mkdir(directory, { recursive: true });
    const artifactPath = path.join(directory, "results.jsonl");
    const body = records.map((record) => `${JSON.stringify(record)}\n`).join("");
    await fs.writeFile(artifactPath, body);
    return { path: artifactPath, lineCount: records.length, byteCount: Buffer.byteLength(body) };
}
const MAX_LINE_CHARS = 200;
// A matched line can be a whole paragraph of prose or minified code; the artifact keeps it whole.
export function clipLine(text) {
    const trimmed = text.trimEnd();
    return trimmed.length <= MAX_LINE_CHARS ? trimmed : `${trimmed.slice(0, MAX_LINE_CHARS)}…`;
}
export function formatCount(count) {
    return count.toLocaleString("en-US");
}
export function plural(count, singular, pluralForm = `${singular}s`) {
    return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}
export function formatArtifact(artifact) {
    return `${artifact.path} (${plural(artifact.lineCount, "line")}, ${formatSize(artifact.byteCount)})`;
}
export function formatDigestHeader(header) {
    const completeness = header.complete === undefined
        ? ""
        : header.complete
            ? " Complete."
            : ` Incomplete: ${header.incompleteReason ?? "the engine did not cover every repository"}.`;
    const shown = header.shownCount === header.fetchedCount
        ? `showing all ${formatCount(header.shownCount)}`
        : `showing ${formatCount(header.shownCount)}`;
    return [
        `${header.found} (${header.source}).${completeness}`,
        `Fetched ${formatCount(header.fetchedCount)}${header.limitHit ? " (limit)" : ""}; ${shown}. Full results: ${formatArtifact(header.artifact)}`,
    ].join("\n");
}
function indent(text, prefix) {
    return text
        .split("\n")
        .map((line) => `${prefix}${line}`)
        .join("\n");
}
export function formatEntryHeadline(entry) {
    return `${entry.label}${entry.revision ? ` (${entry.revision})` : ""}`;
}
export function formatEntries(entries) {
    const width = String(entries.length).length;
    const lines = [];
    let currentGroup;
    for (const [index, entry] of entries.entries()) {
        if (entry.group && entry.group.label !== currentGroup) {
            currentGroup = entry.group.label;
            lines.push(entry.group.cloneSource
                ? `${entry.group.label} — clone with source: ${entry.group.cloneSource}`
                : entry.group.label);
        }
        const number = `${String(index + 1).padStart(width)}.`;
        lines.push(` ${number} ${formatEntryHeadline(entry)}${entry.meta ? ` — ${entry.meta}` : ""}`);
        if (entry.detail) {
            lines.push(indent(entry.detail, " ".repeat(width + 3)));
        }
    }
    return lines.join("\n");
}
export function formatDigest(header, entries) {
    const headerText = formatDigestHeader(header);
    return entries.length === 0 ? headerText : `${headerText}\n\n${formatEntries(entries)}`;
}
