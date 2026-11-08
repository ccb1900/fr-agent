# run-render-regression.ps1 - render-level regression for lib/object*.js changes (2026-11-08).
#   WHY: the default make_api spec (sales_demo) does NOT exercise cells blocks, VanChart kinds or
#   chart decorations. On 2026-11-08 a refactor of lib/object.js passed the default spec, fast gate
#   and MD5 baseline while three real regressions (missing cells cursor advance, dropped decoration
#   guards, lost forEach wrapper) were only caught by reports/test_vanchart.js.
#   This script runs the three render paths that matter and asserts the default byte baseline:
#     1) default spec        -> exit 0 + demo_api.cpt MD5 == baseline
#     2) sales_demo_chart.js -> exit 0 (legacy chart family)
#     3) test_vanchart.js    -> exit 0 (Van chart family + cells blocks + decorations)
#     4) default spec again  -> exit 0 + MD5 == baseline (restores the baseline artifact)
#   run.ps1 stops every java process on this host (pipeline convention): run it when no other JVM matters.
#   Exit 0 = all pass; 1 = any failure. ASCII-only (PS 5.1 reads .ps1 as GBK on zh hosts).
param([string]$Heap = '1200m')
$ErrorActionPreference = 'Continue'

$ROOT = Split-Path -Parent $PSScriptRoot
$runps1 = Join-Path $ROOT 'run.ps1'
$logDir = Join-Path $ROOT 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

$BASELINE = 'CBEB42E3CE48E46E362B9AE80168026F'
$DEMO = Join-Path $ROOT 'demo_api.cpt'
$fail = 0

function Get-DemoMd5 {
  if (-not (Test-Path $DEMO)) { return 'MISSING' }
  return (Get-FileHash -Algorithm MD5 -Path $DEMO).Hash
}

function Run-Spec([string]$spec, [string]$tag) {
  if ($spec) { $env:REPORT_SPEC = $spec } else { Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue }
  $log = Join-Path $logDir ('render_reg_' + $tag + '.out')
  & powershell -NoProfile -ExecutionPolicy Bypass -File $runps1 -Script make_api.js -Heap $Heap *> $log
  $rc = $LASTEXITCODE
  Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue
  $ended = $false
  if (Test-Path $log) {
    $hit = Select-String -Path $log -Pattern 'PIPELINE END, failures=0' -SimpleMatch -ErrorAction SilentlyContinue
    if ($hit) { $ended = $true }
  }
  return @{ rc = $rc; ended = $ended; log = $log }
}

function Check([string]$name, $res, [string]$md5Want) {
  $ok = ($res.rc -eq 0) -and $res.ended
  if ($md5Want) {
    $got = Get-DemoMd5
    if ($got -ne $md5Want) {
      Write-Output ("RENDER FAIL: " + $name + " baseline MD5 " + $got + " != " + $md5Want)
      $script:fail++
      return
    }
  }
  if ($ok) {
    Write-Output ("RENDER PASS: " + $name)
  } else {
    Write-Output ("RENDER FAIL: " + $name + " (rc=" + $res.rc + " pipelineEnd=" + $res.ended + ", log " + $res.log + ")")
    $script:fail++
  }
}

Write-Output 'RENDER REGRESSION: 4 runs (default -> legacy chart -> van chart -> default)'
Check 'default spec + baseline MD5'   (Run-Spec ''                             'default_1') $BASELINE
Check 'legacy chart family'           (Run-Spec 'reports/sales_demo_chart.js'  'legacy_chart') $null
Check 'van chart + cells + deco'      (Run-Spec 'reports/test_vanchart.js'     'van_chart') $null
Check 'default spec restored + MD5'   (Run-Spec ''                             'default_2') $BASELINE

Write-Output ("RENDER END, failures=" + $fail)
exit $(if ($fail -eq 0) { 0 } else { 1 })
