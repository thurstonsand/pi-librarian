// Mirrors pi's read-tool limits and truncation, so a read_file page matches what pi's own read
// tool would show.
export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024;
export function formatSize(bytes) {
    if (bytes < 1024) {
        return `${bytes}B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)}KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
// Keeps whole lines from the top until either limit is reached.
export function truncateHead(content) {
    const lines = content.length === 0 ? [] : content.split("\n");
    if (content.endsWith("\n")) {
        lines.pop();
    }
    if (lines.length <= DEFAULT_MAX_LINES &&
        Buffer.byteLength(content, "utf-8") <= DEFAULT_MAX_BYTES) {
        return {
            content,
            truncated: false,
            truncatedBy: null,
            outputLines: lines.length,
            firstLineExceedsLimit: false,
        };
    }
    if (Buffer.byteLength(lines[0] ?? "", "utf-8") > DEFAULT_MAX_BYTES) {
        return {
            content: "",
            truncated: true,
            truncatedBy: "bytes",
            outputLines: 0,
            firstLineExceedsLimit: true,
        };
    }
    const kept = [];
    let bytes = 0;
    let truncatedBy = "lines";
    for (const [index, line] of lines.entries()) {
        if (index >= DEFAULT_MAX_LINES) {
            break;
        }
        const lineBytes = Buffer.byteLength(line, "utf-8") + (index > 0 ? 1 : 0);
        if (bytes + lineBytes > DEFAULT_MAX_BYTES) {
            truncatedBy = "bytes";
            break;
        }
        kept.push(line);
        bytes += lineBytes;
    }
    if (kept.length >= DEFAULT_MAX_LINES) {
        truncatedBy = "lines";
    }
    return {
        content: kept.join("\n"),
        truncated: true,
        truncatedBy,
        outputLines: kept.length,
        firstLineExceedsLimit: false,
    };
}
