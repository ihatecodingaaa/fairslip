#!/usr/bin/env bash
# PreToolUse hook: deny destructive shell commands.
# Fails CLOSED: if it cannot inspect the command, it denies rather than allows.
set -uo pipefail

deny() {
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  else
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  fi
  exit 0
}

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  deny "block-destructive.sh cannot run: jq is not installed. Install jq, or remove this hook from .claude/settings.json if you accept the risk."
fi

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

case "$cmd" in
  *"rm -rf"*)            deny "Destructive delete blocked by hook. Run it yourself if intended." ;;
  *"git push --force"*)  deny "Force push blocked by hook." ;;
  *"git reset --hard"*)  deny "Hard reset blocked by hook. Use /rewind or do it yourself." ;;
  *"DROP TABLE"*)        deny "Destructive SQL blocked by hook." ;;
esac

exit 0
