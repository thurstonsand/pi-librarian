import { unlink } from "node:fs/promises";
import path from "node:path";
import { formatSize } from "../../../truncate.js";
import { getErrorMessage, slugify, writeDocumentBody } from "../../shared.js";
export function createLocalFetcher(client, extractor) {
    async function fetchOne(url, artifactDir) {
        const slug = slugify(url) || "document";
        const downloadDir = path.join(artifactDir, slug);
        const result = await client.fetch(url, downloadDir);
        const file = path.join(downloadDir, result.name);
        if (isHtmlContentType(result.contentType)) {
            return buildPageDocument(url, artifactDir, file, result);
        }
        return buildFileDocument(url, file, result);
    }
    async function buildPageDocument(url, artifactDir, file, result) {
        const markdown = (await extractor.extractToMarkdown(file, url)).trim();
        if (!markdown)
            throw new Error(`${extractor.name} extracted no content`);
        const body = await writeDocumentBody(artifactDir, url, "content.md", `${markdown}\n`);
        await unlink(file);
        return {
            kind: "local.page",
            source: "local",
            url,
            ...(result.finalUrl !== url ? { link: result.finalUrl } : {}),
            title: result.title || result.finalUrl,
            facts: result.notes,
            excerpt: markdown,
            bodies: [body],
        };
    }
    function buildFileDocument(url, file, result) {
        return {
            kind: "local.file",
            source: "local",
            url,
            ...(result.finalUrl !== url ? { link: result.finalUrl } : {}),
            title: result.name,
            facts: [result.contentType, formatSize(result.bytes), ...result.notes],
            bodies: [{ name: result.name, path: file, lines: 0, bytes: result.bytes }],
        };
    }
    return {
        source: "local",
        promptGuidelines: [],
        canFetch: isHttpUrl,
        async fetch({ urls, artifactDir, signal }) {
            const documents = [];
            const failures = [];
            await Promise.all(urls.map(async (url) => {
                if (signal?.aborted) {
                    failures.push({ url, reason: "Fetch cancelled." });
                    return;
                }
                try {
                    documents.push(await fetchOne(url, artifactDir));
                }
                catch (error) {
                    failures.push({ url, reason: getErrorMessage(error) });
                }
            }));
            return { documents, failures, warnings: [] };
        },
    };
}
function isHttpUrl(url) {
    try {
        const { protocol } = new URL(url);
        return protocol === "http:" || protocol === "https:";
    }
    catch {
        return false;
    }
}
function isHtmlContentType(contentType) {
    const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
    return mime === "text/html" || mime === "application/xhtml+xml";
}
