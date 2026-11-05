# fr_agent.ps1 - stable tool surface for an external AI Agent (r7-B + r10 + r12 + r13).
# Verbs: discover | resolve | plan | plan2spec | compile(create) | patch(modify) | validate | preview
# Contract (r10-A): every verb prints ONE ASCII JSON line {"ok":bool,"runId":"...","result":"logs/agent/runs/<runId>/<verb>.json"};
#   detailed payload (may contain Chinese) is written UTF-8 into the per-run dir logs/agent/runs/<runId>/.
#   Exit codes: 0 = verb AND artifact both ok; 1 = any failure; 2 = usage error.
# r12/r13: compile/patch acquire the global runtime lock (single-instance serial) with an OwnerToken; release verifies it.
# NOTE: keep this file ASCII-only (PS 5.1 GBK ANSI-read lesson, AGENTS sec.5). Paths/policy from config.ps1 (r13 P2-C).
param(
  [Parameter(Mandatory = $true)][ValidateSet('discover', 'resolve', 'plan', 'plan2spec', 'compile', 'create', 'patch', 'modify', 'validate', 'preview')][string]$Verb,
  [string]$Spec = '',
  [string]$Patch = '',
  [string]$Term = '',
  [string]$Png = '',
  [string]$Intent = '',
  [string]$ExpectTotals = '',
  [string]$RunId = ''
)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
$cfg = Get-AgentConfig
$ROOT = $cfg.Root
$FR = $cfg.FrHome
$java = $cfg.Java
$jar = $cfg.NashornJar
$agentDir = $cfg.AgentDir
$runtimePs1 = Join-Path $PSScriptRoot 'runtime.ps1'

# r10-A: per-run identity. Business aliases map create->compile, modify->patch (files keep inner names).
$inner = $Verb
if ($Verb -eq 'create') { $inner = 'compile' }
if ($Verb -eq 'modify') { $inner = 'patch' }

if (-not $RunId) { $RunId = [guid]::NewGuid().ToString('N') }
# r11-4/r13 sec.2: runId charset guard centralized in config.ps1 Test-RunId (path traversal / injection defense)
if (-not (Test-RunId $RunId)) { Write-Output '{"ok":false,"error":"-RunId must match ^[A-Za-z0-9_-]{1,64}$"}'; exit 2 }
$runDir = "$agentDir\runs\$RunId"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
$env:FR_AGENT_HOME = $ROOT
$env:AGENT_RUN_ID = $RunId
# r13: per-invocation owner token (acquire records it, release must present it)
$OwnerToken = [guid]::NewGuid().ToString('N')

function Emit([bool]$ok, [string]$resultRel) {
  Write-Output ('{"ok":' + $ok.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"' + $resultRel + '"}')
}
# r11-3: atomic write helper (temp in same dir -> File.Replace atomic; tmp removed on failure)
function WriteAtomic([string]$path, [string]$text) {
  $tmp = "$path.tmp"
  [System.IO.File]::WriteAllText($tmp, $text, (New-Object System.Text.UTF8Encoding($false)))
  try { [System.IO.File]::Replace($tmp, $path, $null) } catch { Move-Item -Force $tmp $path }
}

switch ($inner) {
  'discover' {
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\discover.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/discover.json"
    exit $rc
  }
  'resolve' {
    if (-not $Term) { Write-Output '{"ok":false,"error":"-Term required"}'; exit 2 }
    $env:AGENT_TERM = $Term
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\resolve.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_TERM -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/resolve.json"
    exit $rc
  }
  'plan' {
    if (-not $Intent) { Write-Output '{"ok":false,"error":"-Intent required (intent JSON file)"}'; exit 2 }
    $env:AGENT_INTENT = $Intent
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\plan.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_INTENT -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/plan.json"
    exit $rc
  }
  'plan2spec' {
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\plan2spec.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/reportSpec.json"
    exit $rc
  }
  'preview' {
    if (-not $Png) { Write-Output '{"ok":false,"error":"-Png required"}'; exit 2 }
    $env:AGENT_PNG = $Png
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\preview.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_PNG -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/preview.json"
    exit $rc
  }
  'validate' {
    $env:AGENT_COMPILE = "$runDir\compile.json"
    if ($ExpectTotals) { $env:AGENT_EXPECT_TOTALS = $ExpectTotals }
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\validate.js"
    $rc = $LASTEXITCODE
    $artRc = 0
    if (Test-Path "$runDir\compile.json") {
      & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\create_report.js"
      $artRc = $LASTEXITCODE
    }
    Remove-Item env:AGENT_COMPILE -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_EXPECT_TOTALS -ErrorAction SilentlyContinue
    $artifactRel = "logs/agent/runs/$RunId/artifact.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/validate.json","artifact":"' + $artifactRel + '"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'compile' {
    if (-not $Spec) { Write-Output '{"ok":false,"error":"-Spec required"}'; exit 2 }
    $specText = [System.IO.File]::ReadAllText((Join-Path $ROOT $Spec), [System.Text.Encoding]::UTF8)
    $specObj = $specText | ConvertFrom-Json
    $outName = [string]$specObj.outName
    # r12/r13: acquire the global runtime lock (single-instance serial); OwnerPid = this live fr_agent process
    & $runtimePs1 -Action acquire -RunId $RunId -Verb compile -OwnerPid $PID -OwnerToken $OwnerToken -PipelineTag 'make_api.js' | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
      Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"ACQUIRE_FAILED"}')
      exit 1
    }
    $env:REPORT_SPEC = $Spec
    $env:FR_AGENT_RESULT = "$runDir\runresult.json"
    $env:RESULT_DUMP = "$runDir\grid.txt"
    $log = "$runDir\compile.log"
    & "$ROOT\run.ps1" -Script make_api.js -Out $log -NoKill | Out-Null
    $rc = $LASTEXITCODE
    Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue
    Remove-Item env:FR_AGENT_RESULT -ErrorAction SilentlyContinue
    Remove-Item env:RESULT_DUMP -ErrorAction SilentlyContinue
    $deploy = $cfg.DeployDir
    $cpt = "$deploy\$outName`_api.cpt"; $png = "$deploy\$outName`_api.png"; $pdf = "$deploy\$outName`_api.pdf"
    $obj = [ordered]@{
      tool = 'compile'; runId = $RunId; ok = ($rc -eq 0); exit = $rc; spec = $Spec; outName = $outName
      runResult = "$runDir\runresult.json"; gridPath = "$runDir\grid.txt"; log = $log
      cptPath = $cpt; pngPath = $png; pdfPath = $pdf
      cptExists = (Test-Path $cpt); pngExists = (Test-Path $png)
    }
    WriteAtomic "$runDir\compile.json" ($obj | ConvertTo-Json -Depth 6)
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\create_report.js"
    $artRc = $LASTEXITCODE
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    # r13: release with the SAME token; businessResult reflects the actual outcome (distinct from execution-right release)
    $biz = $(if ($okAll) { 'succeeded' } else { 'failed' })
    & $runtimePs1 -Action release -RunId $RunId -OwnerToken $OwnerToken -BusinessResult $biz | Out-Null
    $artifactRel = "logs/agent/runs/$RunId/artifact.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/compile.json","artifact":"' + $artifactRel + '"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'patch' {
    if (-not $Patch) { Write-Output '{"ok":false,"error":"-Patch required"}'; exit 2 }
    & $runtimePs1 -Action acquire -RunId $RunId -Verb patch -OwnerPid $PID -OwnerToken $OwnerToken -PipelineTag 'patch_main.js' | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
      Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"ACQUIRE_FAILED"}')
      exit 1
    }
    $env:TEMPLATE_PATCH = $Patch
    $stagingDir = "$runDir\staging"
    New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null
    $env:TEMPLATE_STAGING = $stagingDir
    $log = "$runDir\patch.log"
    & "$ROOT\runraw.ps1" 'template/patch_main.js' *> $log
    $rc = $LASTEXITCODE
    Remove-Item env:TEMPLATE_PATCH -ErrorAction SilentlyContinue
    Remove-Item env:TEMPLATE_STAGING -ErrorAction SilentlyContinue
    $manifest = "$stagingDir\manifest.json"
    $mf = $null
    if (Test-Path $manifest) { $mf = [System.IO.File]::ReadAllText($manifest, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $obj = [ordered]@{ tool = 'patch'; runId = $RunId; ok = ($rc -eq 0); exit = $rc; patch = $Patch; log = $log; manifestPath = $manifest; stagingDir = $stagingDir; manifest = $mf }
    WriteAtomic "$runDir\patch.json" ($obj | ConvertTo-Json -Depth 8)
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\modify_report.js"
    $artRc = $LASTEXITCODE
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    $biz = $(if ($okAll) { 'succeeded' } else { 'failed' })
    & $runtimePs1 -Action release -RunId $RunId -OwnerToken $OwnerToken -BusinessResult $biz | Out-Null
    $artifactRel = "logs/agent/runs/$RunId/artifact.json"
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/patch.json","artifact":"' + $artifactRel + '"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  default { Write-Output '{"ok":false,"error":"unknown verb"}'; exit 2 }
}
