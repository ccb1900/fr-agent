# fr_agent.ps1 - stable tool surface for an external AI Agent (r7-B + r10-A/B/C).
# Verbs: discover | resolve | plan | compile(create) | patch(modify) | validate | preview
# Contract (r10-A): every verb prints ONE ASCII JSON line {"ok":bool,"runId":"...","result":"logs/agent/runs/<runId>/<verb>.json"};
#   detailed payload (may contain Chinese) is written UTF-8 into the per-run dir logs/agent/runs/<runId>/.
#   Per-run isolation: concurrent tasks never share files; artifact.json is written atomically inside the run dir.
#   Exit codes: 0 = verb AND artifact both ok; 1 = any failure; 2 = usage error. (r10 P1 fix: artifact failure can no longer hide behind exit 0.)
# NOTE: keep this file ASCII-only (PS 5.1 GBK ANSI-read lesson, AGENTS sec.5).
param(
  [Parameter(Mandatory = $true)][ValidateSet('discover', 'resolve', 'plan', 'compile', 'create', 'patch', 'modify', 'validate', 'preview')][string]$Verb,
  [string]$Spec = '',
  [string]$Patch = '',
  [string]$Term = '',
  [string]$Png = '',
  [string]$Intent = '',
  [string]$ExpectTotals = '',
  [string]$RunId = ''
)
$ErrorActionPreference = 'Continue'
$ROOT = 'D:\fineagent'
$FR = 'D:\software\FineReport_11.0'
$java = "$FR\jre\bin\java.exe"
$jar = "$FR\jre\lib\ext\nashorn.jar"
$agentDir = "$ROOT\logs\agent"

# r10-A: per-run identity. Business aliases map create->compile, modify->patch (files keep inner names).
$inner = $Verb
if ($Verb -eq 'create') { $inner = 'compile' }
if ($Verb -eq 'modify') { $inner = 'patch' }

if (-not $RunId) {
  $RunId = 'r' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '_' + (Get-Random -Maximum 9000 -Minimum 1000)
}
$runDir = "$agentDir\runs\$RunId"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
$env:FR_AGENT_HOME = $ROOT
$env:AGENT_RUN_ID = $RunId

function Emit([bool]$ok, [string]$resultRel) {
  Write-Output ('{"ok":' + $ok.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"' + $resultRel + '"}')
}

switch ($inner) {
  'discover' {
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\discover.js"
    $rc = $LASTEXITCODE
    $outRel = "logs/agent/runs/$RunId/discover.json"
    $okJson = ($rc -eq 0)
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit $okJson $outRel
    exit $rc
  }
  'resolve' {
    if (-not $Term) { Write-Output '{"ok":false,"error":"-Term required"}'; exit 2 }
    $env:AGENT_TERM = $Term
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\resolve.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_TERM -ErrorAction SilentlyContinue
    $outRel = "logs/agent/runs/$RunId/resolve.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) $outRel
    exit $rc
  }
  'plan' {
    if (-not $Intent) { Write-Output '{"ok":false,"error":"-Intent required (intent JSON file)"}'; exit 2 }
    $env:AGENT_INTENT = $Intent
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\plan.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_INTENT -ErrorAction SilentlyContinue
    $outRel = "logs/agent/runs/$RunId/plan.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    # plan is informational: ready -> ok true; ambiguous/rejected -> ok false (exit 1) with structured result
    Emit ($rc -eq 0) $outRel
    exit $rc
  }
  'preview' {
    if (-not $Png) { Write-Output '{"ok":false,"error":"-Png required"}'; exit 2 }
    $env:AGENT_PNG = $Png
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\preview.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_PNG -ErrorAction SilentlyContinue
    $outRel = "logs/agent/runs/$RunId/preview.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) $outRel
    exit $rc
  }
  'validate' {
    $env:AGENT_COMPILE = "$runDir\compile.json"
    if ($ExpectTotals) { $env:AGENT_EXPECT_TOTALS = $ExpectTotals }
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\validate.js"
    $rc = $LASTEXITCODE
    # Fold this run's acceptance into the unified artifact (only here is reading validate.json allowed;
    #   create_report.js hard-checks validate.json runId == AGENT_RUN_ID - stale acceptance is impossible).
    $artRc = 0
    if (Test-Path "$runDir\compile.json") {
      & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\create_report.js"
      $artRc = $LASTEXITCODE
    }
    Remove-Item env:AGENT_COMPILE -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_EXPECT_TOTALS -ErrorAction SilentlyContinue
    $outRel = "logs/agent/runs/$RunId/validate.json"
    $artifactRel = "logs/agent/runs/$RunId/artifact.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"' + $outRel + '","artifact":"' + $artifactRel + '"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'compile' {
    if (-not $Spec) { Write-Output '{"ok":false,"error":"-Spec required"}'; exit 2 }
    $specText = [System.IO.File]::ReadAllText((Join-Path $ROOT $Spec), [System.Text.Encoding]::UTF8)
    $specObj = $specText | ConvertFrom-Json
    $outName = [string]$specObj.outName
    $env:REPORT_SPEC = $Spec
    $env:FR_AGENT_RESULT = "$runDir\runresult.json"
    $env:RESULT_DUMP = "$runDir\grid.txt"
    $log = "$runDir\compile.log"
    & "$ROOT\run.ps1" -Script make_api.js -Out $log | Out-Null
    $rc = $LASTEXITCODE
    Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue
    Remove-Item env:FR_AGENT_RESULT -ErrorAction SilentlyContinue
    Remove-Item env:RESULT_DUMP -ErrorAction SilentlyContinue
    $deploy = "$FR\webapps\webroot\WEB-INF\reportlets\fineagent"
    $cpt = "$deploy\$outName`_api.cpt"; $png = "$deploy\$outName`_api.png"; $pdf = "$deploy\$outName`_api.pdf"
    $obj = [ordered]@{
      tool = 'compile'; runId = $RunId; ok = ($rc -eq 0); exit = $rc; spec = $Spec; outName = $outName
      runResult = "$runDir\runresult.json"; gridPath = "$runDir\grid.txt"; log = $log
      cptPath = $cpt; pngPath = $png; pdfPath = $pdf
      cptExists = (Test-Path $cpt); pngExists = (Test-Path $png)
    }
    [System.IO.File]::WriteAllText("$runDir\compile.json", ($obj | ConvertTo-Json -Depth 6), [System.Text.Encoding]::UTF8)
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\create_report.js"
    $artRc = $LASTEXITCODE
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    $outRel = "logs/agent/runs/$RunId/compile.json"
    $artifactRel = "logs/agent/runs/$RunId/artifact.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"' + $outRel + '","artifact":"' + $artifactRel + '"}')
    # r10 P1 fix: artifact failure must not return exit 0
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'patch' {
    if (-not $Patch) { Write-Output '{"ok":false,"error":"-Patch required"}'; exit 2 }
    $env:TEMPLATE_PATCH = $Patch
    $log = "$runDir\patch.log"
    & "$ROOT\runraw.ps1" 'template/patch_main.js' *> $log
    $rc = $LASTEXITCODE
    Remove-Item env:TEMPLATE_PATCH -ErrorAction SilentlyContinue
    $manifest = "$ROOT\logs\template_staging\manifest.json"
    $mf = $null
    if (Test-Path $manifest) { $mf = [System.IO.File]::ReadAllText($manifest, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $obj = [ordered]@{ tool = 'patch'; runId = $RunId; ok = ($rc -eq 0); exit = $rc; patch = $Patch; log = $log; manifestPath = $manifest; manifest = $mf }
    [System.IO.File]::WriteAllText("$runDir\patch.json", ($obj | ConvertTo-Json -Depth 8), [System.Text.Encoding]::UTF8)
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\modify_report.js"
    $artRc = $LASTEXITCODE
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    $outRel = "logs/agent/runs/$RunId/patch.json"
    $artifactRel = "logs/agent/runs/$RunId/artifact.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"' + $outRel + '","artifact":"' + $artifactRel + '"}')
    # r10 P1 fix: artifact failure must not return exit 0
    exit $(if ($okAll) { 0 } else { 1 })
  }
  default { Write-Output '{"ok":false,"error":"unknown verb"}'; exit 2 }
}
