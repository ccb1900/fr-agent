# runtime.ps1 - r15 THIN single-instance executor support (the mutex is held by fr_agent.ps1).
# Premise (docs/gpt/r15.md): single machine, single FineReport instance, at most one task at a time. No scheduler,
#   no queue, no FIFO, no ownership token. This script only provides the FineReport-specific leftover-process check:
#   a crashed PowerShell host frees the OS mutex but its Java child may still be running -> before starting a new task,
#   inspect the leftover sentinel (active.json -> runs/<runId>/java.pid) by PROCESS IDENTITY:
#     - confirmed orphan (recorded owner dead + our java alive by pid+start) -> kill exactly that java, proceed.
#     - cannot confirm (corrupt sentinel, or owner still alive) -> REFUSE (RUNTIME_BUSY); never start a second instance.
#   Result/business tracking is NOT here - artifact.json (application layer) is the single source of truth.
# NOTE: ASCII-only. Paths/policy from config.ps1.
param(
  [Parameter(Mandatory = $true)][ValidateSet('enter', 'claim', 'release', 'status')][string]$Action,
  [string]$RunId = '',
  [int]$OwnerPid = 0
)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
$cfg = Get-AgentConfig
$rtDir = $cfg.RuntimeDir
$activeFile = "$rtDir\active.json"
$historyFile = "$rtDir\history.log"
New-Item -ItemType Directory -Force -Path $rtDir | Out-Null

function ReadJson([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  try {
    $t = (Get-Content $path -Raw -Encoding UTF8).TrimStart([char]0xFEFF)
    if (-not $t) { return $null }
    return ($t | ConvertFrom-Json)
  } catch { return $null }
}
function WriteJsonNoBom([string]$path, $obj) {
  $tmp = "$path.tmp"
  [System.IO.File]::WriteAllText($tmp, ($obj | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
  try { [System.IO.File]::Replace($tmp, $path, $null) } catch { Move-Item -Force $tmp $path }
}
function WriteHistory([string]$evt) {
  try { Add-Content -Path $historyFile -Value ((Get-Date).ToString('o') + ' ' + $evt) -Encoding ASCII } catch { }
}
function ProcStartTicks([int]$procId) {
  if ($procId -le 0) { return -1 }
  try { $p = Get-Process -Id $procId -ErrorAction Stop; return [long]$p.StartTime.Ticks } catch { return -1 }
}
# identity alive = pid exists AND (if a start was recorded) its start matches (guards PID reuse).
# NOTE param must NOT be $pid (PowerShell automatic $PID is read-only; assigning it throws VariableNotWritable).
function IdentityAlive([int]$procId, [long]$start) {
  if ($procId -le 0) { return $false }
  $cur = ProcStartTicks $procId
  if ($cur -lt 0) { return $false }
  if ($start -gt 0 -and $cur -ne $start) { return $false }
  return $true
}
# kill exactly the java of a confirmed-orphan run (pid+start verified); never scan-all, never unconditional.
function Kill-OrphanJava([string]$run) {
  $pf = "$($cfg.RunsDir)\$run\java.pid"
  if (-not (Test-Path $pf)) { return $false }
  $parts = ((Get-Content $pf -Raw -Encoding UTF8).Trim() -split ' ')
  $jpid = 0; if ($parts.Count -ge 1 -and [int]::TryParse($parts[0], [ref]$jpid)) {
    $jstart = -1; if ($parts.Count -ge 2) { [long]::TryParse($parts[1], [ref]$jstart) | Out-Null }
    if (IdentityAlive $jpid $jstart) { Stop-Process -Id $jpid -Force -ErrorAction SilentlyContinue; return $true }
  }
  return $false
}

switch ($Action) {
  'enter' {
    # called by fr_agent AFTER acquiring the mutex, BEFORE starting java. Decide: proceed / recover-orphan / refuse.
    if (-not (Test-Path $activeFile)) { Write-Output '{"ok":true,"state":"clear"}'; exit 0 }
    $a = ReadJson $activeFile
    if (-not $a) {
      # corrupt sentinel: cannot confirm the leftover -> fail-closed, refuse (do NOT auto-clear a possibly-live run)
      Write-Output '{"ok":false,"reason":"RUNTIME_BUSY","detail":"active.json unreadable; cannot confirm leftover"}'; exit 1
    }
    $ownerAlive = IdentityAlive ([int]$a.ownerPid) ([long]$a.ownerStart)
    if ($ownerAlive) {
      # a live owner while we hold the mutex is contradictory -> cannot confirm -> refuse (never start a second instance)
      Write-Output ('{"ok":false,"reason":"RUNTIME_BUSY","detail":"owner pid ' + [int]$a.ownerPid + ' alive"}'); exit 1
    }
    # owner confirmed dead (pid gone or reused) -> predecessor crashed. Kill its orphan java if identity matches.
    $lostRun = [string]$a.runId
    $killed = Kill-OrphanJava $lostRun
    if (Test-Path $cfg.FineDbLck) { Remove-Item $cfg.FineDbLck -Force -ErrorAction SilentlyContinue }
    Remove-Item $activeFile -Force -ErrorAction SilentlyContinue
    WriteHistory "RECOVER $lostRun"
    Write-Output ('{"ok":true,"state":"recovered","lostRunId":"' + $lostRun + '","killedJava":' + $(if ($killed) { 'true' } else { 'false' }) + '}'); exit 0
  }
  'claim' {
    if (-not $RunId) { Write-Output '{"ok":false,"error":"claim needs -RunId"}'; exit 2 }
    $opid = if ($OwnerPid -gt 0) { $OwnerPid } else { $PID }
    $ost = ProcStartTicks $opid
    WriteJsonNoBom $activeFile @{ runId = $RunId; ownerPid = $opid; ownerStart = $ost; claimedAt = (Get-Date).ToString('o') }
    WriteHistory "ACQUIRE $RunId"
    Write-Output ('{"ok":true,"claimed":true,"runId":"' + $RunId + '"}'); exit 0
  }
  'release' {
    if (-not $RunId) { Write-Output '{"ok":false,"error":"release needs -RunId"}'; exit 2 }
    $a = ReadJson $activeFile
    if ($a -and [string]$a.runId -eq $RunId) { Remove-Item $activeFile -Force -ErrorAction SilentlyContinue }
    WriteHistory "RELEASE $RunId"
    Write-Output ('{"ok":true,"released":true,"runId":"' + $RunId + '"}'); exit 0
  }
  'status' {
    $a = ReadJson $activeFile
    if (-not $a) { Write-Output '{"ok":true,"active":null}'; exit 0 }
    $ownerAlive = IdentityAlive ([int]$a.ownerPid) ([long]$a.ownerStart)
    $javaAlive = $false
    $pf = "$($cfg.RunsDir)\$($a.runId)\java.pid"
    if (Test-Path $pf) { $parts = ((Get-Content $pf -Raw -Encoding UTF8).Trim() -split ' '); $jp = 0; $js = -1; if ($parts.Count -ge 1) { [int]::TryParse($parts[0], [ref]$jp) | Out-Null }; if ($parts.Count -ge 2) { [long]::TryParse($parts[1], [ref]$js) | Out-Null }; $javaAlive = IdentityAlive $jp $js }
    Write-Output ('{"ok":true,"active":' + (ConvertTo-Json @{ runId = [string]$a.runId; ownerAlive = $ownerAlive; javaAlive = $javaAlive } -Compress) + '}')
    exit 0
  }
  default { Write-Output '{"ok":false,"error":"unknown action"}'; exit 2 }
}
