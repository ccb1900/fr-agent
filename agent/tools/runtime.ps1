# runtime.ps1 - r14 Runtime Supervisor RECORD/state manager (the mutex itself is held by fr_agent.ps1).
# Model (docs/gpt/r14.md): mutual exclusion is an OS named Mutex (kernel-enforced, abandonment proves owner death).
#   This script manages the durable RECORDS: atomic RunId claim, owner.json (current holder identity), queue/done state,
#   history event stream, and identity-scoped recovery of a crashed holder's JVM.
# Invariants (r14):
#   - RunId claim is atomic (FileMode.CreateNew): two same-RunId acquires, exactly one wins (no TOCTOU).
#   - finalize verifies runId + ownerToken against owner.json; a missing owner.json is OWNER_STATE_UNKNOWN (not success).
#   - recovery kills ONLY the java process recorded in the crashed run's java.pid (pid + StartTime verified), never all java.
#   - runtimeState (queued/running/released/lost) is orthogonal to businessResult (pending/succeeded/failed).
# NOTE: ASCII-only (PS 5.1 GBK ANSI-read lesson). Paths/policy from config.ps1 (single source).
param(
  [Parameter(Mandatory = $true)][ValidateSet('register', 'unregister', 'mark-running', 'finalize', 'recover-previous', 'status', 'recover')][string]$Action,
  [string]$RunId = '',
  [string]$Verb = '',
  [string]$OwnerToken = '',
  [string]$PipelineTag = 'make_api.js',
  [string]$BusinessResult = 'pending',
  [int]$OwnerPid = 0
)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
$cfg = Get-AgentConfig
$rtDir = $cfg.RuntimeDir
$ownerFile = "$rtDir\owner.json"
$queueDir = "$rtDir\queue"
$doneDir = "$rtDir\done"
$historyFile = "$rtDir\history.log"
New-Item -ItemType Directory -Force -Path $rtDir | Out-Null
New-Item -ItemType Directory -Force -Path $queueDir | Out-Null
New-Item -ItemType Directory -Force -Path $doneDir | Out-Null

function ReadJson([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  try {
    $t = (Get-Content $path -Raw -Encoding UTF8).TrimStart([char]0xFEFF)
    if (-not $t) { return $null }
    return ($t | ConvertFrom-Json)
  } catch { return $null }
}
function WriteJsonNoBom([string]$path, $obj) {
  $parent = Split-Path $path -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $tmp = "$path.tmp"
  [System.IO.File]::WriteAllText($tmp, ($obj | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
  try { [System.IO.File]::Replace($tmp, $path, $null) } catch { Move-Item -Force $tmp $path }
}
function WriteHistory([string]$evt, [string]$runId) {
  try { Add-Content -Path $historyFile -Value ((Get-Date).ToString('o') + ' ' + $evt + ' ' + $runId) -Encoding ASCII } catch { }
}
function ProcStartTicks([int]$procId) {
  if ($procId -le 0) { return -1 }
  try { $p = Get-Process -Id $procId -ErrorAction Stop; return [long]$p.StartTime.Ticks } catch { return -1 }
}
function OwnerIdentityAlive($o) {
  if (-not $o) { return $false }
  $opid = 0; try { $opid = [int]$o.ownerPid } catch { return $false }
  $st = ProcStartTicks $opid
  if ($st -lt 0) { return $false }
  if ($o.ownerStart -and [long]$o.ownerStart -gt 0 -and [long]$o.ownerStart -ne $st) { return $false }  # pid reused
  return $true
}
# Atomic exclusive claim of a file: returns $true if THIS call created it (won), $false if it already existed.
function Try-CreateNew([string]$path, $obj) {
  try {
    $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
    try {
      $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes(($obj | ConvertTo-Json -Depth 6))
      $fs.Write($bytes, 0, $bytes.Length)
    } finally { $fs.Dispose() }
    return $true
  } catch [System.IO.FileExistsException] { return $false } catch { return $false }
}
# Identity-scoped kill of the crashed holder's JVM via its recorded pidfile (pid + StartTime verified).
function Kill-RecordedJava([string]$lostRun) {
  if (-not $lostRun) { return }
  $pf = "$($cfg.RunsDir)\$lostRun\java.pid"
  if (-not (Test-Path $pf)) { return }
  $parts = ((Get-Content $pf -Raw -Encoding UTF8).Trim() -split ' ')
  if ($parts.Count -lt 1) { return }
  $jpid = 0; try { $jpid = [int]$parts[0] } catch { return }
  $jstart = -1; if ($parts.Count -ge 2) { try { $jstart = [long]$parts[1] } catch { $jstart = -1 } }
  $cur = ProcStartTicks $jpid
  if ($cur -lt 0) { return }                       # already gone
  if ($jstart -gt 0 -and $cur -ne $jstart) { return }  # pid reused by another process -> NOT our java, do not kill
  Stop-Process -Id $jpid -Force -ErrorAction SilentlyContinue
}
function Do-Recover-Previous() {
  $owner = ReadJson $ownerFile
  if (-not $owner) { return '' }
  $lostRun = [string]$owner.runId
  Kill-RecordedJava $lostRun
  if (Test-Path $cfg.FineDbLck) { Remove-Item $cfg.FineDbLck -Force -ErrorAction SilentlyContinue }
  if ($lostRun) {
    $q = ReadJson "$queueDir\$lostRun.json"
    WriteJsonNoBom "$doneDir\$lostRun.json" @{ runId = $lostRun; verb = [string]$owner.verb; submittedAt = $(if ($q) { [string]$q.submittedAt } else { '' }); runtimeState = 'lost'; businessResult = 'failed'; reason = 'RUNTIME_LOST:owner-crashed'; finishedAt = (Get-Date).ToString('o') }
    Remove-Item "$queueDir\$lostRun.json" -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $ownerFile -Force -ErrorAction SilentlyContinue
  WriteHistory "RECOVER $lostRun" $lostRun
  return $lostRun
}

switch ($Action) {
  'register' {
    if (-not $RunId -or -not $Verb) { Write-Output '{"ok":false,"error":"register needs -RunId and -Verb"}'; exit 2 }
    if (-not (Test-RunId $RunId)) { Write-Output '{"ok":false,"error":"illegal runId"}'; exit 2 }
    if (-not $OwnerToken) { Write-Output '{"ok":false,"error":"register needs -OwnerToken"}'; exit 2 }
    $opid = if ($OwnerPid -gt 0) { $OwnerPid } else { $PID }
    $ost = ProcStartTicks $opid
    $slot = @{ runId = $RunId; verb = $Verb; submittedAt = (Get-Date).ToString('o'); runtimeState = 'queued'; ownerToken = $OwnerToken; ownerPid = $opid; ownerStart = $ost }
    # r14 P1#1: atomic exclusive claim via FileMode.CreateNew - exactly one same-RunId register wins.
    #   NO reclaim-on-dead-owner here (that heuristic made duplicate-RunId non-strict): the slot is cleaned by
    #   finalize (normal) or recover-previous (crashed holder via OS mutex abandonment), never by a guessing waiter.
    if (Try-CreateNew "$queueDir\$RunId.json" $slot) { WriteHistory "SUBMITTED $RunId" $RunId; Write-Output ('{"ok":true,"registered":true,"runId":"' + $RunId + '"}'); exit 0 }
    Write-Output ('{"ok":false,"registered":false,"reason":"RUNID_INFLIGHT","runId":"' + $RunId + '"}'); exit 1
  }
  'unregister' {
    if (-not $RunId) { Write-Output '{"ok":false,"error":"unregister needs -RunId"}'; exit 2 }
    Remove-Item "$queueDir\$RunId.json" -Force -ErrorAction SilentlyContinue
    Write-Output ('{"ok":true,"unregistered":true,"runId":"' + $RunId + '"}'); exit 0
  }
  'mark-running' {
    if (-not $RunId -or -not $OwnerToken) { Write-Output '{"ok":false,"error":"mark-running needs -RunId and -OwnerToken"}'; exit 2 }
    $opid = if ($OwnerPid -gt 0) { $OwnerPid } else { $PID }
    $ost = ProcStartTicks $opid
    WriteJsonNoBom $ownerFile @{ runId = $RunId; verb = $Verb; ownerPid = $opid; ownerStart = $ost; ownerToken = $OwnerToken; pipelineTag = $PipelineTag; acquiredAt = (Get-Date).ToString('o') }
    $q = ReadJson "$queueDir\$RunId.json"; if ($q) { $q.runtimeState = 'running'; $q.ownerPid = $opid; $q.ownerStart = $ost; WriteJsonNoBom "$queueDir\$RunId.json" $q }
    WriteHistory "ACQUIRE $RunId" $RunId
    Write-Output ('{"ok":true,"running":true,"runId":"' + $RunId + '"}'); exit 0
  }
  'finalize' {
    if (-not $RunId -or -not $OwnerToken) { Write-Output '{"ok":false,"error":"finalize needs -RunId and -OwnerToken"}'; exit 2 }
    $owner = ReadJson $ownerFile
    if (-not $owner) { Write-Output ('{"ok":false,"finalized":false,"reason":"OWNER_STATE_UNKNOWN","runId":"' + $RunId + '"}'); exit 1 }
    if (([string]$owner.runId -ne $RunId) -or ([string]$owner.ownerToken -ne $OwnerToken)) {
      Write-Output ('{"ok":false,"finalized":false,"reason":"NOT_OWNER","runId":"' + $RunId + '"}'); exit 1
    }
    $q = ReadJson "$queueDir\$RunId.json"
    WriteJsonNoBom "$doneDir\$RunId.json" @{ runId = $RunId; verb = [string]$owner.verb; submittedAt = $(if ($q) { [string]$q.submittedAt } else { '' }); runtimeState = 'released'; businessResult = $BusinessResult; finishedAt = (Get-Date).ToString('o') }
    Remove-Item "$queueDir\$RunId.json" -Force -ErrorAction SilentlyContinue
    Remove-Item $ownerFile -Force -ErrorAction SilentlyContinue
    WriteHistory "RELEASE $RunId" $RunId
    Write-Output ('{"ok":true,"finalized":true,"runId":"' + $RunId + '","businessResult":"' + $BusinessResult + '"}'); exit 0
  }
  'recover-previous' {
    $lost = Do-Recover-Previous
    Write-Output ('{"ok":true,"recovered":' + $(if ($lost) { 'true' } else { 'false' }) + ',"lostRunId":"' + $lost + '"}'); exit 0
  }
  'status' {
    $owner = ReadJson $ownerFile
    $alive = OwnerIdentityAlive $owner
    $queued = @(Get-ChildItem "$queueDir\*.json" -ErrorAction SilentlyContinue | ForEach-Object { ReadJson $_.FullName } | Where-Object { $_ } | Sort-Object submittedAt, runId | ForEach-Object { $_.runId })
    $suspect = $false
    if ($owner -and $alive) { try { $age = ((Get-Date) - [datetime]::Parse([string]$owner.acquiredAt)).TotalSeconds; if ($age -gt $cfg.TaskSuspectSec) { $suspect = $true } } catch { } }
    $cur = 'null'
    if ($owner) { $cur = (ConvertTo-Json @{ runId = [string]$owner.runId; verb = [string]$owner.verb; pid = [int]$owner.ownerPid; alive = $alive } -Compress) }
    Write-Output ('{"ok":true,"owner":' + $cur + ',"suspect":' + $suspect.ToString().ToLower() + ',"queued":' + (ConvertTo-Json $queued -Compress) + '}')
    exit 0
  }
  'recover' {
    # standalone probe: open the named mutex; if it is FREE but owner.json exists -> the holder crashed without releasing -> recover.
    # if the mutex is HELD (WaitOne(0) false) -> a live owner -> never touch.
    $mtx = New-Object System.Threading.Mutex($false, $cfg.MutexName)
    $acquired = $false
    try {
      try { $acquired = $mtx.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
      if (-not $acquired) { Write-Output '{"ok":true,"recovered":false,"reason":"OWNER_ALIVE"}'; exit 0 }
      $owner = ReadJson $ownerFile
      if ($owner) { $lost = Do-Recover-Previous; Write-Output ('{"ok":true,"recovered":true,"lostRunId":"' + $lost + '"}') }
      else { Write-Output '{"ok":true,"recovered":false,"reason":"NO_OWNER_RECORD"}' }
    } finally { if ($acquired) { try { $mtx.ReleaseMutex() } catch { } }; $mtx.Dispose() }
    exit 0
  }
  default { Write-Output '{"ok":false,"error":"unknown action"}'; exit 2 }
}
