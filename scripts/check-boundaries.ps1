# check-boundaries.ps1 - ABR-1 dependency-direction check (lightweight static scan, loads no JS)
# Usage: powershell -File scripts\check-boundaries.ps1   ; violations printed + EXIT=1
# Rules (docs/architecture/dependency-rules.md):
#   R1 lib/ must not reference features/ - sole waiver lib/browser.js (ABR-1 compat shim)
#   R2 lib/ir.js must stay zero-runtime-dependency - no Java.type / com.fr.
#   R3 runtime/ must not hold business-report knowledge - no reports/ or BROWSER or laser terms
#   R4 reports*/ must not load backends directly - no load lib/object.js|cpt.js|ir.js
#     (dbpass credential peripheral is NOT a backend)
#   R5 make_api.js must not load migrated Features directly - no features/data_browser
$ErrorActionPreference = 'Stop'
$root = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
$viol = @()

# R1
Get-ChildItem "$root\lib" -Filter '*.js' | Where-Object { $_.Name -ne 'browser.js' } | ForEach-Object {
  if (Select-String -Path $_.FullName -Pattern 'features/|features\\' -Quiet) {
    $viol += "R1 lib/$($_.Name) references features/"
  }
}
# R2
if (Select-String -Path "$root\lib\ir.js" -Pattern 'Java\.type|com\.fr\.' -Quiet) {
  $viol += "R2 lib/ir.js has runtime dependency (Java.type/com.fr.)"
}
# R3
Get-ChildItem "$root\runtime" -Filter '*.js' | ForEach-Object {
  if (Select-String -Path $_.FullName -Pattern 'reports/|BROWSER|laser' -Quiet) {
    $viol += "R3 runtime/$($_.Name) contains business-report knowledge"
  }
}
# R4
Get-ChildItem "$root\reports","$root\reports_prod" -Filter 'br_*.js' | ForEach-Object {
  if (Select-String -Path $_.FullName -Pattern "load\('D:/fineagent/lib/(object|cpt|ir)\.js'\)") {
    $viol += "R4 $($_.Name) loads backend directly"
  }
}
# R5
if (Select-String -Path "$root\make_api.js" -Pattern 'features/data_browser' -Quiet) {
  $viol += "R5 make_api.js loads migrated Feature directly"
}
# R6 runner wiring assertions (added after 2026-11-04 audit, docs/architecture/dependency-rules.md)
# R6a make_api.js must contain Runtime/Paths wiring (the documented call chain is machine-checkable)
foreach ($pat in @("Paths\.runtime\('bootstrap\.js'\)", "Paths\.runtime\('datasource\.js'\)", 'Runtime\.initialize\(\)', 'Paths\.lib\(', 'runtime/paths\.js')) {
  if (-not (Select-String -Path "$root\make_api.js" -Pattern $pat -Quiet)) {
    $viol += "R6a make_api.js missing wiring assertion: $pat"
  }
}
# R6b make_api.js must not inline FR activation chain/connection registration (belongs to runtime/* only)
if (Select-String -Path "$root\make_api.js" -Pattern 'ActivatorToolBox|SimpleWork|DatasourceManager' -Quiet) {
  $viol += "R6b make_api.js inlines activation chain/connection registration that belongs to runtime (ActivatorToolBox/SimpleWork/DatasourceManager)"
}
# R6c make_api.js must not contain load('D:... hardcoded absolute paths (path single-point is runtime/paths.js)
if (Select-String -Path "$root\make_api.js" -Pattern "load\('D:" -Quiet) {
  $viol += "R6c make_api.js has hardcoded absolute load path (use Paths / FR_AGENT_HOME single point)"
}

# R7 semantic-layer boundary (I2, docs/architecture/dependency-rules.md R7): semantic/ independent of Core/Feature/Runtime
#   R7a semantic/** bans com.fr. + the three FR activation-chain terms, and real load( of the three backends
#        (lib/object|ir|cpt) - the semantic layer only depends on java.sql + dbpass + pure JS, so a future report
#        engine swap reuses it whole (r2 I3 intent). runtime/paths.js (pure path helper) and dbpass (credential
#        peripheral) are allowed, not judged.
#        NOTE: the R7a term list deliberately EXCLUDES bare Java.type - the inspector must call
#        Java.type('java.sql.DriverManager'); differing from R2 (which bans Java.type) is intentional, do NOT
#        "unify the term lists" and kill legal code. Reverse deps require a real load( call to avoid matching
#        path names inside comments.
#   R7b semantic core zero-runtime-dependency red line (same term as R2, Java.type): semantic/** except the
#        thin DB shells (inspector.js/inspect_main.js) must not contain Java.type - applies to I2 schema core
#        (metadata/relation/serializer) and I3 model core (vocab/registry/validator/resolver) alike: java.sql
#        only in thin shells, cores only consume pure-JS data passed in (offline-testable + engine-swappable).
$shellFiles = @('inspector.js', 'inspect_main.js')
Get-ChildItem "$root\semantic" -Recurse -Filter '*.js' -ErrorAction SilentlyContinue | ForEach-Object {
  if (Select-String -Path $_.FullName -Pattern 'com\.fr\.|ActivatorToolBox|SimpleWork|DatasourceManager' -Quiet) {
    $viol += "R7a semantic/$($_.Name) has FR dependency (com.fr./activation chain)"
  }
  if (Select-String -Path $_.FullName -Pattern "load\([^)]*lib/(object|cpt|ir)\.js" -Quiet) {
    $viol += "R7a semantic/$($_.Name) really loads one of the three backends"
  }
  if (($shellFiles -notcontains $_.Name) -and (Select-String -Path $_.FullName -Pattern 'Java\.type' -Quiet)) {
    $viol += "R7b semantic/$($_.Name) has Java.type (core zero-runtime-dep red line; thin shells are inspector/inspect_main only)"
  }
}

# R8 controlled-modification layer boundary for existing CPTs (I6, docs/architecture/dependency-rules.md R8):
#   template/ is the FR-facing side path, independent of the generation main chain.
#   R8a make_api.js (the generate runner) must not load template/* - I6 has its own patch_main (runraw); keep
#       the two chains unmixed.
#   R8b template core four (ops/validator/locator/diff) zero Java.type/zero com.fr (pure functions, offline
#       testable, same as R7b); only reader/inspector/patch/patch_main thin shells may touch com.fr
$coreFiles = @('ops.js', 'validator.js', 'locator.js', 'diff.js')
if (Select-String -Path "$root\make_api.js" -Pattern "template/" -Quiet) {
  $viol += "R8a make_api.js references template/ (I6 must stay independent of the generate main chain; use patch_main)"
}
Get-ChildItem "$root\template" -Recurse -Filter '*.js' -ErrorAction SilentlyContinue | ForEach-Object {
  if (($coreFiles -contains $_.Name) -and (Select-String -Path $_.FullName -Pattern 'Java\.type|com\.fr\.' -Quiet)) {
    $viol += "R8b template core/$($_.Name) has Java.type/com.fr. (core pure-function zero-dep red line)"
  }
}

if ($viol.Count -gt 0) {
  Write-Host 'BOUNDARY VIOLATIONS:'
  $viol | ForEach-Object { Write-Host "  $_" }
  exit 1
}
Write-Host 'BOUNDARIES OK (R1-R8 clean)'
exit 0
