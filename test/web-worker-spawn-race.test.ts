import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const CLIENT = path.join(import.meta.dirname, "support/fetch-worker-client.ts");
const CLIENTS = 6;

const root = mkdtempSync(path.join(os.tmpdir(), "librarian-race-"));
const stateHome = path.join(root, "state");
const profileDir = path.join(root, "profile");

function workerPids(): number[] {
  return execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line.includes("fetch-worker") && line.includes(profileDir))
    .map((line) => Number.parseInt(line.trim(), 10));
}

afterAll(() => {
  for (const pid of workerPids()) process.kill(pid, "SIGTERM");
  rmSync(root, { recursive: true, force: true });
});

describe("fetch worker spawn race", () => {
  it("starts exactly one worker for concurrent sessions and answers every one", async () => {
    // A browser that cannot launch makes every fetch fail fast inside the worker, so each answer
    // proves a round trip through the worker without a real Chrome.
    const missingBrowser = path.join(root, "no-such-chrome");
    const env = { ...process.env, XDG_STATE_HOME: stateHome };
    const outputs = await Promise.all(
      Array.from({ length: CLIENTS }, (_, index) =>
        run(
          process.execPath,
          [CLIENT, missingBrowser, profileDir, path.join(root, `download-${index}`)],
          { env, timeout: 30_000 },
        ),
      ),
    );

    for (const { stdout } of outputs) {
      expect(stdout).toContain("answered:");
      expect(stdout).toContain(missingBrowser);
    }
    const pids = workerPids();
    expect(pids).toHaveLength(1);
    const pidFile = path.join(stateHome, "agents/librarian/worker.pid");
    expect(Number.parseInt(readFileSync(pidFile, "utf8"), 10)).toBe(pids[0]);
  }, 40_000);
});
