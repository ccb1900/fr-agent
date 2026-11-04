# run-fast-tests.ps1 - Fast (offline) verification gate. README #53.
#   Runs pure-JS contract/parse suites that need ONLY nashorn.jar - NO FineReport engine boot,
#   NO FineDB, NO artifact bytes. Matches plan sec.6: engine-free fast tests; catch most problems
#   on any lib change without starting the full engine. Any suite rc!=0 => overall exit 1.
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 as the system ANSI codepage
#   (GBK on zh hosts) without a BOM, so non-ASCII comments can desync the parser (AGENTS sec.5).
$FR = 'D:\software\FineReport_11.0'
$java = "$FR\jre\bin\java.exe"
$jar = "$FR\jre\lib\ext\nashorn.jar"
$suites = @('verify\fast_parse.js', 'verify\fast_ir_contract.js', 'verify\fast_runresult.js', 'verify\fast_browser_sql.js', 'verify\fast_report_spec.js', 'verify\fast_schema.js', 'verify\fast_semantic.js', 'verify\fast_planner.js')
$fail = 0
foreach ($s in $suites) {
  & $java '-cp' $jar 'jdk.nashorn.tools.Shell' $s
  if ($LASTEXITCODE -ne 0) { $fail = 1; Write-Output "FAST SUITE FAIL (rc=$LASTEXITCODE): $s" }
  else { Write-Output "FAST SUITE PASS: $s" }
}
if ($fail -eq 0) { Write-Output 'FAST GATE GREEN (all offline suites passed)' }
exit $fail
