# fr_agent.ps1 - stable tool surface for an external AI Agent (r7-B + r10 + r12 + r13 + r14 + r15).
# Verbs: discover | resolve | plan | plan2spec | compile(create) | patch(modify) | validate | preview
# Contract: every verb prints ONE ASCII JSON line {"ok":bool,"runId":"...","result":"logs/agent/runs/<runId>/<verb>.json"};
#   detailed payload (UTF-8) is written into the per-run dir. Exit 0 = verb AND artifact ok; 1 = failure; 2 = usage.
# r15 THIN single-instance executor: the FineReport runtime section is guarded by an OS named Mutex (kernel mutual
#   exclusion). Crash recovery is NOT AbandonedMutexException-based (TerminateProcess here frees the mutex silently);
#   instead runtime.ps1 `enter` inspects a leftover sentinel by PROCESS IDENTITY (confirmed orphan java -> kill exactly
#   it; cannot confirm -> RUNTIME_BUSY refuse). No queue/owner.json/OwnerToken/done records (artifact.json = result truth).
# NOTE: ASCII-only. Paths/policy from config.ps1.
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

$inner = $Verb
if ($Verb -eq 'create') { $inner = 'compile' }
if ($Verb -eq 'modify') { $inner = 'patch' }

if (-not $RunId) { $RunId = [guid]::NewGuid().ToString('N') }
if (-not (Test-RunId $RunId)) { Write-Output '{"ok":false,"error":"-RunId must match ^[A-Za-z0-9_-]{1,64}$"}'; exit 2 }
$runDir = "$agentDir\runs\$RunId"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
$env:FR_AGENT_HOME = $ROOT
$env:AGENT_RUN_ID = $RunId

function Emit([bool]$ok, [string]$resultRel) {
  Write-Output ('{"ok":' + $ok.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"' + $resultRel + '"}')
}
function WriteAtomic([string]$path, [string]$text) {
  $tmp = "$path.tmp"
  [System.IO.File]::WriteAllText($tmp, $text, (New-Object System.Text.UTF8Encoding($false)))
  try { [System.IO.File]::Replace($tmp, $path, $null) } catch { Move-Item -Force $tmp $path }
}
# r15 thin single-instance executor: acquire OS mutex -> leftover-process check (enter) -> claim sentinel -> run body
#   -> release sentinel (always, even on body throw) -> release mutex. Mutual exclusion is kernel-enforced; crash
#   recovery is identity-based inside `enter` (confirmed orphan java killed; unconfirmable -> RUNTIME_BUSY refuse).
#   No OwnerToken / queue / finalize / businessResult records (artifact.json is the result truth). Returns {gained; busy; result}.
function Invoke-UnderMutex([scriptblock]$Body) {
  $mtx = New-Object System.Threading.Mutex($false, $cfg.MutexName)
  $gained = $false; $result = $null; $busy = $false
  try {
    try { $gained = $mtx.WaitOne([TimeSpan]::FromSeconds($cfg.AcquireTimeoutSec)) }
    catch [System.Threading.AbandonedMutexException] { $gained = $true }
    if (-not $gained) { return @{ gained = $false; busy = $false; result = $null } }
    & $runtimePs1 -Action enter -RunId $RunId | Out-Null
    if ($LASTEXITCODE -ne 0) { $busy = $true; return @{ gained = $true; busy = $true; result = $null } }
    & $runtimePs1 -Action claim -RunId $RunId -OwnerPid $PID | Out-Null
    try { $result = & $Body } finally { & $runtimePs1 -Action release -RunId $RunId | Out-Null }
    return @{ gained = $true; busy = $false; result = $result }
  } finally {
    if ($gained) { try { $mtx.ReleaseMutex() } catch { } }
    try { $mtx.Dispose() } catch { }
  }
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
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/validate.json","artifact":"logs/agent/runs/' + $RunId + '/artifact.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'compile' {
    if (-not $Spec) { Write-Output '{"ok":false,"error":"-Spec required"}'; exit 2 }
    $specText = [System.IO.File]::ReadAllText((Join-Path $ROOT $Spec), [System.Text.Encoding]::UTF8)
    $outName = [string]($specText | ConvertFrom-Json).outName
    $body = {
      $env:REPORT_SPEC = $Spec
      $env:FR_AGENT_RESULT = "$runDir\runresult.json"
      $env:RESULT_DUMP = "$runDir\grid.txt"
      $env:FR_AGENT_JAVA_PIDFILE = "$runDir\java.pid"
      $log = "$runDir\compile.log"
      & "$ROOT\run.ps1" -Script make_api.js -Out $log -Heap $cfg.Heap -NoKill | Out-Null
      $rc = $LASTEXITCODE
      Remove-Item env:REPORT_SPEC -ErrorAction SilentlyContinue
      Remove-Item env:FR_AGENT_RESULT -ErrorAction SilentlyContinue
      Remove-Item env:RESULT_DUMP -ErrorAction SilentlyContinue
      Remove-Item env:FR_AGENT_JAVA_PIDFILE -ErrorAction SilentlyContinue
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
      @{ okAll = (($rc -eq 0) -and ($artRc -eq 0)) }
    }
    $r = Invoke-UnderMutex $body
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}'); exit 1 }
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY"}'); exit 1 }
    $okAll = $r.result.okAll
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/compile.json","artifact":"logs/agent/runs/' + $RunId + '/artifact.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'patch' {
    if (-not $Patch) { Write-Output '{"ok":false,"error":"-Patch required"}'; exit 2 }
    $body = {
      $env:TEMPLATE_PATCH = $Patch
      $stagingDir = "$runDir\staging"
      New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null
      $env:TEMPLATE_STAGING = $stagingDir
      $env:FR_AGENT_JAVA_PIDFILE = "$runDir\java.pid"
      $log = "$runDir\patch.log"
      & "$ROOT\runraw.ps1" 'template/patch_main.js' $cfg.Heap *> $log
      $rc = $LASTEXITCODE
      Remove-Item env:TEMPLATE_PATCH -ErrorAction SilentlyContinue
      Remove-Item env:TEMPLATE_STAGING -ErrorAction SilentlyContinue
      Remove-Item env:FR_AGENT_JAVA_PIDFILE -ErrorAction SilentlyContinue
      $manifest = "$stagingDir\manifest.json"
      $mf = $null
      if (Test-Path $manifest) { $mf = [System.IO.File]::ReadAllText($manifest, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
      $obj = [ordered]@{ tool = 'patch'; runId = $RunId; ok = ($rc -eq 0); exit = $rc; patch = $Patch; log = $log; manifestPath = $manifest; stagingDir = $stagingDir; manifest = $mf }
      WriteAtomic "$runDir\patch.json" ($obj | ConvertTo-Json -Depth 8)
      & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\modify_report.js"
      $artRc = $LASTEXITCODE
      @{ okAll = (($rc -eq 0) -and ($artRc -eq 0)) }
    }
    $r = Invoke-UnderMutex $body
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}'); exit 1 }
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY"}'); exit 1 }
    $okAll = $r.result.okAll
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/patch.json","artifact":"logs/agent/runs/' + $RunId + '/artifact.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  default { Write-Output '{"ok":false,"error":"unknown verb"}'; exit 2 }
}
