import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { browserProfileDir, settingsPath } from "./paths.js";
// Settings that only the pi binding reads; everything else in the old key is shared by every harness.
const PI_KEYS = new Set(["model", "thinkingLevel", "debug"]);
// Where pi's agent directory is, as pi itself resolves it.
export function piLegacyPaths(env) {
    const configured = env.PI_CODING_AGENT_DIR;
    const agentDir = configured
        ? configured.replace(/^~(?=$|\/)/, os.homedir())
        : path.join(os.homedir(), ".pi", "agent");
    return {
        piSettings: path.join(agentDir, "settings.json"),
        browserProfile: path.join(agentDir, "browser-profile"),
    };
}
export function librarianPaths(env) {
    return { settings: settingsPath(env), browserProfile: browserProfileDir(env) };
}
// Earlier releases kept the librarian's settings under a `librarian` key in pi's settings and the
// browser profile in pi's agent directory. Both move once, on the first load by either binding
// after an upgrade, since Claude or Codex may run before pi does. When the destination already
// exists the move fails instead of choosing one, since either side may hold edits the other lacks.
// Returns what moved, for the binding to report.
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
// Pi accepts a byte-order mark, so a file it reads must not break the librarian.
function readPiSettings(file) {
    let parsed;
    try {
        parsed = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    }
    catch (error) {
        throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isObject(parsed))
        throw new Error(`${file}: expected a JSON object.`);
    return parsed;
}
export function migrateFromPi(legacy, current) {
    const moved = [];
    const piSettings = existsSync(legacy.piSettings) ? readPiSettings(legacy.piSettings) : {};
    const { librarian, ...rest } = piSettings;
    if (librarian !== undefined) {
        if (!isObject(librarian)) {
            throw new Error(`${legacy.piSettings}: "librarian" must be an object to migrate.`);
        }
        if (existsSync(current.settings)) {
            throw new Error(`Librarian settings exist both under "librarian" in ${legacy.piSettings} and in ${current.settings}. Merge them into ${current.settings} and remove the "librarian" key.`);
        }
        const shared = {};
        const pi = {};
        for (const [key, value] of Object.entries(librarian)) {
            (PI_KEYS.has(key) ? pi : shared)[key] = value;
        }
        mkdirSync(path.dirname(current.settings), { recursive: true });
        writeFileSync(current.settings, `${JSON.stringify(Object.keys(pi).length > 0 ? { ...shared, pi } : shared, null, 2)}\n`, { flag: "wx" });
        // Through a rename, so a crash mid-write cannot truncate the rest of pi's settings.
        const temporary = `${legacy.piSettings}.librarian-migration`;
        writeFileSync(temporary, `${JSON.stringify(rest, null, 2)}\n`);
        renameSync(temporary, legacy.piSettings);
        moved.push(`settings from ${legacy.piSettings} to ${current.settings}`);
    }
    if (existsSync(legacy.browserProfile)) {
        if (existsSync(current.browserProfile)) {
            throw new Error(`Browser profiles exist at both ${legacy.browserProfile} and ${current.browserProfile}. Keep one and delete the other.`);
        }
        mkdirSync(path.dirname(current.browserProfile), { recursive: true });
        renameSync(legacy.browserProfile, current.browserProfile);
        moved.push(`browser profile from ${legacy.browserProfile} to ${current.browserProfile}`);
    }
    return moved;
}
