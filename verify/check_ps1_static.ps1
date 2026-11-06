# check_ps1_static.ps1 - r13 (R12.3) static gate for PowerShell tooling.
#   1) every .ps1 must PARSE (PSParser zero errors)
#   2) agent tools + this test harness must be ASCII-only (PS 5.1 reads .ps1 as GBK -> non-ASCII corrupts; AGENTS sec.5)
#   3) agent tools must NOT hardcode the root/FR paths (config.ps1 is the single source; r13 P2-C)
# Wired into the gate suite. Exit 0 = clean, 1 = any violation. ASCII-only file.
# A-sect P2g (2026-11-07): the file list is no longer a fixed 9-entry whitelist - it is enumerated
#   dynamically so a new/moved script cannot silently escape the gate:
#   - PARSE: every .ps1 under the repo except scratch dirs (logs/, probes/, .git) - a parse error is
#     a real defect anywhere, so the net is wide;
#   - ASCII: the MAINTAINED set = root + agent/tools + scripts + verify (+ config-driven tools) - these
#     are executed under PS 5.1 on a GBK host and must stay ASCII-only (probes/ and logs/ are scratch
#     and exempt). New file in a maintained dir is picked up automatically on the next run.
$ErrorActionPreference = 'Continue'
$ROOT = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
$fail = 0
function Fail($n) { Write-Output "STATIC FAIL: $n"; $script:fail++ }
function Pass($n) { Write-Output "STATIC PASS: $n" }

$scratchDirs = @("$ROOT\logs", "$ROOT\probes", "$ROOT\.git", "$ROOT\node_modules")
function Is-Scratch([string]$f) {
  foreach ($d in $scratchDirs) { if ($f -like "$d*") { return $true } }
  return $false
}
$allPs = @(Get-ChildItem -Path $ROOT -Filter '*.ps1' -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName } | Where-Object { -not (Is-Scratch $_) } | Sort-Object)
if ($allPs.Count -eq 0) { Fail 'no .ps1 files enumerated (gate misconfigured)' }
# 1) parse every script
foreach ($f in $allPs) {
  if (-not (Test-Path $f)) { Fail "missing $f"; continue }
  $errs = $null
  [void][System.Management.Automation.PSParser]::Tokenize((Get-Content $f -Raw), [ref]$errs)
  if ($errs -and $errs.Count -gt 0) { Fail "PARSE $f ($($errs.Count) errors)" } else { Pass "PARSE $f" }
}
Write-Output ("STATIC SCOPE: parse enumerated " + $allPs.Count + " .ps1 (dynamic; scratch dirs logs/probes/.git excluded)")

# 2) ASCII-only for the maintained set (executed under PS 5.1 / GBK host): root, agent/tools, scripts, verify
#   (scratch dirs logs/probes/.git excluded - same scope rule as the parse net)
$asciiDirs = @("$ROOT", "$ROOT\agent\tools", "$ROOT\scripts", "$ROOT\verify")
$asciiFiles = @(Get-ChildItem -Path $asciiDirs -Filter '*.ps1' -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName } | Where-Object { -not (Is-Scratch $_) } | Sort-Object -Unique)
foreach ($f in $asciiFiles) {
  $bytes = [System.IO.File]::ReadAllBytes($f)
  $bad = 0
  foreach ($b in $bytes) { if ($b -gt 127) { $bad++ } }
  if ($bad -eq 0) { Pass "ASCII $f" } else { Fail "NON-ASCII $f ($bad bytes >127)" }
}
Write-Output ("STATIC SCOPE: ascii enumerated " + $asciiFiles.Count + " .ps1 (maintained dirs: root/agent-tools/scripts/verify)")

# 3) no hardcoded root/FR in the tools that must use config.ps1
$mustUseConfig = @("$ROOT\agent\tools\runtime.ps1", "$ROOT\agent\tools\fr_agent.ps1")
foreach ($f in $mustUseConfig) {
  $txt = Get-Content $f -Raw
  if ($txt -match 'D:\\fineagent' -or $txt -match 'D:\\software') { Fail "HARDCODED PATH in $f (must come from config.ps1)" } else { Pass "NO-HARDCODE $f" }
}

Write-Output ("STATIC END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
