# engine_launch.ps1 - r16 (P1#1 + step3 "unified Java launch"): the single place that starts a FineReport JVM.
# Both run.ps1 and runraw.ps1 dot-source this. When FR_AGENT_JAVA_PIDFILE is set (the agent path), the JVM is started
#   via Start-Process so its PID + StartTime are recorded to the pidfile - this is what lets the supervisor's leftover
#   check identify (and safely wait on) exactly the JVM this run started. Without the pidfile env, the classic
#   synchronous '&' path is used (manual gate, unchanged behavior).
# r17 P1-3: the pidfile is PRE-REGISTERED ('PENDING') BEFORE Start-Process. Process spawn and pidfile persistence
#   are not atomic; the r16 shape (record AFTER spawn) had a crash window: host killed between spawn and record =>
#   an orphan JVM with NO identification would be left running (next run saw no pidfile -> assume gone -> start a
#   second JVM). Now a host death in that window leaves 'PENDING', which means "identity unknown" => the next run
#   REFUSES (fail-closed) instead of waiting on an unidentifiable JVM. Real pid + start replaces 'PENDING' the
#   moment Start-Process returns; if the spawn itself throws, the pre-registration is removed (nothing was started).
# NOTE: ASCII-only.
function Get-EngineClassPath([string]$FrHome) {
  return @(
    "$FrHome\jre\lib\ext\nashorn.jar",
    "$FrHome\jre\lib\tools.jar",
    "$FrHome\.install4j\i4jruntime.jar",
    "$FrHome\.install4j\user.jar",
    "$FrHome\lib\*",
    "$FrHome\server\lib\*",
    "$FrHome\webapps\webroot\WEB-INF\lib\*"
  ) -join ';'
}

# Returns the java exit code. Records java.pid (PENDING pre-registration -> pid + StartTime ticks) when $PidFile is non-empty.
function Start-EngineJava {
  param(
    [string]$FrHome,
    [string]$Script,
    [string]$Out = '',
    [string]$Heap = '1200m',
    [string]$PidFile = ''
  )
  $cp = Get-EngineClassPath $FrHome
  $java = "$FrHome\jre\bin\java.exe"
  $heapArg = "-Xmx$Heap"
  if ($PidFile) {
    # agent path: register FIRST (r17 P1-3), spawn so we can record identity, then wait for exit (r16: Kill is async)
    $parent = Split-Path $PidFile -Parent
    if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $argList = @('-Djava.awt.headless=true', $heapArg, '-cp', $cp, 'jdk.nashorn.tools.Shell', $Script)
    $sp = @{ FilePath = $java; ArgumentList = $argList; NoNewWindow = $true; PassThru = $true }
    if ($Out -ne '') { $sp['RedirectStandardOutput'] = $Out; $sp['RedirectStandardError'] = "$Out.err" }
    # r18 P1-2: PRE-SPAWN failures (PENDING write / Start-Process throw) are the ONLY path that may un-register:
    #   at this point no java exists, so removing the file still means truthfully "never started".
    $p = $null
    try {
      [System.IO.File]::WriteAllText($PidFile, 'PENDING', (New-Object System.Text.UTF8Encoding($false)))
      $p = Start-Process @sp
    } catch {
      Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
      return 1
    }
    # r18 P1-2: everything AFTER a successful spawn is a "started but unregistered" situation. NEVER delete the
    #   PENDING registration to claim "not started" - either collect the JVM on the SAME object (Kill + confirmed
    #   WaitForExit -> registration may be dropped) or keep PENDING so the next run refuses (r17 fail-closed).
    $st = -1
    try { $st = [long]$p.StartTime.Ticks } catch { $st = -1 }
    if ($st -gt 0) {
      try {
        [System.IO.File]::WriteAllText($PidFile, ($p.Id.ToString() + ' ' + $st.ToString()), (New-Object System.Text.UTF8Encoding($false)))
      } catch {
        Collect-UnregisteredSpawn $p $PidFile | Out-Null
        return 1
      }
      # Phase-3 P0 fix (probed, redirect and no-redirect shapes alike): PS 5.1 Start-Process -PassThru returns a
      #   Process whose ExitCode reads NULL when WaitForExit() runs without the handle allocated first. NULL then
      #   flows through `exit ($null)` => exit code 0, so an engine REJECT was recorded as exit=0 on the agent
      #   path (false-green; runraw/fr_agent $LASTEXITCODE=0). Accessing .Handle forces the SafeProcessHandle
      #   allocation BEFORE the process exits and makes ExitCode reliable (probed: java System.exit(1) reads 1
      #   in both shapes). r17/r18 registration order untouched: spawn -> pidfile -> handle -> wait.
      # 3.2-4 (stage3 final check S8a): a Handle allocation failure must NOT be silently swallowed - without
      #   the handle PS 5.1 reads ExitCode as NULL and a rejected engine run would be recorded as exit 0
      #   (false-green, the P0 class this file exists to prevent). Fail-closed: collect the unidentifiable
      #   spawn on the SAME object (confirmed kill+wait -> pidfile dropped; otherwise PENDING kept so the
      #   next run refuses by identity) and return an explicit failure instead of an untrustworthy exit code.
      try { $null = $p.Handle } catch {
        Collect-UnregisteredSpawn $p $PidFile | Out-Null
        return 1
      }
      $p.WaitForExit()
      return $p.ExitCode
    }
    # StartTime unreadable on a LIVE spawn -> do NOT write a "pid -1" fake identity (would re-trigger the r18
    #   parseable-garbage fail-open). Collect the just-spawned JVM or leave PENDING behind.
    Collect-UnregisteredSpawn $p $PidFile | Out-Null
    return 1
  }
  if ($Out -ne '') {
    & $java '-Djava.awt.headless=true' $heapArg '-cp' $cp 'jdk.nashorn.tools.Shell' $Script *> $Out
    return $LASTEXITCODE
  }
  & $java '-Djava.awt.headless=true' $heapArg '-cp' $cp 'jdk.nashorn.tools.Shell' $Script | Out-Host
  return $LASTEXITCODE
}

# r18 P1-2 / r19 P2: collect a JVM that WAS spawned but whose identity could not be registered (StartTime
#   unreadable or pidfile write failed). Kill on the SAME Process object we hold, then WAIT FOR EXIT - Kill's own
#   outcome is only a hint: if the JVM already exited by itself the Kill throws InvalidOperationException, which is
#   the good case and must NOT mask the exit (r19 race fix: the old single-catch marked that confirmed-exit as
#   kept-pending). ONLY a WaitForExit-confirmed exit may drop the pre-registration; anything else keeps PENDING so
#   the next run refuses (identity unknown) instead of racing an unspecified JVM. Returns 'confirmed' | 'kept-pending'.
function Collect-UnregisteredSpawn($p, [string]$PidFile) {
  try { $p.Kill() } catch { }
  try {
    if ($p.WaitForExit(15000)) {
      Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
      return 'confirmed'
    }
  } catch { }
  return 'kept-pending'
}
