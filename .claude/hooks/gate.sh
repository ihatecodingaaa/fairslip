#!/usr/bin/env bash
# Stop hook: refuse to end the turn while the project is red.
# Exit 2 on Stop prevents Claude from stopping and continues the turn.
# A disabled gate announces itself rather than passing silently.
set -uo pipefail

input=$(cat)

# Loop guard. Without this, a failing gate re-fires forever.
# jq if available, grep fallback so the guard survives a missing dependency.
if command -v jq >/dev/null 2>&1; then
  active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')
else
  printf '{"systemMessage":"gate.sh: jq is not installed. Loop guard is running on a grep fallback - install jq."}\n'
  if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    active=true
  else
    active=false
  fi
fi
[ "$active" = "true" ] && exit 0

ran=""
fail=""

if [ -f package.json ] && command -v npx >/dev/null 2>&1; then
  ran="${ran}typecheck "
  npx --no-install tsc --noEmit >/tmp/cc-gate-tsc.log 2>&1 || fail="${fail}typecheck "
fi

if [ -f pytest.ini ] || [ -f pyproject.toml ]; then
  if command -v pytest >/dev/null 2>&1; then
    ran="${ran}pytest "
    pytest -q >/tmp/cc-gate-pytest.log 2>&1 || fail="${fail}pytest "
  fi
fi

if [ -z "$ran" ]; then
  # No checks ran at all. Say so - a silent no-op gate is worse than no gate.
  printf '{"systemMessage":"gate.sh ran no checks. No package.json/pyproject.toml found, or tsc/pytest missing."}\n'
  exit 0
fi

if [ -n "$fail" ]; then
  echo "Gate failed: ${fail}" >&2
  echo "--- last 20 lines ---" >&2
  tail -n 20 /tmp/cc-gate-tsc.log /tmp/cc-gate-pytest.log 2>/dev/null >&2
  exit 2
fi

exit 0
