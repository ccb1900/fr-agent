# scripts/run-golden-e2e.ps1 - Golden E2E auto-reproduction (closure audit step 3)
#   Fixes agent-demo-machine-daily.md sec.6 manual commands into one re-runnable script:
#   plan -> plan2spec -> create -> validate(-ExpectTotals 33531:26531) -> preview, single runId throughout.
#   Asserts ok / external truth / PNG non-empty per step; any failure exits 1. Unique runId (timestamp) avoids re-entry refusal.
#   Depends on FineReport Runtime single instance (fr_agent via global Mutex, -NoKill); ensure no other java holds FineDB.
#   ASCII-only (PS 5.1 reads UTF-8 as GBK and desyncs the parser - AGENTS sec.5).
param(
  [string]$RunId = ('ge' + (Get-Date -Format 'yyyyMMddHHmmss')),
  [string]$Intent = 'logs/agent/golden/g1_intent.json',
  [string]$Totals = '33531:26531',
  [string]$Root = 'D:\fineagent'
)
$agent = Join-Path $Root 'agent\tools\fr_agent.ps1'
$fails = 0
function Invoke-Step($name, $extra) {
  $raw = & powershell -NoProfile -ExecutionPolicy Bypass -File $agent @extra 2>$null
  $jsonLine = ($raw | Where-Object { $_ -match '^\s*\{' } | Select-Object -Last 1)
  if (-not $jsonLine) { Write-Output ("STEP {0} FAIL: no JSON line" -f $name); $script:fails++; return $null }
  $j = $null
  try { $j = $jsonLine | ConvertFrom-Json } catch { Write-Output ("STEP {0} FAIL: bad JSON -> {1}" -f $name, $jsonLine); $script:fails++; return $null }
  if ($j.ok -ne $true) { Write-Output ("STEP {0} FAIL: ok={1} -> {2}" -f $name, $j.ok, $jsonLine); $script:fails++ }
  else { Write-Output ("STEP {0} OK" -f $name) }
  return $j
}
Invoke-Step 'plan' @('-Verb', 'plan', '-Intent', $Intent, '-RunId', $RunId) | Out-Null
Invoke-Step 'plan2spec' @('-Verb', 'plan2spec', '-RunId', $RunId) | Out-Null
Invoke-Step 'create' @('-Verb', 'create', '-Spec', ("logs/agent/runs/$RunId/reportSpec.json"), '-RunId', $RunId) | Out-Null
Invoke-Step 'validate' @('-Verb', 'validate', '-RunId', $RunId, '-ExpectTotals', $Totals) | Out-Null
# preview step: read PNG directly via .NET (PS 5.1 GBK mangles the Chinese outName path when
# passing it back through fr_agent.ps1; the artifact.json pngPath itself is valid Unicode).
# Assert exists + bytes + dimensions + not blank, exactly what agent/tools/preview.js checks.
$artPath = Join-Path $Root "logs\agent\runs\$RunId\artifact.json"
if (Test-Path $artPath) {
  $png = (Get-Content $artPath -Raw -Encoding UTF8 | ConvertFrom-Json).pngPath
  if ($png) {
    Add-Type -AssemblyName System.Drawing
    try {
      $fi = New-Object System.IO.FileInfo($png)
      if (-not $fi.Exists -or $fi.Length -lt 1000) { throw ("png missing/too small: {0} bytes={1}" -f $png,$fi.Length) }
      $img = [System.Drawing.Image]::FromFile($png)
      $w = $img.Width; $h = $img.Height
      # non-blank check: sparse data reports have low ink coverage (~0.7% samples non-white).
      # Use a tolerant threshold (>=0.2%) plus size/bytes, NOT a full-image exact diff.
      $bmp = New-Object System.Drawing.Bitmap($img)
      $nonWhite = 0; $total = 0
      for ($x = 0; $x -lt $bmp.Width; $x += 20) { for ($y = 0; $y -lt $bmp.Height; $y += 20) {
        $c = $bmp.GetPixel($x, $y); $total++
        if (-not ($c.R -gt 245 -and $c.G -gt 245 -and $c.B -gt 245)) { $nonWhite++ }
      } }
      $bmp.Dispose(); $img.Dispose()
      $ratio = if ($total -gt 0) { $nonWhite / $total } else { 0 }
      if ($w -le 0 -or $h -le 0 -or $ratio -lt 0.002) { throw ("blank/too small: {0}x{1} nonWhite={2}/{3} ratio={4}" -f $w,$h,$nonWhite,$total,$ratio) }
      Write-Output ("STEP preview OK ({0}x{1}, {2} bytes, nonWhite={3}/{4})" -f $w,$h,$fi.Length,$nonWhite,$total)
    } catch { Write-Output ("STEP preview FAIL: {0}" -f $_.Exception.Message); $fails++ }
  } else { Write-Output "STEP preview FAIL: artifact.json pngPath empty"; $fails++ }
} else { Write-Output ("STEP preview FAIL: artifact.json missing -> {0}" -f $artPath); $fails++ }
if ($fails -eq 0) { Write-Output ("GOLDEN E2E PASS (plan->plan2spec->create->validate -ExpectTotals {0} ->preview, runId={1})" -f $Totals, $RunId) }
else { Write-Output ("GOLDEN E2E FAIL, failures={0}" -f $fails) }
exit $fails
