#!/usr/bin/env bash

set -euo pipefail

: "${BASE_SHA:?BASE_SHA is required}"
: "${HEAD_SHA:?HEAD_SHA is required}"

invalid=0
while IFS= read -r -d '' path; do
  case "$path" in
    docs/* | *.md) ;;
    *)
      echo "::error file=${path}::Ветка docs/* может изменять только docs/** и Markdown-файлы."
      invalid=1
      ;;
  esac
done < <(git diff --name-only --diff-filter=ACMR -z "$BASE_SHA" "$HEAD_SHA")

if ((invalid != 0)); then
  exit 1
fi

echo "Границы документационного PR соблюдены."
