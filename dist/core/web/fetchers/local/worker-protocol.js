import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "../../../paths.js";
// The spawner's environment reaches the worker unchanged, so both resolve the same directory.
export function getFetchWorkerDir() {
    return stateDir(process.env);
}
export function ensureFetchWorkerDir() {
    const dir = getFetchWorkerDir();
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
}
export function getFetchWorkerSocketPath() {
    return join(getFetchWorkerDir(), "worker.sock");
}
export function getFetchWorkerPidPath() {
    return join(getFetchWorkerDir(), "worker.pid");
}
export function getFetchWorkerSpawnLockPath() {
    return join(getFetchWorkerDir(), "spawn.lock");
}
