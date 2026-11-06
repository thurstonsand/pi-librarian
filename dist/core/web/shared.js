import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
export function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function summarizeExcerpt(text, maxLength = 220) {
    if (!text)
        return "";
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength)
        return normalized;
    return `${normalized.slice(0, maxLength - 1)}…`;
}
export function formatWarnings(warnings) {
    if (!warnings?.length)
        return [];
    return warnings
        .map((warning) => {
        const type = warning.type ? `[${warning.type}] ` : "";
        const message = warning.message.trim();
        return message ? `${type}${message}` : undefined;
    })
        .filter((warning) => Boolean(warning));
}
export function slugify(value) {
    return value
        .toLowerCase()
        .replace(/https?:\/\//g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}
export async function writeDocumentBody(artifactDir, url, name, content) {
    const filePath = path.join(artifactDir, slugify(url) || "document", safeArtifactName(name));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
    return {
        name,
        path: filePath,
        lines: countLines(content),
        bytes: Buffer.isBuffer(content) ? content.byteLength : Buffer.byteLength(content, "utf8"),
    };
}
function countLines(content) {
    if (Buffer.isBuffer(content))
        return 0;
    if (content.length === 0)
        return 0;
    let lines = 1;
    for (let index = 0; index < content.length; index += 1) {
        if (content.charCodeAt(index) === 10)
            lines += 1;
    }
    if (content.endsWith("\n"))
        lines -= 1;
    return lines;
}
function safeArtifactName(name) {
    const normalized = path.normalize(name).replace(/^([/\\])+/, "");
    const parts = normalized.split(path.sep).filter((part) => part && part !== "." && part !== "..");
    return parts.join(path.sep) || "body";
}
