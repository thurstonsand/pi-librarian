import os from "node:os";
import path from "node:path";
// Every harness shares these, so one cache, one browser profile, and one fetch worker serve them all.
function xdgDir(env, variable, fallback) {
    const base = env[variable]?.trim() || path.join(os.homedir(), ...fallback);
    return path.join(base, "agents", "librarian");
}
export function settingsPath(env) {
    return path.join(xdgDir(env, "XDG_CONFIG_HOME", [".config"]), "config.json");
}
export function cacheDir(env) {
    return xdgDir(env, "XDG_CACHE_HOME", [".cache"]);
}
export function stateDir(env) {
    return xdgDir(env, "XDG_STATE_HOME", [".local", "state"]);
}
export function browserProfileDir(env) {
    return path.join(stateDir(env), "browser-profile");
}
