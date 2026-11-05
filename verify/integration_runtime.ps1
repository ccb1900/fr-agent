# integration_runtime.ps1 - r17 acceptance: THIN single-instance executor, verified by FAULT INJECTION.
# Three properties (docs/gpt/r16.md + r17.md): mutual exclusion (OS mutex) / recovery safety (process identity,
#   three-state fail-closed) / result trust (contracts fail-closed). Tests run against an ISOLATED runtime dir +
#   mutex (r16 P1#4: never touch production state). Full chain: PowerShell -> Nashorn -> Application -> FineReport.
# ASCII-only.
# r17 HONEST SCOPE (P2-2): S5/S5b CONSTRUCT leftover state (decoy java + hand-written java.pid + dead-owner
#   sentinel) - they prove the RECOVERY PATH, not a real host crash; "crash recovery green" means exactly that.
#   S20 is the REAL host-crash test: a live powershell host is TerminateProcess'd while its engine JVM runs (a real
#   orphan, no decoys). S21/S22 cover the new fail-closed pidfile verdicts (corrupt / PENDING -> RUNTIME_BUSY,
#   r17 P1-3/P1-4), S23 covers RunId create-new exclusivity (r17 P2-1). MaxLiveRuntime is a diagnostic-only
#   self-reported history check - NOT kernel proof of the mutex; the mutex itself rests on OS WaitOne semantics
#   (S2/S4/S15 serial outcomes prove no second engine ran concurrently).
$ErrorActionPreference = 'Continue'
$ROOT = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
Set-Location $ROOT
# r16 P1#4: isolate the test's runtime state + mutex so it never clobbers a real task's runtime dir.
$IT_RT = "$ROOT\logs\agent\_it_runtime"
$env:FR_AGENT_RUNTIME_DIR = $IT_RT
$env:FR_AGENT_MUTEX = 'fr-agent-it-test-mutex'
$env:FR_AGENT_HEAP = '640m'   # embedded specs need no j2v8; keeps fault-injection deterministic on a tight host
$rt = $IT_RT
$runs = "$ROOT\logs\agent\runs"
$itRel = 'logs/agent/it'
$itAbs = "$ROOT\logs\agent\it"
$fail = 0
. (Join-Path "$ROOT\agent\tools" 'config.ps1'); $cfg = Get-AgentConfig
$cfgJava = $cfg.Java; $cfgJar = $cfg.NashornJar
function Pass($n) { Write-Output "IT PASS: $n" }
function Fail($n) { Write-Output "IT FAIL: $n"; $script:fail++ }
function Reset-Rt() {
  if (Test-Path $rt) { Remove-Item $rt -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $rt | Out-Null
}
function New-Sleeper([int]$sec) { return (Start-Process powershell -ArgumentList '-Command', "Start-Sleep $sec" -PassThru -WindowStyle Hidden) }
function Start-Ticks($proc) { try { return [long](Get-Process -Id $proc.Id -ErrorAction Stop).StartTime.Ticks } catch { return -1 } }
function ArtExecOk($rid) {
  $p = "$runs\$rid\artifact.json"; if (-not (Test-Path $p)) { return $null }
  try { return (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json).execution.ok } catch { return $null }
}
function Alive($procId) { return [bool](Get-Process -Id $procId -ErrorAction SilentlyContinue) }
# r17: history.log is a self-reported DIAGNOSTIC, not kernel proof of the mutex; used only as an internal-consistency check.
function MaxLiveRuntime() {
  $hist = "$rt\history.log"
  if (-not (Test-Path $hist)) { return 0 }
  $live = @{}; $max = 0
  foreach ($ln in @(Get-Content $hist -Encoding ASCII)) {
    $parts = $ln -split ' '; if ($parts.Count -lt 3) { continue }
    $evt = $parts[1]; $rid = $parts[2]
    if ($evt -eq 'ACQUIRE') { $live[$rid] = 1 } elseif ($evt -eq 'RELEASE') { $live.Remove($rid) } elseif ($evt -eq 'RECOVER') { $live.Clear() }
    if ($live.Count -gt $max) { $max = $live.Count }
  }
  return $max
}

# identity cleanup of java THIS harness spawned before (via it_*/java.pid), never blanket kill (r16 P1#4)
Get-ChildItem -Path $runs -Directory -Filter 'it_*' -ErrorAction SilentlyContinue | ForEach-Object {
  $pf = Join-Path $_.FullName 'java.pid'
  if (Test-Path $pf) {
    $sp = ((Get-Content $pf -Raw -Encoding UTF8).Trim() -split ' '); $jpid = 0
    if ($sp.Count -ge 1 -and [int]::TryParse($sp[0], [ref]$jpid)) {
      $jstart = -1; if ($sp.Count -ge 2) { [long]::TryParse($sp[1], [ref]$jstart) | Out-Null }
      try { $cur = (Get-Process -Id $jpid -ErrorAction Stop).StartTime.Ticks; if ($jstart -gt 0 -and $cur -ne $jstart) { } elseif ($cur -eq $jstart) { Stop-Process -Id $jpid -Force -ErrorAction SilentlyContinue } } catch { }
    }
  }
}
if (Test-Path $itAbs) { Remove-Item $itAbs -Recurse -Force }
New-Item -ItemType Directory -Force -Path $itAbs | Out-Null
Get-ChildItem -Path $runs -Directory -Filter 'it_*' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Reset-Rt
$salesJson = [System.IO.File]::ReadAllText("$ROOT\examples\report-spec\sales_demo.json", [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("$itAbs\a.json", ($salesJson -replace '"outName":\s*"[^"]*"', '"outName": "IT_A"'), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$itAbs\b.json", ($salesJson -replace '"outName":\s*"[^"]*"', '"outName": "IT_B"'), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$itAbs\bad.json", ($salesJson -replace '"aggregation":\s*"sum"', '"aggregation": "avg"'), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$itAbs\_decoy_sleep.js", "Java.type('java.lang.Thread').sleep(60000);`n", (New-Object System.Text.UTF8Encoding($false)))

# ================= P1 mutual exclusion =================
Write-Output "== S1/2/4 concurrent creates serial (mutual exclusion)"
$jobA = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s1a"
$jobB = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/b.json","it_s1b"
$null = Wait-Job $jobA,$jobB; Receive-Job $jobA,$jobB | Out-Null; Remove-Job $jobA,$jobB
if ((ArtExecOk "it_s1a") -eq $true -and (ArtExecOk "it_s1b") -eq $true) { Pass "S2 both creates succeeded (serial)" } else { Fail "S2 not ok A=$(ArtExecOk 'it_s1a') B=$(ArtExecOk 'it_s1b')" }
if ((MaxLiveRuntime) -le 1) { Pass "S4 mutual exclusion maxLiveRuntime=$(MaxLiveRuntime)" } else { Fail "S4 parallel runtimes $(MaxLiveRuntime)" }

# ================= P2 recovery safety (decoy-CONSTRUCTED leftover state, r17 honest scope): compile path =================
Write-Output "== S5 leftover-state recovery path: constructed orphan java -> real create kills exactly it (WaitForExit), proceeds"
Reset-Rt
$decoy = Start-Process $cfgJava -ArgumentList '-cp', $cfgJar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path "$runs\it_ghost" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_ghost\java.pid", ($decoy.Id.ToString() + ' ' + $decoy.StartTime.Ticks.ToString()), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_ghost'; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$null = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s5" 2>&1
if ((-not (Alive $decoy.Id)) -and (ArtExecOk "it_s5") -eq $true -and -not (Test-Path "$rt\active.json")) { Pass "S5 orphan java killed (identity), sentinel cleared, next run completed" } else { Fail "S5 broken orphanDead=$(-not (Alive $decoy.Id)) s5=$(ArtExecOk 'it_s5')" }

# ================= P2 recovery safety (decoy-CONSTRUCTED): PATCH path also records java.pid (r16 P1#1) =================
Write-Output "== S5b patch recovery path: runraw records java.pid, constructed orphan killed"
Reset-Rt
$deploy = "$ROOT\..\..\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\fineagent"
$src = (Get-ChildItem "$deploy\*_api.cpt" -EA SilentlyContinue | Select-Object -First 1)
if ($src) {
  $decoy = Start-Process $cfgJava -ArgumentList '-cp', $cfgJar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 1
  New-Item -ItemType Directory -Force -Path "$runs\it_ghostp" | Out-Null
  [System.IO.File]::WriteAllText("$runs\it_ghostp\java.pid", ($decoy.Id.ToString() + ' ' + $decoy.StartTime.Ticks.ToString()), (New-Object System.Text.UTF8Encoding($false)))
  [System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_ghostp'; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
  $patch = @{ patchVersion='1'; sourceCpt=('fineagent/'+$src.Name); outName='IT_P5B'; ops=@(@{ op='replace_cell_value'; sheet=0; cell=@{ c=0; r=0 }; value=@{ kind='text'; text='IT_P5B' } }) } | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText("$itAbs\p5b.json", $patch, (New-Object System.Text.UTF8Encoding($false)))
  $null = & "$ROOT\agent\tools\fr_agent.ps1" -Verb modify -Patch "$itRel/p5b.json" -RunId "it_s5b" 2>&1
  if ((-not (Alive $decoy.Id)) -and (ArtExecOk "it_s5b") -eq $true) { Pass "S5b patch path records java.pid + orphan killed + modify completed (P1#1 fixed)" } else { Fail "S5b broken orphanDead=$(-not (Alive $decoy.Id)) s5b=$(ArtExecOk 'it_s5b')" }
} else { Pass "S5b skipped (no deployed cpt to patch)" }

# ================= P2 recovery safety: identity mismatch spares an unrelated java =================
Write-Output "== S14 identity mismatch -> spare the reused-pid java, still proceed"
Reset-Rt
$decoy = Start-Process $cfgJava -ArgumentList '-cp', $cfgJar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path "$runs\it_ghost" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_ghost\java.pid", ($decoy.Id.ToString() + ' ' + ($decoy.StartTime.Ticks + 999).ToString()), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_ghost'; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$null = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s14" 2>&1
Start-Sleep -Milliseconds 300
$spared = Alive $decoy.Id
if ($spared -and (ArtExecOk "it_s14") -eq $true) { Pass "S14 reused-pid java spared (not killed), run still proceeded" } else { Fail "S14 broken spared=$spared done=$(ArtExecOk 'it_s14')" }
Stop-Process -Id $decoy.Id -Force -ErrorAction SilentlyContinue

# ================= P2 recovery safety: live owner sentinel + free mutex -> refuse =================
Write-Output "== S6 live-owner sentinel but free mutex -> RUNTIME_BUSY, never start, never clear"
Reset-Rt
$sl = New-Sleeper 30
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_live'; ownerPid=$sl.Id; ownerStart=(Start-Ticks $sl); claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$out6 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s6" 2>&1 | Select-Object -Last 1
if (($out6 -match 'RUNTIME_BUSY') -and (-not (Test-Path "$runs\it_s6\compile.json")) -and (Test-Path "$rt\active.json")) { Pass "S6 refused (RUNTIME_BUSY), did not start, sentinel preserved" } else { Fail "S6 broken: $out6" }
Stop-Process -Id $sl.Id -Force -ErrorAction SilentlyContinue

# ================= P2 recovery safety: corrupt sentinel -> refuse =================
Write-Output "== S16 corrupt sentinel -> RUNTIME_BUSY, never auto-clear"
Reset-Rt
[System.IO.File]::WriteAllText("$rt\active.json", "{ this is not valid json", (New-Object System.Text.UTF8Encoding($false)))
$out16 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s16" 2>&1 | Select-Object -Last 1
if (($out16 -match 'RUNTIME_BUSY') -and (Test-Path "$rt\active.json")) { Pass "S16 corrupt sentinel -> RUNTIME_BUSY, preserved (fail-closed)" } else { Fail "S16 broken: $out16" }
Reset-Rt

# ================= P1 mutual exclusion under a live holder: waiter queues =================
Write-Output "== S8 live holder blocks waiter (queued, not parallel)"
Reset-Rt
$holder = Start-Job -ScriptBlock {
  param($root, $rtDir, $mutex)
  Set-Location $root
  $m = New-Object System.Threading.Mutex($false, $mutex)
  if ($m.WaitOne(5000)) {
    [System.IO.File]::WriteAllText("$rtDir\active.json", (@{ runId='it_holder'; ownerPid=$PID; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
    Start-Sleep 5
    Remove-Item "$rtDir\active.json" -Force -EA SilentlyContinue
    $m.ReleaseMutex()
  }
} -ArgumentList $ROOT,$IT_RT,'fr-agent-it-test-mutex'
Start-Sleep -Milliseconds 900
$jobC = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s8"
Start-Sleep -Seconds 3
$queuedMid = -not (Test-Path "$runs\it_s8\compile.json")
$null = Wait-Job $holder -Timeout 20
$null = Wait-Job $jobC -Timeout 120; Receive-Job $jobC | Out-Null; Remove-Job $holder,$jobC
if ($queuedMid -and (ArtExecOk "it_s8") -eq $true) { Pass "S8 waiter queued while live holder held mutex, then completed" } else { Fail "S8 broken queuedMid=$queuedMid done=$(ArtExecOk 'it_s8')" }

# ================= P1 mutual exclusion + isolation: three concurrent =================
Write-Output "== S15 three concurrent creates"
Reset-Rt
$j1 = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s15a"
$j2 = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/b.json","it_s15b"
$j3 = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/bad.json","it_s15bad"
$null = Wait-Job $j1,$j2,$j3; Receive-Job $j1,$j2,$j3 | Out-Null; Remove-Job $j1,$j2,$j3
$goods = ((ArtExecOk "it_s15a") -eq $true) -and ((ArtExecOk "it_s15b") -eq $true)
if ($goods -and ((ArtExecOk "it_s15bad") -ne $true) -and ((MaxLiveRuntime) -le 1)) { Pass "S15 three serial, goods ok, bad isolated" } else { Fail "S15 broken goods=$goods maxLive=$(MaxLiveRuntime)" }

# ================= P3 result trust: patch missing manifest -> fail-closed =================
Write-Output "== S17 patch missing manifest -> not accepted"
Reset-Rt
New-Item -ItemType Directory -Force -Path "$runs\it_s17" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_s17\patch.json", (@{ tool='patch'; runId='it_s17'; ok=$true; exit=0; patch='x.json'; manifest=$null } | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
$env:AGENT_RUN_ID = 'it_s17'; $env:FR_AGENT_HOME = $ROOT; $env:AGENT_PATCH = "$runs\it_s17\patch.json"
& $cfgJava '-cp' $cfgJar 'jdk.nashorn.tools.Shell' "$ROOT\application\modify_report.js" | Out-Null
if ((ArtExecOk "it_s17") -ne $true) { Pass "S17 missing-manifest patch not accepted (fail-closed)" } else { Fail "S17 missing manifest treated as success" }
Remove-Item env:AGENT_PATCH -ErrorAction SilentlyContinue
Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue

# ============ r17 P2-2: REAL host crash - a live host is killed while its engine JVM runs (no decoys) ============
Write-Output "== S20 real host crash: powershell host TerminateProcess'd mid-run while its java runs -> next run identity-recovers"
Reset-Rt
$cmd20 = "Set-Location '$ROOT'; & '$ROOT\agent\tools\fr_agent.ps1' -Verb create -Spec '$itRel/a.json' -RunId 'it_s20'"
$child = Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', $cmd20 -PassThru -WindowStyle Hidden
# wait until the engine reached its REAL pid registration (past the PENDING pre-registration, r17 P1-3)
$javaPid = 0
for ($i = 0; $i -lt 240; $i++) {
  Start-Sleep -Milliseconds 750
  $pf20 = "$runs\it_s20\java.pid"
  if (Test-Path $pf20) {
    $t20 = ((Get-Content $pf20 -Raw -Encoding UTF8).Trim() -split ' ')
    if ($t20.Count -ge 2 -and $t20[0] -ne 'PENDING') {
      $cnd = 0; if ([int]::TryParse($t20[0], [ref]$cnd) -and $cnd -gt 0) { $javaPid = $cnd; break }
    }
  }
}
if ($javaPid -le 0) {
  Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
  Fail "S20 java.pid never reached real-pid registration (spawn/registration window broken)"
} else {
  Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  $orphanAlive = Alive $javaPid
  # a crashed host never runs the release path -> the sentinel MUST still be there (this is what the next run reads)
  $sentLeft = Test-Path "$rt\active.json"
  if ($orphanAlive -and $sentLeft) {
    $null = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s20b" 2>&1
    if ((-not (Alive $javaPid)) -and (ArtExecOk 'it_s20b') -eq $true) { Pass "S20 real host crash: orphan java $javaPid killed by identity, sentinel consumed, next create completed" }
    else { Fail "S20 recovery broken orphanAlive=$(Alive $javaPid) s20b=$(ArtExecOk 'it_s20b')" }
  } else { Fail "S20 preconditions: orphanAlive=$orphanAlive sentinelLeft=$sentLeft (host finished before the kill?)" }
}

# ============ r17 P1-4: corrupt java.pid must be UNKNOWN, never "no JVM found" ============
Write-Output "== S21 corrupt java.pid + dead owner -> RUNTIME_BUSY, decoy java untouched, sentinel kept"
Reset-Rt
$decoy = Start-Process $cfgJava -ArgumentList '-cp', $cfgJar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path "$runs\it_s21" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_s21\java.pid", 'not-a-jvm-id', (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_s21'; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$out21 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s21x" 2>&1 | Select-Object -Last 1
if (($out21 -match 'RUNTIME_BUSY') -and ((ArtExecOk 'it_s21x') -ne $true) -and (Test-Path "$rt\active.json") -and (Alive $decoy.Id)) { Pass "S21 corrupt java.pid -> RUNTIME_BUSY (fail-closed), decoy untouched" } else { Fail "S21 broken: $out21 decoy=$(Alive $decoy.Id)" }
Stop-Process -Id $decoy.Id -Force -ErrorAction SilentlyContinue

# ============ r17 P1-3: PENDING java.pid (host died in the spawn window) must be UNKNOWN -> refuse ============
Write-Output "== S22 PENDING java.pid + dead owner -> RUNTIME_BUSY (never guess a JVM identity), sentinel kept"
Reset-Rt
$decoy = Start-Process $cfgJava -ArgumentList '-cp', $cfgJar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path "$runs\it_s22" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_s22\java.pid", 'PENDING', (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_s22'; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$out22 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s22x" 2>&1 | Select-Object -Last 1
if (($out22 -match 'RUNTIME_BUSY') -and ((ArtExecOk 'it_s22x') -ne $true) -and (Test-Path "$rt\active.json") -and (Alive $decoy.Id)) { Pass "S22 PENDING java.pid -> RUNTIME_BUSY (fail-closed), decoy untouched" } else { Fail "S22 broken: $out22 decoy=$(Alive $decoy.Id)" }
Stop-Process -Id $decoy.Id -Force -ErrorAction SilentlyContinue

# ============ r17 P2-1: explicit duplicate RunId is refused CREATE-NEW (no artifact cross-pollution) ============
Write-Output "== S23 explicit duplicate RunId -> RUNID_EXISTS, second call refused"
$out23a = & "$ROOT\agent\tools\fr_agent.ps1" -Verb discover -RunId "it_s23" 2>&1 | Select-Object -Last 1   # first outcome irrelevant; only dir existence matters
$out23b = & "$ROOT\agent\tools\fr_agent.ps1" -Verb discover -RunId "it_s23" 2>&1 | Select-Object -Last 1
$rc23 = $LASTEXITCODE
if (($out23b -match 'RUNID_EXISTS') -and $rc23 -eq 1) { Pass "S23 explicit duplicate RunId refused (RUNID_EXISTS, exit 1)" } else { Fail "S23 broken: $out23b rc=$rc23" }

Write-Output ("INTEGRATION END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
