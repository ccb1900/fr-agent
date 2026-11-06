# scripts/run-golden-e2e.ps1 - Golden Create+Modify E2E auto-reproduction (closure audit step 3, v2)
#   v2 fixes per external review: (1) day@machine full-grid truth via verify_sql_data.js TRUTH_DAY_MACHINE=1,
#   not just totals; (2) modify step + original .orig.cpt kept + manifest diffClean; (3) fail-fast on first
#   failed step; (4) RunId = timestamp + GUID suffix (no second-level collision).
#   create chain: plan -> plan2spec -> create -> validate(-ExpectTotals) -> truth-grid -> preview -> modify.
#   Depends on FineReport Runtime single instance (fr_agent via global Mutex, -NoKill); ensure no other java holds FineDB.
#   ASCII-only (PS 5.1 reads UTF-8 as GBK and desyncs the parser - AGENTS sec.5).
param(
  [string]$RunId = ('ge' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6)),
  [string]$Intent = 'logs/agent/golden/g1_intent.json',
  [string]$Totals = '33531:26531',
  [string]$Root = 'D:\fineagent',
  [string]$FrJar = 'D:\software\FineReport_11.0\jre\lib\ext\nashorn.jar',
  [string]$Java = 'D:\software\FineReport_11.0\jre\bin\java.exe'
)
# Environment note (2026-11-06 update): run.ps1's commit preflight was REMOVED by user decision
# (the #46 native-crash accident was under the unlimited 6G default heap; -Xmx cap is the fix).
# This script still steps the heap down on tight memory as a resource optimisation and early signal,
# but it is no longer required to pass any preflight check. ENV_BLOCKED only fires below 400m floor.
$os = Get-CimInstance Win32_OperatingSystem
$freeMB = [int]($os.FreeVirtualMemory / 1KB)
$prevHeap = $env:FR_AGENT_HEAP
$heapMB = 1200
if ($freeMB -lt ($heapMB + 900)) {
  $heapMB = [int]([math]::Floor(($freeMB - 950) / 100) * 100)
  if ($heapMB -lt 400) {
    Write-Host ("ENV_BLOCKED: FreeVirtual={0}MB cannot satisfy heap>=400m (need {1}MB). Close memory hogs and rerun." -f $freeMB, 1300)
    exit 8
  }
  $env:FR_AGENT_HEAP = ("{0}m" -f $heapMB)
  Write-Host ("NOTE: FR_AGENT_HEAP={0}m (FreeVirtual={1}MB < 2100MB preflight; README #47 env override)" -f $heapMB, $freeMB)
}
$agent = Join-Path $Root 'agent\tools\fr_agent.ps1'
$fails = 0
$stop = $false
function Fail($msg) { Write-Host ("STEP FAIL: {0}" -f $msg); $script:fails++; $script:stop = $true }
function Invoke-Step($name, $extra) {
  if ($script:stop) { Write-Host ("STEP {0} SKIP (prior failure)" -f $name); return $null }
  $raw = & powershell -NoProfile -ExecutionPolicy Bypass -File $agent @extra 2>$null
  $jsonLine = ($raw | Where-Object { $_ -match '^\s*\{' } | Select-Object -Last 1)
  if (-not $jsonLine) { Fail ("{0}: no JSON line" -f $name); return $null }
  $j = $null
  try { $j = $jsonLine | ConvertFrom-Json } catch { Fail ("{0}: bad JSON -> {1}" -f $name, $jsonLine); return $null }
  if ($j.ok -ne $true) { Fail ("{0}: ok={1} -> {2}" -f $name, $j.ok, $jsonLine); return $null }
  Write-Host ("STEP {0} OK" -f $name)
  return $j
}
# 1-4: create chain
Invoke-Step 'plan' @('-Verb', 'plan', '-Intent', $Intent, '-RunId', $RunId) | Out-Null
Invoke-Step 'plan2spec' @('-Verb', 'plan2spec', '-RunId', $RunId) | Out-Null
Invoke-Step 'create' @('-Verb', 'create', '-Spec', ("logs/agent/runs/$RunId/reportSpec.json"), '-RunId', $RunId) | Out-Null
Invoke-Step 'validate' @('-Verb', 'validate', '-RunId', $RunId, '-ExpectTotals', $Totals) | Out-Null
# 5: day@machine full-grid truth (independent verifier, double-key closure + per-row plan/done/rate + totals)
#   FAIL-CLOSED (external review P1): grid AND truth file must pre-exist and be non-empty; the verifier runs
#   with REQUIRE_TRUTH=1 so a missing truth can never SKIP-to-pass; any SKIP token in its output is a FAIL too.
if (-not $stop) {
  $grid = Join-Path $Root "logs\agent\runs\$RunId\grid.txt"
  $truth = Join-Path $Root 'data\db_laser_machine_daily_truth.txt'
  if (-not (Test-Path $grid)) { Fail ("truth-grid: missing grid {0}" -f $grid) }
  elseif (-not (Test-Path $truth) -or (Get-Item $truth).Length -lt 100) { Fail ("truth-grid: truth file missing/empty -> {0}" -f $truth) }
  else {
    $prev = $env:TRUTH_DAY_MACHINE; $env:TRUTH_DAY_MACHINE = '1'
    $prevGrid = $env:GRID; $env:GRID = $grid
    $prevReq = $env:REQUIRE_TRUTH; $env:REQUIRE_TRUTH = '1'
    $prevTf = $env:TRUTH_FILE; Remove-Item env:TRUTH_FILE -ErrorAction SilentlyContinue
    $raw = & $Java '-cp' $FrJar 'jdk.nashorn.tools.Shell' (Join-Path $Root 'verify\verify_sql_data.js') 2>&1
    $rc = $LASTEXITCODE
    if ($null -ne $prev) { $env:TRUTH_DAY_MACHINE = $prev } else { Remove-Item env:TRUTH_DAY_MACHINE -ErrorAction SilentlyContinue }
    if ($null -ne $prevGrid) { $env:GRID = $prevGrid } else { Remove-Item env:GRID -ErrorAction SilentlyContinue }
    if ($null -ne $prevReq) { $env:REQUIRE_TRUTH = $prevReq } else { Remove-Item env:REQUIRE_TRUTH -ErrorAction SilentlyContinue }
    if ($null -ne $prevTf) { $env:TRUTH_FILE = $prevTf }
    $joined = ($raw -join ' ')
    $tail = ($raw | Select-Object -Last 1)
    if ($rc -ne 0 -or $joined -match 'CHECK FAIL') { Fail ("truth-grid: rc={0} -> {1}" -f $rc, $tail) }
    elseif ($joined -match 'SKIP') { Fail ("truth-grid: verifier SKIPPED (not a pass) -> {0}" -f $tail) }
    else { Write-Host ("STEP truth-grid OK (10 day@machine rows + totals {0})" -f $Totals) }
  }
}
# 6: preview via .NET (PS 5.1 GBK mangles Chinese PNG path when passed back through fr_agent.ps1)
if (-not $stop) {
  Add-Type -AssemblyName System.Drawing
  $artPath = Join-Path $Root "logs\agent\runs\$RunId\artifact.json"
  if (-not (Test-Path $artPath)) { Fail ("preview: artifact.json missing -> {0}" -f $artPath) }
  else {
    $png = (Get-Content $artPath -Raw -Encoding UTF8 | ConvertFrom-Json).pngPath
    if (-not $png) { Fail "preview: pngPath empty" }
    else {
      try {
        $fi = New-Object System.IO.FileInfo($png)
        if (-not $fi.Exists -or $fi.Length -lt 1000) { throw ("png missing/small: {0}" -f $fi.Length) }
        $img = [System.Drawing.Image]::FromFile($png)
        $bmp = New-Object System.Drawing.Bitmap($img)
        $nw = 0; $tot = 0
        for ($x = 0; $x -lt $bmp.Width; $x += 20) { for ($y = 0; $y -lt $bmp.Height; $y += 20) {
          $c = $bmp.GetPixel($x,$y); $tot++
          if (-not ($c.R -gt 245 -and $c.G -gt 245 -and $c.B -gt 245)) { $nw++ }
        } }
        $ratio = if ($tot -gt 0) { $nw / $tot } else { 0 }
        $w = $img.Width; $h = $img.Height
        $bmp.Dispose(); $img.Dispose()
        if ($w -le 0 -or $h -le 0 -or $ratio -lt 0.002) { throw ("blank/small: {0}x{1} ratio={2}" -f $w,$h,$ratio) }
        Write-Host ("STEP preview OK ({0}x{1}, {2} bytes, nonWhite={3}/{4})" -f $w,$h,$fi.Length,$nw,$tot)
      } catch { Fail ("preview: {0}" -f $_.Exception.Message) }
    }
  }
}
# 7: modify (I6 patch) - build a UTF-8 PatchSpec on the fly pointing at this run's created cpt
if (-not $stop) {
  $spec = Join-Path $Root "logs\agent\runs\$RunId\reportSpec.json"
  # ASCII-only file: build the Chinese cpt name from char codes (PS 5.1 GBK would desync on literal CJK)
  $cptName = -join ([char[]]@(0x751F,0x4EA7,0x65E5,0x62A5)) + 'GOLDEN_api.cpt'
  $patchSpecPath = Join-Path $Root "logs\agent\runs\$RunId\patch_e2e.json"
  $patchJson = '{"patchVersion":"1","sourceCpt":"fineagent/' + $cptName + '","outName":"GoldenReview","ops":[{"op":"replace_cell_value","sheet":0,"cell":{"c":0,"r":0},"value":{"kind":"text","text":"Golden Review"}}]}'
  [System.IO.File]::WriteAllText($patchSpecPath, $patchJson, (New-Object System.Text.UTF8Encoding($false)))
  Invoke-Step 'modify' @('-Verb', 'modify', '-Patch', ("logs/agent/runs/$RunId/patch_e2e.json"), '-RunId', $RunId) | Out-Null
  if (-not $stop) {
    $pj = Join-Path $Root "logs\agent\runs\$RunId\patch.json"
    if (-not (Test-Path $pj)) { Fail "modify: patch.json missing" }
    else {
      $d = Get-Content $pj -Raw -Encoding UTF8 | ConvertFrom-Json
      $m = $d.manifest
      if ($d.ok -ne $true -or $m.diffClean -ne $true -or $m.execution.pass -ne $true -or $m.render.pass -ne $true) { Fail ("modify: ok={0} diffClean={1} exec={2} render={3}" -f $d.ok,$m.diffClean,$m.execution.pass,$m.render.pass) }
      else {
        $staging = Join-Path $Root "logs\agent\runs\$RunId\staging"
        $orig = Get-ChildItem $staging -Filter '*.orig.cpt' -ErrorAction SilentlyContinue
        if (-not $orig) { Fail "modify: .orig.cpt not kept in staging" }
        else { Write-Host ("STEP modify OK (diffClean + exec + render + orig {0} kept)" -f $orig[0].Name) }
      }
    }
  }
}
if ($null -ne $prevHeap) { $env:FR_AGENT_HEAP = $prevHeap } else { Remove-Item env:FR_AGENT_HEAP -ErrorAction SilentlyContinue }
if ($fails -eq 0) { Write-Host ("GOLDEN E2E PASS (create+truth-grid+preview+modify, runId={0})" -f $RunId) }
else { Write-Host ("GOLDEN E2E FAIL, failures={0}" -f $fails) }
exit $fails
