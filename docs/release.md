# Release

`@thurstonsand/pi-librarian` publishes to npm from GitHub Actions when a stable `v*` tag is pushed.

## Changelog

`CHANGELOG.md` starts with `## [Unreleased]`, followed by one `## [x.y.z] - YYYY-MM-DD` section per release, newest first. Pi reads these headings after a package update and shows the entries newer than the version it last saw, so `mise run check` fails when a heading does not parse, when versions do not strictly descend, or when the newest one is not the `version` in `package.json`.

`package.json` carries the released version on `main`. A git install, such as the `downgrade` branch, reads it from there; a placeholder would make Pi show the whole changelog on every launch.

Versions follow semantic versioning: a release with any new feature (an `Added` entry), a raised floor (a higher minimum Pi, Node, OS, or other dependency version), or anything breaking is at least minor, and breaking is major from 1.0 on; patch is only for fixes and dependency updates.

## Release flow

1. Review `## [Unreleased]`: a one-line summary first, then the `### Breaking`, `### Added`, `### Changed`, and `### Fixed` entries that apply.
2. Run `mise run release X.Y.Z`. It refuses unless `main` is checked out, clean, equal to `origin/main`, and green in CI, Unreleased has entries, and `X.Y.Z` is greater than the current version. Then it:
   - moves Unreleased's entries under `## [X.Y.Z] - <today>`, leaving an empty `## [Unreleased]`;
   - writes `X.Y.Z` into `package.json` and `package-lock.json`;
   - commits `chore(release): X.Y.Z`;
   - creates the annotated tag `vX.Y.Z`, whose body is that section, from `scripts/extract-release-notes.sh`;
   - pushes `main` and the tag together.
3. The `Release` workflow first checks that the tag, `package.json`, and the changelog's newest section agree, then runs CI, packs the package, and publishes it to npm with the `latest` dist-tag and provenance. It commits nothing.
