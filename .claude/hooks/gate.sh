#!/usr/bin/env bash
# Stop hook: refuse to end the turn while the project is red.
#
# POSIX twin of gate.ps1. THE TWO MUST STAY IN STEP - the previous version of
# this file checked only the current directory, and both manifests in this repo
# live in subfolders (frontend/, backend/), so at the repo root it found nothing
# and exited 0 having run no checks at all. It announced that rather than lying,
# which is the only reason it was not worse; a gate that announces it is not
# gating is still not a gate. See docs/debt.md, fix-applied-to-one-of-two-twins.
#
# What it runs, per root and per first-level subfolder:
#   package.json + tsconfig.json -> tsc --noEmit, and `npm run lint` if defined
#   pyproject.toml               -> pytest, and ruff check if available
#
# Exit 2 on Stop prevents Claude from stopping and continues the turn.
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

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
log_dir="${TMPDIR:-/tmp}/cc-gate"
mkdir -p "$log_dir"

ran=""
fail=""
logs=""
interp=""

# Resolve THIS project's interpreter before falling back to whatever is on PATH.
# Windows Smart App Control blocks pip's pytest.exe shim, so preferring the shim
# reported "pytest FAILED" while every test passed. Report which interpreter ran
# so a wrong one is visible rather than inferred.
# See docs/debt.md, check-red-for-the-wrong-reason.
resolve_python() {
  local root="$1"
  for candidate in \
    "$root/.venv/bin/python" \
    "$root/.venv/Scripts/python.exe" \
    "$project_dir/.venv/bin/python" \
    "$project_dir/.venv/Scripts/python.exe"; do
    [ -x "$candidate" ] && { printf '%s' "$candidate"; return 0; }
  done
  # FALLING BACK IS NOT NEUTRAL, so it is announced rather than done quietly.
  # A root with no venv sends the suite to whatever is on PATH - and the system
  # interpreter on this machine is missing `anthropic` and was missing
  # `python-multipart`, so it runs the tests green while being unable to serve
  # the app that those tests are about.
  # See docs/debt.md, green-under-an-interpreter-that-cannot-serve.
  if [ -d "$root/.venv" ] || [ -d "$project_dir/.venv" ]; then
    echo "gate: a .venv exists but no interpreter inside it was executable; falling back to PATH." >&2
  fi
  for candidate in python3 python; do
    command -v "$candidate" >/dev/null 2>&1 && { command -v "$candidate"; return 0; }
  done
  return 1
}

roots="$project_dir"
for d in "$project_dir"/*/; do
  name="$(basename "$d")"
  case "$name" in
    node_modules|.git|.claude|.venv|venv|dist|build|.next|__pycache__) continue ;;
  esac
  roots="$roots
$d"
done

while IFS= read -r r; do
  [ -z "$r" ] && continue
  r="${r%/}"
  name="$(basename "$r")"
  [ "$r" = "$project_dir" ] && name="root"

  # ---- TypeScript ----
  if [ -f "$r/package.json" ] && [ -f "$r/tsconfig.json" ] && command -v npx >/dev/null 2>&1; then
    ran="${ran}typecheck:${name} "
    log="$log_dir/tsc-$name.log"
    ( cd "$r" && npx --no-install tsc --noEmit ) >"$log" 2>&1 \
      || { fail="${fail}typecheck:${name} "; logs="${logs}${log} "; }

    # Lint, only when the package actually defines the script. Silence here was
    # the gap: lint was run by hand all build, which means it was not gated.
    if grep -q '"lint"[[:space:]]*:' "$r/package.json" && command -v npm >/dev/null 2>&1; then
      ran="${ran}eslint:${name} "
      log="$log_dir/eslint-$name.log"
      ( cd "$r" && npm run --silent lint ) >"$log" 2>&1 \
        || { fail="${fail}eslint:${name} "; logs="${logs}${log} "; }
    fi
  fi

  # ---- Python ----
  if [ -f "$r/pyproject.toml" ] || [ -f "$r/pytest.ini" ]; then
    if py="$(resolve_python "$r")"; then
      interp="$py"
      ran="${ran}pytest:${name} "
      log="$log_dir/pytest-$name.log"
      ( cd "$r" && "$py" -m pytest -q ) >"$log" 2>&1
      code=$?
      # pytest exit 5 = no tests collected. Treat as pass, but say so.
      if [ "$code" -eq 5 ]; then
        ran="${ran}(no tests in ${name}) "
      elif [ "$code" -ne 0 ]; then
        fail="${fail}pytest:${name} "
        logs="${logs}${log} "
      fi

      if ( cd "$r" && "$py" -m ruff --version ) >/dev/null 2>&1; then
        ran="${ran}ruff:${name} "
        log="$log_dir/ruff-$name.log"
        ( cd "$r" && "$py" -m ruff check --no-cache . ) >"$log" 2>&1 \
          || { fail="${fail}ruff:${name} "; logs="${logs}${log} "; }
      fi
    fi
  fi
done <<EOF
$roots
EOF

if [ -z "$ran" ]; then
  # No checks ran at all. Say so - a silent no-op gate is worse than no gate.
  printf '{"systemMessage":"gate.sh ran no checks. No package.json+tsconfig.json or pyproject.toml found in root or first-level folders, or tsc/pytest not found."}\n'
  exit 0
fi

if [ -n "$fail" ]; then
  echo "Gate failed: ${fail}" >&2
  echo "Ran: ${ran}" >&2
  [ -n "$interp" ] && echo "pytest interpreter: ${interp}" >&2
  for l in $logs; do
    echo "--- $(basename "$l") (last 20 lines) ---" >&2
    tail -n 20 "$l" >&2
  done
  exit 2
fi

exit 0
