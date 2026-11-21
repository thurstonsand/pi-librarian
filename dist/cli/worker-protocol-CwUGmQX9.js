import { mkdirSync } from "node:fs";
import os from "node:os";
import path, { join } from "node:path";
// src/core/paths.ts
function xdgDir(env, variable, fallback) {
	const base = env[variable]?.trim() || path.join(os.homedir(), ...fallback);
	return path.join(base, "agents", "librarian");
}
function settingsPath(env) {
	return path.join(xdgDir(env, "XDG_CONFIG_HOME", [".config"]), "config.json");
}
function cacheDir(env) {
	return xdgDir(env, "XDG_CACHE_HOME", [".cache"]);
}
function stateDir(env) {
	return xdgDir(env, "XDG_STATE_HOME", [".local", "state"]);
}
function browserProfileDir(env) {
	return path.join(stateDir(env), "browser-profile");
}
// src/core/web/fetchers/local/worker-protocol.ts
function getFetchWorkerDir() {
	return stateDir(process.env);
}
function ensureFetchWorkerDir() {
	const dir = getFetchWorkerDir();
	mkdirSync(dir, {
		recursive: true,
		mode: 448
	});
	return dir;
}
function getFetchWorkerSocketPath() {
	return join(getFetchWorkerDir(), "worker.sock");
}
function getFetchWorkerPidPath() {
	return join(getFetchWorkerDir(), "worker.pid");
}
function getFetchWorkerSpawnLockPath() {
	return join(getFetchWorkerDir(), "spawn.lock");
}
export { browserProfileDir as a, stateDir as c, getFetchWorkerSpawnLockPath as i, getFetchWorkerPidPath as n, cacheDir as o, getFetchWorkerSocketPath as r, settingsPath as s, ensureFetchWorkerDir as t };
