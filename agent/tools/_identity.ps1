# _identity.ps1 - r17 shared process-identity primitives for the single-instance executor.
# Used by fr_agent.ps1 (main flow, under the mutex) and runtime.ps1 (read-only status).
# r17 fixes over r16:
#   P1-1: identity verification and Kill happen on the SAME Process object. The r16 shape
#         (Get-Process once to compare, then a SECOND Get-Process before Kill) had a race: if the recorded
#         process exited and Windows recycled its PID between the two lookups, the second lookup returned a
#         totally unrelated process that was then killed. Here ONE Process object is obtained, its StartTime is
#         read from THAT object, compared to the recorded start, and only a match causes Kill on that object -
#         a .NET Process object holds the original handle, so killing it can never hit a recycled PID.
#   P1-2: three-state results (alive / gone / unknown), never bool or -1. "Do not know" (access denied,
#         unreadable StartTime, spawn window) is UNKNOWN and every caller MUST refuse to start (fail-closed);
#         only a definitive exit may be treated as gone.
#   P1-3: the java pidfile can be seen in state 'pending' (pre-registered before the JVM exists; see
#         engine_launch.ps1). pending/corrupt/unreadable => unknown -> refuse; never invent a process identity.
#   P1-4: java.pid file states are distinguished: absent (no file -> nothing to kill => gone), ok (pid+start),
#         pending, corrupt, unreadable. r16 conflated "file has garbage" with "file/proc absent" -> unsafe.
# NOTE: ASCII-only.
# NOTE param must NOT be $pid (PowerShell automatic $PID is read-only; assigning it throws VariableNotWritable).

# Internal: classify ONE freshly obtained Process object.
#   state 'alive'   : this exact process is running (considering the recorded start when we have one)
#   state 'gone'    : definitively not running / different process now occupies that pid
#   state 'unknown' : cannot confirm (access error, turkey StartTime unreadable) -> caller must REFUSE
function Get-ClassifiedProcess([int]$procId, [long]$expectStart) {
  if ($procId -le 0) { return @{ state = 'gone'; proc = $null } }
  $p = $null
  # PS 5.1 Get-Process -Id wraps missing-pid errors in ProcessCommandException (FQID NoProcessFoundForGivenId);
  #   type-based catch is unreliable here, so classification matches the stable error-id string (probed on this host).
  try { $p = Get-Process -Id $procId -ErrorAction Stop }
  catch {
    $fq = [string]$_.FullyQualifiedErrorId
    if ($fq -match 'NoProcessFound') { return @{ state = 'gone'; proc = $null } }   # pid does not exist = definitive
    return @{ state = 'unknown'; proc = $null }                                     # any other lookup failure -> refuse
  }
  $cur = -1
  try { $cur = [long]$p.StartTime.Ticks }
  catch { return @{ state = 'unknown'; proc = $p } }   # cannot read start time (access) -> Unknown -> refuse
  if ($expectStart -le 0) { return @{ state = 'alive'; proc = $p } }   # no recorded start to compare; pid exists
  if ($cur -eq $expectStart) { return @{ state = 'alive'; proc = $p } }   # exact identity match (pid + start)
  if ($cur -gt 0 -and $cur -ne $expectStart) { return @{ state = 'gone'; proc = $p } }   # pid reused by another process
  return @{ state = 'unknown'; proc = $p }
}

# Public: three-state classification without the object (owner/sentinel checks).
function Classify-Process([int]$procId, [long]$expectStart) {
  return (Get-ClassifiedProcess $procId $expectStart).state
}

# Sentinel (active.json) owner liveness, three-state (r17 P1-2). Only 'gone' may clear/clean up.
function Classify-Owner([int]$ownerPid, [long]$ownerStart) {
  return (Classify-Process $ownerPid $ownerStart)
}

# This (fr_agent) process start ticks for the active.json owner identity. Unreadable start is -1:
#   a live pid (pid exists) is enough to see "owner alive" on re-entry; -1 never fabricates a dead verdict.
function SelfStartTicks() {
  try { return [long](Get-Process -Id $PID -ErrorAction Stop).StartTime.Ticks } catch { return -1 }
}

# Read java.pid and classify the FILE (not the process).
#   'absent'     : no file at all -> nothing was ever registered -> caller may treat as gone
#   'pending'    : pre-registered before spawn (r17 P1-3 engine_launch) -> JVM identity unknown -> refuse
#   'ok'         : parses as "pid start" (returns pid/start)
#   'corrupt'    : present but not parseable -> refuse (r17 P1-4)
#   'unreadable' : I/O error while reading -> refuse (r17 P1-4)
function Read-JavaPid([string]$runsDir, [string]$run) {
  $pf = "$runsDir\$run\java.pid"
  if (-not (Test-Path $pf)) { return @{ file = 'absent'; pid = 0; start = -1 } }
  $raw = $null
  try { $raw = (Get-Content $pf -Raw -Encoding UTF8) } catch { return @{ file = 'unreadable'; pid = 0; start = -1 } }
  $t = ([string]$raw).Trim().TrimStart([char]0xFEFF)
  if ($t -eq 'PENDING') { return @{ file = 'pending'; pid = 0; start = -1 } }
  if (-not $t) { return @{ file = 'corrupt'; pid = 0; start = -1 } }
  $parts = $t -split ' '
  $jpid = 0
  if ($parts.Count -lt 2 -or -not [int]::TryParse($parts[0], [ref]$jpid)) { return @{ file = 'corrupt'; pid = 0; start = -1 } }
  $jstart = -1
  if (-not [long]::TryParse($parts[1], [ref]$jstart)) { return @{ file = 'corrupt'; pid = 0; start = -1 } }
  return @{ file = 'ok'; pid = $jpid; start = $jstart }
}

# Identity-scoped kill of an OWNER's leftover JVM (r17 P1-1/P1-2/P1-4 + r16 async-kill).
# Returns the leftover verdict:
#   'gone'    : pidfile absent, recorded process definitively exited, OR the recorded pid is now a DIFFERENT
#               process (recycled - the other process is intentionally never touched: killing it never happens
#               here; verifying and killing use the same single object, r17 P1-1)
#   'killed'  : verified identity (same object), killed on that object, WaitForExit confirmed gone
#   'unknown' : pidfile pending/corrupt/unreadable, or process identity cannot be confirmed -> caller MUST refuse
#   'stuck'   : killed on the verified object but it did not exit within the wait window -> caller MUST refuse
function Kill-OrphanJvm([string]$runsDir, [string]$run) {
  $jp = Read-JavaPid $runsDir $run
  if ($jp.file -eq 'absent') { return 'gone' }
  if ($jp.file -eq 'pending' -or $jp.file -eq 'corrupt' -or $jp.file -eq 'unreadable') { return 'unknown' }   # fail-closed
  $cs = Get-ClassifiedProcess $jp.pid $jp.start
  if ($cs.state -eq 'gone') { return 'gone' }
  if ($cs.state -eq 'unknown') { return 'unknown' }
  # state 'alive': $cs.proc IS the verified object (no re-lookup here - r17 P1-1). Kill THAT object and wait.
  try { $cs.proc.Kill() }
  catch [System.InvalidOperationException] { return 'gone' }                      # process exited between verify and Kill
  catch { return 'unknown' }                                                     # deny/other -> cannot confirm -> refuse
  try { if (-not $cs.proc.WaitForExit(15000)) { return 'stuck' } }
  catch { return 'stuck' }
  return 'killed'
}

# r17 P1-5: is THIS run's java confirmed gone? Used by the sentinel-release path: only a definitive verdict
#   (pidfile absent = never spawned, or pidfile ok + recorded process definitively exited) may release the
#   active.json sentinel. pending/corrupt/unreadable/alive => $false -> keep the sentinel (next run refuses
#   or identity-recovers instead of racing a live JVM).
function Confirm-RunJavaGone([string]$runsDir, [string]$run) {
  $jp = Read-JavaPid $runsDir $run
  if ($jp.file -eq 'absent') { return $true }
  if ($jp.file -ne 'ok') { return $false }
  return ((Get-ClassifiedProcess $jp.pid $jp.start).state -eq 'gone')
}
