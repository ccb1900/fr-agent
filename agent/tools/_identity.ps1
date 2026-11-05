# _identity.ps1 - r16 shared process-identity primitives for the single-instance executor.
# Used by fr_agent.ps1 (main flow, under the mutex) and runtime.ps1 (read-only status).
# The leftover kill is identity-scoped: only the java recorded in java.pid, verified by pid + StartTime.
#   Process.Kill() is ASYNCHRONOUS (r16): after Kill we WaitForExit so the JVM is actually gone before
#   removing the FineDB lock / starting a new instance. Never scan-all java, never unconditional kill.
# NOTE: ASCII-only.
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

# Read java.pid (pid + StartTime ticks) for a run; returns @{pid;start} or $null.
function Read-JavaPid([string]$runsDir, [string]$run) {
  $pf = "$runsDir\$run\java.pid"
  if (-not (Test-Path $pf)) { return $null }
  $parts = ((Get-Content $pf -Raw -Encoding UTF8).Trim() -split ' ')
  $jpid = 0; if ($parts.Count -ge 1) { [int]::TryParse($parts[0], [ref]$jpid) | Out-Null }
  $jstart = -1; if ($parts.Count -ge 2) { try { $jstart = [long]$parts[1] } catch { $jstart = -1 } }
  if ($jpid -le 0) { return $null }
  return @{ pid = $jpid; start = $jstart }
}

# Kill exactly the recorded orphan JVM (identity-verified) and WAIT for it to exit (r16 async-kill).
#   Returns: 'gone' (nothing to kill / already exited), 'killed' (killed and exited), 'spared' (pid reused -> not ours),
#   'stuck' (killed but did not exit within timeout -> caller must NOT proceed).
function Kill-OrphanJvm([string]$runsDir, [string]$run, [int]$waitMs = 15000) {
  $jp = Read-JavaPid $runsDir $run
  if (-not $jp) { return 'gone' }
  $cur = ProcStartTicks $jp.pid
  if ($cur -lt 0) { return 'gone' }                              # already exited
  if ($jp.start -gt 0 -and $cur -ne $jp.start) { return 'spared' } # PID reused by another process -> not our java
  $p = $null
  try { $p = Get-Process -Id $jp.pid -ErrorAction Stop } catch { return 'gone' }
  try { $p.Kill() } catch { }
  try {
    if (-not $p.WaitForExit($waitMs)) { return 'stuck' }          # r16: Kill is async; confirm it actually exited
  } catch { return 'stuck' }
  return 'killed'
}
