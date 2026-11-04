# fr_agent.ps1 - stable tool surface for an external AI Agent (r7-B).
# Verbs: discover | resolve | compile | patch | validate | preview
# Contract: every verb prints ONE ASCII JSON line {"ok":bool,"result":"logs/agent/<verb>.json"};
#   detailed payload (may contain Chinese) is written UTF-8 to that file.
# NOTE: keep this file ASCII-only (PS 5.1 GBK ANSI-read lesson, AGENTS sec.5).
param(
  [Parameter(Mandatory = $true)][ValidateSet('discover', 'resolve', 'compile', 'patch', 'validate', 'preview')][string]$Verb,
  [string]$Spec = '',
  [string]$Patch = '',
  [string]$Term = '',
  [string]$Png = '',
  [string]$ExpectTotals = ''
)
$ErrorActionPreference = 'Continue'
$ROOT = 'D:\fineagent'
$FR = 'D:\software\FineReport_11.0'
$java = "$FR\jre\bin\java.exe"
$jar = "$FR\jre\lib\ext\nashorn.jar"
$agentDir = "$ROOT\logs\agent"
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
$env:FR_AGENT_HOME = $ROOT

function Emit([bool]$ok, [string]$verb) {
  Write-Output ('{"ok":' + $ok.ToString().ToLower() + ',"result":"logs/agent/' + $verb + '.json"}')
}

switch ($Verb) {
  'discover' {
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\discover.js"
    $rc = $LASTEXITCODE
    exit $rc
  }
  'resolve' {
    if (-not $Term) { Write-Output '{"ok":false,"error":"-Term required"}'; exit 2 }
    $env:AGENT_TERM = $Term
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\resolve.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_TERM -ErrorAction SilentlyContinue
    exit $rc
  }
  'preview' {
    if (-not $Png) { Write-Output '{"ok":false,"error":"-Png required"}'; exit 2 }
    $env:AGENT_PNG = $Png
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\preview.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_PNG -ErrorAction SilentlyContinue
    exit $rc
  }
  'validate' {
    $env:AGENT_COMPILE = "$agentDir\compile.json"
    if ($ExpectTotals) { $env:AGENT_EXPECT_TOTALS = $ExpectTotals }
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\validate.js"
    $rc = $LASTEXITCODE
    # 把本轮验收并入统一产物（仅此时允许读 validate.json，避免陈旧验收）
    if (Test-Path "$agentDir\compile.json") {
      $env:AGENT_WITH_VALIDATION = '1'
      & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\create_report.js" | Out-Null
      Remove-Item env:AGENT_WITH_VALIDATION -ErrorAction SilentlyContinue
    }
    Remove-Item env:AGENT_COMPILE -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_EXPECT_TOTALS -ErrorAction SilentlyContinue
    exit $rc
  }
  'compile' {
    if (-not $Spec) { Write-Output '{"ok":false,"error":"-Spec required"}'; exit 2 }
    $specText = [System.IO.File]::ReadAllText((Join-Path $ROOT $Spec), [System.Text.Encoding]::UTF8)
    $specObj = $specText | ConvertFrom-Json
    $outName = [string]$specObj.outName
    $env:REPORT_SPEC = $Spec
    $env:FR_AGENT_RESULT = "$agentDir\runresult.json"
    $env:RESULT_DUMP = "$agentDir\grid.txt"
    $log = "$agentDir\compile.log"
    & "$ROOT\run.ps1" -Script make_api.js -Out $log | Out-Null
    $rc = $LASTEXITCODE
    Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue
    Remove-Item env:FR_AGENT_RESULT -ErrorAction SilentlyContinue
    Remove-Item env:RESULT_DUMP -ErrorAction SilentlyContinue
    $deploy = "$FR\webapps\webroot\WEB-INF\reportlets\fineagent"
    $cpt = "$deploy\$outName`_api.cpt"; $png = "$deploy\$outName`_api.png"; $pdf = "$deploy\$outName`_api.pdf"
    $obj = [ordered]@{
      tool = 'compile'; ok = ($rc -eq 0); exit = $rc; spec = $Spec; outName = $outName
      runResult = "$agentDir\runresult.json"; gridPath = "$agentDir\grid.txt"; log = $log
      cptPath = $cpt; pngPath = $png; pdfPath = $pdf
      cptExists = (Test-Path $cpt); pngExists = (Test-Path $png)
    }
    [System.IO.File]::WriteAllText("$agentDir\compile.json", ($obj | ConvertTo-Json -Depth 6), [System.Text.Encoding]::UTF8)
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\create_report.js"
    $artRc = $LASTEXITCODE
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"result":"logs/agent/compile.json","artifact":"logs/agent/artifact.json"}')
    exit $rc
  }
  'patch' {
    if (-not $Patch) { Write-Output '{"ok":false,"error":"-Patch required"}'; exit 2 }
    $env:TEMPLATE_PATCH = $Patch
    $log = "$agentDir\patch.log"
    & "$ROOT\runraw.ps1" 'template/patch_main.js' *> $log
    $rc = $LASTEXITCODE
    Remove-Item env:TEMPLATE_PATCH -ErrorAction SilentlyContinue
    $manifest = "$ROOT\logs\template_staging\manifest.json"
    $mf = $null
    if (Test-Path $manifest) { $mf = [System.IO.File]::ReadAllText($manifest, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $obj = [ordered]@{ tool = 'patch'; ok = ($rc -eq 0); exit = $rc; patch = $Patch; log = $log; manifestPath = $manifest; manifest = $mf }
    [System.IO.File]::WriteAllText("$agentDir\patch.json", ($obj | ConvertTo-Json -Depth 8), [System.Text.Encoding]::UTF8)
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\modify_report.js"
    $artRc = $LASTEXITCODE
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"result":"logs/agent/patch.json","artifact":"logs/agent/artifact.json"}')
    exit $rc
  }
  default { Write-Output '{"ok":false,"error":"unknown verb"}'; exit 2 }
}
