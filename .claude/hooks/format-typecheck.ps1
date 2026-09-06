# PostToolUse hook: format and typecheck the file Claude just edited.
# Monorepo-aware: for .ts/.tsx it walks up from the file to the nearest
# tsconfig.json and runs tsc there. PostToolUse cannot block; exit 2 shows
# stderr to Claude so it can react.
$ErrorActionPreference = 'Continue'

$raw = [Console]::In.ReadToEnd()
try { $data = $raw | ConvertFrom-Json -ErrorAction Stop } catch {
  @{ systemMessage = 'format-typecheck.ps1 could not parse hook input; skipped.' } | ConvertTo-Json -Compress
  exit 0
}

$file = ''
if ($data.tool_input -and $data.tool_input.file_path) { $file = [string]$data.tool_input.file_path }
if ([string]::IsNullOrWhiteSpace($file)) { exit 0 }
if (-not (Test-Path $file)) { exit 0 }

$projectDir = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }
$logDir = Join-Path $env:TEMP 'cc-gate'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$ext = [System.IO.Path]::GetExtension($file).ToLower()

function Find-Up([string]$start, [string]$marker) {
  $d = Split-Path -Parent (Resolve-Path $start)
  while ($d -and $d.Length -ge $projectDir.Length) {
    if (Test-Path (Join-Path $d $marker)) { return $d }
    $parent = Split-Path -Parent $d
    if ($parent -eq $d) { break }
    $d = $parent
  }
  return $null
}

if ($ext -in '.ts', '.tsx', '.js', '.jsx') {
  if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { exit 0 }
  $tsRoot = Find-Up $file 'tsconfig.json'
  if (-not $tsRoot) { exit 0 }   # not a TypeScript project; nothing to check
  Push-Location $tsRoot
  & npx --no-install prettier --write $file *> $null
  $log = Join-Path $logDir 'tsc-inline.log'
  & npx --no-install tsc --noEmit *> $log
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) {
    [Console]::Error.WriteLine("Typecheck failed after editing $file (project: $tsRoot):")
    Get-Content $log -Tail 20 | ForEach-Object { [Console]::Error.WriteLine($_) }
    exit 2
  }
}
elseif ($ext -eq '.py') {
  if (-not (Get-Command ruff -ErrorAction SilentlyContinue)) { exit 0 }
  & ruff format $file *> $null
  $log = Join-Path $logDir 'ruff.log'
  & ruff check $file *> $log
  if ($LASTEXITCODE -ne 0) {
    [Console]::Error.WriteLine("Lint failed after editing $file :")
    Get-Content $log -Tail 20 | ForEach-Object { [Console]::Error.WriteLine($_) }
    exit 2
  }
}

exit 0
