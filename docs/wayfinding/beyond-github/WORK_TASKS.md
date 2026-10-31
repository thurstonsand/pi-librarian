# Work tasks

What the beyond-GitHub work still needs from the work machine: its self-hosted GitLab, and any GitHub Enterprise it can reach. Everything that needed a personal machine or account was measured from an orb on 2026-10-31 and is recorded where it applies in [`tool-surface.md`](tool-surface.md). Results from here go there too; delete this file when every task is ticked.

## Before the release

- [ ] **The self-hosted GitLab accepts `search_type=basic`.** Every project-scoped `search_code_gitlab` now sends it, because gitlab.com otherwise answers with exact code search, which ANDs words and reads `foo(` as a broken regex; see _gitlab.com_ under _`search_code_gitlab`_. Run one project search on the self-hosted instance with a pattern ending in `(`. The same results as before mean it is accepted or ignored; a `400` naming `search_type` means an older GitLab rejects it, and the client must send it only where it is supported.
- [ ] **GitHub Enterprise, if there is one.** A declared `kind: "github"` source other than github.com builds a client at `<url>/api/v3` and reads its token from `tokenEnv` or `GITHUB_TOKEN`. Declare it with `tokenEnv`, run one `search_code_github`, one `search_repos_github`, and one `read_file`; check the `source` enum offers both instances, each call reaches the right host, and blob and repository links in digests resolve on the GHE host. With no GHE to reach, it ships on unit coverage.
- [ ] **The unscoped path of `search_code_gitlab`, if an instance allows it.** With `advancedSearch: true` and no `project`, the tool calls `GET /search?scope=blobs` and resolves each result's `project_id` to a path. gitlab.com refuses global search, so this has unit coverage only. On any instance with instance-wide advanced search, run an unscoped search and check files are grouped under the right project paths.

## After the release

- [ ] **Migrate this machine's configuration**: remove the `librarian.tools` array, which 0.7.0 refuses, and replace the pi-web-tools package with pi-librarian. Parallel is not used here, so there is no `apiKeyCommand` to move.
