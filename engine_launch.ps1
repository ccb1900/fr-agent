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

# r18 P1-2: collect a JVM that WAS spawned but whose identity could not be registered (StartTime unreadable or
#   pidfile write failed). Kill on the SAME Process object we hold and wait for exit; ONLY a confirmed exit may
#   drop the pre-registration. If it cannot be confirmed dead, the pending registration STAYS so the next run
#   refuses (identity unknown) instead of racing an unspecified JVM. Returns 'confirmed' | 'kept-pending'.
function Collect-UnregisteredSpawn($p, [string]$PidFile) {
  $confirmed = $false
  try {
    $p.Kill()
    if ($p.WaitForExit(15000)) { $confirmed = $true }
  } catch { $confirmed = $false }
  if ($confirmed) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    return 'confirmed'
  }
  return 'kept-pending'
}
