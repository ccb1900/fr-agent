# tools_prod_run.ps1 - prod staging batch build (report specs = reports_prod\br_*.js)
# Semantics: BR_MODULESET=prod + BR_TPFX=t_collector_ + BR_DEPLOYDIR=<mkwh staging (dynamic name, dodges
#   non-ASCII path pitfalls)>; BR_SKIP_EXEC deliberately NOT set here (local 127.0.0.1 atom_live_demo mirror
#   DB reachable -> full execution gives stronger verification).
# Usage: tools_prod_run.ps1 [-SkipExec]  ; one line per spec into logs\prod_<name>_out.txt, EXIT codes summed.
# Note: under PS5.1 param([switch]) binding was unstable in this session (IsPresent stayed empty) - use $args
#   detection instead, behaviorally equivalent.
$ErrorActionPreference = 'Continue'
$SkipExec = ($args -contains '-SkipExec')
Write-Host "PARAMBIND SKIP=[$SkipExec] BR=[$env:BR_SKIP_EXEC]"
$base = 'D:\fineagent'
$stageDir = Get-ChildItem "$base\build_prod\mkwh" -Directory | Select-Object -First 1
$stage = $stageDir.FullName
$skip = if ($SkipExec) { $env:BR_SKIP_EXEC = '1' } else { Remove-Item env:BR_SKIP_EXEC -ErrorAction SilentlyContinue }
$env:BR_MODULESET = 'prod'
$env:BR_TPFX = 't_collector_'
$env:BR_DEPLOYDIR = $stage
$specDir = "$base\reports_prod"
$results = @()
$specs = Get-ChildItem $specDir -Filter 'br_*.js' | Sort-Object Name
foreach ($sp in $specs) {
  $name = [IO.Path]::GetFileNameWithoutExtension($sp.Name)
  $out = "$base\logs\prod_${name}_out.txt"
  $env:REPORT_SPEC = "reports_prod/$($sp.Name)"
  Write-Host "=== $name -> $out"
  & "$base\run.ps1" "$base\make_api.js" *> $out
  $code = $LASTEXITCODE
  $fail = (Select-String -Path $out -Pattern 'failures=(\d+)').Matches | Select-Object -Last 1 -ExpandProperty Value
  $results += "$name EXIT=$code $fail"
}
$results | Out-File "$base\logs\prod_batch_summary.txt" -Encoding utf8
Write-Host "=== SUMMARY ==="
Get-Content "$base\logs\prod_batch_summary.txt"
"STAGE=$stage"