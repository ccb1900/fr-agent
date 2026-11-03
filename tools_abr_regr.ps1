# tools_abr_regr.ps1 — ABR-1 迁移后回归批（v2 默认 + 能力自检四族 + 默认 spec 收尾）
$ErrorActionPreference = 'Continue'
$demo = 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\fineagent'
Remove-Item env:BR_MODULESET, env:BR_TPFX, env:BR_DEPLOYDIR, env:BR_SKIP_EXEC, env:REPORT_SPEC -ErrorAction SilentlyContinue

Write-Host '=== v2 default (make_report.js)'
& D:\fineagent\run.ps1 D:\fineagent\make_report.js -Out D:\fineagent\logs\abr1_regr_v2.txt | Out-Null
Write-Host ('V2 demo_template_final.cpt = ' + (Get-FileHash 'D:\fineagent\demo_template_final.cpt' -Algorithm MD5).Hash)

foreach ($s in 'test_widgets', 'test_cellattrs', 'test_v41', 'test_vanchart') {
  $env:REPORT_SPEC = "reports/$s.js"
  $out = "D:\fineagent\logs\abr1_regr_$s.txt"
  & D:\fineagent\run.ps1 D:\fineagent\make_api.js *> $out
  $fail = (Select-String -Path $out -Pattern 'failures=(\d+)').Matches | Select-Object -Last 1 -ExpandProperty Value
  $name = & { switch ($s) {
    'test_widgets'    { '能力自检_控件族' }
    'test_cellattrs'  { '能力自检_单元格属性' }
    'test_v41'        { '能力自检_族二' }
    'test_vanchart'   { '能力自检_VanChart' }
    default           { '' }
  } }
  Write-Host ("SPEC $s EXIT=$LASTEXITCODE $fail -> demo/" + $name + "_api.cpt = " + (Get-FileHash "$demo\${name}_api.cpt" -Algorithm MD5).Hash)
}

Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue
Write-Host '=== default spec close (make_api.js)'
& D:\fineagent\run.ps1 D:\fineagent\make_api.js -Out D:\fineagent\logs\abr1_regr_close.txt | Out-Null
Write-Host ('V3 demo_api.cpt = ' + (Get-FileHash 'D:\fineagent\demo_api.cpt' -Algorithm MD5).Hash)
Write-Host ('V3 销售明细_api.png = ' + (Get-FileHash "$demo\销售明细_api.png" -Algorithm MD5).Hash)
