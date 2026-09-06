# PreToolUse hook: deny destructive shell commands.
# Fails CLOSED: if it cannot inspect the command, it denies rather than allows.
$ErrorActionPreference = 'Stop'

function Send-Deny([string]$Reason) {
  $payload = @{
    hookSpecificOutput = @{
      hookEventName            = 'PreToolUse'
      permissionDecision       = 'deny'
      permissionDecisionReason = $Reason
    }
  }
  $payload | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

try {
  $raw = [Console]::In.ReadToEnd()
  $data = $raw | ConvertFrom-Json -ErrorAction Stop
} catch {
  Send-Deny "block-destructive.ps1 could not parse the hook input, so it cannot verify this command is safe. Denying."
}

$cmd = ''
if ($data.tool_input -and $data.tool_input.command) { $cmd = [string]$data.tool_input.command }
if ([string]::IsNullOrWhiteSpace($cmd)) { exit 0 }

# Strip heredoc bodies so documentation text that merely mentions a
# destructive command is not treated as one. Quoted strings are NOT
# stripped: sh -c '...' puts a real command inside single quotes.
$scan = $cmd
$scan = [regex]::Replace($scan, "(?s)<<-?\s*'?(\w+)'?.*?\r?\n\1", ' ')

$patterns = @(
  @{ Match = 'rm\s+-rf';                Reason = 'Destructive delete blocked by hook. Run it yourself if intended.' },
  @{ Match = 'Remove-Item.*-Recurse';   Reason = 'Recursive delete blocked by hook. Run it yourself if intended.' },
  @{ Match = 'git\s+push\s+--force';    Reason = 'Force push blocked by hook.' },
  @{ Match = 'git\s+reset\s+--hard';    Reason = 'Hard reset blocked by hook. Use /rewind or do it yourself.' },
  @{ Match = 'DROP\s+TABLE';            Reason = 'Destructive SQL blocked by hook.' },
  @{ Match = 'Format-Volume';           Reason = 'Disk format blocked by hook.' }
)

foreach ($p in $patterns) {
  if ($scan -match $p.Match) { Send-Deny $p.Reason }
}

exit 0
