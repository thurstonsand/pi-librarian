---
status: open
type: grilling
blocked-by: []
---

# Folding pi-web-tools into the librarian

## Decision already made

`pi-web-tools` is deprecated and its functionality moves into this package. That settles the question the map left open under _Converging with `pi-web-tools`_: the repositories merge, in this direction. What remains is how, and what the librarian looks like once it can reach the web.

## What there is to carry

As of `pi-web-tools` `ad20628` (0.4.3, 2026-10-22). Everything here is functionality, and none of it should be lost in the move.

**`web_search`** — backed by Parallel. Takes an objective plus optional queries, returns at most 8 results with excerpts, inline. Registered only when a Parallel key resolves, from `PARALLEL_API_KEY` or `webTools.parallel.apiKeyCommand`; the key command is resolved lazily.

**`web_fetch`** — routes each URL through a fetcher chain, `github → parallel → local`, first document wins, and writes every body to a per-call artifact directory with a bounded digest. Its GitHub fetcher resolves, through Octokit:

- repository READMEs, individual files including `blob` URLs and bare `owner/repo/path` refs, and directories as listings
- issues, pull requests, and Discussions with their conversations; PRs carry the diff
- issue and PR listings, `github.com/{owner}/{repo}/issues` or `/pulls`, optionally with `?q=` in GitHub search syntax, up to 100 matches — **a repository-scoped issue and PR search, delivered through a fetch**
- commits with metadata, comments, and a patch; commit history scoped by ref and path, up to 100
- releases, tags, branches, and GitHub Actions runs with jobs, steps, and artifacts

The Parallel fetcher handles everything else; the local fetcher is a `playwright-core` browser with a rehype HTML-to-markdown pipeline, which can reach pages behind a login through `/browser open` and download non-HTML files such as PDFs. Bot-wall challenges escalate from headless to a visible browser window under `webTools.fetch.challenge`.

**Settings and commands**: `webTools.parallel.apiKeyCommand`, `webTools.fetch.browser.{executablePath,profileDir}`, `webTools.fetch.challenge.{escalation,headlessWaitSecs,headedWaitSecs}`; the `/browser` command; GitHub auth from `GH_TOKEN`, then `~/.pi/agent/github-token`, then `gh auth token`.

**Rendering**: both tools implement `renderCall`/`renderResult`, link URLs and titles with OSC 8 hyperlinks where the terminal supports them, and time their rows like pi's own.

**Dependencies**: `@octokit/rest`, `parallel-web` (optional), `playwright-core` (about 12 MB), and the unified/rehype/remark stack.

## What the librarian gains, and where it overlaps

The librarian today cannot read an issue or a pull request. With `web_fetch` it can read any of them with their conversations, and search a repository's issues and PRs through a listing URL. That is most of what Firecrawl's Developer Index was proposed for on the code side; the Developer Index still adds cross-repository search and natural-language questions over READMEs and documentation.

Three overlaps need a decision rather than a merge:

- **`web_fetch`'s GitHub file and directory fetcher versus `read_github_file`** and the planned `read_file`. Two ways to read one file is one too many.
- **Commit history through `web_fetch`** versus `checkout_repo` plus `git log`, which the librarian prompt already prefers.
- **Issue and PR search against what the GitHub spike measured.** `web_fetch`'s listing URL already searches one repository's issues and PRs. The spike found that "was this bug fixed" is settled by structured signals a listing does not show: `state_reason` (`completed` can mean a usage answer, not a code fix), the `closed` timeline event's `commit_id`, and `cross-referenced` events — and that a raw timeline is mostly noise, 100+ events on one popular issue, so it needs filtering to `closed`, `reopened`, `cross-referenced`, `referenced`, and `connected`. Whether `web_fetch`'s issue fetcher grows that filter, or a dedicated `search_issues_github` / `read_issue_github` pair earns its place, is this ticket's call. The measurements are cheap either way: sub-second, and on the search bucket rather than code search's ten a minute.
- **GitHub authentication**, resolved one way in `extensions/librarian/github.ts` and another in web-tools' `fetchers/github/auth.ts`.

## Questions

1. **Packaging.** Does `playwright-core` and the rehype stack ship in every install, or behind an optional dependency the way `parallel-web` already is?
2. **Do librarian runs get web tools by default**, or only through `librarian.tools.extra` as today?
3. **Settings namespace.** Keep `webTools.*` because it describes what it configures, or move under `librarian.*` because that is the package? Backwards compatibility is not a constraint.
4. **Tool names.** `web_search` and `web_fetch` are established, short, and accurate; the `search_code_*` naming rule is about engines, and does not obviously apply to a tool that fetches by URL.
5. **The overlaps above**, one by one.
6. **Where Firecrawl's Developer Index goes**, now that the delivery model it matches — `web_search`'s — lives in the same package.
7. **The `downgrade` branch.** `parallel-web` is not on at least one corporate registry mirror at any version; web-tools carried an uncommitted local patch so it would typecheck without the SDK. Whether that becomes a real fix or a pin is part of the move.
