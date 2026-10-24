import { parseRepoReference } from "./checkout.ts";
import type { LibrarianSource } from "./settings.ts";
import type { Findings, FindingsLocation } from "./tools/provide-results.ts";
import { fileWebUrl } from "./web-urls.ts";

function declaredSource(
  location: FindingsLocation,
  sources: LibrarianSource[],
): LibrarianSource | undefined {
  return (
    sources.find((source) => source.name === location.source) ??
    sources.find((source) => new URL(source.url).host === location.source.toLowerCase())
  );
}

// The same identity checkout_repo records, so a cited file links to the commit that was read.
export function locationIdentity(
  location: FindingsLocation,
  sources: LibrarianSource[],
): string | undefined {
  try {
    const source = sources.find((candidate) => candidate.name === location.source);
    return source?.roles.includes("clone")
      ? parseRepoReference(location.repo, sources, source.name).key
      : parseRepoReference(`https://${location.source}/${location.repo}`, sources).key;
  } catch {
    return undefined;
  }
}

export function locationUrl(
  location: FindingsLocation,
  checkouts: Record<string, string>,
  sources: LibrarianSource[],
): string | undefined {
  const source = declaredSource(location, sources);
  if (!source) {
    return undefined;
  }
  const identity = locationIdentity(location, sources);
  const sha = identity ? checkouts[identity] : undefined;
  return fileWebUrl(source, location.repo, sha?.slice(0, 12), location.file, location.lines);
}

export function formatLocation(location: FindingsLocation): string {
  const lineSuffix = location.lines ? `:${location.lines}` : "";
  return `\`${location.source}:${location.repo}/${location.file}${lineSuffix}\` — ${location.note}`;
}

export function renderFindingsMarkdown(
  findings: Findings,
  checkouts: Record<string, string>,
  sources: LibrarianSource[],
): string {
  const sections = [findings.summary];

  if (findings.locations.length > 0) {
    const bullets = findings.locations.map((location) => {
      const url = locationUrl(location, checkouts, sources);
      const citation = `- ${formatLocation(location)}`;
      return url ? `${citation}\n  ${url}` : citation;
    });
    sections.push(`## Locations\n\n${bullets.join("\n")}`);
  }

  if (findings.description) {
    sections.push(findings.description);
  }

  return sections.join("\n\n");
}
