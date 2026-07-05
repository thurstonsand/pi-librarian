import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutError, parseRepoName, repoCachePath } from "../extensions/librarian/checkout.ts";

afterEach(() => {
  vi.doUnmock("node:child_process");
  vi.resetModules();
});

describe("parseRepoName", () => {
  it("accepts owner/repo", () => {
    expect(parseRepoName("drizzle-team/drizzle-orm")).toBe("drizzle-team/drizzle-orm");
  });

  it("accepts github.com URLs and strips .git and trailing slashes", () => {
    expect(parseRepoName("https://github.com/a/b.git")).toBe("a/b");
    expect(parseRepoName("https://github.com/a/b/")).toBe("a/b");
  });

  it("accepts non-GitHub HTTPS repository URLs", () => {
    expect(parseRepoName("https://gitlab.com/a/b.git")).toBe("gitlab.com/a/b");
  });

  it("accepts SSH repository URLs", () => {
    expect(parseRepoName("git@github.com:a/b.git")).toBe("a/b");
    expect(parseRepoName("git@gitlab.com:a/b.git")).toBe("gitlab.com/a/b");
    expect(parseRepoName("ssh://git@gitlab.com/a/b.git")).toBe("gitlab.com/a/b");
  });

  it("accepts nested repository paths for non-GitHub hosts", () => {
    expect(parseRepoName("git@gitlab.com:a/b/c/d.git")).toBe("gitlab.com/a/b/c/d");
    expect(parseRepoName("https://gitlab.com/a/b/c/d.git")).toBe("gitlab.com/a/b/c/d");
  });

  it("accepts dots and dashes in names", () => {
    expect(parseRepoName("user.name/repo-name.js")).toBe("user.name/repo-name.js");
  });

  it("rejects anything else", () => {
    expect(() => parseRepoName("not-a-repo")).toThrow(CheckoutError);
    expect(() => parseRepoName("a/b/c")).toThrow(CheckoutError);
    expect(() => parseRepoName("git@github.com:a/b/c.git")).toThrow(CheckoutError);
    expect(() => parseRepoName("https://github.com/a/b/c.git")).toThrow(CheckoutError);
    expect(() => parseRepoName("git@github.com:a/b; rm -rf /")).toThrow(CheckoutError);
    expect(() => parseRepoName("http://gitlab.com/a/b")).toThrow(CheckoutError);
    expect(() => parseRepoName("file:///tmp/repo")).toThrow(CheckoutError);
  });
});

describe("repoCachePath", () => {
  it("nests repository keys under the cache repos dir", () => {
    expect(repoCachePath("/cache", "a/b")).toBe(path.join("/cache", "repos", "a", "b"));
    expect(repoCachePath("/cache", "gitlab.com/a/b/c/d")).toBe(
      path.join("/cache", "repos", "gitlab.com", "a", "b", "c", "d"),
    );
  });
});

describe("checkoutRepo", () => {
  async function withMockedGit(
    stdoutFor: (args: string[]) => string | undefined,
    errorFor: (args: string[]) => Error | undefined = () => undefined,
  ) {
    const calls: string[][] = [];
    vi.doMock("node:child_process", () => ({
      execFile: vi.fn(
        (
          _command: string,
          args: string[],
          _options: unknown,
          callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
        ) => {
          calls.push(args);
          callback(errorFor(args) ?? null, { stdout: stdoutFor(args) ?? "", stderr: "" });
        },
      ),
    }));

    const { checkoutRepo } = await import("../extensions/librarian/checkout.ts");
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-librarian-checkout-test-"));
    return { calls, checkoutRepo, cacheDir };
  }

  it("hard-resets and cleans reused default-branch checkouts", async () => {
    const { calls, checkoutRepo, cacheDir } = await withMockedGit((args) => {
      if (args.join(" ") === "remote get-url origin") {
        return "https://github.com/a/b.git";
      }
      if (args.join(" ") === "symbolic-ref refs/remotes/origin/HEAD") {
        return "refs/remotes/origin/main";
      }
      if (args.join(" ") === "rev-parse HEAD") {
        return "abc123";
      }
      if (args.join(" ") === "ls-files") {
        return "README.md\nsrc/index.ts";
      }
      return "";
    });
    await fs.mkdir(path.join(cacheDir, "repos", "a", "b", ".git"), { recursive: true });

    const result = await checkoutRepo("a/b", undefined, cacheDir, undefined);

    expect(result.reusedClone).toBe(true);
    expect(calls).toContainEqual(["checkout", "--force", "main"]);
    expect(calls).toContainEqual(["reset", "--hard", "origin/main"]);
    expect(calls).toContainEqual(["clean", "-fdx"]);
  });

  it("hard-resets and cleans explicit ref checkouts", async () => {
    const { calls, checkoutRepo, cacheDir } = await withMockedGit((args) => {
      if (args.join(" ") === "remote get-url origin") {
        return "https://github.com/a/b.git";
      }
      if (args.join(" ") === "rev-parse HEAD") {
        return "abc123";
      }
      return "";
    });
    await fs.mkdir(path.join(cacheDir, "repos", "a", "b", ".git"), { recursive: true });

    await checkoutRepo("a/b", "v1.0.0", cacheDir, undefined);

    expect(calls).toContainEqual(["fetch", "origin", "v1.0.0"]);
    expect(calls).toContainEqual(["checkout", "--force", "--detach", "FETCH_HEAD"]);
    expect(calls).toContainEqual(["reset", "--hard", "HEAD"]);
    expect(calls).toContainEqual(["clean", "-fdx"]);
  });

  it("replaces malformed cache paths", async () => {
    const { calls, checkoutRepo, cacheDir } = await withMockedGit((args) => {
      if (args.join(" ") === "symbolic-ref refs/remotes/origin/HEAD") {
        return "refs/remotes/origin/main";
      }
      if (args.join(" ") === "rev-parse HEAD") {
        return "abc123";
      }
      return "";
    });
    const dest = path.join(cacheDir, "repos", "a", "b");
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(path.join(dest, "debris.txt"), "debris");

    const result = await checkoutRepo("a/b", undefined, cacheDir, undefined);

    expect(result.reusedClone).toBe(false);
    expect(calls).toContainEqual([
      "clone",
      "--filter=blob:none",
      "https://github.com/a/b.git",
      result.path,
    ]);
  });

  it("discards cached checkouts whose origin points at a different repo", async () => {
    const { calls, checkoutRepo, cacheDir } = await withMockedGit((args) => {
      if (args.join(" ") === "remote get-url origin") {
        return "https://github.com/other/repo.git";
      }
      if (args.join(" ") === "symbolic-ref refs/remotes/origin/HEAD") {
        return "refs/remotes/origin/main";
      }
      if (args.join(" ") === "rev-parse HEAD") {
        return "abc123";
      }
      return "";
    });
    await fs.mkdir(path.join(cacheDir, "repos", "a", "b", ".git"), { recursive: true });

    const result = await checkoutRepo("a/b", undefined, cacheDir, undefined);

    expect(result.reusedClone).toBe(false);
    expect(calls).toContainEqual([
      "clone",
      "--filter=blob:none",
      "https://github.com/a/b.git",
      result.path,
    ]);
  });

  it("reports fetch failures instead of using stale refs", async () => {
    const fetchError = new Error("fetch failed") as Error & { stderr: string };
    fetchError.stderr = "fatal: could not fetch";
    const { checkoutRepo, cacheDir } = await withMockedGit(
      (args) => {
        if (args.join(" ") === "remote get-url origin") {
          return "https://github.com/a/b.git";
        }
        return "";
      },
      (args) => (args.join(" ") === "fetch origin --prune" ? fetchError : undefined),
    );
    await fs.mkdir(path.join(cacheDir, "repos", "a", "b", ".git"), { recursive: true });

    await expect(checkoutRepo("a/b", undefined, cacheDir, undefined)).rejects.toThrow(
      "git fetch failed: fatal: could not fetch",
    );
  });
});
