# run-engine-negative-tests.ps1 - Engine-gated negative suite. README #54 / r2.md I0-06.
#   Proves the I0 acceptance invariant: NO run that fails yields exit 0, and NO success:true coexists
#   with a nonzero exit. Each fixture feeds one known-bad input through make_api.js and we assert BOTH
#   the process exit code AND the RunResult stages from FR_AGENT_RESULT, so a "looks normal but wrong"
#   product can never pass. Runs the full pipeline (needs FineReport engine + FineDB). Kills java (AGENTS run.ps1).
#   Ends with a default-spec restore so demo_api.cpt keeps its byte baseline (AGENTS 1: last step must be default).
# NOTE: keep this file ASCII-only (PS 5.1 GBK ANSI-read lesson, AGENTS sec.5). Exit 0 = all negative gates held.
$ErrorActionPreference = 'Continue'
$base = 'D:\fineagent'
$fail = 0

# rows: label, spec, env hashtable, expect-exit, expect-failed-stage (or '' if none)
# spec-traverse (B-review-B1, 2026-11-07): REPORT_SPEC pointing OUTSIDE the project root. The escape file
#   is written next to the repo parent (real loadable JS that drops a marker) - an unguarded make_api would
#   EXECUTE it (load() = code execution, probe-verified 2026-11-07); the guarded runner must refuse BEFORE
#   any load (exit 2, input_load failed) and the marker must NOT exist. Temp dir is derived from $base's
#   parent (no new hardcoded path) and removed at the end.
$negTmp = (Split-Path $base -Parent) + '\fa_negtmp'
New-Item -ItemType Directory -Force -Path $negTmp | Out-Null
@'
var F = Java.type('java.nio.file.Files');
var P = Java.type('java.nio.file.Paths');
F.write(P.get('D:/fa_negtmp/marker.txt'), Java.type('java.lang.String').valueOf('ESCAPED').getBytes('UTF-8'));
SPEC = { outName: 'escaped', columns: [{ label: 'a', name: 'a', type: 'text', widthPt: 100 }], data: [['x']] };
'@ | Set-Content -Path "$negTmp\escape.js" -Encoding ASCII
$rows = @(
  @{ n='ir-bad';            spec='verify/neg_ir_full.js';    env=@{};                                            code=9; bad='ir_validate' },
  @{ n='db-conn';           spec='verify/neg_db_conn.js';    env=@{};                                            code=4; bad='datasource_connect' },
  @{ n='secret-leak';       spec='verify/neg_secret_leak.js'; env=@{};                                           code=1; bad='deploy' },
  @{ n='exec-formula';      spec='verify/neg_exec_formula.js'; env=@{};                                          code=1; bad='execute' },
  @{ n='json-bad-spec';     spec='verify/neg_bad_spec.json';  env=@{};                                          code=2; bad='input_load' },
  @{ n='spec-traverse';     spec='../fa_negtmp/escape.js';   env=@{};                                            code=2; bad='input_load'; noMarker="$negTmp\marker.txt" }
)

$script:badrow = 0
function Assert-R($name, $expCode, $badStage, $rc, $json) {
  $script:badrow = 0
  if ($rc -ne $expCode) { Write-Output "NEG GATE FAIL [$name]: exit=$rc expected=$expCode"; $script:badrow = 1; return }
  if ($null -eq $json) { Write-Output "NEG GATE FAIL [$name]: no result JSON (runner crashed before writeRunResult?)"; $script:badrow = 1; return }
  $obj = $json | ConvertFrom-Json
  # invariant: success must be false for any failing run, and json.exit must match the process code
  if ($obj.success -ne $false) { Write-Output "NEG GATE FAIL [$name]: success=$($obj.success) expected false"; $script:badrow = 1; return }
  if ($obj.exit -ne $expCode) { Write-Output "NEG GATE FAIL [$name]: json.exit=$($obj.exit) expected=$expCode"; $script:badrow = 1; return }
  if ($badStage -and ($obj.stages.$badStage -ne 'failed')) { Write-Output "NEG GATE FAIL [$name]: stage $badStage=$($obj.stages.$badStage) expected failed"; $script:badrow = 1; return }
  Write-Output "NEG GATE OK [$name]: exit=$rc failed=$badStage"
}

foreach ($r in $rows) {
  $rf = "$base\logs\_engneg_$($r.n).json"
  if (Test-Path $rf) { Remove-Item $rf -Force }
  if ($r.noMarker -and (Test-Path $r.noMarker)) { Remove-Item $r.noMarker -Force }
  Write-Output ">>> running $($r.n) ..."
  $env:REPORT_SPEC = $r.spec
  $env:FR_AGENT_RESULT = $rf
  & "$base\run.ps1" -Script make_api.js | Out-Null
  $rc = $LASTEXITCODE
  # read the result file AS UTF-8 (PS 5.1 defaults to ANSI/GBK => Chinese diagnostics garble => ConvertFrom-Json chokes; runner itself is fine)
  $json = if (Test-Path $rf) { [System.IO.File]::ReadAllText($rf, [System.Text.Encoding]::UTF8) } else { $null }
  Assert-R $r.n $r.code $r.bad $rc $json
  if ($r.noMarker) {
    if (Test-Path $r.noMarker) { Write-Output "NEG GATE FAIL [$($r.n)]: outside-root marker exists -> unguarded load EXECUTED foreign code"; $script:badrow = 1 }
    else { Write-Output "NEG GATE OK [$($r.n)]: outside-root JS not executed (marker absent)" }
  }
  if ($script:badrow) { $fail = 1 }
  Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue
  Remove-Item env:FR_AGENT_RESULT -ErrorAction SilentlyContinue
  if (Test-Path $rf) { Remove-Item $rf -Force }
}
if (Test-Path $negTmp) { Remove-Item $negTmp -Recurse -Force -ErrorAction SilentlyContinue }   # leave no host residue

# default-spec restore + byte baseline (AGENTS 1: make_api writes only current spec; last step must be default)
& "$base\run.ps1" -Script make_api.js | Out-Null
$rcDefault = $LASTEXITCODE
$cpt = (Get-FileHash "$base\demo_api.cpt" -Algorithm MD5).Hash
if ($rcDefault -ne 0) { Write-Output "RESTORE FAIL: default spec exit=$rcDefault"; $fail = 1 }
if ($cpt -ne 'CBEB42E3CE48E46E362B9AE80168026F') { Write-Output "BASELINE FAIL: demo_api.cpt=$cpt"; $fail = 1 }

if ($fail -eq 0) { Write-Output 'ENGINE NEG GATE GREEN (no false-green; default baseline intact)' }
exit $fail
