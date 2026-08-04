# Downgrade pins

`main` plus pins for environments whose registry mirror lags npm. Install with `pi install git:github.com/thurstonsand/pi-librarian@downgrade`; everywhere else use `npm:@thurstonsand/pi-librarian` at latest.

| Package                  | Pinned    | `main` wants                    | Pinned on  | Recheck after |
| ------------------------ | --------- | ------------------------------- | ---------- | ------------- |
| `@octokit/core`          | `7.0.6`   | `7.0.7`, via `@octokit/rest`    | 2026-08-03 | 2026-10-03    |
| `@octokit/graphql`       | `9.0.3`   | `9.0.4`, via `@octokit/core`    | 2026-08-03 | 2026-10-03    |
| `@octokit/request`       | `10.0.11` | `10.0.13`, via `@octokit/core`  | 2026-08-03 | 2026-10-03    |
| `@octokit/request-error` | `7.1.0`   | `^7.1.1`, a direct dependency   | 2026-08-03 | 2026-10-03    |

`@octokit/request-error` is a direct dependency, so it cannot take an `overrides` entry and its range is narrowed to an exact version instead. That line conflicts on rebase whenever `main` bumps the range — take `main`'s line, then re-narrow it. The alternative, a lockfile-only pin, would evaporate silently the moment `main`'s range stopped admitting `7.1.0`.
