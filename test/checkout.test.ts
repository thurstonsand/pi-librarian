import path from "node:path";
import { describe, expect, it } from "vitest";
import { CheckoutError, parseRepoName, repoCachePath } from "../extensions/librarian/checkout.ts";

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
