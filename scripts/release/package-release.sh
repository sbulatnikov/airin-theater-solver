#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_TAG:?RELEASE_TAG is required}"
: "${PREVIOUS_TAG:?PREVIOUS_TAG is required}"

mkdir -p release-artifacts
pnpm exec tsx scripts/release/generate-release-notes.ts "$PREVIOUS_TAG" "$RELEASE_TAG" release-artifacts/RELEASE_NOTES.md
tar -czf "release-artifacts/airin-theater-solver-${RELEASE_TAG}.tar.gz" -C dist .
cp CHANGELOG.md release-artifacts/CHANGELOG.md
(
  cd release-artifacts
  sha256sum CHANGELOG.md RELEASE_NOTES.md ./*.tar.gz > SHA256SUMS.txt
)
