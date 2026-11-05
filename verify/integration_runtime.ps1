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

# ============ r18 P1: corrupt java.pid VARIANTS (integer-parseable garbage must NOT become a killable identity) ============
Write-Output "== S21 corrupt java.pid variants -> RUNTIME_BUSY, decoy untouched, sentinel kept"
$variants21 = @('not-a-jvm-id', '1234 -1', '1234 0', '0 123456789', '-1 123456789', '1234 123456789 extra',
  '1234   123456789', "1234`t123456789", '99999999999 123456789', '1234 99999999999999999999')
$bad21 = 0
$idx21 = 0
foreach ($v21 in $variants21) {
  $idx21++
  Reset-Rt
  $decoy = Start-Process $cfgJava -ArgumentList '-cp', $cfgJar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 1
  New-Item -ItemType Directory -Force -Path "$runs\it_s21_$idx21" | Out-Null
  [System.IO.File]::WriteAllText("$runs\it_s21_$idx21\java.pid", $v21, (New-Object System.Text.UTF8Encoding($false)))
  [System.IO.File]::WriteAllText("$rt\active.json", (@{ runId="it_s21_$idx21"; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
  $out21 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s21x$idx21" 2>&1 | Select-Object -Last 1
  if (-not (($out21 -match 'RUNTIME_BUSY') -and ((ArtExecOk "it_s21x$idx21") -ne $true) -and (Test-Path "$rt\active.json") -and (Alive $decoy.Id))) {
    Write-Output "S21 VARI'$v21' FAIL: out=$out21 decoyAlive=$(Alive $decoy.Id) sent=$(Test-Path "$rt\active.json")"; $bad21++
  }
  Stop-Process -Id $decoy.Id -Force -ErrorAction SilentlyContinue
}
Reset-Rt
if ($bad21 -eq 0) { Pass "S21 corrupt java.pid variants x$idx21 -> RUNTIME_BUSY (fail-closed), decoys untouched" } else { Fail "S21 broken variants=$bad21" }

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

# ============ r17 P2-1 REFINED r22e: the duplicate verdict is the ENGINE ARTIFACT, not the directory ============
# r22e product semantics (reverse-engineered from the demo one-runId flow): zero-engine products (plan.json/
#   reportSpec.json) in a run dir are the legal chain handoff (plan->plan2spec->create share ONE runId); the
#   refusal surface is the ENGINE artifact (compile.json / patch.json) - a REAL re-entry would overwrite it.
# S23: pre-seed a compile.json (no engine), then a real compile verb call must refuse. The zero-engine chain
#     must NOT refuse (plan on a dir with only plan.json re-enters, S26 failures covered elsewhere).
# S24: two concurrent compile hosts over the pre-seeded artifact both refuse (mutex-serial: no second engine,
#     no artifact race). The former directory-race verdict moved into the artifact-existence rule.
Write-Output "== S23 compile verb with existing compile.json -> RUNID_EXISTS; zero-engine plan on same dir re-enters"
Reset-Rt
New-Item -ItemType Directory -Force -Path "$runs\it_s23" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_s23\compile.json", '{"tool":"compile","runId":"it_s23","ok":true,"exit":0}', (New-Object System.Text.UTF8Encoding($false)))
$out23b = & "$ROOT\agent\tools\fr_agent.ps1" -Verb compile -RunId "it_s23" 2>&1 | Select-Object -Last 1
$rc23 = $LASTEXITCODE
$planRe23 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb plan -Intent "$itRel/a.json" -RunId "it_s23" 2>&1 | Select-Object -Last 1
# zero-engine re-entry proof = NO RUNID_EXISTS from the entry registration (plan.status may legitimately be
#   rejected for out-of-model terms in the rows intent - the re-entry gate itself is what we're asserting).
$orchid = ($out23b -match 'RUNID_EXISTS') -and ($rc23 -eq 1) -and ($planRe23 -notmatch 'RUNID_EXISTS')
if ($orchid) { Pass "S23 engine artifact re-entry refused; zero-engine chain handoff allowed on the same runId" } else { Fail "S23 broken: compile=$out23b rc=$rc23 plan=$planRe23" }

Write-Output "== S24a two concurrent compile hosts over pre-seeded engine artifact -> both refuse (no race write)"
Reset-Rt
New-Item -ItemType Directory -Force -Path "$runs\it_s24" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_s24\compile.json", '{"tool":"compile","runId":"it_s24","ok":true,"exit":0}', (New-Object System.Text.UTF8Encoding($false)))
$s24a = Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', "Set-Location '$ROOT'; & '$ROOT\agent\tools\fr_agent.ps1' -Verb compile -RunId 'it_s24'" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$itAbs\s24a.txt" -RedirectStandardError "$itAbs\s24a.err"
$s24b = Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', "Set-Location '$ROOT'; & '$ROOT\agent\tools\fr_agent.ps1' -Verb compile -RunId 'it_s24'" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$itAbs\s24b.txt" -RedirectStandardError "$itAbs\s24b.err"
$null = $s24a.WaitForExit(180000); $null = $s24b.WaitForExit(180000)
$outA24 = [string]([System.IO.File]::ReadAllText("$itAbs\s24a.txt")); $outB24 = [string]([System.IO.File]::ReadAllText("$itAbs\s24b.txt"))
if (($outA24 -match 'RUNID_EXISTS') -and ($outB24 -match 'RUNID_EXISTS') -and ((Get-Content "$runs\it_s24\compile.json" -Raw) -match '"runId":"it_s24"' -and (Get-Content "$runs\it_s24\compile.json" -Raw) -notmatch 'queue')) {
  Pass "S24a both concurrent compiles refused (mutex-serial, artifact untouched, no engine started)"
} else { Fail "S24a broken outA=$outA24 outB=$outB24" }

# ============ r23 P1: REAL same-RunId concurrent re-entry race, DETERMINISTIC (r24: gate/signals, no sleep) ============
# r24 review: bare Start-Process "started close together" does NOT guarantee both callers passed the entry check
#   before A wrote compile.json (a late B would be refused at the OUTSIDE entry and never reach the in-mutex
#   recheck). Deterministic construction (test-layer sync only, zero production change, zero sleep-gambling):
#     1) test process holds the SAME named mutex the agents use (FR_AGENT_MUTEX env);
#     2) two wrapper processes each: write a ready signal file -> wait ManualResetEvent('IT_S24_GATE') ->
#        spawn fr_agent compile (real spec); while the mutex is held their entry checks pass (compile.json
#        absent) and they block queued on WaitOne;
#        "both wrappers ready" is proven by both ready signal files appearing (event-driven poll, no fixed delay);
#        window argument: engine run (60s+) dwarfs the millisecond skew of two entry checks, so B's entry check
#        always happens before A writes compile.json;
#     3) Set the event (ManualReset broadcasts to both waiters) -> both fr_agents queue on WaitOne -> mutex serial;
#     4) winner runs the engine and writes compile.json (r22e assembly also inside the mutex, visible before
#        release); loser hits the IN-MUTEX recheck -> RUNID_EXISTS;
#     5) assert exactly one ok:true + exactly one RUNID_EXISTS + single runresult with success=true.
Write-Output "== S24b real race (deterministic gate): two hosts same RunId from zero artifacts -> exactly ONE engine run"
Reset-Rt
[System.IO.File]::WriteAllText("$itAbs\s24race.json", ($salesJson -replace '"outName":\s*"[^"]*"', '"outName": "IT_S24RACE"'), (New-Object System.Text.UTF8Encoding($false)))
Remove-Item "$itAbs\s24gate_ready_a.txt", "$itAbs\s24gate_ready_b.txt" -Force -ErrorAction SilentlyContinue
$gateCreated = $false
$gate24 = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::ManualReset, 'IT_S24_GATE', [ref]$gateCreated)
# r24: readiness is signaled by the wrappers themselves via two AutoReset events - the harness blocks on
#   kernel WaitOne (NO sleep, NO polling). A wrapper that died before signaling simply times the wait out.
$rdA = $false; $rdB = $false
try { $rdA = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, 'IT_S24_READY_A', [ref]$true) } catch { }
try { $rdB = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, 'IT_S24_READY_B', [ref]$true) } catch { }
$mtx24 = New-Object System.Threading.Mutex($false, $env:FR_AGENT_MUTEX)
$null = $mtx24.WaitOne(10000)   # hold the SAME mutex the agents use: their WaitOne queues behind us
$wrapA = "Set-Location '$ROOT'; Set-Content -Path '$itAbs\s24gate_ready_a.txt' -Value 'w'; [void][System.Threading.EventWaitHandle]::OpenExisting('IT_S24_READY_A').Set(); " + "`$e=[System.Threading.EventWaitHandle]::OpenExisting('IT_S24_GATE'); [void]`$e.WaitOne(180000); & '$ROOT\agent\tools\fr_agent.ps1' -Verb compile -Spec 'logs/agent/it/s24race.json' -RunId 'it_s24r'"
$wrapB = "Set-Location '$ROOT'; Set-Content -Path '$itAbs\s24gate_ready_b.txt' -Value 'w'; [void][System.Threading.EventWaitHandle]::OpenExisting('IT_S24_READY_B').Set(); " + "`$e=[System.Threading.EventWaitHandle]::OpenExisting('IT_S24_GATE'); [void]`$e.WaitOne(180000); & '$ROOT\agent\tools\fr_agent.ps1' -Verb compile -Spec 'logs/agent/it/s24race.json' -RunId 'it_s24r'"
$r24a = Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', $wrapA -PassThru -WindowStyle Hidden -RedirectStandardOutput "$itAbs\s24ra.txt" -RedirectStandardError "$itAbs\s24ra.err"
$r24b = Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', $wrapB -PassThru -WindowStyle Hidden -RedirectStandardOutput "$itAbs\s24rb.txt" -RedirectStandardError "$itAbs\s24rb.err"
$readyA = [bool]$rdA -and $rdA.WaitOne(120000)   # kernel-block until each wrapper signals ready (no sleep)
$readyB = [bool]$rdB -and $rdB.WaitOne(120000)
if ((-not $readyA) -or (-not $readyB) -or (Test-Path "$runs\it_s24r\compile.json")) {
  Fail "S24b readiness broken readyA=$readyA readyB=$readyB artifactEarly=$(Test-Path "$runs\it_s24r\compile.json")"
  try { $gate24.Set() | Out-Null } catch { }
  try { $null = $mtx24.ReleaseMutex() } catch { }
  $mtx24.Dispose()
  $null = $r24a.WaitForExit(120000); $null = $r24b.WaitForExit(120000)
} else {
  $gate24.Set() | Out-Null          # broadcast: both wrappers spawn fr_agent, pass the entry check (no artifact yet), queue on WaitOne
  $null = $mtx24.ReleaseMutex()     # hand the mutex to the queue: winner runs the engine, loser hits the in-mutex recheck
  $null = $r24a.WaitForExit(600000); $null = $r24b.WaitForExit(600000)
  $outRa = [string]([System.IO.File]::ReadAllText("$itAbs\s24ra.txt")); $outRb = [string]([System.IO.File]::ReadAllText("$itAbs\s24rb.txt"))
  $okR24 = 0; $refR24 = 0
  if ($outRa -match '"ok":true') { $okR24++ } elseif ($outRa -match 'RUNID_EXISTS') { $refR24++ }
  if ($outRb -match '"ok":true') { $okR24++ } elseif ($outRb -match 'RUNID_EXISTS') { $refR24++ }
  $rrJson = $null; try { $rrJson = Get-Content "$runs\it_s24r\runresult.json" -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
  $singleEngine = (($okR24 -eq 1) -and ($refR24 -eq 1) -and ($null -ne $rrJson) -and ($rrJson.success -eq $true))
  if ($singleEngine) { Pass "S24b deterministic race closed: both hosts past entry while mutex held, exactly ONE engine run (ok=1, RUNID_EXISTS=1), single truthful runresult" } else { Fail "S24b broken ok=$okR24 ref=$refR24 outA=$outRa outB=$outRb" }
  Remove-Item "D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\fineagent\IT_S24RACE_api.*" -Force -ErrorAction SilentlyContinue
}
try { $gate24.Dispose() } catch { }; try { $rdA.Dispose() } catch { }; try { $rdB.Dispose() } catch { }; $mtx24.Dispose()

# r24 second deliverable: patch path gets its own concurrent acceptance (pre-seeded patch.json -> both refuse)
Write-Output "== S24c patch path: pre-seeded patch.json -> two concurrent modify hosts both RUNID_EXISTS"
Reset-Rt
New-Item -ItemType Directory -Force -Path "$runs\it_s24p" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_s24p\patch.json", '{"tool":"patch","runId":"it_s24p","ok":true,"exit":0}', (New-Object System.Text.UTF8Encoding($false)))
$p24a = Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', "Set-Location '$ROOT'; & '$ROOT\agent\tools\fr_agent.ps1' -Verb modify -RunId 'it_s24p'" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$itAbs\s24pa.txt" -RedirectStandardError "$itAbs\s24pa.err"
$p24b = Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command', "Set-Location '$ROOT'; & '$ROOT\agent\tools\fr_agent.ps1' -Verb modify -RunId 'it_s24p'" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$itAbs\s24pb.txt" -RedirectStandardError "$itAbs\s24pb.err"
$null = $p24a.WaitForExit(180000); $null = $p24b.WaitForExit(180000)
$outPa = [string]([System.IO.File]::ReadAllText("$itAbs\s24pa.txt")); $outPb = [string]([System.IO.File]::ReadAllText("$itAbs\s24pb.txt"))
if (($outPa -match 'RUNID_EXISTS') -and ($outPb -match 'RUNID_EXISTS')) { Pass "S24c patch path: both concurrent modifies refused (patch.json DupCheckFile honored)" } else { Fail "S24c broken outA=$outPa outB=$outPb" }

# ============ r18 P2: registration-failure fault injection (e2e + white-box) ============
Write-Output "== S25 pre-spawn registration unusable (pidfile PARENT is a regular file - deterministic fault, no drive dependency) -> rc!=0, NO java spawned"
$s25dir = "$itAbs\s25engine"
if (Test-Path $s25dir) { Remove-Item $s25dir -Recurse -Force -ErrorAction SilentlyContinue }
[System.IO.File]::WriteAllText($s25dir, 'regular file blocks the pidfile parent (r19: deterministic, host-independent)', (New-Object System.Text.UTF8Encoding($false)))
$env:FR_AGENT_JAVA_PIDFILE = "$s25dir\java.pid"
& "$ROOT\run.ps1" -Script "$itAbs\_decoy_sleep.js" -Heap 640m -NoKill | Out-Null
$rc25 = $LASTEXITCODE
Remove-Item env:FR_AGENT_JAVA_PIDFILE -ErrorAction SilentlyContinue
# identity-based leak check (ANOTHER SESSION may run its own java concurrently - never count foreign java)
$leaked25 = @(Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue | Where-Object { [string]($_.CommandLine) -match '_decoy_sleep\.js' }).Count
if (($rc25 -ne 0) -and ($leaked25 -eq 0)) { Pass "S25 pre-spawn registration failure -> rc=$rc25, no leaked decoy java (identity-checked)" } else { Fail "S25 broken rc=$rc25 leaked=$leaked25" }

Write-Output "== S26 white-box Collect-UnregisteredSpawn: confirmed exit clears registration; cannot-confirm keeps PENDING"
. "$ROOT\engine_launch.ps1"   # r18: exposes Collect-UnregisteredSpawn (started-but-unregistered JVM collector)
# A) real java alive -> same-object Kill+Wait confirmed -> registration may be dropped
$decoy26 = Start-Process $cfgJava -ArgumentList '-cp', $cfgJar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path "$itAbs\s26a" | Out-Null
$pf26a = "$itAbs\s26a\java.pid"
[System.IO.File]::WriteAllText($pf26a, 'PENDING', (New-Object System.Text.UTF8Encoding($false)))
$r26a = Collect-UnregisteredSpawn $decoy26 $pf26a
$ok26a = (($r26a -eq 'confirmed') -and (-not (Alive $decoy26.Id)) -and (-not (Test-Path $pf26a)))
# B) Kill fails (stub) -> PENDING must STAY (fail-closed: the JVM may still be alive)
$stubB26 = New-Object PSObject
$stubB26 | Add-Member -MemberType ScriptMethod -Name Kill -Value { throw 'simulated kill failure' }
$stubB26 | Add-Member -MemberType ScriptMethod -Name WaitForExit -Value { param([int]$ms) throw 'simulated wait failure' }
New-Item -ItemType Directory -Force -Path "$itAbs\s26b" | Out-Null
$pf26b = "$itAbs\s26b\java.pid"
[System.IO.File]::WriteAllText($pf26b, 'PENDING', (New-Object System.Text.UTF8Encoding($false)))
$r26b = Collect-UnregisteredSpawn $stubB26 $pf26b
$ok26b = (($r26b -eq 'kept-pending') -and (Test-Path $pf26b))
# C) Kill ok but WaitForExit false (stub) -> PENDING must STAY
$stubC26 = New-Object PSObject
$stubC26 | Add-Member -MemberType ScriptMethod -Name Kill -Value { }
$stubC26 | Add-Member -MemberType ScriptMethod -Name WaitForExit -Value { param([int]$ms) return $false }
New-Item -ItemType Directory -Force -Path "$itAbs\s26c" | Out-Null
$pf26c = "$itAbs\s26c\java.pid"
[System.IO.File]::WriteAllText($pf26c, 'PENDING', (New-Object System.Text.UTF8Encoding($false)))
$r26c = Collect-UnregisteredSpawn $stubC26 $pf26c
$ok26c = (($r26c -eq 'kept-pending') -and (Test-Path $pf26c))
# D) r19 recovery race: Kill throws InvalidOperationException (JVM already exited by itself) but WaitForExit
#    tells the truth -> the registration MAY be dropped (current r18 code returns kept-pending here = RED-expected)
$stubD26 = New-Object PSObject
$stubD26 | Add-Member -MemberType ScriptMethod -Name Kill -Value { throw (New-Object System.InvalidOperationException 'process already exited') }
$stubD26 | Add-Member -MemberType ScriptMethod -Name WaitForExit -Value { param([int]$ms) return $true }
New-Item -ItemType Directory -Force -Path "$itAbs\s26d" | Out-Null
$pf26d = "$itAbs\s26d\java.pid"
[System.IO.File]::WriteAllText($pf26d, 'PENDING', (New-Object System.Text.UTF8Encoding($false)))
$r26d = Collect-UnregisteredSpawn $stubD26 $pf26d
$ok26d = (($r26d -eq 'confirmed') -and (-not (Test-Path $pf26d)))
if ($ok26a -and $ok26b -and $ok26c -and $ok26d) { Pass "S26 unregistered-spawn collector: a=$r26a b/c=kept(d=$r26d confirmed-exited race fixed)" } else { Fail "S26 broken a=$ok26a($r26a) b=$ok26b($r26b) c=$ok26c($r26c) d=$ok26d($r26d)" }

# ============ r21: runtime.ps1 status BLACK-BOX chain (persistent regression, replaces the throwaway red probe) ============
Write-Output "== S28 status call chain: sane pidfile -> javaState=alive; locked pidfile -> javaState=unknown"
Reset-Rt
$decoy28 = Start-Process $cfgJava -ArgumentList '-cp', $cfgJar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_s28'; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
# A) SANE chain: pidfile carries the REAL live identity -> status must classify 'alive' (r21 P2: $jp read missing => everything unknown)
New-Item -ItemType Directory -Force -Path "$runs\it_s28" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_s28\java.pid", ($decoy28.Id.ToString() + ' ' + (Start-Ticks $decoy28).ToString()), (New-Object System.Text.UTF8Encoding($false)))
$out28 = & "$ROOT\agent\tools\runtime.ps1" -Action status 2>&1 | Select-Object -Last 1
$java28a = $null; try { $java28a = ([string]$out28 | ConvertFrom-Json).active.javaState } catch { }
# B) LOCKED pidfile: exists but unconfirmable -> javaState=unknown (never 'absent', never a crash)
$fs28 = [System.IO.File]::Open("$runs\it_s28\java.pid", [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
$out28b = & "$ROOT\agent\tools\runtime.ps1" -Action status 2>&1 | Select-Object -Last 1
$fs28.Close()
$java28b = $null; try { $java28b = ([string]$out28b | ConvertFrom-Json).active.javaState } catch { }
Stop-Process -Id $decoy28.Id -Force -ErrorAction SilentlyContinue
if (($java28a -eq 'alive') -and ($java28b -eq 'unknown')) { Pass "S28 status chain: live pidfile -> alive, locked pidfile -> unknown (no absent leak)" } else { Fail "S28 broken A=$java28a ($out28) B=$java28b" }

# ============ r19 P1: file presence classification - "cannot confirm" is NEVER "absent" ============
Write-Output "== S27 Get-FilePresence 4-state: absent / readable / unreadable-ish unknown via locks & lying paths"
. "$ROOT\agent\tools\_identity.ps1"   # r19: exposes Get-FilePresence
New-Item -ItemType Directory -Force -Path "$itAbs\s27" | Out-Null
$r27a = Get-FilePresence "$itAbs\s27\nope_not_here.pid"                                  # definitively absent
$rl27 = "$itAbs\s27\plain.txt"
[System.IO.File]::WriteAllText($rl27, 'readable', (New-Object System.Text.UTF8Encoding($false)))
$r27b = Get-FilePresence $rl27                                                            # readable
$lock27 = "$itAbs\s27\locked.active"
[System.IO.File]::WriteAllText($lock27, '{"x":1}', (New-Object System.Text.UTF8Encoding($false)))
$fs27 = [System.IO.File]::Open($lock27, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
$r27c = Get-FilePresence $lock27                                                          # exists but cannot be opened -> NOT absent
$fs27.Close()
$bogus27 = "$itAbs\s27\bad|file.pid"
$lies27 = Test-Path "$bogus27" 2>$null                                                    # Test-Path FOLDS the malformed path error into $false
$r27d = Get-FilePresence $bogus27                                                         # classify must say unknown, never absent
if (($r27a -eq 'absent') -and ($r27b -eq 'readable') -and ($r27c -eq 'unknown') -and ($r27d -eq 'unknown') -and ($lies27 -eq $false)) {
  Pass "S27 presence classification: absent/readable/unknown(locked)/unknown(malformed; Test-Path lied=$lies27)"
} else { Fail "S27 broken a=$r27a b=$r27b c=$r27c d=$r27d liesTestPath=$lies27" }
# S27b - black-box holdover: exclusively locked sentinel still refuses (fail-closed behavior must NOT regress)
Reset-Rt
[System.IO.File]::WriteAllText("$rt\active.json", '{"runId":"it_s27","ownerPid":999999,"ownerStart":-1,"claimedAt":"now"}', (New-Object System.Text.UTF8Encoding($false)))
$fs27b = [System.IO.File]::Open("$rt\active.json", [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
$out27 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s27x" 2>&1 | Select-Object -Last 1
$fs27b.Close()
if (($out27 -match 'RUNTIME_BUSY') -and (Test-Path "$rt\active.json")) { Pass "S27b locked sentinel -> RUNTIME_BUSY (fail-closed, not touched)" } else { Fail "S27b broken: $out27" }

# S27e - r19 endgame: the UNREADABLE branch must have its own proof. Deny-Read for Everyone is deterministic even
#   for elevated/administrative runners: explicit Deny ACE precedes any Allow (incl. inherited), and
#   SeBackupPrivilege stays DISABLED by default so normal File.Open evaluates deny -> AccessDenied.
Write-Output "== S27e unreadable branch: Everyone-deny Read -> 'unreadable' (never absent/unknown)"
New-Item -ItemType Directory -Force -Path "$itAbs\s27u" | Out-Null
$f27u = "$itAbs\s27u\denied.pid"
[System.IO.File]::WriteAllText($f27u, 'x', (New-Object System.Text.UTF8Encoding($false)))
icacls $f27u /deny '*S-1-1-0:(R)' | Out-Null
$cls27u = Get-FilePresence $f27u
icacls $f27u /remove:d '*S-1-1-0' | Out-Null   # owner has implicit WRITE_DAC -> deny removal always possible
Remove-Item $f27u -Force -ErrorAction SilentlyContinue
if ($cls27u -eq 'unreadable') { Pass "S27e unreadable branch proven (Everyone-deny Read; not folded into absent)" } else { Fail "S27e broken: cls=$cls27u (expected unreadable)" }

Write-Output ("INTEGRATION END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
