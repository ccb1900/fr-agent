# runtime.ps1 - r12 Runtime Supervisor: single-instance FineReport runtime, multi-task queue.
# Model (docs/gpt/r12.md): tasks may be SUBMITTED concurrently but the FineReport RUNTIME executes SERIALLY.
#   Global execution right = logs/agent/runtime/lock (a directory; atomic create on NTFS = cross-process mutex).
#   current.json records the lock owner (runId + verb + pid + startedAt). queue/ holds task descriptors for tracking.
# Illegal states made impossible: at most one live runtime task; a task cannot start runtime while another owns the lock;
#   a crashed owner is RECOVERED (only after confirming its pid is dead) before anyone else proceeds.
# NOTE: keep this file ASCII-only (PS 5.1 GBK ANSI-read lesson, AGENTS sec.5).
param(
  [Parameter(Mandatory = $true)][ValidateSet('acquire', 'release', 'status', 'recover')][string]$Action,
  [string]$RunId = '',
  [string]$Verb = '',
  [int]$OwnerPid = 0,
  [int]$TimeoutSec = 600,
  [int]$MaxLockAgeSec = 1800
)
$ErrorActionPreference = 'Continue'
$ROOT = 'D:\fineagent'
$FR = 'D:\software\FineReport_11.0'
$rtDir = "$ROOT\logs\agent\runtime"
$lockDir = "$rtDir\lock"
$queueDir = "$rtDir\queue"
$doneDir = "$rtDir\done"
$currentFile = "$rtDir\current.json"
$historyFile = "$rtDir\history.log"
$lck = "$FR\webapps\webroot\WEB-INF\embed\finedb\db.lck"

# Append-only event stream: the integration test reads this to PROVE serialization (no two ACQUIRE without
#   an intervening RELEASE) and recovery. One line per event, ASCII, flushed immediately.
function WriteHistory([string]$evt, [string]$runId) {
  try {
    Add-Content -Path $historyFile -Value ((Get-Date).ToString('o') + ' ' + $evt + ' ' + $runId) -Encoding ASCII
  } catch { }
}

New-Item -ItemType Directory -Force -Path $rtDir | Out-Null
New-Item -ItemType Directory -Force -Path $queueDir | Out-Null
New-Item -ItemType Directory -Force -Path $doneDir | Out-Null

function WriteJsonAtomic([string]$path, $obj) {
  $tmp = "$path.tmp"
  ($obj | ConvertTo-Json -Depth 6) | Set-Content -Path $tmp -Encoding UTF8
  Move-Item -Force $tmp $path
}
function ReadJson([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  try { return (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}
# NOTE param name must NOT be $pid - $PID is a PowerShell automatic variable (current process, always alive);
#   a param named $pid silently collides and makes OwnerAlive always true (deadlock: stale never detected).
function OwnerAlive([string]$procId) {
  if (-not $procId) { return $false }
  $p = Get-Process -Id ([int]$procId) -ErrorAction SilentlyContinue
  return [bool]$p
}
# A lock is stale if: no current.json, OR its owner pid is dead, OR older than MaxLockAgeSec (hung).
function LockIsStale() {
  if (-not (Test-Path $currentFile)) { return $true }
  $cur = ReadJson $currentFile
  if (-not $cur) { return $true }
  if (-not (OwnerAlive $cur.pid)) { return $true }
  try {
    $age = ((Get-Date) - [datetime]::Parse($cur.startedAt)).TotalSeconds
    if ($age -gt $MaxLockAgeSec) { return $true }
  } catch { return $true }
  return $false
}
# Recovery: ONLY after confirming the current owner is dead/hung - clear leftover runtime state (kill orphan java +
#   delete FineDB lock) then drop lock/current. This is the sanctioned conditional lifecycle action (r12 sec.3),
#   NOT a default pre-action of every execution.
function Invoke-Recovery([string]$reason) {
  $cur = ReadJson $currentFile
  $lostRun = if ($cur) { [string]$cur.runId } else { '' }
  Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force
  if (Test-Path $lck) { Remove-Item $lck -Force }
  if (Test-Path $currentFile) { Remove-Item $currentFile -Force }
  if (Test-Path $lockDir) { Remove-Item $lockDir -Force -Recurse }
  # mark the abandoned run's queue entry as failed-recovered (never as success)
  if ($lostRun -and (Test-Path "$queueDir\$lostRun.json")) {
    $q = ReadJson "$queueDir\$lostRun.json"
    if ($q) {
      # build a fresh hashtable (PS5.1 silently drops NEW properties added to a ConvertFrom-Json PSCustomObject;
      #   only existing keys like 'state' can be reassigned - 'reason' would not persist otherwise)
      WriteJsonAtomic "$doneDir\$lostRun.json" @{ runId = $lostRun; verb = [string]$q.verb; submittedAt = [string]$q.submittedAt; state = 'failed'; reason = "RUNTIME_LOST:$reason"; recoveredAt = (Get-Date).ToString('o') }
    }
    Remove-Item "$queueDir\$lostRun.json" -Force -ErrorAction SilentlyContinue
  }
  WriteHistory "RECOVER $reason" $lostRun
  return $lostRun
}

switch ($Action) {
  'acquire' {
    if (-not $RunId -or -not $Verb) { Write-Output '{"ok":false,"error":"acquire needs -RunId and -Verb"}'; exit 2 }
    if ($RunId -notmatch '^[A-Za-z0-9_-]{1,64}$') { Write-Output '{"ok":false,"error":"illegal runId"}'; exit 2 }
    # register as queued
    WriteJsonAtomic "$queueDir\$RunId.json" @{ runId = $RunId; verb = $Verb; submittedAt = (Get-Date).ToString('o'); state = 'queued' }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($true) {
      try {
        New-Item -ItemType Directory -Path $lockDir -ErrorAction Stop | Out-Null
        # lock acquired (atomic): record ownership. pid MUST be the CALLER (fr_agent) that lives across the runtime
        #   execution - the acquire subprocess exits immediately, so recording its own $PID would make the owner
        #   look dead at once and cause the next acquire to FALSELY recover (kill the running JVM). r12 review fix.
        $ownerPid = if ($OwnerPid -gt 0) { $OwnerPid } else { $PID }
        WriteJsonAtomic $currentFile @{ runId = $RunId; verb = $Verb; pid = $ownerPid; startedAt = (Get-Date).ToString('o') }
        $q = ReadJson "$queueDir\$RunId.json"; if ($q) { $q.state = 'running'; WriteJsonAtomic "$queueDir\$RunId.json" $q }
        WriteHistory "ACQUIRE" $RunId
        Write-Output ('{"ok":true,"acquired":true,"runId":"' + $RunId + '","waitedMs":' + [int]$sw.ElapsedMilliseconds + '}')
        exit 0
      } catch {
        # lock held by someone; is that holder stale?
        if (LockIsStale) {
          $lost = Invoke-Recovery 'stale-owner'
          continue  # retry immediately after clearing
        }
        if ($sw.Elapsed.TotalSeconds -gt $TimeoutSec) {
          $pos = @(Get-ChildItem "$queueDir\*.json" -ErrorAction SilentlyContinue).Count
          # r12 review: drop our own queued registration so status doesn't show a phantom waiter for a task that gave up
          Remove-Item "$queueDir\$RunId.json" -Force -ErrorAction SilentlyContinue
          Write-Output ('{"ok":false,"acquired":false,"reason":"QUEUE_TIMEOUT","runId":"' + $RunId + '","queueDepth":' + $pos + '}')
          exit 1
        }
        Start-Sleep -Milliseconds 250
      }
    }
  }
  'release' {
    if (-not $RunId) { Write-Output '{"ok":false,"error":"release needs -RunId"}'; exit 2 }
    $cur = ReadJson $currentFile
    if ($cur -and [string]$cur.runId -ne $RunId) {
      # not ours to release; leave the real owner's lock intact (idempotent, no false success)
      Write-Output ('{"ok":false,"released":false,"reason":"NOT_OWNER","runId":"' + $RunId + '"}')
      exit 1
    }
    if (Test-Path $currentFile) { Remove-Item $currentFile -Force }
    if (Test-Path $lockDir) { Remove-Item $lockDir -Force -Recurse }
    $q = ReadJson "$queueDir\$RunId.json"
    if ($q) { $q.state = 'done'; WriteJsonAtomic "$doneDir\$RunId.json" $q; Remove-Item "$queueDir\$RunId.json" -Force }
    WriteHistory "RELEASE" $RunId
    Write-Output ('{"ok":true,"released":true,"runId":"' + $RunId + '"}')
    exit 0
  }
  'status' {
    $cur = ReadJson $currentFile
    $queued = @(Get-ChildItem "$queueDir\*.json" -ErrorAction SilentlyContinue | ForEach-Object { $_.BaseName })
    $held = Test-Path $lockDir
    Write-Output ('{"ok":true,"lockHeld":' + $held.ToString().ToLower() + ',"current":' + ($(if ($cur) { (ConvertTo-Json $cur -Compress) } else { 'null' })) + ',"queued":' + (ConvertTo-Json $queued -Compress) + '}')
    exit 0
  }
  'recover' {
    if ((Test-Path $lockDir) -and (LockIsStale)) {
      $lost = Invoke-Recovery 'manual'
      Write-Output ('{"ok":true,"recovered":true,"lostRunId":"' + $lost + '"}')
    } elseif (Test-Path $lockDir) {
      Write-Output '{"ok":true,"recovered":false,"reason":"OWNER_ALIVE"}'
    } else {
      Write-Output '{"ok":true,"recovered":false,"reason":"NO_LOCK"}'
    }
    exit 0
  }
  default { Write-Output '{"ok":false,"error":"unknown action"}'; exit 2 }
}
