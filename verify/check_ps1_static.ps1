# check_ps1_static.ps1 - r13 (R12.3) static gate for PowerShell tooling.
#   1) every .ps1 must PARSE (PSParser zero errors)
#   2) agent tools + this test harness must be ASCII-only (PS 5.1 reads .ps1 as GBK -> non-ASCII corrupts; AGENTS sec.5)
#   3) agent tools must NOT hardcode the root/FR paths (config.ps1 is the single source; r13 P2-C)
# Wired into the gate suite. Exit 0 = clean, 1 = any violation. ASCII-only file.
$ErrorActionPreference = 'Continue'
$ROOT = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
$fail = 0
function Fail($n) { Write-Output "STATIC FAIL: $n"; $script:fail++ }
function Pass($n) { Write-Output "STATIC PASS: $n" }

$allPs = @(
  "$ROOT\run.ps1", "$ROOT\runraw.ps1", "$ROOT\engine_launch.ps1",
  "$ROOT\agent\tools\config.ps1", "$ROOT\agent\tools\_identity.ps1", "$ROOT\agent\tools\runtime.ps1", "$ROOT\agent\tools\fr_agent.ps1",
  "$ROOT\verify\integration_runtime.ps1", "$ROOT\verify\check_ps1_static.ps1"
)
# 1) parse every script
foreach ($f in $allPs) {
  if (-not (Test-Path $f)) { Fail "missing $f"; continue }
  $errs = $null
  [void][System.Management.Automation.PSParser]::Tokenize((Get-Content $f -Raw), [ref]$errs)
  if ($errs -and $errs.Count -gt 0) { Fail "PARSE $f ($($errs.Count) errors)" } else { Pass "PARSE $f" }
}

# 2) ASCII-only for agent tools + test harness (run.ps1/runraw.ps1/engine_launch.ps1/config.ps1 also kept ASCII by convention)
$asciiFiles = @(
  "$ROOT\run.ps1", "$ROOT\runraw.ps1", "$ROOT\engine_launch.ps1",
  "$ROOT\agent\tools\config.ps1", "$ROOT\agent\tools\_identity.ps1", "$ROOT\agent\tools\runtime.ps1", "$ROOT\agent\tools\fr_agent.ps1",
  "$ROOT\verify\integration_runtime.ps1", "$ROOT\verify\check_ps1_static.ps1"
)
foreach ($f in $asciiFiles) {
  $bytes = [System.IO.File]::ReadAllBytes($f)
  $bad = 0
  foreach ($b in $bytes) { if ($b -gt 127) { $bad++ } }
  if ($bad -eq 0) { Pass "ASCII $f" } else { Fail "NON-ASCII $f ($bad bytes >127)" }
}

# 3) no hardcoded root/FR in the tools that must use config.ps1
$mustUseConfig = @("$ROOT\agent\tools\runtime.ps1", "$ROOT\agent\tools\fr_agent.ps1")
foreach ($f in $mustUseConfig) {
  $txt = Get-Content $f -Raw
  if ($txt -match 'D:\\fineagent' -or $txt -match 'D:\\software') { Fail "HARDCODED PATH in $f (must come from config.ps1)" } else { Pass "NO-HARDCODE $f" }
}

Write-Output ("STATIC END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
