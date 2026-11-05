# runtime.ps1 - r13 (R12.1) Runtime Supervisor: single-instance FineReport runtime, multi-task queue, CORRECT lock protocol.
# Model (docs/gpt/r12.md + r13.md): tasks may be SUBMITTED concurrently but the FineReport RUNTIME executes SERIALLY.
#
# r13 fixes over r12:
#   P1-A lock-init race: lock dir create + owner.json write are two steps. A waiter must NEVER delete a lock just
#        because owner.json is momentarily absent (that is INITIALIZING, not stale). Staleness is decided by OWNER
#        IDENTITY (pid alive AND process start-time matches), never by file absence alone.
#   P1-B MaxLockAgeSec must NOT equal owner-death: a live-owner task older than TaskSuspectSec is a WARNING only,
#        never killed. Only a dead owner (pid gone, or pid reused -> start-time mismatch) triggers Recovery.
#   OwnerToken: release/recovery verify the token, not just RunId (a wrong RunId cannot delete another's lock).
#   Recovery scope: kill only java whose CommandLine matches THIS runtime's pipelineTag, never all java on the box.
#   runtimeState (queued/running/released/lost) is separate from businessResult (pending/succeeded/failed):
#        releasing the execution right is NOT the same as the report succeeding.
#   FIFO: only the oldest still-queued waiter attempts to claim the lock (best-effort FIFO ordering).
#   Duplicate RunId: a runId already queued/running cannot be acquired again (no double execution).
#
# NOTE: ASCII-only (PS 5.1 GBK ANSI-read lesson). Paths/policy come from config.ps1 (single source).
param(
  [Parameter(Mandatory = $true)][ValidateSet('acquire', 'release', 'status', 'recover')][string]$Action,
  [string]$RunId = '',
  [string]$Verb = '',
  [string]$OwnerToken = '',
  [string]$PipelineTag = 'make_api.js',
  [string]$BusinessResult = 'pending',
  [int]$OwnerPid = 0,
  [int]$TimeoutSec = 0
)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
$cfg = Get-AgentConfig
$effTimeout = if ($TimeoutSec -gt 0) { $TimeoutSec } else { $cfg.AcquireTimeoutSec }
$rtDir = $cfg.RuntimeDir
$lockDir = "$rtDir\lock"
$ownerFile = "$rtDir\lock\owner.json"
$queueDir = "$rtDir\queue"
$doneDir = "$rtDir\done"
$historyFile = "$rtDir\history.log"

function WriteJsonNoBom([string]$path, $obj) {
  $parent = Split-Path $path -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $tmp = "$path.tmp"
  [System.IO.File]::WriteAllText($tmp, ($obj | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -Force $tmp $path
}
function ReadJson([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  try { return (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}
function WriteHistory([string]$evt, [string]$runId) {
  try { Add-Content -Path $historyFile -Value ((Get-Date).ToString('o') + ' ' + $evt + ' ' + $runId) -Encoding ASCII } catch { }
}
# Process start-time ticks (PID-reuse guard). -1 if not found / not readable.
function ProcStartTicks([int]$procId) {
  if ($procId -le 0) { return -1 }
  try {
    $p = Get-Process -Id $procId -ErrorAction Stop
    return [long]$p.StartTime.Ticks
  } catch { return -1 }
}
# Owner identity alive = pid exists AND its start-time still matches the recorded one (PID not recycled).
function OwnerIdentityAlive($owner) {
  if (-not $owner) { return $false }
  $opid = 0
  try { $opid = [int]$owner.ownerPid } catch { return $false }
  $st = ProcStartTicks $opid
  if ($st -lt 0) { return $false }                       # pid gone
  # only enforce the start-time match when a VALID start was recorded (ownerStart>0); if it was unreadable (-1) at
  #   acquire time, fall back to pid-alive so a live owner is never misjudged dead (r13 review)
  if ($owner.ownerStart -and [long]$owner.ownerStart -gt 0 -and [long]$owner.ownerStart -ne $st) { return $false }  # pid reused -> different process
  return $true
}
# Returns: free | owned_alive | owned_dead | initializing | init_stalled
function Get-LockState() {
  if (-not (Test-Path $lockDir)) { return 'free' }
  $owner = ReadJson $ownerFile
  if ($owner) {
    if (OwnerIdentityAlive $owner) { return 'owned_alive' }
    return 'owned_dead'
  }
  # lock dir exists but owner.json not yet written
  $ageSec = 0
  try { $ageSec = ((Get-Date) - (Get-Item $lockDir).CreationTime).TotalSeconds } catch { $ageSec = 9999 }
  if ($ageSec -lt $cfg.InitGraceSec) { return 'initializing' }
  return 'init_stalled'
}
# Best-effort FIFO: only the oldest still-queued waiter may attempt to claim the lock.
#   r13 review fix: a queued waiter whose owning process DIED cannot self-clean its queue slot; if it stayed "oldest"
#   every younger waiter would defer to it forever (starvation). So prune dead-queued entries before ordering.
function Is-OldestQueued([string]$runId) {
  $entries = @()
  foreach ($file in @(Get-ChildItem "$queueDir\*.json" -ErrorAction SilentlyContinue)) {
    $e = ReadJson $file.FullName
    if (-not $e) { continue }
    if ([string]$e.runtimeState -ne 'queued') { continue }
    # a queued entry with a dead ownerPid is an abandoned waiter -> drop its slot, do not let it block others
    $opid = 0; try { $opid = [int]$e.ownerPid } catch { $opid = 0 }
    if ($opid -gt 0 -and $opid -ne $PID -and (ProcStartTicks $opid) -lt 0) {
      Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
      continue
    }
    $entries += $e
  }
  if ($entries.Count -eq 0) { return $true }
  $sorted = @($entries | Sort-Object submittedAt, runId)
  return ([string]$sorted[0].runId -eq $runId)
}
function Mark-Done([string]$runId, [string]$runtimeState, [string]$businessResult, [string]$reason) {
  $q = ReadJson "$queueDir\$runId.json"
  $rec = @{ runId = $runId; verb = $(if ($q) { [string]$q.verb } else { '' }); submittedAt = $(if ($q) { [string]$q.submittedAt } else { '' }); runtimeState = $runtimeState; businessResult = $businessResult; finishedAt = (Get-Date).ToString('o') }
  if ($reason) { $rec.reason = $reason }
  WriteJsonNoBom "$doneDir\$runId.json" $rec
  Remove-Item "$queueDir\$runId.json" -Force -ErrorAction SilentlyContinue
}
# Recovery ONLY after owner identity confirmed dead (or init stalled). Scoped java kill; FineDB lock only when owner verified gone.
function Invoke-Recovery([string]$reason, [bool]$killJava) {
  $owner = ReadJson $ownerFile
  $lostRun = if ($owner) { [string]$owner.runId } else { '' }
  if ($killJava -and $owner -and $owner.pipelineTag) {
    # kill only java whose command line matches THIS runtime's pipeline script (never all java on the box)
    try {
      $procs = Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine -match [regex]::Escape([string]$owner.pipelineTag) }
      foreach ($pr in $procs) { Stop-Process -Id $pr.ProcessId -Force -ErrorAction SilentlyContinue }
    } catch { }
    # FineDB lock is removed only because we verified the owning instance's owner is dead
    if (Test-Path $cfg.FineDbLck) { Remove-Item $cfg.FineDbLck -Force -ErrorAction SilentlyContinue }
  }
  if (Test-Path $lockDir) { Remove-Item $lockDir -Force -Recurse -ErrorAction SilentlyContinue }
  if ($lostRun) { Mark-Done $lostRun 'lost' 'failed' "RUNTIME_LOST:$reason" }
  WriteHistory "RECOVER $reason" $lostRun
  return $lostRun
}

switch ($Action) {
  'acquire' {
    if (-not $RunId -or -not $Verb) { Write-Output '{"ok":false,"error":"acquire needs -RunId and -Verb"}'; exit 2 }
    if ($RunId -notmatch '^[A-Za-z0-9_-]{1,64}$') { Write-Output '{"ok":false,"error":"illegal runId"}'; exit 2 }
    if (-not $OwnerToken) { Write-Output '{"ok":false,"error":"acquire needs -OwnerToken"}'; exit 2 }
    # duplicate RunId policy: an in-flight (queued/running) runId cannot be acquired again (no double execution)
    $existing = ReadJson "$queueDir\$RunId.json"
    if ($existing) { Write-Output ('{"ok":false,"acquired":false,"reason":"RUNID_INFLIGHT","runId":"' + $RunId + '"}'); exit 1 }
    # queue slot ownerPid = THIS acquire process (the spinner): while queued it is alive; if the acquirer is killed the
    #   slot is prunable so it cannot starve younger waiters. owner.json ownerPid (below) = the long-lived caller (fr_agent).
    WriteJsonNoBom "$queueDir\$RunId.json" @{ runId = $RunId; verb = $Verb; submittedAt = (Get-Date).ToString('o'); runtimeState = 'queued'; ownerToken = $OwnerToken; ownerPid = $PID }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($true) {
      if (Is-OldestQueued $RunId) {
        try {
          New-Item -ItemType Directory -Path $lockDir -ErrorAction Stop | Out-Null
          # I own the lock dir now (atomic). Write owner identity INSIDE it.
          $opid = if ($OwnerPid -gt 0) { $OwnerPid } else { $PID }
          $ost = ProcStartTicks $opid
          WriteJsonNoBom $ownerFile @{ runId = $RunId; verb = $Verb; ownerPid = $opid; ownerStart = $ost; ownerToken = $OwnerToken; pipelineTag = $PipelineTag; acquiredAt = (Get-Date).ToString('o') }
          $q = ReadJson "$queueDir\$RunId.json"; if ($q) { $q.runtimeState = 'running'; WriteJsonNoBom "$queueDir\$RunId.json" $q }
          WriteHistory "ACQUIRE" $RunId
          Write-Output ('{"ok":true,"acquired":true,"runId":"' + $RunId + '","waitedMs":' + [int]$sw.ElapsedMilliseconds + '}')
          exit 0
        } catch {
          # lock exists; classify WITHOUT ever deleting on a mere missing-owner assumption
          $state = Get-LockState
          if ($state -eq 'owned_dead') { $null = Invoke-Recovery 'owner-dead' $true; continue }
          if ($state -eq 'init_stalled') { $null = Invoke-Recovery 'init-stalled' $false; continue }
          # owned_alive / initializing / free(race) -> wait, never delete
        }
      }
      if ($sw.Elapsed.TotalSeconds -gt $effTimeout) {
        Remove-Item "$queueDir\$RunId.json" -Force -ErrorAction SilentlyContinue
        $pos = @(Get-ChildItem "$queueDir\*.json" -ErrorAction SilentlyContinue).Count
        Write-Output ('{"ok":false,"acquired":false,"reason":"QUEUE_TIMEOUT","runId":"' + $RunId + '","queueDepth":' + $pos + '}')
        exit 1
      }
      Start-Sleep -Milliseconds 150
    }
  }
  'release' {
    if (-not $RunId -or -not $OwnerToken) { Write-Output '{"ok":false,"error":"release needs -RunId and -OwnerToken"}'; exit 2 }
    $owner = ReadJson $ownerFile
    if (-not $owner) {
      # no owner record: either already released or lock held in init. Idempotent: finalize our queue slot if present.
      if (Test-Path "$queueDir\$RunId.json") { Mark-Done $RunId 'released' $BusinessResult '' }
      Write-Output ('{"ok":true,"released":true,"idempotent":true,"runId":"' + $RunId + '"}'); exit 0
    }
    if ([string]$owner.ownerToken -ne $OwnerToken) {
      # wrong token: never delete another owner's lock (r13 S11)
      Write-Output ('{"ok":false,"released":false,"reason":"NOT_OWNER","runId":"' + $RunId + '"}'); exit 1
    }
    Remove-Item $lockDir -Force -Recurse -ErrorAction SilentlyContinue
    Mark-Done $RunId 'released' $BusinessResult ''
    WriteHistory "RELEASE" $RunId
    Write-Output ('{"ok":true,"released":true,"runId":"' + $RunId + '","businessResult":"' + $BusinessResult + '"}')
    exit 0
  }
  'status' {
    $owner = ReadJson $ownerFile
    $state = Get-LockState
    $queued = @(Get-ChildItem "$queueDir\*.json" -ErrorAction SilentlyContinue | ForEach-Object { ReadJson $_.FullName } | Where-Object { $_ } | Sort-Object submittedAt, runId | ForEach-Object { $_.runId })
    $alive = OwnerIdentityAlive $owner
    $suspect = $false
    if ($owner -and $alive) { try { $age = ((Get-Date) - [datetime]::Parse([string]$owner.acquiredAt)).TotalSeconds; if ($age -gt $cfg.TaskSuspectSec) { $suspect = $true } } catch { } }
    $cur = 'null'
    if ($owner) { $cur = (ConvertTo-Json @{ runId = [string]$owner.runId; verb = [string]$owner.verb; pid = [int]$owner.ownerPid; alive = $alive; state = $state } -Compress) }
    Write-Output ('{"ok":true,"lockState":"' + $state + '","owner":' + $cur + ',"suspect":' + $suspect.ToString().ToLower() + ',"queued":' + (ConvertTo-Json $queued -Compress) + '}')
    exit 0
  }
  'recover' {
    $state = Get-LockState
    if ($state -eq 'owned_dead') { $lost = Invoke-Recovery 'owner-dead-manual' $true; Write-Output ('{"ok":true,"recovered":true,"lostRunId":"' + $lost + '"}') }
    elseif ($state -eq 'init_stalled') { $lost = Invoke-Recovery 'init-stalled-manual' $false; Write-Output ('{"ok":true,"recovered":true,"lostRunId":"' + $lost + '"}') }
    elseif ($state -eq 'owned_alive') { Write-Output '{"ok":true,"recovered":false,"reason":"OWNER_ALIVE"}' }
    elseif ($state -eq 'initializing') { Write-Output '{"ok":true,"recovered":false,"reason":"INIT_IN_PROGRESS"}' }
    else { Write-Output '{"ok":true,"recovered":false,"reason":"NO_LOCK"}' }
    exit 0
  }
  default { Write-Output '{"ok":false,"error":"unknown action"}'; exit 2 }
}
