# runtime.ps1 - r17: read-only status helper for the thin single-instance executor.
#   The actual mutex + leftover-check + kill + active-sentinel claim/release now live ENTIRELY in fr_agent.ps1's
#   Invoke-UnderMutex (main flow, under the mutex) - there is NO standalone dangerous recovery action anymore
#   (r16 P1#2: recovery only inside the main execution flow). This file only reports state for diagnostics/tests.
# r17: reports owner/java liveness as three-state strings (live/gone/unknown), never collapsing
#   "cannot confirm" (unreadable/corrupt/pending identity) into "gone". Diagnostics only - no actions here.
# NOTE: ASCII-only. Paths/policy from config.ps1.
param(
  [Parameter(Mandatory = $true)][ValidateSet('status')][string]$Action
)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
. (Join-Path $PSScriptRoot '_identity.ps1')
$cfg = Get-AgentConfig
$activeFile = "$($cfg.RuntimeDir)\active.json"

switch ($Action) {
  'status' {
    # r19 P1: presence via Get-FilePresence - a locked/malformed sentinel reports UNKNOWN/CORRUPT, never null-absent.
    $pres = Get-FilePresence $activeFile
    if ($pres -eq 'absent') { Write-Output '{"ok":true,"active":null}'; exit 0 }
    if ($pres -ne 'readable') { Write-Output ('{"ok":true,"active":"' + $pres.ToUpper() + '"}'); exit 0 }
    $a = $null
    try { $t = (Get-Content $activeFile -Raw -Encoding UTF8).TrimStart([char]0xFEFF); if ($t) { $a = $t | ConvertFrom-Json } } catch { $a = $null }
    if (-not $a) { Write-Output '{"ok":true,"active":"CORRUPT"}'; exit 0 }
    $ownerState = Classify-Owner ([int]$a.ownerPid) ([long]$a.ownerStart)
    # r19/portfolio P2: EXHAUSTIVE mapping of the pidfile state - unknown state must surface as 'unknown',
    #   NEVER silently fall back to the 'absent' initializer (a locked/unconfirmable java.pid is a REAL
    #   diagnostic state, and reporting it as "no java registered" lies to the operator about exactly the
    #   case the fail-closed contract cares about).
    $javaState = switch ($jp.file) {
      'ok' { Classify-Process ([int]$jp.pid) ([long]$jp.start) $true }   # r18: java = kill-target semantics
      'absent' { 'absent' }
      'pending' { 'unknown' }
      'corrupt' { 'corrupt' }
      'unreadable' { 'unknown' }
      'unknown' { 'unknown' }
      default { 'unknown' }
    }
    Write-Output ('{"ok":true,"active":' + (ConvertTo-Json @{ runId = [string]$a.runId; ownerState = "$ownerState"; javaState = "$javaState" } -Compress) + '}')
    exit 0
  }
  default { Write-Output '{"ok":false,"error":"unknown action"}'; exit 2 }
}
