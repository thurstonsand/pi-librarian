import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CheckoutError,
  parseRepoReference,
  repoCachePath,
} from "../extensions/librarian/checkout.ts";
import type { CloneSource } from "../extensions/librarian/settings.ts";
import { resolveLibrarianSettings } from "../extensions/librarian/settings.ts";
import { createCheckoutRepoTool } from "../extensions/librarian/tools/checkout-repo.ts";

afterEach(() => {
  vi.doUnmock("node:child_process");
  vi.resetModules();
});

function key(input: string, sourceName?: string): string {
  return parseRepoReference(input, HOSTS, sourceName).key;
}

function cloneUrls(input: string, sourceName?: string): string[] {
  return parseRepoReference(input, HOSTS, sourceName).cloneUrls;
}

const HOSTS = resolveLibrarianSettings(
  {
    sources: [
      { name: "example-bb", url: "https://git.example.com", kind: "bitbucket-server" },
      { name: "example-gl", url: "https://gitlab.example.com", kind: "gitlab" },
    ],
  },
  {},
).sources;

describe("parseRepoReference", () => {
  it("requires source for a shorthand repository path", () => {
    expect(() => key("a/b")).toThrow(/Pass source/);
  });

  it("derives GitHub shorthand from the implicit github source", () => {
    expect(key("drizzle-team/drizzle-orm", "github")).toBe("github.com/drizzle-team/drizzle-orm");
    expect(cloneUrls("a/b", "github")).toEqual(["https://github.com/a/b.git"]);
  });

  it("rejects a source name that is not a clone-capable declaration", () => {
    expect(() => key("a/b", "nope")).toThrow(/Unknown source "nope"/);
  });

  // "Unknown" would be a lie and would send the model looking for a spelling mistake.
  it("distinguishes a declared source that cannot clone from an unknown one", () => {
    const { sources } = resolveLibrarianSettings(
      {
        sources: [
          { name: "sg", url: "https://search.example.com", kind: "sourcegraph" },
          {
            name: "bb-search-only",
            url: "https://git.example.com",
            kind: "bitbucket-server",
            disabled: ["clone"],
          },
        ],
      },
      {},
    );

    expect(() => parseRepoReference("PROJ/repo", sources, "sg")).toThrow(
      /Source "sg" cannot clone \(kind sourcegraph\)/,
    );
    expect(() => parseRepoReference("PROJ/repo", sources, "bb-search-only")).toThrow(
      /cannot clone \(cloning disabled in settings\)/,
    );
  });

  it("derives Bitbucket Server shorthand with its /scm/ prefix", () => {
    const reference = parseRepoReference("PROJ/repo", HOSTS, "example-bb");
    expect(reference.key).toBe("git.example.com/proj/repo");
    expect(reference.cloneUrls).toEqual(["https://git.example.com/scm/PROJ/repo.git"]);
  });

  it("accepts single and nested host-relative paths without guessing their shape", () => {
    expect(key("repo", "example-gl")).toBe("gitlab.example.com/repo");
    expect(key("group/subgroup/repo", "example-gl")).toBe("gitlab.example.com/group/subgroup/repo");
  });

  it("passes HTTPS repository URLs through and strips /scm/ only from identity", () => {
    const reference = parseRepoReference("https://git.example.com:8443/scm/PROJ/repo.git", HOSTS);
    expect(reference.key).toBe("git.example.com/proj/repo");
    expect(reference.cloneUrls).toEqual(["https://git.example.com:8443/scm/PROJ/repo.git"]);
  });

  // "scm" is a legitimate group or owner name anywhere else, and erasing it would merge two
  // distinct repositories onto one cache directory.
  it("strips /scm/ only for a host declared as bitbucket-server", () => {
    expect(key("https://gitlab.example.com/scm/project")).toBe("gitlab.example.com/scm/project");
    expect(key("https://undeclared.example.com/scm/project")).toBe(
      "undeclared.example.com/scm/project",
    );
  });

  it("passes SSH repository URLs through and keeps ports out of identity", () => {
    const reference = parseRepoReference("ssh://git@git.example.com:7999/PROJ/repo.git", HOSTS);
    expect(reference.key).toBe("git.example.com/proj/repo");
    expect(reference.cloneUrls).toEqual(["ssh://git@git.example.com:7999/PROJ/repo.git"]);
    expect(key("git@git.example.com:PROJ/repo.git")).toBe("git.example.com/proj/repo");
  });

  it("keys URL and shorthand forms case-insensitively to the same entry", () => {
    expect(key("PROJ/repo", "example-bb")).toBe(key("https://git.example.com/scm/proj/repo"));
  });

  it("rejects invalid GitHub shorthand path shapes before cloning", () => {
    expect(() => key("repo", "github")).toThrow(CheckoutError);
    expect(() => key("owner/group/repo", "github")).toThrow(CheckoutError);
  });

  it("rejects source with a full clone URL", () => {
    expect(() => key("https://github.com/a/b.git", "github")).toThrow(/Remove source/);
  });

  it("rejects unsupported repository forms", () => {
    expect(() => key("not-a-repo")).toThrow(CheckoutError);
    expect(() => key("git@git.example.com:a/b; rm -rf /")).toThrow(CheckoutError);
    expect(() => key("http://gitlab.example.com/a/b")).toThrow(CheckoutError);
    expect(() => key("file:///tmp/repo")).toThrow(CheckoutError);
  });
});

describe("createCheckoutRepoTool", () => {
  it("exposes only declared clone-enabled sources in its flat source enum", () => {
    const settings = resolveLibrarianSettings(
      {
        sources: [
          { name: "example-gl", url: "https://gitlab.example.com", kind: "gitlab" },
          { name: "search", url: "https://search.example.com", kind: "sourcegraph" },
          {
            name: "no-clone",
            url: "https://git.example.com",
            kind: "bitbucket-server",
            disabled: ["clone"],
          },
        ],
      },
      {},
    );
    const tool = createCheckoutRepoTool("/tmp/pi-librarian", settings.sources);
    const sourceSchema = tool.parameters.properties.source as {
      enum: string[];
      description: string;
    };

    expect(sourceSchema.enum).toEqual(["github", "example-gl"]);
    // The mapping must live here, not in the system prompt: attach mode exposes the tool without it.
    expect(sourceSchema.description).toContain(
      "github (github.com), example-gl (gitlab.example.com)",
    );
    expect(sourceSchema.description).not.toContain("search.example.com");
  });
});

describe("bitbucket-server /scm/ prefix", () => {
  it("names one repository once however the prefix is spelled", () => {
    const { sources } = resolveLibrarianSettings(
      {
        sources: [{ name: "bb", url: "https://git.example.com", kind: "bitbucket-server" }],
      },
      {},
    );

    for (const shorthand of ["PROJ/repo", "scm/PROJ/repo", "/scm/PROJ/repo", "SCM/PROJ/repo"]) {
      const reference = parseRepoReference(shorthand, sources, "bb");
      expect(reference.key).toBe("git.example.com/proj/repo");
      expect(reference.cloneUrls).toEqual(["https://git.example.com/scm/PROJ/repo.git"]);
    }

    expect(parseRepoReference("https://git.example.com/scm/PROJ/repo.git", sources).key).toBe(
      "git.example.com/proj/repo",
    );
  });
});

describe("repoCachePath", () => {
  it("nests repository keys under the cache repos dir", () => {
    expect(repoCachePath("/cache", "github.com/a/b")).toBe(
      path.join("/cache", "repos", "github.com", "a", "b"),
    );
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
    await fs.mkdir(path.join(cacheDir, "repos", "github.com", "a", "b", ".git"), {
      recursive: true,
    });

    const result = await checkoutRepo("a/b", HOSTS, "github", undefined, cacheDir, undefined);

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
    await fs.mkdir(path.join(cacheDir, "repos", "github.com", "a", "b", ".git"), {
      recursive: true,
    });

    await checkoutRepo("a/b", HOSTS, "github", "v1.0.0", cacheDir, undefined);

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
    const dest = path.join(cacheDir, "repos", "github.com", "a", "b");
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(path.join(dest, "debris.txt"), "debris");

    const result = await checkoutRepo("a/b", HOSTS, "github", undefined, cacheDir, undefined);

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
    await fs.mkdir(path.join(cacheDir, "repos", "github.com", "a", "b", ".git"), {
      recursive: true,
    });

    const result = await checkoutRepo("a/b", HOSTS, "github", undefined, cacheDir, undefined);

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
    await fs.mkdir(path.join(cacheDir, "repos", "github.com", "a", "b", ".git"), {
      recursive: true,
    });

    await expect(
      checkoutRepo("a/b", HOSTS, "github", undefined, cacheDir, undefined),
    ).rejects.toThrow("git fetch failed: fatal: could not fetch");
  });

  it("reports every clone URL it tried when none works", async () => {
    const cloneError = new Error("clone failed") as Error & { stderr: string };
    cloneError.stderr = "fatal: Authentication failed";
    const { checkoutRepo, cacheDir } = await withMockedGit(
      () => "",
      (args) => (args[0] === "clone" ? cloneError : undefined),
    );

    const failure = await checkoutRepo(
      "PROJ/repo",
      HOSTS,
      "example-bb",
      undefined,
      cacheDir,
      undefined,
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain("Could not clone git.example.com/proj/repo");
    expect(message).toContain("https://git.example.com/scm/PROJ/repo.git");
  });

  it("redacts credentials a git error echoes back from a URL", async () => {
    const cloneError = new Error("clone failed") as Error & { stderr: string };
    cloneError.stderr =
      "fatal: unable to update url base from redirection:\n  asked for: https://x-token-auth:sekrit@git.example.com/proj/repo.git/info/refs";
    const { checkoutRepo, cacheDir } = await withMockedGit(
      () => "",
      (args) => (args[0] === "clone" ? cloneError : undefined),
    );

    const failure = await checkoutRepo(
      "proj/repo",
      HOSTS,
      "example-bb",
      undefined,
      cacheDir,
      undefined,
    ).catch((error: unknown) => error);

    const message = (failure as Error).message;
    expect(message).not.toContain("sekrit");
    expect(message).toContain("https://<redacted>@git.example.com/proj/repo.git");
  });

  it("reports a cloned repository without a remote HEAD as possibly empty", async () => {
    const headError = new Error("head failed") as Error & { stderr: string };
    headError.stderr = "error: Cannot determine remote HEAD";
    const { checkoutRepo, cacheDir } = await withMockedGit(
      () => "",
      (args) =>
        ["symbolic-ref refs/remotes/origin/HEAD", "remote set-head origin --auto"].includes(
          args.join(" "),
        )
          ? headError
          : undefined,
    );

    await expect(
      checkoutRepo("a/b", HOSTS, "github", undefined, cacheDir, undefined),
    ).rejects.toThrow("Cloned github.com/a/b, but it has no remote HEAD and may be empty");
  });

  it("does not redact an SSH username from a git error", async () => {
    const cloneError = new Error("clone failed") as Error & { stderr: string };
    cloneError.stderr =
      "fatal: Could not read from remote repository ssh://git@git.example.com:7999/proj/repo.git";
    const { checkoutRepo, cacheDir } = await withMockedGit(
      () => "",
      (args) => (args[0] === "clone" ? cloneError : undefined),
    );

    const failure = await checkoutRepo(
      "ssh://git@git.example.com:7999/proj/repo.git",
      HOSTS,
      undefined,
      undefined,
      cacheDir,
      undefined,
    ).catch((error: unknown) => error);

    const message = (failure as Error).message;
    expect(message).toContain("ssh://git@git.example.com:7999/proj/repo.git");
    expect(message).not.toContain("<redacted>");
  });
});
