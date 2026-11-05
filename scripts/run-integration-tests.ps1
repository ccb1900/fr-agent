# run-integration-tests.ps1 - r13 gate: PowerShell static check + Runtime Supervisor integration (S1-S15).
#   Static part is engine-free; integration part spawns real FineReport runtime (serial, one at a time).
#   Any failure => exit 1. ASCII-only.
$ErrorActionPreference = 'Continue'
$ROOT = 'D:\fineagent'
$fail = 0

Write-Output "== static check"
& "$ROOT\verify\check_ps1_static.ps1"
if ($LASTEXITCODE -ne 0) { $fail = 1; Write-Output "STATIC GATE FAIL" }

Write-Output "== runtime supervisor integration (S1-S15, full chain)"
& "$ROOT\verify\integration_runtime.ps1"
if ($LASTEXITCODE -ne 0) { $fail = 1; Write-Output "INTEGRATION GATE FAIL" }

if ($fail -eq 0) { Write-Output "INTEGRATION GATE GREEN" } else { Write-Output "INTEGRATION GATE RED" }
exit $fail
