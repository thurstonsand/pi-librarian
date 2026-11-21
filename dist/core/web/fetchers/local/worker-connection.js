import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { connect } from "node:net";
import { basename, delimiter, dirname, extname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { ensureFetchWorkerDir, getFetchWorkerPidPath, getFetchWorkerSocketPath, getFetchWorkerSpawnLockPath, } from "./worker-protocol.js";
// Beside this module with its extension: `.ts` in the source tree, `.js` in the compiled tree and
// the CLI bundle. scripts/check-dist.sh fails a build that separates them.
const HERE = fileURLToPath(import.meta.url);
const WORKER_PATH = join(dirname(HERE), `fetch-worker${extname(HERE)}`);
const SPAWN_CONNECT_ATTEMPTS = 30; // x100ms
const SPAWN_LOCK_STALE_MS = 10_000;
// The worker's worst honest path is a challenge escalation: two navigations
// plus both challenge wait budgets plus peer drain. The budgets arrive on the
// worker's `started` event (the worker is canonical for its own config); this
// base covers the rest. A request that blows past the sum is a zombie worker,
// not a slow page. Defaults (10s + 20s) land on 60s.
const REQUEST_DEADLINE_BASE_MS = 30_000;
// pi ships as a compiled binary, so process.execPath points at pi, not node.
// Spawning it would relaunch pi with fetch-worker.ts as a prompt. Resolve a
// real node interpreter instead.
function resolveNode() {
    if (basename(process.execPath).toLowerCase().startsWith("node")) {
        return process.execPath;
    }
    for (const dir of (process.env.PATH ?? "").split(delimiter)) {
        if (!dir)
            continue;
        const candidate = join(dir, "node");
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
// Cross-session spawn lock
function acquireSpawnLock() {
    ensureFetchWorkerDir();
    const lockPath = getFetchWorkerSpawnLockPath();
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            writeFileSync(lockPath, `${process.pid}\n${Date.now()}\n`, { flag: "wx" });
            return true;
        }
        catch (error) {
            if (!(error instanceof Error) || error.code !== "EEXIST") {
                throw error;
            }
            if (isSpawnLockStale(lockPath)) {
                try {
                    unlinkSync(lockPath);
                }
                catch { }
                continue;
            }
            return false;
        }
    }
    return false;
}
function isSpawnLockStale(lockPath) {
    try {
        const [pidLine = "", createdAtLine = "0"] = readFileSync(lockPath, "utf8").trim().split("\n");
        const pid = Number.parseInt(pidLine, 10);
        const createdAt = Number.parseInt(createdAtLine, 10);
        if (Number.isFinite(pid)) {
            try {
                process.kill(pid, 0);
            }
            catch {
                return true;
            }
        }
        return !Number.isFinite(createdAt) || Date.now() - createdAt > SPAWN_LOCK_STALE_MS;
    }
    catch {
        return true;
    }
}
function releaseSpawnLock() {
    try {
        unlinkSync(getFetchWorkerSpawnLockPath());
    }
    catch { }
}
// The worker heartbeats every 5s per connection; with requests pending, this
// much total silence — no heartbeat, status, or result — means the worker is
// wedged. Liveness must be traffic-based rather than duration-based: only the
// worker knows how long its work takes.
const STALL_SILENCE_MS = 20_000;
// Settings are re-read at every spawn, so a worker restart (idle exit or
// /browser restart) picks up settings changes without a new pi session.
export function createFetchWorkerClient(getSettings) {
    const socketPath = getFetchWorkerSocketPath();
    let sock = null;
    let connecting = null;
    const pending = new Map();
    function connectOnce() {
        return new Promise((resolve) => {
            const candidate = connect(socketPath, () => resolve(candidate));
            candidate.on("error", () => {
                if (sock === candidate)
                    sock = null;
                resolve(null);
            });
            candidate.on("close", () => {
                if (sock === candidate)
                    sock = null;
                failAllPending(new Error("fetch worker connection closed"));
            });
        });
    }
    function armDeadline(id, request, deadlineMs) {
        if (request.deadline)
            return;
        request.deadline = setTimeout(() => {
            pending.delete(id);
            onPendingChanged();
            // Deadline expiry means the worker failed to enforce its own stage
            // timeouts — it is wedged, not slow, and it would stall every later
            // request too; put it down so the next fetch respawns clean.
            void terminateWorker();
            request.reject(new Error(`fetch worker did not respond within ${deadlineMs / 1000}s`));
        }, deadlineMs);
    }
    let stallTimer = null;
    function onPendingChanged() {
        if (stallTimer)
            clearTimeout(stallTimer);
        stallTimer = null;
        holdProcessWhilePending();
        if (pending.size === 0)
            return;
        stallTimer = setTimeout(() => void terminateWorker(), STALL_SILENCE_MS);
    }
    // The connection to the detached worker is kept across fetches; idle, it must
    // not keep the host alive, or `pi -p` never exits after a local fetch.
    function holdProcessWhilePending() {
        if (pending.size > 0)
            sock?.ref();
        else
            sock?.unref();
    }
    function attachReader(socket) {
        const rl = createInterface({ input: socket, crlfDelay: Number.POSITIVE_INFINITY });
        rl.on("line", (line) => {
            let event;
            try {
                event = JSON.parse(line);
            }
            catch {
                return;
            }
            onPendingChanged();
            if (event.event === "heartbeat")
                return;
            const request = pending.get(event.id);
            if (!request)
                return;
            if (event.event === "status") {
                if (event.stage === "started") {
                    armDeadline(event.id, request, REQUEST_DEADLINE_BASE_MS + event.budgetSecs * 1000);
                }
                return;
            }
            pending.delete(event.id);
            onPendingChanged();
            if (request.deadline)
                clearTimeout(request.deadline);
            request.resolve(event);
        });
    }
    function failAllPending(error) {
        for (const request of pending.values()) {
            if (request.deadline)
                clearTimeout(request.deadline);
            request.reject(error);
        }
        pending.clear();
        onPendingChanged();
    }
    async function ensureConnected() {
        if (sock && !sock.destroyed)
            return sock;
        // Single-flight: a batch fires its URLs concurrently, and each one racing
        // through here would spawn its own worker.
        connecting ??= establishConnection().finally(() => {
            connecting = null;
        });
        return connecting;
    }
    async function establishConnection() {
        let socket = await connectOnce();
        if (!socket) {
            const spawnedHere = acquireSpawnLock();
            try {
                if (spawnedHere) {
                    const node = resolveNode();
                    if (!node)
                        throw new Error("no node interpreter found to spawn the fetch worker");
                    const settings = getSettings();
                    const config = {
                        profileDir: settings.browser.profileDir,
                        ...(settings.browser.executablePath
                            ? { executablePath: settings.browser.executablePath }
                            : {}),
                        challenge: settings.challenge,
                    };
                    const child = spawn(node, [WORKER_PATH, JSON.stringify(config)], {
                        detached: true,
                        stdio: "ignore",
                    });
                    child.unref();
                }
                for (let attempt = 0; attempt < SPAWN_CONNECT_ATTEMPTS && !socket; attempt += 1) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    socket = await connectOnce();
                }
                if (!socket)
                    throw new Error("fetch worker did not start");
            }
            finally {
                if (spawnedHere)
                    releaseSpawnLock();
            }
        }
        sock = socket;
        holdProcessWhilePending();
        attachReader(socket);
        return socket;
    }
    async function readWorkerPid() {
        try {
            const pid = Number.parseInt(await readFile(getFetchWorkerPidPath(), "utf8"), 10);
            return Number.isInteger(pid) && pid > 0 ? pid : null;
        }
        catch {
            return null;
        }
    }
    async function terminateWorker() {
        sock?.destroy();
        sock = null;
        const pid = await readWorkerPid();
        if (pid) {
            try {
                process.kill(pid, "SIGTERM");
            }
            catch { }
        }
    }
    async function request(payload) {
        const socket = await ensureConnected();
        return new Promise((resolve, reject) => {
            const request = { resolve, reject, deadline: null };
            pending.set(payload.id, request);
            onPendingChanged();
            // Only fetch ops queue; anything else starts immediately, so arm now.
            if (payload.op !== "fetch")
                armDeadline(payload.id, request, REQUEST_DEADLINE_BASE_MS);
            socket.write(`${JSON.stringify(payload)}\n`);
        });
    }
    return {
        async fetch(url, downloadDir) {
            const event = await request({ id: randomUUID(), op: "fetch", url, downloadDir });
            if (event.event === "error")
                throw new Error(event.reason);
            if (event.event !== "result" || event.op !== "fetch") {
                throw new Error("fetch worker returned a malformed result");
            }
            // Another release's worker may answer on the shared socket and predate notes.
            const { id, event: _event, op, notes, ...result } = event;
            return { ...result, notes: notes ?? [] };
        },
        async openBrowser() {
            const event = await request({ id: randomUUID(), op: "open-browser" });
            if (event.event === "error")
                throw new Error(event.reason);
        },
        async restart() {
            const pid = await readWorkerPid();
            await terminateWorker();
            if (!pid)
                return;
            // Restart is a barrier: wait for the old worker to actually exit so the
            // next fetch cannot reconnect to a dying socket.
            const gaveUpAt = Date.now() + 5_000;
            while (Date.now() < gaveUpAt) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                try {
                    process.kill(pid, 0);
                }
                catch {
                    return;
                }
            }
            try {
                process.kill(pid, "SIGKILL");
            }
            catch { }
        },
    };
}
