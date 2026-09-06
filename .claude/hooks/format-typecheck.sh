#!/usr/bin/env bash
# PostToolUse hook: format and typecheck the file Claude just edited.
# PostToolUse cannot block; exit 2 shows stderr to Claude so it can react.
set -uo pipefail

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  printf '{"systemMessage":"format-typecheck.sh is disabled: jq is not installed."}\n'
  exit 0
fi

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx)
    command -v npx >/dev/null 2>&1 || exit 0
    npx --no-install prettier --write "$file" >/dev/null 2>&1
    if ! npx --no-install tsc --noEmit >/tmp/cc-tsc.log 2>&1; then
      echo "Typecheck failed after editing $file:" >&2
      tail -n 20 /tmp/cc-tsc.log >&2
      exit 2
    fi
    ;;
  *.py)
    command -v ruff >/dev/null 2>&1 || exit 0
    ruff format "$file" >/dev/null 2>&1
    if ! ruff check "$file" >/tmp/cc-ruff.log 2>&1; then
      echo "Lint failed after editing $file:" >&2
      tail -n 20 /tmp/cc-ruff.log >&2
      exit 2
    fi
    ;;
esac

exit 0
