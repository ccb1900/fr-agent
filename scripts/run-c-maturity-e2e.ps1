# scripts/run-c-maturity-e2e.ps1 - Phase-2 C-sect: NL->report maturity loop e2e.
#   Simulates an EXTERNAL LLM that only sees tool output: three NON-demo shaped reports go through the
#   full product chain create -> validate -> inspect_template -> modify -> promote. Patch coordinates are
#   derived from the inspect_template output (never hardcoded), mirroring how an outside agent would work.
#   Shapes: C1 params+conditional-highlight+footnote (rows) / C2 multi-sheet+headerFooter+watermark (rows) /
#   C3 real-DB chart page (sql via plan chain).
#   ASCII-only (PS 5.1 GBK lesson): all Chinese values come from the UTF-8 fixture JSONs, never literals.
param(
  [string]$Root = 'D:\fineagent'
)
$ErrorActionPreference = 'Continue'
$agent = Join-Path $Root 'agent\tools\fr_agent.ps1'
$deploy = 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\fineagent'
$fixtures = @(
  @{ label = 'C1-params-hl'; file = 'verify\fixtures\c_maturity\c1_params_hl.json'; mode = 'direct' },
  @{ label = 'C2-multisheet-hf'; file = 'verify\fixtures\c_maturity\c2_multisheet_hf.json'; mode = 'direct' },
  @{ label = 'C3-chart-sql'; file = 'verify\fixtures\c_maturity\c3_chart_intent.json'; mode = 'plan' }
)
$script:fails = 0
function Fail($msg) { Write-Host ("C-STEP FAIL: {0}" -f $msg); $script:fails++ }
function Ok($msg) { Write-Host ("C-STEP OK: {0}" -f $msg) }
function Invoke-Step($name, $extra) {
  $raw = & powershell -NoProfile -ExecutionPolicy Bypass -File $agent @extra 2>$null
  $jsonLine = ($raw | Where-Object { $_ -match '^\s*\{' } | Select-Object -Last 1)
  if (-not $jsonLine) { Fail ("{0}: no JSON line" -f $name); return $null }
  $j = $null
  try { $j = $jsonLine | ConvertFrom-Json } catch { Fail ("{0}: bad JSON -> {1}" -f $name, $jsonLine); return $null }
  if ($j.ok -ne $true) { Fail ("{0}: ok={1} -> {2}" -f $name, $j.ok, $jsonLine); return $null }
  return $j
}

foreach ($fx in $fixtures) {
  Write-Host ("==== {0} ====" -f $fx.label)
  $stamp = Get-Date -Format 'HHmmss'
  $runId = ('c' + $stamp + '-' + [guid]::NewGuid().ToString('N').Substring(0, 4))
  $runDir = Join-Path $Root ("logs\agent\runs\{0}" -f $runId)
  $specAbs = Join-Path $Root $fx.file
  if (-not (Test-Path $specAbs)) { Fail ("fixture missing: {0}" -f $specAbs); continue }
  $fixture = Get-Content -Raw -Encoding UTF8 $specAbs | ConvertFrom-Json

  # ---- create chain (plan chain only for the sql shape; direct ReportSpec for rows shapes = the hybrid route)
  if ($fx.mode -eq 'plan') {
    $p = Invoke-Step 'plan' @('-Verb', 'plan', '-Intent', $fx.file, '-RunId', $runId)
    if (-not $p) { continue }
    $p2 = Invoke-Step 'plan2spec' @('-Verb', 'plan2spec', '-RunId', $runId)
    if (-not $p2) { continue }
    $specRel = "logs/agent/runs/$runId/reportSpec.json"
  } else {
    $specRel = ($fx.file -replace '\\', '/')
  }
  $c = Invoke-Step 'create' @('-Verb', 'create', '-Spec', $specRel, '-RunId', $runId)
  if (-not $c) { continue }

  # ---- validate (no ExpectTotals: shapes are not the demo 3-col totals signature)
  $v = Invoke-Step 'validate' @('-Verb', 'validate', '-RunId', $runId)
  if (-not $v) { continue }

  # ---- outName from the fixture/spec (external LLM knows its own outName; deployed name = <outName>_api.cpt)
  $outName = $fixture.outName
  $cptRel = 'fineagent/' + $outName + '_api.cpt'
  $deployed = Join-Path $deploy ($outName + '_api.cpt')
  if (-not (Test-Path $deployed)) { Fail ("created cpt not deployed: {0}" -f $deployed); continue }
  Ok ("created + validated: {0}" -f $outName)

  # ---- inspect_template: real cell coordinates from tool output (never hardcoded)
  $insp = Invoke-Step 'inspect' @('-Verb', 'inspect_template', '-Target', $cptRel, '-RunId', $runId)
  if (-not $insp) { continue }
  $inspJson = Get-Content (Join-Path $runDir 'inspect.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($inspJson.sheetCount -lt 1 -or -not $inspJson.sheets[0].cells -or $inspJson.sheets[0].cells.Count -lt 1) { Fail 'inspect: no cells returned'; continue }
  $titleCell = $inspJson.sheets[0].cells | Where-Object { $_.r -eq 0 } | Select-Object -First 1
  if (-not $titleCell) { Fail 'inspect: no r0 cell (title) found'; continue }
  Ok ("inspect: title cell c={0} r={1} text={2}" -f $titleCell.c, $titleCell.r, $titleCell.text)

  # ---- modify: replace the title cell with a review tag (coordinates from inspect output).
  #   ASCII-only per AGENTS sec.5: the review tag is ASCII ' (review)'; patch values must not contain
  #   ']' (template/validator.js) - ASCII parens/space are fine. The ORIGINAL title text itself is CJK
  #   but it lives in the UTF-8 fixture JSON / inspect.json payload, never in this file.
  $md5Pre = (Get-FileHash $deployed -Algorithm MD5).Hash
  $patchSpec = @{
    patchVersion = '1'; sourceCpt = $cptRel; outName = ($outName + 'REVIEW')
    ops = @(@{ op = 'replace_cell_value'; sheet = 0; cell = @{ c = $titleCell.c; r = $titleCell.r }; value = @{ kind = 'text'; text = ($titleCell.text + ' (review)') } })
  }
  $patchFile = "logs/agent/runs/$runId/patch_review.json"
  [System.IO.File]::WriteAllText((Join-Path $Root $patchFile), ($patchSpec | ConvertTo-Json -Depth 8), (New-Object System.Text.UTF8Encoding($false)))
  $m = Invoke-Step 'modify' @('-Verb', 'modify', '-Patch', $patchFile, '-RunId', $runId)
  if (-not $m) { continue }
  $pj = Get-Content (Join-Path $runDir 'patch.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($pj.manifest.diffClean -ne $true) { Fail 'modify: diffClean!=true'; continue }
  Ok 'modify: patch applied, diff clean'

  # ---- promote: deployed artifact becomes the verified patched bytes
  $pr = Invoke-Step 'promote' @('-Verb', 'promote', '-RunId', $runId)
  if (-not $pr) { continue }
  $md5Post = (Get-FileHash $deployed -Algorithm MD5).Hash
  $md5Staged = (Get-FileHash $pj.manifest.out -Algorithm MD5).Hash
  if ($md5Post -ne $md5Staged) { Fail 'promote: deployed cpt != staged patched bytes'; continue }
  if ($md5Post -eq $md5Pre) { Fail 'promote: deployed cpt unchanged (no-op?)'; continue }
  Ok ("promote: deployed artifact updated (md5 {0} -> {1})" -f $md5Pre.Substring(0, 8), $md5Post.Substring(0, 8))
}

# default-spec restore + byte baseline (AGENTS sec.1): the create/plan steps run make_api with their own
#   spec, leaving demo_api.cpt as the last created report - close with the default spec.
& (Join-Path $Root 'run.ps1') -Script make_api.js | Out-Null
$rcRestore = $LASTEXITCODE
$md5 = (Get-FileHash (Join-Path $Root 'demo_api.cpt') -Algorithm MD5).Hash
if ($rcRestore -ne 0) { Write-Host ("RESTORE FAIL: default spec exit={0}" -f $rcRestore); $script:fails++ }
if ($md5 -ne 'CBEB42E3CE48E46E362B9AE80168026F') { Write-Host ("BASELINE FAIL: demo_api.cpt={0}" -f $md5); $script:fails++ }

if ($script:fails -eq 0) { Write-Host 'C-MATURITY E2E GREEN (3 shapes x create+validate+inspect+modify+promote)'; exit 0 }
Write-Host ("C-MATURITY E2E FAILED, failures={0}" -f $script:fails)
exit 1
