#!/usr/bin/env bash
# Cuts release x.y.z from Unreleased: the changelog section, package.json, the commit, the annotated
# tag, and the push that starts the Release workflow. Review Unreleased before running it.
set -euo pipefail

version="${1:?usage: release.sh x.y.z}"

fail() {
  echo "release: $*" >&2
  exit 1
}

[[ "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "\"${version}\" is not x.y.z"
[[ "$(git symbolic-ref --short HEAD)" == "main" ]] || fail "not on main"
[[ -z "$(git status --porcelain)" ]] || fail "the working tree has changes"
git fetch --quiet origin main
head="$(git rev-parse HEAD)"
[[ "${head}" == "$(git rev-parse origin/main)" ]] || fail "main is not origin/main"
ci="$(gh run list --commit "${head}" --workflow CI --limit 1 --json status,conclusion --jq '.[0] | "\(.status) \(.conclusion)"')"
[[ "${ci}" == "completed success" ]] || fail "CI on ${head:0:7} is not green: ${ci:-no run}"

unreleased="$(awk '/^## \[Unreleased\]$/ { inside = 1; next } inside && /^## / { exit } inside && NF' CHANGELOG.md)"
[[ -n "${unreleased}" ]] || fail "Unreleased in CHANGELOG.md is empty"
current="$(node -p 'require("./package.json").version')"
if [[ "${version}" == "${current}" || "$(printf '%s\n%s\n' "${current}" "${version}" | sort -V | tail -1)" != "${version}" ]]; then
  fail "${version} is not greater than the current ${current}"
fi

awk -v heading="## [${version}] - $(date +%F)" '
  $0 == "## [Unreleased]" { print; print ""; print heading; next }
  { print }
' CHANGELOG.md > CHANGELOG.md.tmp
mv CHANGELOG.md.tmp CHANGELOG.md
npm version "${version}" --no-git-tag-version > /dev/null
# The Claude plugin's bin runs the CLI pinned to the plugin's own version.
node -e '
  const fs = require("node:fs");
  const file = "plugin/.claude-plugin/plugin.json";
  const plugin = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, `${JSON.stringify({ ...plugin, version: process.argv[1] }, null, 2)}\n`);
' "${version}"
scripts/sync-codex-plugin.mjs
npx biome format --write codex-plugin > /dev/null
git add CHANGELOG.md package.json package-lock.json plugin/.claude-plugin/plugin.json codex-plugin
git commit --quiet -m "chore(release): ${version}"

notes="$(mktemp)"
trap 'rm -f "${notes}"' EXIT
scripts/extract-release-notes.sh "v${version}" > "${notes}"
git tag -a "v${version}" --cleanup=verbatim -F "${notes}"
git push --atomic origin main "v${version}"
