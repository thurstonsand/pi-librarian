export class EntryNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "EntryNotFoundError";
    }
}
export class EntryTooLargeError extends Error {
    size;
    constructor(size) {
        super(`File is ${size} bytes.`);
        this.size = size;
        this.name = "EntryTooLargeError";
    }
}
// GitLab and Bitbucket report that an entry is a submodule but not where it points; .gitmodules does.
export function submoduleUrl(gitmodules, path) {
    let sectionPath;
    let sectionUrl;
    for (const rawLine of [...gitmodules.split("\n"), "[end]"]) {
        const line = rawLine.trim();
        if (line.startsWith("[")) {
            if (sectionPath === path && sectionUrl) {
                return sectionUrl;
            }
            sectionPath = undefined;
            sectionUrl = undefined;
            continue;
        }
        const setting = /^(path|url)\s*=\s*(.+)$/.exec(line);
        if (setting?.[1] === "path") {
            sectionPath = setting[2];
        }
        else if (setting?.[1] === "url") {
            sectionUrl = setting[2];
        }
    }
    return undefined;
}
