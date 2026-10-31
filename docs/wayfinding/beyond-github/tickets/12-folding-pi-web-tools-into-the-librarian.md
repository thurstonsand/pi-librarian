---
status: closed
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

## Decisions

Settled with the user on 2026-10-24 ("do the prefactor, and otherwise complete ticket 12") from the positions proposed in the session, then built on `beyond-github`.

1. **Packaging.** Everything ships as a normal dependency: `playwright-core` (no browser download; it drives the user's Chrome), the unified/rehype/remark stack. `parallel-web` is gone rather than optional — Parallel is two `POST`s with an `x-api-key` header (`/v1/search`, `/v1/extract`, confirmed against the docs and the SDK's `src/resources/top-level.ts`), so `parallel.ts` calls them with `fetch` and validates the responses with TypeBox. That also settles question 7.
2. **Runs get the web tools by default.** `web_fetch` always, `web_search` when a Parallel key is configured, both removable through `librarian.tools.disabled`. Extra tools existed for exactly this and are removed with it: `librarian.tools.extra`, `librarian.extensions`, `extra-tools.ts`, `stripExtensionHooks`, and extension loading in runs. In the main session the web tools are registered and active, independent of `/librarian`.
3. **Settings move to `librarian.web.*`**: `web.parallel.apiKeyCommand`, `web.fetch.browser.{executablePath,profileDir}`, `web.fetch.challenge.{escalation,headlessWaitSecs,headedWaitSecs}`. The whole `librarian` block is now strict, so a leftover `extensions` or `tools.extra` is an error naming the key, not silently ignored.
4. **Names stay `web_search` and `web_fetch`.**
5. **The overlaps:**
   - **One GitHub client.** The prefactor gave `GitHubClient` validated `get`/`getRaw`/`graphql` primitives and rebuilt the repo tools' calls on them; the GitHub fetcher takes the same per-source client providers, so one token resolution (`GITHUB_TOKEN`/`GH_TOKEN`, then `gh auth token`) and one error path serve both, and Octokit's derived response types are replaced by TypeBox schemas. The `~/.pi/agent/github-token` file web-tools also read is dropped. As a consequence `web_fetch` resolves URLs on any declared `github` source, GHE included.
   - **Files.** `read_file` (repo + path) and `web_fetch` (a URL) both stay; they now share the client, so the duplication is one of entry points, not of implementations.
   - **Commit history** stays in `web_fetch` for URLs; the prompt still prefers a clone and `git log`.
   - **Issues get no new tools.** The issue fetcher reads the timeline, keeps only `closed`, `reopened`, `cross-referenced`, `referenced`, and `connected`, renders them in `conversation.md`, and states `closed by commit <sha>` as a fact. Listings show `[state/state_reason]` per row. The prompt tells runs that `completed` alone is not evidence of a fix.
   - **Authentication**: as above.
6. **Firecrawl's Developer Index** stays out of this fold: an evaluation for the personal machine, as a possible `web_search` backend later. Since evaluated and dropped; see _Firecrawl's Developer Index is not code search_ in the tool surface.
7. **The `downgrade` branch** needs nothing for `parallel-web`, which is no longer a dependency. `playwright-core` resolved at 1.64.1 on the constrained mirror, so web-tools' 1.63.0 pin does not carry over.

pi-web-tools itself gets a final release whose README points here, then `npm deprecate`; installing both makes pi report a tool-name clash at startup.

## Measured live

Run on 2026-10-31 from an orb, with a real Parallel key, through `createWebTools` and in pi 1.4.0 with `-e ./extensions/librarian.ts`.

- **`web_search`** returns results with excerpts, at most 8. With `after_date: "2026-09-01"`, every date in the results was in October 2026.
- **`apiKeyCommand` alone** registers `web_search`, and a rotated key takes effect on the next call: with `cat` of a file as the command, a stale key in the file was a `401`, and rewriting the file made the next call in the same process succeed.
- **The Parallel fetcher** gives an `excerpt` without `objective` and `highlights` with one, on `orm.drizzle.team/docs/transactions`.
- **An invalid key** was reported as a bare `HTTP 401`. Parallel refuses a key before the API proper, in a gateway's shape, `{"code":16,"message":"Invalid API key (C.1)"}`, while every other error seen — `422`s from both endpoints — is the documented `{"error":{"message"}}`. The client now reads both, so the message is `Parallel search returned HTTP 401: Invalid API key (C.1)`.
- **A librarian run** asked where Bun documents its fake timers traced `✓ search web How Bun bun:test implements fake timers … (5 results)`, then `✓ fetch https://bun.sh/blog/bun-v1.4 +1 more (2 documents)`, both pages from the Parallel fetcher. Three earlier runs never searched: given a documentation question, the model went straight to a URL it could guess — a raw GitHub file, `docs.stripe.com/api/idempotent_requests`, `nodejs.org/en/blog/release` — and each fetch answered it. That is the prompt working, not `web_search` being missed.
