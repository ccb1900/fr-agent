# run-integration-tests.ps1 - PowerShell static check + Runtime Supervisor integration gate.
#   Static part is engine-free; integration part spawns real FineReport runtime (serial, one at a time).
#   Current scenario ids live in verify/integration_runtime.ps1 (S1..S28 as of r21); the authoritative
#   invariant-to-test table is docs/architecture/runtime-supervisor.md par.5. Any failure => exit 1. ASCII-only.
$ErrorActionPreference = 'Continue'
$ROOT = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
$fail = 0

Write-Output "== static check"
& "$ROOT\verify\check_ps1_static.ps1"
if ($LASTEXITCODE -ne 0) { $fail = 1; Write-Output "STATIC GATE FAIL" }

# Phase-3 deploy-safety regression matrix (promote/restore guard chain; engine-free, fully sandboxed -
# never writes the real deployed reportlets dir; tamper evidence asserted inside).
Write-Output "== promote/restore deploy-safety matrix"
& "$ROOT\scripts\run-promote-restore-tests.ps1"
if ($LASTEXITCODE -ne 0) { $fail = 1; Write-Output "PROMOTE-RESTORE MATRIX FAIL" }

# Render-level regression on the object path (4 engine cycles, ~80s): default spec + baseline MD5,
# legacy chart family, Van chart family + cells blocks + decorations, default spec again to restore the
# baseline artifact. The default spec alone does NOT cover cells/Van/decoration paths (2026-11-08: three
# refactor regressions passed the default spec and were only caught by reports/test_vanchart.js).
Write-Output "== render regression (default + legacy chart + van chart)"
& "$ROOT\scripts\run-render-regression.ps1"
if ($LASTEXITCODE -ne 0) { $fail = 1; Write-Output "RENDER REGRESSION FAIL" }

Write-Output "== runtime supervisor integration (current scenario set S1..S28, full chain)"
& "$ROOT\verify\integration_runtime.ps1"
if ($LASTEXITCODE -ne 0) { $fail = 1; Write-Output "INTEGRATION GATE FAIL" }

if ($fail -eq 0) { Write-Output "INTEGRATION GATE GREEN" } else { Write-Output "INTEGRATION GATE RED" }
exit $fail
