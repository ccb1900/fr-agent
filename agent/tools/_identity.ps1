# _identity.ps1 - r18 shared process-identity primitives for the single-instance executor (r17 three-state base).
# Used by fr_agent.ps1 (main flow, under the mutex) and runtime.ps1 (read-only status).
# r17 fixes over r16 (all kept):
#   P1-1 identity verification and Kill happen on the SAME Process object (a .NET Process holds the original
#         handle; a recycled PID can never be killed by killing the verified object).
#   P1-2 three-state result (alive / gone / unknown). "Do not know" = UNKNOWN -> caller MUST refuse (fail-closed).
#   P1-3/P1-4 java.pid file states distinguished: absent / pending / corrupt / unreadable. pending and garbage
#         NEVER become "no JVM".
# r18 fixes over r17 (docs/gpt/r18.md):
#   P1-parseable-garbage: "converts to an integer" is NOT a process identity. A pidfile like "1234 -1" parsed as
#         ok + classified pid-only (expectStart<=0 -> alive whenever that pid exists) could KILL an unrelated
#         process (or, when the pid does not exist, silently "recover" and run a task with a ghost identity).
#         Now: Java kill-target identities REQUIRE exactly two fields with pid > 0 AND start > 0; anything else
#         is corrupt -> unknown -> refuse. The owner path keeps the OTHER semantic (ownerStart=-1 with a live pid
#         => alive, conservative) - the two are never conflated.
# NOTE: ASCII-only.
# NOTE param must NOT be $pid (PowerShell automatic $PID is read-only; assigning it throws VariableNotWritable).

# r19 P1: FILE PRESENCE classification (docs/gpt/r19.md). Test-Path / File.Exists fold access errors into
#   $false, so "false" is NOT proof of absence - a locked/malformed/unreadable path could pass as "no sentinel"
#   and the caller would claim the runtime and start a second JVM. Classify on .NET exceptions instead:
#   'absent'     : provably not there (FileNotFoundException / DirectoryNotFoundException)
#   'readable'   : openable for read -> caller may parse the content
#   'unreadable' : exists but the access was denied -> unknown for the supervisor -> REFUSE
#   'unknown'    : other filesystem fault (sharing violation, malformed path, too-long path) -> REFUSE
# The handle opens with FileShare ReadWrite so normal concurrent readers/writers are not disturbed.
function Get-FilePresence([string]$path) {
  if ([string]::IsNullOrEmpty($path)) { return 'unknown' }
  $fs = $null
  try {
    $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    return 'readable'
  } catch {
    # r17 lesson: classify on real exception type NAME, never on typed catch alone. PS 5.1 surface lesson (r19):
    #   .NET method call exceptions arrive wrapped as MethodInvocationException with the real type in INNEREXCEPTION
    #   (probed: File.Open on a missing file -> Inner=FileNotFoundException) - unwrap once, then classify.
    $ex = $_.Exception
    if ($ex -and $ex.InnerException) { $ex = $ex.InnerException }
    $t = if ($ex) { [string]$ex.GetType().FullName } else { '' }
    if ($t -eq 'System.IO.FileNotFoundException' -or $t -eq 'System.IO.DirectoryNotFoundException') { return 'absent' }
    if ($t -eq 'System.UnauthorizedAccessException') { return 'unreadable' }
    return 'unknown'
  } finally {
    if ($fs) { $fs.Dispose() }
  }
}

# Internal: classify ONE freshly obtained Process object.
#   state 'alive'   : this exact process is running
#   state 'gone'    : definitively not running / different process now occupies that pid
#   state 'unknown' : cannot confirm -> caller must REFUSE
# $requireStart (r18):
#   $true  = kill-target semantics (java.pid identities): expectStart<=0 is NOT acceptable evidence of
#            identity - a pid-only verdict would be exactly the r18 fail-open. Returns 'unknown'.
#   $false = conservative sentinel/owner semantics (ownerStart may legitimately be -1): a live pid means
#            "owner alive unless proven otherwise".
function Get-ClassifiedProcess([int]$procId, [long]$expectStart, [bool]$requireStart) {
  if ($procId -le 0) { return @{ state = 'gone'; proc = $null } }
  $p = $null
  # PS 5.1 Get-Process -Id wraps missing-pid errors in ProcessCommandException (FQID NoProcessFoundForGivenId);
  #   type-based catch is unreliable here, so classification matches the stable error-id string (probed r17).
  try { $p = Get-Process -Id $procId -ErrorAction Stop }
  catch {
    $fq = [string]$_.FullyQualifiedErrorId
    if ($fq -match 'NoProcessFound') { return @{ state = 'gone'; proc = $null } }   # pid does not exist = definitive
    return @{ state = 'unknown'; proc = $null }                                     # any other lookup failure -> refuse
  }
  $cur = -1
  try { $cur = [long]$p.StartTime.Ticks }
  catch { return @{ state = 'unknown'; proc = $p } }   # cannot read start time (access) -> Unknown -> refuse
  if ($expectStart -le 0) {
    if ($requireStart) { return @{ state = 'unknown'; proc = $p } }   # r18: pid-only verdicts are FORBIDDEN for kill targets
    return @{ state = 'alive'; proc = $p }                            # owner semantics: pid exists -> conservatively alive
  }
  if ($cur -eq $expectStart) { return @{ state = 'alive'; proc = $p } }   # exact identity match (pid + start)
  if ($cur -gt 0 -and $cur -ne $expectStart) { return @{ state = 'gone'; proc = $p } }   # pid reused by another process
  return @{ state = 'unknown'; proc = $p }
}

# Public: classification state without the object.
# Callers that classify a KILL TARGET must pass $true; owner/sentinel checks pass $false.
function Classify-Process([int]$procId, [long]$expectStart, [bool]$requireStart) {
  return (Get-ClassifiedProcess $procId $expectStart $requireStart).state
}

# Sentinel (active.json) owner liveness - CONSERVATIVE semantics on purpose (r18): ownerStart=-1 recorded by a
#   crashed host is acceptable owner evidence ("pid exists = possibly alive -> refuse"); only 'gone' may clean up.
function Classify-Owner([int]$ownerPid, [long]$ownerStart) {
  return (Classify-Process $ownerPid $ownerStart $false)
}

# This (fr_agent) process start ticks for the active.json owner identity. Unreadable start is -1:
#   a live pid (pid exists) is enough to see "owner alive" on re-entry; -1 never fabricates a dead verdict.
function SelfStartTicks() {
  try { return [long](Get-Process -Id $PID -ErrorAction Stop).StartTime.Ticks } catch { return -1 }
}

# Read java.pid and classify the FILE (not the process).
#   'absent'     : no file at all -> nothing was ever registered -> caller may treat as gone
#   'pending'    : pre-registered before spawn (r17 P1-3 engine_launch) -> JVM identity unknown -> refuse
#   'ok'         : parses as EXACTLY two fields "pid start" with pid > 0 AND start > 0 (r18 strict)
#   'corrupt'    : present but not a valid identity (non-numeric, extra fields, pid<=0, start<=0) -> refuse (r18)
#   'unreadable' : I/O error while reading -> refuse
function Read-JavaPid([string]$runsDir, [string]$run) {
  $pf = "$runsDir\$run\java.pid"
  # r19 P1: presence is decided by Get-FilePresence (fault-capable), NOT by Test-Path false=absent fiction.
  $pres = Get-FilePresence $pf
  if ($pres -eq 'absent') { return @{ file = 'absent'; pid = 0; start = -1 } }
  if ($pres -ne 'readable') { return @{ file = $pres; pid = 0; start = -1 } }   # unreadable/unknown -> caller refuses
  $raw = $null
  try { $raw = (Get-Content $pf -Raw -Encoding UTF8) } catch { return @{ file = 'unreadable'; pid = 0; start = -1 } }
  $t = ([string]$raw).Trim().TrimStart([char]0xFEFF)
  if ($t -eq 'PENDING') { return @{ file = 'pending'; pid = 0; start = -1 } }
  if (-not $t) { return @{ file = 'corrupt'; pid = 0; start = -1 } }
  $parts = $t -split ' '
  # r18 P1: exactly two fields, pid > 0, start > 0 - "parses as int" alone is NOT an identity (r18 fail-open fix)
  if ($parts.Count -ne 2) { return @{ file = 'corrupt'; pid = 0; start = -1 } }
  $jpid = 0
  if (-not [int]::TryParse($parts[0], [ref]$jpid) -or $jpid -le 0) { return @{ file = 'corrupt'; pid = 0; start = -1 } }
  $jstart = -1
  if (-not [long]::TryParse($parts[1], [ref]$jstart) -or $jstart -le 0) { return @{ file = 'corrupt'; pid = 0; start = -1 } }
  return @{ file = 'ok'; pid = $jpid; start = $jstart }
}

# Identity-scoped kill of an OWNER's leftover JVM (r17 P1-1 + r18 strict identity).
# Returns:
#   'gone'    : pidfile absent, recorded process definitively exited, OR the recorded pid is now a DIFFERENT
#               process (recycled - the other process is intentionally never touched; verification and killing
#               use the same single object, r17 P1-1)
#   'killed'  : verified identity (same object), killed on that object, WaitForExit confirmed gone
#   'unknown' : pidfile pending/corrupt/unreadable, or process identity cannot be confirmed -> caller MUST refuse
#   'stuck'   : killed on the verified object but it did not exit within the wait window -> caller MUST refuse
function Kill-OrphanJvm([string]$runsDir, [string]$run) {
  $jp = Read-JavaPid $runsDir $run
  if ($jp.file -eq 'absent') { return 'gone' }
  if ($jp.file -ne 'ok') { return 'unknown' }   # pending/corrupt/unreadable -> never guess (r17 P1-3/P1-4 + r18)
  $cs = Get-ClassifiedProcess $jp.pid $jp.start $true
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
#   active.json sentinel. pending/corrupt/unreadable/alive => $false -> keep the sentinel.
function Confirm-RunJavaGone([string]$runsDir, [string]$run) {
  $jp = Read-JavaPid $runsDir $run
  if ($jp.file -eq 'absent') { return $true }
  if ($jp.file -ne 'ok') { return $false }
  return ((Get-ClassifiedProcess $jp.pid $jp.start $true).state -eq 'gone')
}
