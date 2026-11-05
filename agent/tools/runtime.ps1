# runtime.ps1 - r16: read-only status helper for the thin single-instance executor.
#   The actual mutex + leftover-check + kill + active-sentinel claim/release now live ENTIRELY in fr_agent.ps1's
#   Invoke-UnderMutex (main flow, under the mutex) - there is NO standalone dangerous recovery action anymore
#   (r16 P1#2: recovery only inside the main execution flow). This file only reports state for diagnostics/tests.
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
    if (-not (Test-Path $activeFile)) { Write-Output '{"ok":true,"active":null}'; exit 0 }
    $a = $null
    try { $t = (Get-Content $activeFile -Raw -Encoding UTF8).TrimStart([char]0xFEFF); if ($t) { $a = $t | ConvertFrom-Json } } catch { $a = $null }
    if (-not $a) { Write-Output '{"ok":true,"active":"CORRUPT"}'; exit 0 }
    $ownerAlive = IdentityAlive ([int]$a.ownerPid) ([long]$a.ownerStart)
    $javaAlive = $false
    $jp = Read-JavaPid $cfg.RunsDir ([string]$a.runId)
    if ($jp) { $javaAlive = IdentityAlive $jp.pid $jp.start }
    Write-Output ('{"ok":true,"active":' + (ConvertTo-Json @{ runId = [string]$a.runId; ownerAlive = $ownerAlive; javaAlive = $javaAlive } -Compress) + '}')
    exit 0
  }
  default { Write-Output '{"ok":false,"error":"unknown action"}'; exit 2 }
}
