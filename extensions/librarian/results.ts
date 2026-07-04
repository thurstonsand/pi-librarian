import type { Findings } from "./tools/provide-results.ts";

function githubOwnerRepo(repo: string): string | undefined {
  if (/^[^/]+\/[^/]+$/.test(repo)) {
    return repo;
  }

  try {
    const url = new URL(repo);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      return undefined;
    }
    const [owner, name] = url.pathname.replace(/^\/+/, "").split("/");
    return owner && name ? `${owner}/${name.replace(/\.git$/, "")}` : undefined;
  } catch {
    return undefined;
  }
}

function locationUrl(
  repo: string,
  file: string,
  lines: string | undefined,
  sha: string | undefined,
): string | undefined {
  const ownerRepo = githubOwnerRepo(repo);
  if (!ownerRepo) {
    return undefined;
  }

  const refSegment = sha ? sha.slice(0, 12) : "HEAD";
  const anchor = lines ? `#L${lines.replace(/[^0-9-]/g, "").replace("-", "-L")}` : "";
  return `https://github.com/${ownerRepo}/blob/${refSegment}/${file}${anchor}`;
}

export function renderFindingsMarkdown(
  findings: Findings,
  checkouts: Record<string, string>,
): string {
  const sections = [findings.summary];

  if (findings.locations.length > 0) {
    const bullets = findings.locations.map((location) => {
      const lineSuffix = location.lines ? `:${location.lines}` : "";
      const ownerRepo = githubOwnerRepo(location.repo);
      const url = locationUrl(
        location.repo,
        location.file,
        location.lines,
        ownerRepo ? checkouts[ownerRepo] : undefined,
      );
      const citation = `- \`${location.repo}/${location.file}${lineSuffix}\` — ${location.note}`;
      return url ? `${citation}\n  ${url}` : citation;
    });
    sections.push(`## Locations\n\n${bullets.join("\n")}`);
  }

  if (findings.description) {
    sections.push(findings.description);
  }

  return sections.join("\n\n");
}
