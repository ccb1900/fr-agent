# tools_abr_regr.ps1 - post ABR-1 migration regression batch (v2 default + capability self-check four families + default spec close)
$ErrorActionPreference = 'Continue'
$demo = 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\fineagent'
Remove-Item env:BR_MODULESET, env:BR_TPFX, env:BR_DEPLOYDIR, env:BR_SKIP_EXEC, env:REPORT_SPEC -ErrorAction SilentlyContinue

Write-Host '=== v2 default (make_report.js)'
& D:\fineagent\run.ps1 D:\fineagent\make_report.js -Out D:\fineagent\logs\abr1_regr_v2.txt | Out-Null
Write-Host ('V2 demo_template_final.cpt = ' + (Get-FileHash 'D:\fineagent\demo_template_final.cpt' -Algorithm MD5).Hash)

# artifact names on disk are non-ASCII (zh) - build them here to keep this file ASCII-only
function SpecArtifactName([string]$s) {
  $cap = "$([char]0x80FD)$([char]0x529B)$([char]0x81EA)$([char]0x68C0)"   # capability self-check prefix
  switch ($s) {
    'test_widgets'   { return "${cap}_$([char]0x63A7)$([char]0x4EF6)$([char]0x65CF)" }
    'test_cellattrs' { return "${cap}_$([char]0x5355)$([char]0x5143)$([char]0x683C)$([char]0x5C5E)$([char]0x6027)" }
    'test_v41'       { return "${cap}_$([char]0x65CF)$([char]0x4E8C)" }
    'test_vanchart'  { return "${cap}_VanChart" }
    default          { return '' }
  }
}
foreach ($s in 'test_widgets', 'test_cellattrs', 'test_v41', 'test_vanchart') {
  $env:REPORT_SPEC = "reports/$s.js"
  $out = "D:\fineagent\logs\abr1_regr_$s.txt"
  & D:\fineagent\run.ps1 D:\fineagent\make_api.js *> $out
  $fail = (Select-String -Path $out -Pattern 'failures=(\d+)').Matches | Select-Object -Last 1 -ExpandProperty Value
  $name = SpecArtifactName $s
  Write-Host ("SPEC $s EXIT=$LASTEXITCODE $fail -> demo/$name" + "_api.cpt = " + (Get-FileHash "$demo\${name}_api.cpt" -Algorithm MD5).Hash)
}

Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue
Write-Host '=== default spec close (make_api.js)'
& D:\fineagent\run.ps1 D:\fineagent\make_api.js -Out D:\fineagent\logs\abr1_regr_close.txt | Out-Null
Write-Host ('V3 demo_api.cpt = ' + (Get-FileHash 'D:\fineagent\demo_api.cpt' -Algorithm MD5).Hash)
$salePng = "$demo\" + "$([char]0x9500)$([char]0x552E)$([char]0x660E)$([char]0x7EC6)_api.png"
Write-Host ('V3 sales_detail_api.png = ' + (Get-FileHash $salePng -Algorithm MD5).Hash)
