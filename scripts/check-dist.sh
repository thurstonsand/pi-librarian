#!/usr/bin/env bash
# Fails the build when a module that spawns the fetch worker does not sit beside it. The client
# resolves `fetch-worker` next to its own file, so moving it into another chunk or directory breaks
# every local fetch at runtime rather than at build time.
set -euo pipefail

fail() {
  echo "check-dist: $*" >&2
  exit 1
}

for tree in dist/core dist/cli; do
  resolvers="$(grep -rlF 'fetch-worker${' "${tree}" || true)"
  [[ -n "${resolvers}" ]] || fail "no fetch worker resolver in ${tree}"
  while IFS= read -r resolver; do
    worker="$(dirname "${resolver}")/fetch-worker.${resolver##*.}"
    [[ -f "${worker}" ]] || fail "${resolver} resolves ${worker}, which the build did not emit"
    # Loading proves every chunk and dependency the worker imports is present.
    loaded="$(node "${worker}" 2>&1 || true)"
    [[ "${loaded}" == "usage: fetch-worker"* ]] || fail "${worker} does not load: ${loaded}"
  done <<< "${resolvers}"
done
