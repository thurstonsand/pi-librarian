#!/usr/bin/env bash
# Pi shows a package's changelog after an update by reading `## [x.y.z]` headings and comparing them
# with package.json's version, so every heading has to parse, the versions have to descend, and the
# newest one has to be the version package.json declares.
set -euo pipefail

changelog="${1:-CHANGELOG.md}"
package_version="$(node -p 'require("./package.json").version')"
status=0
previous=""
top=""

while IFS= read -r heading; do
  if [[ "${heading}" == "## [Unreleased]" ]]; then
    continue
  fi
  if [[ ! "${heading}" =~ ^"## ["([0-9]+\.[0-9]+\.[0-9]+)"] - "[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "${changelog}: \"${heading}\" is not \"## [Unreleased]\" or \"## [x.y.z] - YYYY-MM-DD\"" >&2
    status=1
    continue
  fi
  version="${BASH_REMATCH[1]}"
  if [[ -z "${top}" ]]; then
    top="${version}"
  elif [[ "${version}" == "${previous}" || "$(printf '%s\n%s\n' "${version}" "${previous}" | sort -V | tail -1)" != "${previous}" ]]; then
    echo "${changelog}: ${version} comes after ${previous}; versions must strictly descend" >&2
    status=1
  fi
  previous="${version}"
done < <(grep '^## ' "${changelog}")

if [[ "${top}" != "${package_version}" ]]; then
  echo "${changelog}: the newest release is ${top:-missing}, but package.json says ${package_version}" >&2
  status=1
fi

exit "${status}"
