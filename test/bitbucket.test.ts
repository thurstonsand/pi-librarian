import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "./support/fetch-stub.ts";
import { call, repoTools, temporaryCacheDir, text, withoutArtifact } from "./support/tools.ts";

const ENV = { BITBUCKET_TOKEN: "bb-token" };
let cacheDir: string;

beforeEach(async () => {
  cacheDir = await temporaryCacheDir();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const settings = () => ({
  cacheDir,
  sources: [
    { name: "example-bb", url: "https://git.example.com", kind: "bitbucket-server" as const },
  ],
});

function codeHit(project: string, slug: string, file: string, lines: Array<[number, string]>) {
  return {
    repository: { slug, name: slug, project: { key: project }, archived: false },
    file,
    hitCount: lines.length,
    pathMatches: [],
    hitContexts: [lines.map(([line, text]) => ({ line, text }))],
  };
}

describe("search_code_bitbucket", () => {
  it("builds modifiers from typed arguments and decodes the marked, escaped lines", async () => {
    const requests = stubFetch([
      () =>
        Response.json({
          code: {
            count: 12,
            isLastPage: false,
            values: [
              codeHit("CORE", "deploy-cli", "internal/backoff.go", [
                [12, "&#x2F;&#x2F; computes the delay"],
                [13, "func <em>computeBackoff</em>(attempt int) time.Duration {"],
              ]),
            ],
          },
        }),
    ]);

    const result = await call(repoTools(settings(), ENV), "search_code_bitbucket", {
      pattern: "computeBackoff -test",
      project: "CORE",
      repo: "deploy-cli",
      extension: ".go",
      limit: 1,
    });

    expect(requests[0]?.headers.get("authorization")).toBe("Bearer bb-token");
    expect(JSON.parse(requests[0]?.body ?? "")).toEqual({
      query: "computeBackoff -test repo:CORE/deploy-cli ext:go",
      entities: { code: { start: 0, limit: 1 } },
      limits: { primary: 1, secondary: 10 },
    });
    expect(withoutArtifact(text(result))).toBe(`12 files match (example-bb).
Fetched 1 (limit); showing all 1. Full results: <artifact>

 1. CORE/deploy-cli — internal/backoff.go
    13: func computeBackoff(attempt int) time.Duration {`);
  });

  it("says an unknown project is not an empty result", async () => {
    stubFetch([
      (request) =>
        request.url.pathname === "/rest/api/1.0/projects/NOPE"
          ? Response.json(
              { errors: [{ message: "Project NOPE does not exist." }] },
              { status: 404 },
            )
          : Response.json({ code: { count: 0, isLastPage: true, values: [] } }),
    ]);
    await expect(
      call(repoTools(settings(), ENV), "search_code_bitbucket", { pattern: "x", project: "NOPE" }),
    ).rejects.toThrow(
      "No Bitbucket project NOPE on example-bb, or it is not visible to this token. This is not an empty result.",
    );
  });

  it.each([
    [{ pattern: "retry lang:go" }, 'pattern contains a modifier "lang:"'],
    [{ pattern: "retryBack*" }, "no wildcards"],
    [{ pattern: "x", repo: "deploy-cli" }, "repo requires project"],
  ])("refuses %j before sending anything", async (params, message) => {
    const requests = stubFetch([]);
    await expect(call(repoTools(settings(), ENV), "search_code_bitbucket", params)).rejects.toThrow(
      message,
    );
    expect(requests).toEqual([]);
  });
});

describe("search_repos_bitbucket", () => {
  it("matches the start of a name within a project, and says when more exist", async () => {
    const requests = stubFetch([
      () =>
        Response.json({
          isLastPage: false,
          values: [
            {
              slug: "deploy-cli",
              name: "deploy-cli",
              project: { key: "CORE" },
              description: "Deployment CLI",
            },
          ],
        }),
    ]);
    const result = await call(repoTools(settings(), ENV), "search_repos_bitbucket", {
      name: "deploy",
      project: "CORE",
      limit: 1,
    });

    expect(Object.fromEntries(requests[0]?.url.searchParams.entries() ?? [])).toEqual({
      name: "deploy",
      projectkey: "CORE",
      limit: "1",
    });
    expect(withoutArtifact(text(result))).toBe(`More than 1 repository match (example-bb).
Fetched 1 (limit); showing all 1. Full results: <artifact>

 1. CORE/deploy-cli
    Deployment CLI`);
  });
});

describe("read_file on Bitbucket", () => {
  it("learns an entry's type from its parent and refuses a file over the size limit before downloading", async () => {
    const requests = stubFetch([
      (request) =>
        request.url.pathname === "/rest/api/1.0/projects/CORE/repos/deploy-cli/browse/vendor"
          ? Response.json({
              path: {},
              children: {
                isLastPage: true,
                values: [
                  { path: { name: "protocol" }, type: "SUBMODULE" },
                  { path: { name: "dump.sql" }, type: "FILE", size: 6 * 1024 * 1024 },
                ],
              },
            })
          : request.url.pathname === "/rest/api/1.0/projects/CORE/repos/deploy-cli/raw/.gitmodules"
            ? new Response(
                '[submodule "protocol"]\n\tpath = vendor/protocol\n\turl = ../protocol.git\n',
              )
            : undefined,
    ]);
    const read = (path: string) =>
      call(repoTools(settings(), ENV), "read_file", {
        source: "example-bb",
        repo: "CORE/deploy-cli",
        path,
      });

    expect(text(await read("vendor/protocol"))).toBe(
      "CORE/deploy-cli/vendor/protocol is a submodule pointing at ../protocol.git — read it from that repository.",
    );
    await expect(read("vendor/dump.sql")).rejects.toThrow("is 6.0MB, over the 5.0MB read limit");
    expect(requests.some((request) => request.url.pathname.endsWith("/raw/vendor/dump.sql"))).toBe(
      false,
    );
  });
});
