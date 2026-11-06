# scripts/run-multisheet-e2e.ps1 - Agent chain e2e for ReportSpec multi-sheet (rows path)
#   chain: fr_agent plan -> plan2spec -> create, then artifact assertions:
#     plan.reportSpec carries extraSheets/params; deployed cpt has >=2 <Report>, ReportParameterAttr, dataset ds2.
#   ASCII-only (PS 5.1 reads UTF-8 as GBK and desyncs the parser - AGENTS sec.5).
#   Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-multisheet-e2e.ps1
param(
  [string]$RunId = ('ms' + (Get-Date -Format 'yyyyMMddHHmmss')),
  [string]$Root = 'D:\fineagent',
  [string]$FrHome = 'D:\software\FineReport_11.0'
)
$ErrorActionPreference = 'Continue'
$agent = Join-Path $Root 'agent\tools\fr_agent.ps1'
$intent = Join-Path $Root 'verify\fixtures\multisheet\intent.json'
$runDir = Join-Path $Root ("logs\agent\runs\{0}" -f $RunId)
$failures = 0
$stop = $false
function Fail($msg) { Write-Host ("STEP FAIL: {0}" -f $msg); $script:failures++; $script:stop = $true }
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

if (-not (Test-Path $intent)) { Fail ("intent missing: {0}" -f $intent) }
Invoke-Step 'plan' @('-Verb', 'plan', '-Intent', $intent, '-RunId', $RunId) | Out-Null
Invoke-Step 'plan2spec' @('-Verb', 'plan2spec', '-RunId', $RunId) | Out-Null
Invoke-Step 'create' @('-Verb', 'create', '-Spec', ("logs/agent/runs/$RunId/reportSpec.json"), '-RunId', $RunId) | Out-Null

# ---- assertions: plan/spec carries the new keys (agent chain, not hand-written spec)
if (-not $stop) {
  $specPath = Join-Path $runDir 'reportSpec.json'
  if (-not (Test-Path $specPath)) { Fail ("reportSpec missing: {0}" -f $specPath) }
  else {
    $spec = Get-Content -Raw -Encoding UTF8 $specPath | ConvertFrom-Json
    if ($spec.extraSheets -and $spec.extraSheets.Count -ge 1 -and $spec.extraSheets[0].name -eq 'Detail') { Write-Host 'CHECK PASS: plan2spec keeps extraSheets (Detail)' }
    else { Fail 'plan2spec lost extraSheets' }
    if ($spec.params -and $spec.params.Count -ge 1 -and $spec.params[0].name -eq 'd1') { Write-Host 'CHECK PASS: plan2spec keeps params (d1)' }
    else { Fail 'plan2spec lost params' }
  }
}
# ---- assertions: deployed cpt structure
if (-not $stop) {
  $cpt = Join-Path $FrHome 'webapps\webroot\WEB-INF\reportlets\fineagent\ms_agent_e2e_api.cpt'
  if (-not (Test-Path $cpt)) { Fail ("cpt missing: {0}" -f $cpt) }
  else {
    $xml = Get-Content -Raw -Encoding UTF8 $cpt
    $reports = ([regex]::Matches($xml, '<Report\s')).Count
    if ($reports -ge 2) { Write-Host ("CHECK PASS: cpt has {0} Report nodes (multi-sheet)" -f $reports) }
    else { Fail ("cpt Report nodes={0} (expected >=2)" -f $reports) }
    if ($xml -match '<ReportParameterAttr') { Write-Host 'CHECK PASS: cpt has ReportParameterAttr (params)' }
    else { Fail 'cpt missing ReportParameterAttr' }
    if ($xml -match 'ds2') { Write-Host 'CHECK PASS: cpt references ds2 (extra sheet dataset)' }
    else { Fail 'cpt missing ds2 reference' }
  }
}
if ($failures -eq 0) { Write-Host 'MULTISHEET E2E GREEN'; exit 0 }
Write-Host ("MULTISHEET E2E FAILED failures={0}" -f $failures)
exit 1
