import type { LibrarianSource, SourceKind } from "./settings.ts";

function lineAnchor(kind: SourceKind, lines: string | undefined): string {
  const match = lines ? /^(\d+)(?:-(\d+))?$/.exec(lines.trim()) : null;
  if (!match) {
    return "";
  }
  const [, start, end] = match;
  switch (kind) {
    case "github":
      return end ? `#L${start}-L${end}` : `#L${start}`;
    case "gitlab":
      return end ? `#L${start}-${end}` : `#L${start}`;
    case "bitbucket-server":
      return end ? `#${start}-${end}` : `#${start}`;
    case "sourcegraph":
      return end ? `#L${start}-${end}` : `#L${start}`;
  }
}

function bitbucketRepoPath(repo: string): string | undefined {
  const [project, slug, ...rest] = repo.split("/");
  return project && slug && rest.length === 0 ? `projects/${project}/repos/${slug}` : undefined;
}

export function repoWebUrl(source: LibrarianSource, repo: string): string | undefined {
  switch (source.kind) {
    case "github":
    case "gitlab":
      return `${source.url}/${repo}`;
    case "bitbucket-server": {
      const repoPath = bitbucketRepoPath(repo);
      return repoPath ? `${source.url}/${repoPath}` : undefined;
    }
    case "sourcegraph":
      return `${source.url}/${repo}`;
  }
}

export function fileWebUrl(
  source: LibrarianSource,
  repo: string,
  ref: string | undefined,
  file: string,
  lines: string | undefined,
): string | undefined {
  const anchor = lineAnchor(source.kind, lines);
  switch (source.kind) {
    case "github":
      return `${source.url}/${repo}/blob/${ref ?? "HEAD"}/${file}${anchor}`;
    case "gitlab":
      return `${source.url}/${repo}/-/blob/${ref ?? "HEAD"}/${file}${anchor}`;
    case "bitbucket-server": {
      const repoPath = bitbucketRepoPath(repo);
      return repoPath
        ? `${source.url}/${repoPath}/browse/${file}${ref ? `?at=${encodeURIComponent(ref)}` : ""}${anchor}`
        : undefined;
    }
    case "sourcegraph":
      return `${source.url}/${repo}${ref ? `@${ref}` : ""}/-/blob/${file}${anchor}`;
  }
}
