# integration_runtime.ps1 - r13 (R12.1/R12.2) acceptance: single-instance Runtime Supervisor correctness.
# Proves the KEY INVARIANTS by actively manufacturing the bad state and asserting the system REFUSES it
#   (r13 principle: "do not treat GREEN as proof; every key invariant needs a fault-injection test").
# Scenarios S1-S15 (docs/gpt/r13.md sec.7). Full chain: PowerShell -> Nashorn -> Application -> FineReport runtime.
# IMPORTANT: -Spec/-Patch are ROOT-RELATIVE; keep this file ASCII-only.
# Exit 0 = all pass, 1 = any fail.
$ErrorActionPreference = 'Continue'
$ROOT = 'D:\fineagent'
Set-Location $ROOT
. (Join-Path "$ROOT\agent\tools" 'config.ps1')
$cfg = Get-AgentConfig
$FR = $cfg.FrHome
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
  if (Test-Path "$rt\lock") { Remove-Item "$rt\lock" -Recurse -Force }
  Remove-Item "$rt\current.json" -Force -ErrorAction SilentlyContinue
  Remove-Item "$rt\history.log" -Force -ErrorAction SilentlyContinue
  Get-ChildItem "$rt\queue\*.json" -ErrorAction SilentlyContinue | Remove-Item -Force
  Get-ChildItem "$rt\done\*.json" -ErrorAction SilentlyContinue | Remove-Item -Force
}
function New-Sleeper([int]$sec) {
  $p = Start-Process powershell -ArgumentList '-Command', "Start-Sleep $sec" -PassThru -WindowStyle Hidden
  return $p
}
function Start-Ticks($proc) { try { return [long](Get-Process -Id $proc.Id -ErrorAction Stop).StartTime.Ticks } catch { return -1 } }
function ArtExecOk($rid) {
  $p = "$runs\$rid\artifact.json"
  if (-not (Test-Path $p)) { return $null }
  try { return (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json).execution.ok } catch { return $null }
}
function Assert-Serialized($label) {
  $lines = @(); if (Test-Path "$rt\history.log") { $lines = @(Get-Content "$rt\history.log" -Encoding ASCII) }
  $live = @{}; $maxLive = 0
  foreach ($ln in $lines) {
    $parts = $ln -split ' '; if ($parts.Count -lt 3) { continue }
    $evt = $parts[1]; $rid = $parts[2]
    if ($evt -eq 'ACQUIRE') { $live[$rid] = 1 } elseif ($evt -eq 'RELEASE') { $live.Remove($rid) } elseif ($evt -eq 'RECOVER') { $live.Clear() }
    if ($live.Count -gt $maxLive) { $maxLive = $live.Count }
  }
  if ($maxLive -le 1) { Pass "$label maxLiveRuntime=$maxLive (<=1)" } else { Fail "$label maxLiveRuntime=$maxLive (>1)" }
}

# fresh spec files (embedded sales_demo, ASCII outName)
if (Test-Path $itAbs) { Remove-Item $itAbs -Recurse -Force }
New-Item -ItemType Directory -Force -Path $itAbs | Out-Null
Get-ChildItem -Path $runs -Directory -Filter 'it_*' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
# operator-harness baseline cleanup: free committed memory left by prior runs so run.ps1 preflight (README #46/#47) is not
#   the flaky cause. This is the TEST harness (operator), NOT the agent path (which never kills, per r12/r13).
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Reset-Rt
$salesJson = [System.IO.File]::ReadAllText("$ROOT\examples\report-spec\sales_demo.json", [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("$itAbs\a.json", ($salesJson -replace '"outName":\s*"[^"]*"', '"outName": "IT_A"'), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$itAbs\b.json", ($salesJson -replace '"outName":\s*"[^"]*"', '"outName": "IT_B"'), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$itAbs\bad.json", ($salesJson -replace '"aggregation":\s*"sum"', '"aggregation": "avg"'), (New-Object System.Text.UTF8Encoding($false)))
$sqlIntent = '{"outName":"IT_SQL","reportName":"IT_SQL","dataset":{"kind":"sql","connection":"ATOM_LIVE","entity":"InspectionRecord","dimensions":["bizDate"],"metrics":["planned","done"],"dateRange":{"from":"2026-09-13","to":"2026-09-13"}}}'
[System.IO.File]::WriteAllText("$itAbs\sql_intent.json", $sqlIntent, (New-Object System.Text.UTF8Encoding($false)))

# ================= S1/2/4: concurrent submits, serial runtime =================
Write-Output "== S1/2/4 concurrent create A+B"
$jobA = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s1a"
$jobB = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/b.json","it_s1b"
$null = Wait-Job $jobA,$jobB; $outA = Receive-Job $jobA; $outB = Receive-Job $jobB; Remove-Job $jobA,$jobB
Write-Output "  A: $outA"; Write-Output "  B: $outB"
if ((Test-Path "$runs\it_s1a\artifact.json") -and (Test-Path "$runs\it_s1b\artifact.json")) { Pass "S1 both artifacts present" } else { Fail "S1 missing artifact" }
if ((ArtExecOk "it_s1a") -eq $true -and (ArtExecOk "it_s1b") -eq $true) { Pass "S2 both execution.ok=true (serial auto-start)" } else { Fail "S2 execution not ok" }
Assert-Serialized "S4 serialized"

# ================= S3: failure isolation =================
Write-Output "== S3 failure isolation"
Reset-Rt
$jobBad = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/bad.json","it_s3bad"
$jobGood = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s3good"
$null = Wait-Job $jobBad,$jobGood; Receive-Job $jobBad | Out-Null; Receive-Job $jobGood | Out-Null; Remove-Job $jobBad,$jobGood
$badOk = ArtExecOk "it_s3bad"; $goodOk = ArtExecOk "it_s3good"
if ($badOk -ne $true -and $goodOk -eq $true) { Pass "S3 failing task did not poison good task (bad=$badOk good=$goodOk)" } else { Fail "S3 isolation broken bad=$badOk good=$goodOk" }
Assert-Serialized "S3 serialized"

# ================= S5: crash recovery via full create (dead owner) =================
Write-Output "== S5 crash recovery (dead owner -> abandoned marked failed, new run completes)"
Reset-Rt
New-Item -ItemType Directory -Force -Path "$rt\lock" | Out-Null
[System.IO.File]::WriteAllText("$rt\lock\owner.json", (@{ runId='it_ghost'; verb='compile'; ownerPid=999999; ownerStart=-1; ownerToken='ghost'; pipelineTag='make_api.js'; acquiredAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$rt\queue\it_ghost.json", (@{ runId='it_ghost'; verb='compile'; submittedAt=(Get-Date).ToString('o'); runtimeState='running'; ownerToken='ghost' } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$null = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s5" 2>&1
$ghostDone = $null; if (Test-Path "$rt\done\it_ghost.json") { $ghostDone = Get-Content "$rt\done\it_ghost.json" -Raw -Encoding UTF8 | ConvertFrom-Json }
$ghostFailed = $ghostDone -and ($ghostDone.runtimeState -eq 'lost') -and ($ghostDone.businessResult -eq 'failed')
if ($ghostFailed -and ((ArtExecOk "it_s5") -eq $true)) { Pass "S5 dead owner recovered as lost/failed (never success) and new run completed" } else { Fail "S5 recovery broken ghost=$($ghostDone.runtimeState)/$($ghostDone.businessResult) s5Ok=$(ArtExecOk 'it_s5')" }

# ================= S8: live holder forces queueing =================
Write-Output "== S8 live-holder forces queueing (no parallel runtime, no false recovery)"
Reset-Rt
$holder = New-Sleeper 90
$holdTok = [guid]::NewGuid().ToString('N')
$null = & $runtimePs1 -Action acquire -RunId "it_s8hold" -Verb compile -OwnerPid $holder.Id -OwnerToken $holdTok 2>&1
$jobC = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s8"
Start-Sleep -Seconds 4
$queuedMid = -not (Test-Path "$runs\it_s8\compile.json")
$recInHist = (Test-Path "$rt\history.log") -and ((Get-Content "$rt\history.log" -Encoding ASCII) -match 'RECOVER')
if ($queuedMid -and -not $recInHist) { Pass "S8 create stayed queued while live holder owns lock (no compile.json yet, no RECOVER)" } else { Fail "S8 concurrency broken queuedMid=$queuedMid recovered=$recInHist" }
$null = & $runtimePs1 -Action release -RunId "it_s8hold" -OwnerToken $holdTok 2>&1
$null = Wait-Job $jobC -Timeout 120; Receive-Job $jobC | Out-Null; Remove-Job $jobC
Stop-Process -Id $holder.Id -Force -ErrorAction SilentlyContinue
if ((ArtExecOk "it_s8") -eq $true) { Pass "S8 queued create auto-started and succeeded after release" } else { Fail "S8 queued create did not complete" }
Assert-Serialized "S8 serialized under contention"

# ================= S9: lock-init window must NOT be deleted by a waiter (P1-A double-acquire) =================
Write-Output "== S9 init-window: waiter must WAIT, never delete a lock whose owner.json is not yet written"
Reset-Rt
New-Item -ItemType Directory -Force -Path "$rt\lock" | Out-Null   # lock created, owner.json intentionally absent (init in progress)
$null = & $runtimePs1 -Action acquire -RunId "it_s9waiter" -Verb compile -OwnerToken ([guid]::NewGuid().ToString('N')) -TimeoutSec 4 2>&1
$lockStillThere = Test-Path "$rt\lock"
$recInHist = (Test-Path "$rt\history.log") -and ((Get-Content "$rt\history.log" -Encoding ASCII) -match 'RECOVER')
if ($lockStillThere -and -not $recInHist) { Pass "S9 waiter did not delete initializing lock and did not recover (no double-acquire)" } else { Fail "S9 waiter deleted init lock or falsely recovered (lock=$lockStillThere recovered=$recInHist)" }
Reset-Rt

# ================= S10: task older than TaskSuspectSec but owner ALIVE -> no recovery (P1-B) =================
Write-Output "== S10 aged-but-alive owner must NOT be recovered"
Reset-Rt
$sl = New-Sleeper 60
New-Item -ItemType Directory -Force -Path "$rt\lock" | Out-Null
$old = (Get-Date).AddSeconds(-2000).ToString('o')   # older than TaskSuspectSec 1800
[System.IO.File]::WriteAllText("$rt\lock\owner.json", (@{ runId='it_s10'; verb='compile'; ownerPid=$sl.Id; ownerStart=(Start-Ticks $sl); ownerToken='t10'; pipelineTag='make_api.js'; acquiredAt=$old } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$recOut = & $runtimePs1 -Action recover 2>&1 | Select-Object -Last 1
$stOut = & $runtimePs1 -Action status 2>&1 | Select-Object -Last 1
Write-Output "  recover: $recOut"
$notRecovered = ($recOut -match 'OWNER_ALIVE') -and (Test-Path "$rt\lock")
$suspect = ($stOut -match '"suspect":true')
if ($notRecovered -and $suspect) { Pass "S10 aged live owner NOT recovered (warning-only suspect=$suspect)" } else { Fail "S10 aged live owner mishandled rec=$recOut suspect=$suspect" }
Stop-Process -Id $sl.Id -Force -ErrorAction SilentlyContinue
Reset-Rt

# ================= S11: release with wrong token cannot delete another's lock =================
Write-Output "== S11 release token verification"
Reset-Rt
$sl = New-Sleeper 60
$tokR = [guid]::NewGuid().ToString('N')
$null = & $runtimePs1 -Action acquire -RunId "it_s11" -Verb compile -OwnerPid $sl.Id -OwnerToken $tokR 2>&1
$wrongOut = & $runtimePs1 -Action release -RunId "it_s11" -OwnerToken ([guid]::NewGuid().ToString('N')) 2>&1 | Select-Object -Last 1
$stillHeld = Test-Path "$rt\lock"
$rightOut = & $runtimePs1 -Action release -RunId "it_s11" -OwnerToken $tokR 2>&1 | Select-Object -Last 1
$freedAfterRight = -not (Test-Path "$rt\lock")
if (($wrongOut -match 'NOT_OWNER') -and $stillHeld -and ($rightOut -match '"released":true') -and $freedAfterRight) { Pass "S11 wrong token refused, right token released" } else { Fail "S11 token check broken wrong=$wrongOut stillHeld=$stillHeld right=$rightOut" }
Stop-Process -Id $sl.Id -Force -ErrorAction SilentlyContinue
Reset-Rt

# ================= S12: owner crash detected via identity -> recovered, next acquires =================
Write-Output "== S12 owner crash -> identity detects death, recovers, next acquires"
Reset-Rt
$sl = New-Sleeper 60
$null = & $runtimePs1 -Action acquire -RunId "it_s12" -Verb compile -OwnerPid $sl.Id -OwnerToken ([guid]::NewGuid().ToString('N')) 2>&1
Stop-Process -Id $sl.Id -Force -ErrorAction SilentlyContinue   # simulate supervisor/owner crash
Start-Sleep -Milliseconds 500
$sl2 = New-Sleeper 60
$acq2 = & $runtimePs1 -Action acquire -RunId "it_s12b" -Verb compile -OwnerPid $sl2.Id -OwnerToken ([guid]::NewGuid().ToString('N')) -TimeoutSec 10 2>&1 | Select-Object -Last 1
$g = $null; if (Test-Path "$rt\done\it_s12.json") { $g = Get-Content "$rt\done\it_s12.json" -Raw -Encoding UTF8 | ConvertFrom-Json }
$acq2ok = ($acq2 -match '"acquired":true')
if (($g.runtimeState -eq 'lost') -and ($g.businessResult -eq 'failed') -and $acq2ok) { Pass "S12 crashed owner detected lost/failed, next run acquired" } else { Fail "S12 broken g=$($g.runtimeState)/$($g.businessResult) acq2=$acq2ok" }
$null = & $runtimePs1 -Action release -RunId "it_s12b" -OwnerToken ((Get-Content "$rt\lock\owner.json" -Raw -Encoding UTF8 | ConvertFrom-Json).ownerToken) 2>&1
Stop-Process -Id $sl2.Id -Force -ErrorAction SilentlyContinue
Reset-Rt

# ================= S13: duplicate RunId -> no double execution =================
Write-Output "== S13 duplicate RunId rejection"
Reset-Rt
$sl = New-Sleeper 60
$null = & $runtimePs1 -Action acquire -RunId "it_dup" -Verb compile -OwnerPid $sl.Id -OwnerToken ([guid]::NewGuid().ToString('N')) 2>&1
$dupOut = & $runtimePs1 -Action acquire -RunId "it_dup" -Verb compile -OwnerPid $sl.Id -OwnerToken ([guid]::NewGuid().ToString('N')) -TimeoutSec 3 2>&1 | Select-Object -Last 1
if ($dupOut -match 'RUNID_INFLIGHT') { Pass "S13 duplicate in-flight RunId rejected" } else { Fail "S13 duplicate not rejected: $dupOut" }
$null = & $runtimePs1 -Action release -RunId "it_dup" -OwnerToken ((Get-Content "$rt\lock\owner.json" -Raw -Encoding UTF8 | ConvertFrom-Json).ownerToken) 2>&1
Stop-Process -Id $sl.Id -Force -ErrorAction SilentlyContinue
Reset-Rt

# ================= S14: recovery must not kill unrelated java (scoped by pipelineTag) =================
Write-Output "== S14 recovery scoped to pipeline java, not all java"
Reset-Rt
[System.IO.File]::WriteAllText("$itAbs\_decoy_sleep.js", "Java.type('java.lang.Thread').sleep(60000);`n", (New-Object System.Text.UTF8Encoding($false)))
$decoy = Start-Process $java -ArgumentList '-cp', $jar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path "$rt\lock" | Out-Null
[System.IO.File]::WriteAllText("$rt\lock\owner.json", (@{ runId='it_s14dead'; verb='compile'; ownerPid=999999; ownerStart=-1; ownerToken='t14'; pipelineTag='make_api.js'; acquiredAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$null = & $runtimePs1 -Action recover 2>&1
Start-Sleep -Milliseconds 400
$decoyAlive = [bool](Get-Process -Id $decoy.Id -ErrorAction SilentlyContinue)
if ($decoyAlive) { Pass "S14 recovery did NOT kill unrelated java (decoy pid=$($decoy.Id) alive)" } else { Fail "S14 recovery killed unrelated java" }
Stop-Process -Id $decoy.Id -Force -ErrorAction SilentlyContinue
Reset-Rt

# ================= S15: three concurrent submits -> serialized + failure isolation =================
Write-Output "== S15 three concurrent creates"
Reset-Rt
$j1 = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s15a"
$j2 = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/b.json","it_s15b"
$j3 = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/bad.json","it_s15bad"
$null = Wait-Job $j1,$j2,$j3; Receive-Job $j1,$j2,$j3 | Out-Null; Remove-Job $j1,$j2,$j3
$allDone = (Test-Path "$runs\it_s15a\artifact.json") -and (Test-Path "$runs\it_s15b\artifact.json") -and (Test-Path "$runs\it_s15bad\artifact.json")
$goodsOk = ((ArtExecOk "it_s15a") -eq $true) -and ((ArtExecOk "it_s15b") -eq $true)
$badFailed = (ArtExecOk "it_s15bad") -ne $true
if ($allDone -and $goodsOk -and $badFailed) { Pass "S15 three tasks serialized, goods ok, bad isolated" } else { Fail "S15 broken done=$allDone goods=$goodsOk bad=$badFailed" }
Assert-Serialized "S15 serialized"

# ================= S16: a dead queued waiter must not starve younger waiters (r13 review fix) =================
Write-Output "== S16 dead-waiter queue slot pruned (no starvation)"
Reset-Rt
# plant an OLDEST queued entry whose owner process is dead (999999) - it must not block a real waiter
[System.IO.File]::WriteAllText("$rt\queue\it_phantom.json", (@{ runId='it_phantom'; verb='compile'; submittedAt=(Get-Date).AddSeconds(-100).ToString('o'); runtimeState='queued'; ownerToken='phantom'; ownerPid=999999 } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
$sl = New-Sleeper 60
$acq = & $runtimePs1 -Action acquire -RunId "it_real" -Verb compile -OwnerPid $sl.Id -OwnerToken ([guid]::NewGuid().ToString('N')) -TimeoutSec 8 2>&1 | Select-Object -Last 1
$acqOk = ($acq -match '"acquired":true')
$phantomGone = -not (Test-Path "$rt\queue\it_phantom.json")
if ($acqOk -and $phantomGone) { Pass "S16 dead waiter pruned, real waiter acquired (no starvation)" } else { Fail "S16 starvation acq=$acqOk phantomGone=$phantomGone" }
$null = & $runtimePs1 -Action release -RunId "it_real" -OwnerToken ((Get-Content "$rt\lock\owner.json" -Raw -Encoding UTF8 | ConvertFrom-Json).ownerToken) 2>&1
Stop-Process -Id $sl.Id -Force -ErrorAction SilentlyContinue
Reset-Rt

Write-Output ("INTEGRATION END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
