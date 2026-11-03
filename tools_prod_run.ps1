# tools_prod_run.ps1 — prod staging 批量构建（报告 spec = reports_prod\br_*.js）
# 语义：BR_MODULESET=prod + BR_TPFX=t_collector_ + BR_DEPLOYDIR=<mkwh staging（动态取名避中文编码坑）>
#       计划内不设 BR_SKIP_EXEC（本机可连 127.0.0.1 atom_live_demo 镜像库，全量执行验证更强）
# 用法：tools_prod_run.ps1 [-SkipExec]  ; 每张一参一行落 logs\prod_<name>_out.txt，EXIT 码汇总
# 注：PS5.1 下 param([switch]) 在本会话绑定不稳（IsPresent 一直空），改用 $args 判定，行为等价。
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