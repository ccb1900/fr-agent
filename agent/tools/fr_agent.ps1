# fr_agent.ps1 - stable tool surface for an external AI Agent (r7-B + r10 + r12 + r13 + r14).
# Verbs: discover | resolve | plan | plan2spec | compile(create) | patch(modify) | validate | preview
# Contract: every verb prints ONE ASCII JSON line {"ok":bool,"runId":"...","result":"logs/agent/runs/<runId>/<verb>.json"};
#   detailed payload (UTF-8) is written into the per-run dir. Exit 0 = verb AND artifact ok; 1 = failure; 2 = usage.
# r14: the FineReport runtime section is guarded by an OS named Mutex (single-instance serial). Mutual exclusion is
#   kernel-enforced; a crashed holder surfaces as AbandonedMutexException (OS-proven death) -> identity-scoped recovery.
#   Records (owner.json/queue/done/history) are managed by runtime.ps1; the mutex is held HERE across the whole run.
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
$OwnerToken = [guid]::NewGuid().ToString('N')

function Emit([bool]$ok, [string]$resultRel) {
  Write-Output ('{"ok":' + $ok.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"' + $resultRel + '"}')
}
function WriteAtomic([string]$path, [string]$text) {
  $tmp = "$path.tmp"
  [System.IO.File]::WriteAllText($tmp, $text, (New-Object System.Text.UTF8Encoding($false)))
  try { [System.IO.File]::Replace($tmp, $path, $null) } catch { Move-Item -Force $tmp $path }
}
# r14: run the FineReport runtime under the OS named mutex. Mutual exclusion is kernel-enforced (WaitOne).
#   Crash recovery does NOT rely on AbandonedMutexException (TerminateProcess here frees the mutex WITHOUT raising it):
#   after gaining the mutex, we inspect owner.json; if it names a DIFFERENT run whose owner process is PROVEN dead
#   (pid+StartTime identity), that predecessor crashed -> identity-scoped recover-previous. A live predecessor still
#   holds the mutex, so we could not have gained it -> no false reclaim. Returns @{gained; abandoned; result}.
function Invoke-UnderMutex([scriptblock]$Body) {
  $mtx = New-Object System.Threading.Mutex($false, $cfg.MutexName)
  $gained = $false; $abandoned = $false; $result = $null
  try {
    try { $gained = $mtx.WaitOne([TimeSpan]::FromSeconds($cfg.AcquireTimeoutSec)) }
    catch [System.Threading.AbandonedMutexException] { $gained = $true; $abandoned = $true }
    if (-not $gained) { return @{ gained = $false; abandoned = $false; result = $null } }
    # detect a crashed predecessor by owner.json identity (reliable regardless of abandonment semantics)
    $of = "$($cfg.RuntimeDir)\owner.json"
    $prev = $null
    if (Test-Path $of) { try { $prev = Get-Content $of -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $prev = $null } }
    if ($prev -and [string]$prev.runId -ne $RunId) {
      $alive = $false
      try { $pp = [int]$prev.ownerPid; $cur = (Get-Process -Id $pp -ErrorAction Stop).StartTime.Ticks; if (-not ($prev.ownerStart -and [long]$prev.ownerStart -gt 0 -and [long]$prev.ownerStart -ne $cur)) { $alive = $true } } catch { $alive = $false }
      if (-not $alive) { & $runtimePs1 -Action recover-previous | Out-Null }
    }
    $result = & $Body
    return @{ gained = $true; abandoned = $abandoned; result = $result }
  } finally {
    if ($gained) {
      try {
        $ownerNow = $null
        $of2 = "$($cfg.RuntimeDir)\owner.json"
        if (Test-Path $of2) { $ownerNow = (Get-Content $of2 -Raw -Encoding UTF8 | ConvertFrom-Json) }
        if ($ownerNow -and [string]$ownerNow.runId -eq $RunId -and [string]$ownerNow.ownerToken -eq $OwnerToken) {
          & $runtimePs1 -Action finalize -RunId $RunId -OwnerToken $OwnerToken -BusinessResult failed | Out-Null
        }
      } catch { }
      try { $mtx.ReleaseMutex() } catch { }
    }
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
    # 1. atomic RunId claim (CreateNew) - duplicate in-flight runId rejected before touching the mutex
    & $runtimePs1 -Action register -RunId $RunId -Verb compile -OwnerPid $PID -OwnerToken $OwnerToken | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
      Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNID_INFLIGHT_OR_USAGE"}')
      exit 1
    }
    # 2. run the FineReport runtime under the OS mutex (single-instance serial)
    $body = {
      & $runtimePs1 -Action mark-running -RunId $RunId -Verb compile -OwnerPid $PID -OwnerToken $OwnerToken -PipelineTag 'make_api.js' | Out-Null
      $env:REPORT_SPEC = $Spec
      $env:FR_AGENT_RESULT = "$runDir\runresult.json"
      $env:RESULT_DUMP = "$runDir\grid.txt"
      $env:FR_AGENT_JAVA_PIDFILE = "$runDir\java.pid"
      $log = "$runDir\compile.log"
      & "$ROOT\run.ps1" -Script make_api.js -Out $log -NoKill | Out-Null
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
      $okAll = ($rc -eq 0) -and ($artRc -eq 0)
      $biz = $(if ($okAll) { 'succeeded' } else { 'failed' })
      # finalize INSIDE the mutex (owner.json is only touched by the current holder - no cross-run race)
      & $runtimePs1 -Action finalize -RunId $RunId -OwnerToken $OwnerToken -BusinessResult $biz | Out-Null
      @{ okAll = $okAll }
    }
    $r = Invoke-UnderMutex $body
    if (-not $r.gained) {
      & $runtimePs1 -Action unregister -RunId $RunId | Out-Null
      Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
      Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}')
      exit 1
    }
    $okAll = $r.result.okAll
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/compile.json","artifact":"logs/agent/runs/' + $RunId + '/artifact.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'patch' {
    if (-not $Patch) { Write-Output '{"ok":false,"error":"-Patch required"}'; exit 2 }
    & $runtimePs1 -Action register -RunId $RunId -Verb patch -OwnerPid $PID -OwnerToken $OwnerToken | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
      Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNID_INFLIGHT_OR_USAGE"}')
      exit 1
    }
    $body = {
      & $runtimePs1 -Action mark-running -RunId $RunId -Verb patch -OwnerPid $PID -OwnerToken $OwnerToken -PipelineTag 'patch_main.js' | Out-Null
      $env:TEMPLATE_PATCH = $Patch
      $stagingDir = "$runDir\staging"
      New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null
      $env:TEMPLATE_STAGING = $stagingDir
      $env:FR_AGENT_JAVA_PIDFILE = "$runDir\java.pid"
      $log = "$runDir\patch.log"
      & "$ROOT\runraw.ps1" 'template/patch_main.js' *> $log
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
      $okAll = ($rc -eq 0) -and ($artRc -eq 0)
      $biz = $(if ($okAll) { 'succeeded' } else { 'failed' })
      & $runtimePs1 -Action finalize -RunId $RunId -OwnerToken $OwnerToken -BusinessResult $biz | Out-Null
      @{ okAll = $okAll }
    }
    $r = Invoke-UnderMutex $body
    if (-not $r.gained) {
      & $runtimePs1 -Action unregister -RunId $RunId | Out-Null
      Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
      Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}')
      exit 1
    }
    $okAll = $r.result.okAll
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/patch.json","artifact":"logs/agent/runs/' + $RunId + '/artifact.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  default { Write-Output '{"ok":false,"error":"unknown verb"}'; exit 2 }
}
