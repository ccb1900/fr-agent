# integration_runtime.ps1 - r14 acceptance: Runtime Supervisor + Artifact trust, verified by FAULT INJECTION.
# Three properties (docs/gpt/r14.md sec.6):
#   P1 mutual exclusion  - at most one FineReport runtime holder at any time (OS named mutex).
#   P2 recovery safety   - never reclaim a lock / kill a JVM unless the owner is PROVEN dead (identity, not time/corruption).
#   P3 result trust      - no complete execution+regression evidence => cannot declare success (fail-closed).
# Full chain: PowerShell -> Nashorn -> Application -> FineReport runtime. -Spec/-Patch are ROOT-RELATIVE. ASCII-only.
# Exit 0 = all pass.
$ErrorActionPreference = 'Continue'
$ROOT = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
Set-Location $ROOT
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
  Remove-Item "$rt\owner.json" -Force -ErrorAction SilentlyContinue
  Remove-Item "$rt\history.log" -Force -ErrorAction SilentlyContinue
  Get-ChildItem "$rt\queue\*.json" -ErrorAction SilentlyContinue | Remove-Item -Force
  Get-ChildItem "$rt\done\*.json" -ErrorAction SilentlyContinue | Remove-Item -Force
}
function ArtExecOk($rid) {
  $p = "$runs\$rid\artifact.json"; if (-not (Test-Path $p)) { return $null }
  try { return (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json).execution.ok } catch { return $null }
}
function DoneField($rid, $field) {
  $p = "$rt\done\$rid.json"; if (-not (Test-Path $p)) { return '' }
  try { return [string](Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json).$field } catch { return '' }
}
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

# baseline: free ONLY the java THIS harness spawned in prior runs (identity-verified via each it_* run's java.pid),
#   never blanket-kill all java (r14 P2). Each create/patch run writes runs/<runId>/java.pid (pid + StartTime).
Get-ChildItem -Path $runs -Directory -Filter 'it_*' -ErrorAction SilentlyContinue | ForEach-Object {
  $pf = Join-Path $_.FullName 'java.pid'
  if (Test-Path $pf) {
    $sp = ((Get-Content $pf -Raw -Encoding UTF8).Trim() -split ' ')
    $jpid = 0; if ($sp.Count -ge 1 -and [int]::TryParse($sp[0], [ref]$jpid)) {
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

# ================= P1 mutual exclusion: concurrent creates are serial =================
Write-Output "== S1/2/4 concurrent creates serial (mutual exclusion)"
$jobA = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s1a"
$jobB = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/b.json","it_s1b"
$null = Wait-Job $jobA,$jobB; $outA = Receive-Job $jobA; $outB = Receive-Job $jobB; Remove-Job $jobA,$jobB
Write-Output "  A: $outA"; Write-Output "  B: $outB"
if ((ArtExecOk "it_s1a") -eq $true -and (ArtExecOk "it_s1b") -eq $true) { Pass "S2 both creates succeeded (serial auto-start)" } else { Fail "S2 create not ok A=$(ArtExecOk 'it_s1a') B=$(ArtExecOk 'it_s1b')" }
if ((MaxLiveRuntime) -le 1) { Pass "S4 mutual exclusion maxLiveRuntime=$(MaxLiveRuntime) (<=1)" } else { Fail "S4 parallel runtimes maxLiveRuntime=$(MaxLiveRuntime)" }

# ================= P1: three concurrent creates + failure isolation =================
Write-Output "== S15 three concurrent creates"
Reset-Rt
$j1 = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s15a"
$j2 = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/b.json","it_s15b"
$j3 = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/bad.json","it_s15bad"
$null = Wait-Job $j1,$j2,$j3; Receive-Job $j1,$j2,$j3 | Out-Null; Remove-Job $j1,$j2,$j3
$goods = ((ArtExecOk "it_s15a") -eq $true) -and ((ArtExecOk "it_s15b") -eq $true)
$badfail = (ArtExecOk "it_s15bad") -ne $true
if ($goods -and $badfail -and ((MaxLiveRuntime) -le 1)) { Pass "S15 three tasks serial, goods ok, bad isolated" } else { Fail "S15 broken goods=$goods badfail=$badfail maxLive=$(MaxLiveRuntime)" }

# ================= P1 atomic RunId claim: two concurrent register same RunId -> exactly one wins =================
Write-Output "== S18 duplicate RunId concurrent register (atomic CreateNew)"
Reset-Rt
$r1 = Start-Job -ScriptBlock { param($rp,$id) & $rp -Action register -RunId $id -Verb compile -OwnerToken 't1' 2>&1 | Select-Object -Last 1 } -ArgumentList $runtimePs1,"it_dup"
$r2 = Start-Job -ScriptBlock { param($rp,$id) & $rp -Action register -RunId $id -Verb compile -OwnerToken 't2' 2>&1 | Select-Object -Last 1 } -ArgumentList $runtimePs1,"it_dup"
$null = Wait-Job $r1,$r2; $o1 = Receive-Job $r1; $o2 = Receive-Job $r2; Remove-Job $r1,$r2
$wins = 0; foreach ($o in @($o1,$o2)) { if ($o -match '"registered":true') { $wins++ } }
$inflight = 0; foreach ($o in @($o1,$o2)) { if ($o -match 'RUNID_INFLIGHT') { $inflight++ } }
if ($wins -eq 1 -and $inflight -eq 1) { Pass "S18 exactly one register wins (wins=$wins inflight=$inflight)" } else { Fail "S18 atomic claim broken wins=$wins inflight=$inflight o1=$o1 o2=$o2" }
Reset-Rt

# ================= P2 recovery safety: crashed holder -> abandoned -> recovered as LOST/FAILED (never success) =================
Write-Output "== S5 crashed holder recovered as lost/failed"
Reset-Rt
$crashTok = [guid]::NewGuid().ToString('N')
$crasher = Start-Job -ScriptBlock {
  param($root, $rid, $tok)
  Set-Location $root
  . (Join-Path "$root\agent\tools" 'config.ps1'); $c = Get-AgentConfig
  $m = New-Object System.Threading.Mutex($false, $c.MutexName)
  [System.IO.File]::WriteAllText("$root\logs\agent\it\crasher.pid", $PID.ToString())
  if ($m.WaitOne(5000)) {
    & "$root\agent\tools\runtime.ps1" -Action mark-running -RunId $rid -Verb compile -OwnerPid $PID -OwnerToken $tok | Out-Null
    Start-Sleep 60   # hold the mutex
  }
} -ArgumentList $ROOT,"it_ghost",$crashTok
# wait until the crasher has acquired the mutex AND written owner.json, then HARD-KILL its process (a graceful Stop-Job
#   would let the .NET Mutex finalizer release cleanly => no AbandonedMutexException; only a real process death abandons it)
$seen = $false
for ($i = 0; $i -lt 40; $i++) { if (Test-Path "$rt\owner.json") { $seen = $true; break }; Start-Sleep -Milliseconds 250 }
$crashPid = 0; if (Test-Path "$itAbs\crasher.pid") { [int]::TryParse((Get-Content "$itAbs\crasher.pid" -Raw).Trim(), [ref]$crashPid) | Out-Null }
if ($crashPid -gt 0) { Stop-Process -Id $crashPid -Force -ErrorAction SilentlyContinue }
Remove-Job $crasher -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500   # let the OS mark the mutex abandoned
# a new create must observe abandonment, recover the ghost (lost/failed), then complete
$null = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s5" 2>&1
$ghostState = DoneField "it_ghost" "runtimeState"; $ghostBiz = DoneField "it_ghost" "businessResult"
if ($seen -and $ghostState -eq 'lost' -and $ghostBiz -eq 'failed' -and (ArtExecOk "it_s5") -eq $true) { Pass "S5 crashed holder recovered lost/failed (never success), new run completed" } else { Fail "S5 recovery broken seen=$seen ghost=$ghostState/$ghostBiz s5=$(ArtExecOk 'it_s5')" }
Reset-Rt

# ================= P2 recovery safety: live holder blocks a waiter (never reclaimed) =================
Write-Output "== S8 live holder blocks waiter (no false reclaim)"
Reset-Rt
$holdTok = [guid]::NewGuid().ToString('N')
$holder = Start-Job -ScriptBlock {
  param($root, $rid, $tok)
  Set-Location $root
  . (Join-Path "$root\agent\tools" 'config.ps1'); $c = Get-AgentConfig
  $m = New-Object System.Threading.Mutex($false, $c.MutexName)
  if ($m.WaitOne(5000)) {
    & "$root\agent\tools\runtime.ps1" -Action mark-running -RunId $rid -Verb compile -OwnerPid $PID -OwnerToken $tok | Out-Null
    Start-Sleep 6
    & "$root\agent\tools\runtime.ps1" -Action finalize -RunId $rid -OwnerToken $tok -BusinessResult succeeded | Out-Null
    $m.ReleaseMutex()
  }
} -ArgumentList $ROOT,"it_holder",$holdTok
Start-Sleep -Milliseconds 800   # let holder acquire + mark-running
$jobC = Start-Job -ScriptBlock { param($r,$s,$id) Set-Location $r; & "$r\agent\tools\fr_agent.ps1" -Verb create -Spec $s -RunId $id 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s8"
Start-Sleep -Seconds 3
$queuedMid = -not (Test-Path "$runs\it_s8\compile.json")
$recInHist = (Test-Path "$rt\history.log") -and ((Get-Content "$rt\history.log" -Encoding ASCII) -match 'RECOVER')
$null = Wait-Job $holder -Timeout 20
$null = Wait-Job $jobC -Timeout 120; Receive-Job $jobC | Out-Null; Remove-Job $holder,$jobC
if ($queuedMid -and -not $recInHist -and (ArtExecOk "it_s8") -eq $true) { Pass "S8 live holder blocked waiter (queued, not reclaimed), waiter completed after release" } else { Fail "S8 broken queuedMid=$queuedMid recovered=$recInHist done=$(ArtExecOk 'it_s8')" }
Reset-Rt

# ================= P2 recovery safety: identity-scoped JVM kill (never all java) =================
Write-Output "== S14 recovery kills only the identity-matched JVM"
Reset-Rt
[System.IO.File]::WriteAllText("$itAbs\_decoy_sleep.js", "Java.type('java.lang.Thread').sleep(60000);`n", (New-Object System.Text.UTF8Encoding($false)))
New-Item -ItemType Directory -Force -Path "$runs\it_s14a" | Out-Null
New-Item -ItemType Directory -Force -Path "$runs\it_s14b" | Out-Null
$decoy = Start-Process $java -ArgumentList '-cp', $jar, 'jdk.nashorn.tools.Shell', "$itAbs\_decoy_sleep.js" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1
$dpid = $decoy.Id; $dstart = $decoy.StartTime.Ticks
# case A: java.pid has WRONG start ticks -> must NOT kill the decoy (PID reuse guard)
[System.IO.File]::WriteAllText("$rt\owner.json", (@{ runId='it_s14a'; verb='compile'; ownerPid=999999; ownerStart=-1; ownerToken='ta'; pipelineTag='make_api.js'; acquiredAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$runs\it_s14a\java.pid", ($dpid.ToString() + ' ' + ($dstart + 12345).ToString()))
$null = & $runtimePs1 -Action recover-previous 2>&1
$aliveAfterMismatch = [bool](Get-Process -Id $dpid -ErrorAction SilentlyContinue)
# case B: java.pid has EXACT identity -> must kill it
[System.IO.File]::WriteAllText("$rt\owner.json", (@{ runId='it_s14b'; verb='compile'; ownerPid=999999; ownerStart=-1; ownerToken='tb'; pipelineTag='make_api.js'; acquiredAt=(Get-Date).ToString('o') } | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$runs\it_s14b\java.pid", ($dpid.ToString() + ' ' + $dstart.ToString()))
$null = & $runtimePs1 -Action recover-previous 2>&1
Start-Sleep -Milliseconds 400
$deadAfterMatch = -not (Get-Process -Id $dpid -ErrorAction SilentlyContinue)
if ($aliveAfterMismatch -and $deadAfterMatch) { Pass "S14 identity-scoped kill: mismatched start spared, exact identity killed" } else { Fail "S14 broken mismatchSpared=$aliveAfterMismatch exactKilled=$deadAfterMatch" }
Stop-Process -Id $dpid -Force -ErrorAction SilentlyContinue
Reset-Rt

# ================= P2 recovery safety: corrupt/missing owner + free mutex -> NO false success =================
Write-Output "== S19 corrupt owner.json with free mutex -> not a false reclaim/success"
Reset-Rt
New-Item -ItemType Directory -Force -Path "$rt" | Out-Null
[System.IO.File]::WriteAllText("$rt\owner.json", "{ this is not valid json", (New-Object System.Text.UTF8Encoding($false)))
$recOut = & $runtimePs1 -Action recover 2>&1 | Select-Object -Last 1
if ($recOut -match 'NO_OWNER_RECORD' -or $recOut -match '"recovered":false') { Pass "S19 corrupt owner.json fail-closed (no fabricated success): $recOut" } else { Fail "S19 corrupt owner mishandled: $recOut" }
Reset-Rt

# ================= P3 result trust: patch manifest missing -> artifact NOT accepted =================
Write-Output "== S17 patch missing manifest -> fail-closed acceptance"
Reset-Rt
New-Item -ItemType Directory -Force -Path "$runs\it_s17" | Out-Null
[System.IO.File]::WriteAllText("$runs\it_s17\patch.json", (@{ tool='patch'; runId='it_s17'; ok=$true; exit=0; patch='x.json'; manifest=$null } | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
$env:AGENT_RUN_ID = 'it_s17'; $env:FR_AGENT_HOME = $ROOT
$env:AGENT_PATCH = "$runs\it_s17\patch.json"
& $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\modify_report.js" | Out-Null
$art = Get-Content "$runs\it_s17\artifact.json" -Raw -Encoding UTF8 | ConvertFrom-Json
if ($art.execution.ok -ne $true) { Pass "S17 missing-manifest patch execution.ok=false (fail-closed)" } else { Fail "S17 missing manifest treated as success" }
Remove-Item env:AGENT_PATCH -ErrorAction SilentlyContinue
Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue

Write-Output ("INTEGRATION END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
