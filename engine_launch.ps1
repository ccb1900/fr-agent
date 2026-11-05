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
    # agent path: register FIRST (P1-3), spawn so we can record identity, then wait for exit (r16: Kill is async - the holder must WAIT)
    $parent = Split-Path $PidFile -Parent
    if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    [System.IO.File]::WriteAllText($PidFile, 'PENDING', (New-Object System.Text.UTF8Encoding($false)))
    $argList = @('-Djava.awt.headless=true', $heapArg, '-cp', $cp, 'jdk.nashorn.tools.Shell', $Script)
    $sp = @{ FilePath = $java; ArgumentList = $argList; NoNewWindow = $true; PassThru = $true }
    if ($Out -ne '') { $sp['RedirectStandardOutput'] = $Out; $sp['RedirectStandardError'] = "$Out.err" }
    $p = $null
    try {
      $p = Start-Process @sp
      $st = -1; try { $st = $p.StartTime.Ticks } catch { }
      [System.IO.File]::WriteAllText($PidFile, ($p.Id.ToString() + ' ' + $st.ToString()), (New-Object System.Text.UTF8Encoding($false)))
    } catch {
      # spawn never happened -> drop the pre-registration so "absent" stays the truthful verdict
      Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
      return 1
    }
    $p.WaitForExit()
    return $p.ExitCode
  }
  if ($Out -ne '') {
    & $java '-Djava.awt.headless=true' $heapArg '-cp' $cp 'jdk.nashorn.tools.Shell' $Script *> $Out
    return $LASTEXITCODE
  }
  & $java '-Djava.awt.headless=true' $heapArg '-cp' $cp 'jdk.nashorn.tools.Shell' $Script | Out-Host
  return $LASTEXITCODE
}
