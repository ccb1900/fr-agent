# integration_runtime.ps1 - r12 acceptance: single-instance runtime supervisor + multi-task queue.
# Covers docs/gpt/r12.md sec.4 six scenarios over the FULL chain (PowerShell -> Nashorn -> Application -> FineReport runtime).
#   1) A,B submitted concurrently -> A runs, B queues (never two live runtimes).
#   2) A success -> B auto-starts.
#   3) A failure -> B still runs (failure isolation).
#   4) re-submit during A -> no second runtime (asserted via history serialization).
#   5) runtime crash -> queue recoverable, abandoned run NOT marked success.
#   6) template modify products/pre/post/manifest of A not overwritten by B.
# Proof: runtime.ps1 appends ACQUIRE/RELEASE/RECOVER to history.log; replay asserts live-owner set never exceeds 1.
# IMPORTANT: -Spec/-Patch are ROOT-RELATIVE (make_api Paths.spec prepends root); keep this file ASCII-only
#   (PS 5.1 reads .ps1 as GBK -> any Chinese literal here would corrupt; deployed names are read from the FS instead).
# Exit 0 = all pass, 1 = any fail.
$ErrorActionPreference = 'Continue'
$ROOT = 'D:\fineagent'
Set-Location $ROOT
$FR = 'D:\software\FineReport_11.0'
$rt = "$ROOT\logs\agent\runtime"
$runs = "$ROOT\logs\agent\runs"
$itRel = 'logs/agent/it'
$itAbs = "$ROOT\logs\agent\it"
$fail = 0
function Pass($n) { Write-Output "IT PASS: $n" }
function Fail($n) { Write-Output "IT FAIL: $n"; $script:fail++ }

if (Test-Path $itAbs) { Remove-Item $itAbs -Recurse -Force }
New-Item -ItemType Directory -Force -Path $itAbs | Out-Null
Get-ChildItem -Path $runs -Directory -Filter 'it_*' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
if (Test-Path "$rt\lock") { Remove-Item "$rt\lock" -Recurse -Force }
Remove-Item "$rt\current.json" -Force -ErrorAction SilentlyContinue
Remove-Item "$rt\history.log" -Force -ErrorAction SilentlyContinue
Get-ChildItem "$rt\queue\*.json" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem "$rt\done\*.json" -ErrorAction SilentlyContinue | Remove-Item -Force

# specs: embedded sales_demo (fast, no DB). ASCII outName via regex replace on the UTF-8 source.
$salesJson = [System.IO.File]::ReadAllText("$ROOT\examples\report-spec\sales_demo.json", [System.Text.UTF8Encoding]::new($false))
$specA = ($salesJson -replace '"outName":\s*"[^"]*"', '"outName": "IT_A"')
$specB = ($salesJson -replace '"outName":\s*"[^"]*"', '"outName": "IT_B"')
$badSpec = ($salesJson -replace '"aggregation":\s*"sum"', '"aggregation": "avg"')
[System.IO.File]::WriteAllText("$itAbs\a.json", $specA, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText("$itAbs\b.json", $specB, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText("$itAbs\bad.json", $badSpec, [System.Text.UTF8Encoding]::new($false))

function Assert-Serialized($label) {
  $lines = @()
  if (Test-Path "$rt\history.log") { $lines = @(Get-Content "$rt\history.log" -Encoding ASCII) }
  $live = @{}; $maxLive = 0
  foreach ($ln in $lines) {
    $parts = $ln -split ' '
    if ($parts.Count -lt 3) { continue }
    $evt = $parts[1]; $rid = $parts[2]
    if ($evt -eq 'ACQUIRE') { $live[$rid] = 1 }
    elseif ($evt -eq 'RELEASE') { $live.Remove($rid) }
    elseif ($evt -eq 'RECOVER') { $live.Clear() }
    if ($live.Count -gt $maxLive) { $maxLive = $live.Count }
  }
  if ($maxLive -le 1) { Pass "$label maxLiveRuntime=$maxLive (<=1)" } else { Fail "$label maxLiveRuntime=$maxLive (>1)" }
}
function ArtExecOk($rid) {
  $p = "$runs\$rid\artifact.json"
  if (-not (Test-Path $p)) { return $null }
  try { return (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json).execution.ok } catch { return $null }
}

# ---- Scenario 1/2/4: two concurrent creates ----
Write-Output "== S1/2/4 concurrent create A+B"
$jobA = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s1a"
$jobB = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/b.json","it_s1b"
$null = Wait-Job $jobA,$jobB; $outA = Receive-Job $jobA; $outB = Receive-Job $jobB; Remove-Job $jobA,$jobB
Write-Output "  A: $outA"; Write-Output "  B: $outB"
if ((Test-Path "$runs\it_s1a\artifact.json") -and (Test-Path "$runs\it_s1b\artifact.json")) { Pass "S1 both artifacts present" } else { Fail "S1 missing artifact" }
$okA = ArtExecOk "it_s1a"; $okB = ArtExecOk "it_s1b"
if ($okA -eq $true -and $okB -eq $true) { Pass "S2 both execution.ok=true (A then B auto-started)" } else { Fail "S2 execution not ok A=$okA B=$okB" }
Assert-Serialized "S4 history serialized (no 2nd runtime)"

# ---- Scenario 3: failing task + good task concurrently ----
Write-Output "== S3 failure isolation (bad spec + good spec)"
Remove-Item "$rt\history.log" -Force -ErrorAction SilentlyContinue
$jobBad = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/bad.json","it_s3bad"
$jobGood = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb create -Spec $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/a.json","it_s3good"
$null = Wait-Job $jobBad,$jobGood; $ob = Receive-Job $jobBad; $og = Receive-Job $jobGood; Remove-Job $jobBad,$jobGood
Write-Output "  bad: $ob"; Write-Output "  good: $og"
$badOk = ArtExecOk "it_s3bad"; $goodOk = ArtExecOk "it_s3good"
if ($badOk -ne $true -and $goodOk -eq $true) { Pass "S3 failing task did not poison good task (bad=$badOk good=$goodOk)" } else { Fail "S3 isolation broken bad=$badOk good=$goodOk" }
Assert-Serialized "S3 serialized"

# ---- Scenario 5: crash recovery (stale lock with dead owner) ----
Write-Output "== S5 crash recovery"
Remove-Item "$rt\history.log" -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$rt\lock" | Out-Null
[System.IO.File]::WriteAllText("$rt\current.json", (@{ runId='it_ghost'; verb='compile'; pid=999999; startedAt=(Get-Date).AddMinutes(-1).ToString('o') } | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText("$rt\queue\it_ghost.json", (@{ runId='it_ghost'; verb='compile'; state='running'; submittedAt=(Get-Date).AddMinutes(-1).ToString('o') } | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))
$recOut = & "$ROOT\agent\tools\fr_agent.ps1" -Verb create -Spec "$itRel/a.json" -RunId "it_s5" 2>&1 | Select-Object -Last 1
Write-Output "  after-crash create: $recOut"
$ghostFailed = $false
if (Test-Path "$rt\done\it_ghost.json") { $g = Get-Content "$rt\done\it_ghost.json" -Raw -Encoding UTF8 | ConvertFrom-Json; $ghostFailed = ($g.state -eq 'failed' -and ([string]$g.reason) -like 'RUNTIME_LOST*') }
$s5Ok = (ArtExecOk "it_s5")
if ($ghostFailed -and ($s5Ok -eq $true)) { Pass "S5 stale owner recovered as failed (not success) and new run completed" } else { Fail "S5 recovery broken ghostFailed=$ghostFailed s5Ok=$s5Ok" }

# ---- Scenario 6: template modify isolation (two concurrent patches, distinct staging) ----
Write-Output "== S6 template modify isolation"
Remove-Item "$rt\history.log" -Force -ErrorAction SilentlyContinue
$deploy = "$FR\webapps\webroot\WEB-INF\reportlets\fineagent"
$avail = @(Get-ChildItem "$deploy\*_api.cpt" -ErrorAction SilentlyContinue | Select-Object -First 2)
if ($avail.Count -lt 2) { Fail "S6 need >=2 deployed cpt templates" }
else {
  $src1 = 'fineagent/' + $avail[0].Name
  $src2 = 'fineagent/' + $avail[1].Name
  $p1 = @{ patchVersion='1'; sourceCpt=$src1; outName='IT_P1'; ops=@(@{ op='replace_cell_value'; sheet=0; cell=@{ c=0; r=0 }; value=@{ kind='text'; text='IT_TITLE_ONE' } }) } | ConvertTo-Json -Depth 8
  $p2 = @{ patchVersion='1'; sourceCpt=$src2; outName='IT_P2'; ops=@(@{ op='replace_cell_value'; sheet=0; cell=@{ c=0; r=0 }; value=@{ kind='text'; text='IT_TITLE_TWO' } }) } | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText("$itAbs\p1.json", $p1, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText("$itAbs\p2.json", $p2, [System.Text.UTF8Encoding]::new($false))
  $jp1 = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb modify -Patch $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/p1.json","it_s6a"
  $jp2 = Start-Job -ScriptBlock { param($root,$spec,$rid) Set-Location $root; & "$root\agent\tools\fr_agent.ps1" -Verb modify -Patch $spec -RunId $rid 2>&1 | Select-Object -Last 1 } -ArgumentList $ROOT,"$itRel/p2.json","it_s6b"
  $null = Wait-Job $jp1,$jp2; $o1 = Receive-Job $jp1; $o2 = Receive-Job $jp2; Remove-Job $jp1,$jp2
  Write-Output "  patch1: $o1"; Write-Output "  patch2: $o2"
  $m1 = "$runs\it_s6a\staging\manifest.json"; $m2 = "$runs\it_s6b\staging\manifest.json"
  if ((Test-Path $m1) -and (Test-Path $m2)) {
    $out1 = [string](Get-Content $m1 -Raw -Encoding UTF8 | ConvertFrom-Json).out
    $out2 = [string](Get-Content $m2 -Raw -Encoding UTF8 | ConvertFrom-Json).out
    if ($out1 -like '*IT_P1*' -and $out2 -like '*IT_P2*') { Pass "S6 per-run staging isolated (A=$out1 B=$out2)" } else { Fail "S6 staging cross-contaminated A=$out1 B=$out2" }
  } else { Fail "S6 missing per-run staging manifests" }
  Assert-Serialized "S6 serialized"
}

# ---- Scenario 7 (r11-5): plan preflight split - sql vs rows paths run independently ----
Write-Output "== S7 plan preflight split (sql vs rows)"
$sqlIntent = '{"outName":"IT_SQL","reportName":"IT_SQL","dataset":{"kind":"sql","connection":"ATOM_LIVE","entity":"InspectionRecord","dimensions":["bizDate"],"metrics":["planned","done"],"dateRange":{"from":"2026-09-13","to":"2026-09-13"}}}'
$rowsIntent = '{"outName":"IT_ROWS","dimensions":["bizDate"],"metrics":[{"term":"planned"}],"rows":[["2026-09-13",10]]}'
[System.IO.File]::WriteAllText("$itAbs\sql_intent.json", $sqlIntent, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText("$itAbs\rows_intent.json", $rowsIntent, [System.Text.UTF8Encoding]::new($false))
$ps = & "$ROOT\agent\tools\fr_agent.ps1" -Verb plan -Intent "$itRel/sql_intent.json" -RunId "it_s7sql" 2>&1 | Select-Object -Last 1
$pr = & "$ROOT\agent\tools\fr_agent.ps1" -Verb plan -Intent "$itRel/rows_intent.json" -RunId "it_s7rows" 2>&1 | Select-Object -Last 1
Write-Output "  sql plan: $ps"; Write-Output "  rows plan: $pr"
$sqlStat = $null; if (Test-Path "$runs\it_s7sql\plan.json") { $sqlStat = [string](Get-Content "$runs\it_s7sql\plan.json" -Raw -Encoding UTF8 | ConvertFrom-Json).status }
$rowsReason = ''; if (Test-Path "$runs\it_s7rows\plan.json") { $rowsReason = [string](Get-Content "$runs\it_s7rows\plan.json" -Raw -Encoding UTF8 | ConvertFrom-Json).reason }
if ($sqlStat -eq 'ready') { Pass "S7 sql intent reaches planner (ready)" } else { Fail "S7 sql intent status=$sqlStat" }
# rows intent must NOT be blocked by database preflight (reason != PREFLIGHT_FAILED); it goes through planner rows path
if ($rowsReason -ne 'PREFLIGHT_FAILED') { Pass "S7 rows intent NOT blocked by preflight (reason=$rowsReason)" } else { Fail "S7 rows intent wrongly blocked by DB preflight" }

Write-Output ("INTEGRATION END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
