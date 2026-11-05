# integration_runtime.ps1 - r15 acceptance: THIN single-instance executor, verified by FAULT INJECTION.
# Three properties (docs/gpt/r15.md):
#   1 mutual exclusion  - OS named Mutex: concurrent submits run serially, never two FineReport JVMs at once.
#   2 recovery safety   - after gaining the mutex, inspect the leftover sentinel by PROCESS IDENTITY:
#                         confirmed orphan (owner dead + our java alive) -> kill exactly that java;
#                         cannot confirm (live owner, or corrupt sentinel) -> REFUSE (RUNTIME_BUSY), never start a second,
#                         never scan-all-kill, never auto-clear a possibly-live run.
#   3 result trust      - contracts fail-closed: missing manifest/regression evidence => not accepted (artifact.json).
# Full chain: PowerShell -> Nashorn -> Application -> FineReport runtime. -Spec/-Patch ROOT-RELATIVE. ASCII-only.
$ErrorActionPreference = 'Continue'
$ROOT = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
Set-Location $ROOT
# r15: this host is chronically memory-tight (README #46); embedded sales_demo needs no j2v8, so run test creates at a
#   lower heap to keep the fault-injection suite deterministic instead of flaky on COMMIT_LIMIT_LOW.
$env:FR_AGENT_HEAP = '640m'
. (Join-Path "$ROOT\agent\tools" 'config.ps1')
$cfg = Get-AgentConfig
$java = $cfg.Java
$jar = $cfg.NashornJar
$rt = $cfg.RuntimeDir
$runs = $cfg.RunsDir
$itRel = 'logs/agent/it'
$itAbs = "$ROOT\logs\agent\it"
$runtimePs1 = "$ROOT\agent\tools\runtime.ps1"
$fail = 0
function Pass($n) { Write-Output "IT PASS: $n" }
function Fail($n) { Write-Output "IT FAIL: $n"; $script:fail++ }
function Reset-Rt() {
  Remove-Item "$rt\active.json" -Force -ErrorAction SilentlyContinue
  Remove-Item "$rt\owner.json" -Force -ErrorAction SilentlyContinue
  Remove-Item "$rt\history.log" -Force -ErrorAction SilentlyContinue
  if (Test-Path "$rt\queue") { Remove-Item "$rt\queue" -Recurse -Force }
  if (Test-Path "$rt\done") { Remove-Item "$rt\done" -Recurse -Force }
}
function New-Sleeper([int]$sec) { return (Start-Process powershell -ArgumentList '-Command', "Start-Sleep $sec" -PassThru -WindowStyle Hidden) }
function Start-Ticks($proc) { try { return [long](Get-Process -Id $proc.Id -ErrorAction Stop).StartTime.Ticks } catch { return -1 } }
function ArtExecOk($rid) {
  $p = "$runs\$rid\artifact.json"; if (-not (Test-Path $p)) { return $null }
  try { return (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json).execution.ok } catch { return $null }
}
function Alive($procId) { return [bool](Get-Process -Id $procId -ErrorAction SilentlyContinue) }
function MaxLiveRuntime() {
  if (-not (Test-Path "$rt\history.log")) { return 0 }
  $live = @{}; $max = 0
  foreach ($ln in @(Get-Content "$rt\history.log" -Encoding ASCII)) {
    $parts = $ln -split ' '; if ($parts.Count -lt 3) { continue }
    $evt = $parts[1]; $rid = $parts[2]
    if ($evt -eq 'ACQUIRE') { $live[$rid] = 1 } elseif ($evt -eq 'RELEASE') { $live.Remove($rid) } elseif ($evt -eq 'RECOVER') { $live.Clear() }
    if ($live.Count -gt $max) { $max = $live.Count }
  }
  return $max
}

# fresh spec files + identity cleanup of java THIS harness spawned before (via it_*/java.pid), never blanket kill
Get-ChildItem -Path $runs -Directory -Filter 'it_*' -ErrorAction SilentlyContinue | ForEach-Object {
  $pf = Join-Path $_.FullName 'java.pid'
  if (Test-Path $pf) {
    $sp = ((Get-Content $pf -Raw -Encoding UTF8).Trim() -split ' '); $jpid = 0
    if ($sp.Count -ge 1 -and [int]::TryParse($sp[0], [ref]$jpid)) {
      $jstart = -1; if ($sp.Count -ge 2) { [long]::TryParse($sp[1], [ref]$jstart) | Out-Null }
      try { $cur = (Get-Process -Id $jpid -ErrorAction Stop).StartTime.Ticks; if ($jstart -lt 0 -or $cur -eq $jstart) { Stop-Process -Id $jpid -Force -ErrorAction SilentlyContinue } } catch { }
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

# ================= P2 recovery safety: crashed predecessor + ORPHAN JAVA killed by identity =================
Write-Output "== S5 crashed owner + orphan java -> enter kills exactly that java, next proceeds"
Reset-Rt
$decoy = Start-Process $java -ArgumentList '-cp', $jar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path "$runs\it_ghost" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_ghost\java.pid", ($decoy.Id.ToString() + ' ' + $decoy.StartTime.Ticks.ToString()), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_ghost'; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$null = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s5" 2>&1
$orphanDead = -not (Alive $decoy.Id)
if ($orphanDead -and (ArtExecOk "it_s5") -eq $true -and -not (Test-Path "$rt\active.json")) { Pass "S5 orphan java killed by identity, sentinel cleared, next run completed" } else { Fail "S5 broken orphanDead=$orphanDead s5=$(ArtExecOk 'it_s5')" }

# ================= P2 recovery safety: identity mismatch spares an unrelated java =================
Write-Output "== S14 identity mismatch -> do NOT kill a reused-pid/unrelated java"
Reset-Rt
$decoy = Start-Process $java -ArgumentList '-cp', $jar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path "$runs\it_ghost" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_ghost\java.pid", ($decoy.Id.ToString() + ' ' + ($decoy.StartTime.Ticks + 999).ToString()), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_ghost'; ownerPid=999999; ownerStart=-1; claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$null = & $runtimePs1 -Action enter -RunId "it_new" 2>&1
$spared = Alive $decoy.Id
if ($spared) { Pass "S14 identity mismatch spared the java (not killed)" } else { Fail "S14 killed a non-matching java" }
Stop-Process -Id $decoy.Id -Force -ErrorAction SilentlyContinue
Reset-Rt

# ================= P2 recovery safety: live owner + free mutex -> REFUSE (RUNTIME_BUSY) =================
Write-Output "== S6 live-owner sentinel but free mutex -> refuse, never start a second, never clear"
Reset-Rt
$sl = New-Sleeper 30
[System.IO.File]::WriteAllText("$rt\active.json", (@{ runId='it_live'; ownerPid=$sl.Id; ownerStart=(Start-Ticks $sl); claimedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$out6 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s6" 2>&1 | Select-Object -Last 1
Write-Output "  S6: $out6"
$refused = ($out6 -match 'RUNTIME_BUSY') -and (-not (Test-Path "$runs\it_s6\compile.json")) -and (Test-Path "$rt\active.json")
if ($refused) { Pass "S6 refused (RUNTIME_BUSY), did not start, did not clear live sentinel" } else { Fail "S6 broken: $out6" }
Stop-Process -Id $sl.Id -Force -ErrorAction SilentlyContinue
Reset-Rt

# ================= P2 recovery safety: corrupt sentinel -> refuse (fail-closed) =================
Write-Output "== S16 corrupt sentinel -> refuse, never auto-clear"
Reset-Rt
[System.IO.File]::WriteAllText("$rt\active.json", "{ this is not valid json", (New-Object System.Text.UTF8Encoding($false)))
$out16 = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s16" 2>&1 | Select-Object -Last 1
$refused16 = ($out16 -match 'RUNTIME_BUSY') -and (Test-Path "$rt\active.json")
if ($refused16) { Pass "S16 corrupt sentinel -> RUNTIME_BUSY, sentinel preserved (fail-closed)" } else { Fail "S16 broken: $out16" }
Reset-Rt

# ================= P2 mutual exclusion under a live holder: waiter queues =================
Write-Output "== S8 live holder blocks waiter (queued, not parallel)"
Reset-Rt
$holder = Start-Job -ScriptBlock {
  param($root)
  Set-Location $root
  . (Join-Path "$root\agent\tools" 'config.ps1'); $c = Get-AgentConfig
  $m = New-Object System.Threading.Mutex($false, $c.MutexName)
  if ($m.WaitOne(5000)) {
    & "$root\agent\tools\runtime.ps1" -Action claim -RunId "it_holder" -OwnerPid $PID | Out-Null
    Start-Sleep 5
    & "$root\agent\tools\runtime.ps1" -Action release -RunId "it_holder" | Out-Null
    $m.ReleaseMutex()
  }
} -ArgumentList $ROOT
Start-Sleep -Milliseconds 800
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
& $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\modify_report.js" | Out-Null
if ((ArtExecOk "it_s17") -ne $true) { Pass "S17 missing-manifest patch not accepted (fail-closed)" } else { Fail "S17 missing manifest treated as success" }
Remove-Item env:AGENT_PATCH -ErrorAction SilentlyContinue
Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue

Write-Output ("INTEGRATION END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
