---
name: npm-release
description: Prepare, tag, publish, and verify an npm release for this repo. Use when the user wants to release pi-librarian to npm.
---

# npm Release

Use this skill when preparing and publishing a new release for `pi-librarian`.

## Release model

- Release from `main` with `mise run release X.Y.Z`, which writes the changelog section, `package.json`, the release commit, and the annotated tag, and pushes `main` and the tag. `docs/release.md` describes what it checks and does.
- npm publishing is tag-driven through `.github/workflows/release.yml`, which refuses a tag that does not match `package.json` and the changelog.
- `CHANGELOG.md` holds the human release notes under `## [Unreleased]` until the task gives them a `## [X.Y.Z] - YYYY-MM-DD` heading; the tag body is that section.
- Stable releases are `vX.Y.Z` tags. Stable package tags are immutable. Never force-push a stable release tag.
- The GitHub Action uses npm Trusted Publishing through OIDC.
- The `downgrade` branch tracks `main` with specific downgrades needed for a limited environment.

## 1. Inspect release state

- Check the current git state before touching anything. If the working tree has unrelated changes, leave them alone. If release-relevant changes are uncommitted, ask whether they belong in the release before proceeding.
- Inspect changes since the latest stable tag.
- Summarize:
  - user-facing features and fixes
  - package, install, or release changes
  - API changes
  - documentation updates
  - likely semver bump: patch, minor, or major. Raising the minimum Pi version is a minor bump.

Ask the user to confirm the target version unless they already specified it.

## 2. Review the release notes

Review `## [Unreleased]` in `CHANGELOG.md` against the changes since the latest tag. It should read:

```md
## [Unreleased]

Short release summary.

### Breaking

- Change that needs the user to act.

### Added

- User-facing change.

### Changed

- Package or install change.

### Fixed

- User-facing fix.
```

Omit empty sections. Do not list every internal refactor. If the user edits the notes, preserve their wording. Commit and push the reviewed notes, then wait for CI on that commit to pass.

If release mechanics change, update `docs/release.md`.

## 3. Verify locally

Run the full gate and inspect package contents:

```sh
mise run check
npm pack --dry-run
```

Do not proceed on failures. Fix them or report the blocker.

## 4. Release

```sh
mise run release X.Y.Z
```

The task refuses unless `main` is clean, equal to `origin/main`, and green in CI, Unreleased has entries, and the version is greater than the current one. If it refuses, fix the cause and rerun it; do not tag by hand. If a tag already exists, stop and inspect; do not overwrite it.

## 5. Watch GitHub Actions publishing

The tag should trigger the Release workflow.

- Use the `gh` tool to find the release (`gh run list --workflow Release`).
- Watch the release action to completion.
- The workflow should check that the tag, `package.json`, and the changelog agree, run CI, and publish to npm with the `latest` dist-tag.
- If there is an error, inform the user what went wrong, including a proposed fix when feasible.

## 6. Final verification

Confirm npm and git remote state:

```sh
VERSION=X.Y.Z
npm view @thurstonsand/pi-librarian version dist-tags --json
git ls-remote --tags origin "v${VERSION}"
git status --short
```

## 7. Rebase the `downgrade` branch

The `downgrade` install resets to the branch tip, so it stays on the previous version until the branch carries the release. Load the `downgrade-rebase` skill and follow it with `v${VERSION}` as the target.

## 8. Final report

Final report should include:

- npm version published
- release commit hash and tag
- workflow watched and whether it passed
- verification status
- the `downgrade-rebase` report: new `downgrade` commit, pin confirmation, and any pins now due for recheck
- any follow-up work or issues encountered
