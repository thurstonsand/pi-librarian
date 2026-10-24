import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "./support/fetch-stub.ts";
import { call, repoTools, text } from "./support/tools.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const tools = () => repoTools({}, { GITHUB_TOKEN: "test-token" });

function fileEntry(path: string, content: Buffer) {
  return {
    type: "file",
    name: path.split("/").pop(),
    path,
    size: content.length,
    sha: "f".repeat(40),
    content: content.toString("base64"),
    encoding: "base64",
  };
}

describe("read_file on GitHub", () => {
  it("has no source argument while github is the only readable source", () => {
    const parameters = tools().get("read_file")?.parameters as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(parameters.properties)).toEqual(["repo", "path", "ref", "offset", "limit"]);
  });

  it("pages a file from offset with a continuation footer", async () => {
    const requests = stubFetch([
      () => Response.json(fileEntry("src/a.ts", Buffer.from("one\ntwo\nthree\nfour\nfive"))),
    ]);
    const result = await call(tools(), "read_file", {
      repo: "drizzle-team/drizzle-orm",
      path: "src/a.ts",
      ref: "v1",
      offset: 2,
      limit: 2,
    });

    expect(requests.map((request) => `${request.url.pathname}${request.url.search}`)).toEqual([
      "/repos/drizzle-team/drizzle-orm/contents/src%2Fa.ts?ref=v1",
    ]);
    expect(text(result)).toBe("two\nthree\n\n[Showing lines 2-3 of 5. Use offset=4 to continue.]");
    expect(result.details).toEqual({
      kind: "read_file",
      source: "github",
      repo: "drizzle-team/drizzle-orm",
      path: "src/a.ts",
      entryType: "file",
      shownLines: 2,
      totalLines: 5,
    });
  });

  it("fetches the raw body when GitHub's JSON omits the content of a large file", async () => {
    const requests = stubFetch([
      (request) =>
        request.headers.get("accept")?.includes("raw")
          ? new Response("raw body", { headers: { "content-type": "text/plain" } })
          : Response.json({
              ...fileEntry("big.txt", Buffer.from("")),
              size: 1_500_000,
              content: "",
              encoding: "none",
            }),
    ]);
    const result = await call(tools(), "read_file", { repo: "a/b", path: "big.txt" });
    expect(text(result)).toBe("raw body");
    expect(requests).toHaveLength(2);
  });

  it("lists a directory, marking what each entry is", async () => {
    stubFetch([
      () =>
        Response.json([
          { type: "file", name: "retry.ts", path: "src/retry.ts", size: 1, sha: "a" },
          { type: "dir", name: "internal", path: "src/internal", size: 0, sha: "b" },
          { type: "submodule", name: "proto", path: "src/proto", size: 0, sha: "c" },
        ]),
    ]);
    const result = await call(tools(), "read_file", { repo: "a/b", path: "src/" });
    expect(text(result)).toBe("src/retry.ts\nsrc/internal/\nsrc/proto (submodule)");
  });

  it("says what a submodule and a symlink are instead of reading them", async () => {
    stubFetch([
      (request) =>
        request.url.pathname.endsWith("vendor%2Fprotocol")
          ? Response.json({
              type: "submodule",
              name: "protocol",
              path: "vendor/protocol",
              size: 0,
              sha: "c".repeat(40),
              submodule_git_url: "https://github.com/acme/protocol.git",
            })
          : Response.json({
              type: "symlink",
              name: "latest",
              path: "docs/latest",
              size: 2,
              sha: "d".repeat(40),
              target: "v2",
            }),
    ]);
    expect(text(await call(tools(), "read_file", { repo: "a/b", path: "vendor/protocol" }))).toBe(
      "a/b/vendor/protocol is a submodule pointing at https://github.com/acme/protocol.git — read it from that repository.",
    );
    expect(text(await call(tools(), "read_file", { repo: "a/b", path: "docs/latest" }))).toBe(
      "a/b/docs/latest is a symlink to v2 — read that path instead.",
    );
  });

  it("refuses binary and oversized files, and says a 404 cannot tell missing from private", async () => {
    stubFetch([
      (request) =>
        request.url.pathname.endsWith("logo.png")
          ? Response.json(fileEntry("logo.png", Buffer.from([0x89, 0x50, 0x00, 0x01])))
          : request.url.pathname.endsWith("huge.bin")
            ? Response.json({
                ...fileEntry("huge.bin", Buffer.from("")),
                size: 6 * 1024 * 1024,
                content: "",
              })
            : Response.json({ message: "Not Found" }, { status: 404 }),
    ]);
    await expect(call(tools(), "read_file", { repo: "a/b", path: "logo.png" })).rejects.toThrow(
      "a/b/logo.png is a binary file (4B); its content would be noise in context.",
    );
    await expect(call(tools(), "read_file", { repo: "a/b", path: "huge.bin" })).rejects.toThrow(
      "a/b/huge.bin is 6.0MB, over the 5.0MB read limit. Clone it with checkout_repo and read it locally instead.",
    );
    await expect(call(tools(), "read_file", { repo: "a/b", path: "missing.ts" })).rejects.toThrow(
      /^Not found: a\/b\/missing.ts.\nGitHub returns the same 404 for a missing path, ref, or repository and for a private repository your token cannot read.$/,
    );
  });
});
