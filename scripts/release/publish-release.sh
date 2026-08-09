#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_TAG:?RELEASE_TAG is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
  gh release upload "$RELEASE_TAG" release-artifacts/* --clobber
  gh release edit "$RELEASE_TAG" \
    --notes-file release-artifacts/RELEASE_NOTES.md \
    --title "$RELEASE_TAG" \
    --latest
else
  gh release create "$RELEASE_TAG" release-artifacts/* \
    --latest \
    --notes-file release-artifacts/RELEASE_NOTES.md \
    --title "$RELEASE_TAG" \
    --verify-tag
fi
