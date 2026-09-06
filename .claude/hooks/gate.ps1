# Stop hook: refuse to end the turn while the project is red.
# Monorepo-aware: checks the project root AND each first-level subfolder
# (frontend/, backend/, ...) so a split layout is not silently skipped.
# Exit 2 on Stop prevents Claude from stopping and continues the turn.
$ErrorActionPreference = 'Continue'

$raw = [Console]::In.ReadToEnd()

# Loop guard. Without this, a failing gate re-fires forever.
$stopHookActive = $false
try {
  $data = $raw | ConvertFrom-Json -ErrorAction Stop
  if ($data.stop_hook_active) { $stopHookActive = $true }
} catch {
  if ($raw -match '"stop_hook_active"\s*:\s*true') { $stopHookActive = $true }
}
if ($stopHookActive) { exit 0 }

$projectDir = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }
$logDir = Join-Path $env:TEMP 'cc-gate'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$skip = @('node_modules', '.git', '.claude', '.venv', 'venv', 'dist', 'build', '.next', '__pycache__')
$roots = @($projectDir)
Get-ChildItem -Path $projectDir -Directory -ErrorAction SilentlyContinue |
  Where-Object { $skip -notcontains $_.Name } |
  ForEach-Object { $roots += $_.FullName }

$ran  = @()
$fail = @()
$logs = @()

foreach ($r in $roots) {
  $name = Split-Path $r -Leaf
  if ($r -eq $projectDir) { $name = 'root' }

  if ((Test-Path (Join-Path $r 'package.json')) -and (Test-Path (Join-Path $r 'tsconfig.json'))) {
    if (Get-Command npx -ErrorAction SilentlyContinue) {
      $ran += "typecheck:$name"
      $log = Join-Path $logDir "tsc-$name.log"
      Push-Location $r
      & npx --no-install tsc --noEmit *> $log
      $code = $LASTEXITCODE
      Pop-Location
      if ($code -ne 0) { $fail += "typecheck:$name"; $logs += $log }
    }
  }

  if ((Test-Path (Join-Path $r 'pyproject.toml')) -or (Test-Path (Join-Path $r 'pytest.ini'))) {
    $exe = $null; $pre = @()
    if (Get-Command pytest -ErrorAction SilentlyContinue)      { $exe = 'pytest' }
    elseif (Get-Command python -ErrorAction SilentlyContinue)  { $exe = 'python'; $pre = @('-m', 'pytest') }
    if ($exe) {
      $ran += "pytest:$name"
      $log = Join-Path $logDir "pytest-$name.log"
      Push-Location $r
      & $exe @pre -q *> $log
      $code = $LASTEXITCODE
      Pop-Location
      # pytest exit 5 = no tests collected. Treat as pass but say so.
      if ($code -eq 5) { $ran += "(no tests in $name)" }
      elseif ($code -ne 0) { $fail += "pytest:$name"; $logs += $log }
    }
  }
}

if ($ran.Count -eq 0) {
  @{ systemMessage = 'gate.ps1 ran no checks. No package.json+tsconfig.json or pyproject.toml found in root or first-level folders, or tsc/pytest not on PATH.' } |
    ConvertTo-Json -Compress
  exit 0
}

if ($fail.Count -gt 0) {
  [Console]::Error.WriteLine("Gate failed: $($fail -join ', ')")
  [Console]::Error.WriteLine("Ran: $($ran -join ', ')")
  foreach ($l in $logs) {
    [Console]::Error.WriteLine("--- $(Split-Path $l -Leaf) (last 20 lines) ---")
    Get-Content $l -Tail 20 | ForEach-Object { [Console]::Error.WriteLine($_) }
  }
  exit 2
}

exit 0
