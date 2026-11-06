# fr_agent.ps1 - stable tool surface for an external AI Agent (r7-B + r10 + r12 + r13 + r14 + r15 + r16 + r17).
# Verbs: discover | resolve | plan | plan2spec | compile(create) | patch(modify) | validate | preview
# Contract: every verb prints ONE ASCII JSON line {"ok":bool,"runId":"...","result":"logs/agent/runs/<runId>/<verb>.json"};
#   detailed payload (UTF-8) is written into the per-run dir. Exit 0 = verb AND artifact ok; 1 = failure; 2 = usage.
# r15/r16 THIN single-instance executor: the FineReport runtime section is guarded by an OS named Mutex (kernel mutual
#   exclusion). Crash recovery is NOT AbandonedMutexException-based (a minimal experiment on this host proved
#   TerminateProcess frees the mutex WITHOUT raising it); instead the main flow (Invoke-UnderMutex) inspects a leftover
#   sentinel by PROCESS IDENTITY (confirmed orphan java -> Kill+WaitForExit; cannot confirm -> RUNTIME_BUSY refuse).
#   No queue/owner.json/OwnerToken/done records (artifact.json = result truth). runtime.ps1 is read-only status only.
# r17 boundary hardening (docs/gpt/r17.md), no new infrastructure:
#   P1-1 identity check and Kill use ONE Process object (no PID-reuse race); P1-2 all identity reads are three-state
#   (alive/gone/unknown - unknown => RUNTIME_BUSY refuse, never "gone"); P1-3/P1-4 a java.pid that is pending (host
#   died in the spawn window), corrupt or unreadable is UNKNOWN, never "no JVM"; P1-5 the active sentinel is released
#   only when THIS run's java is confirmed exited (else keep it so the next run refuses/recovers by identity);
#   P2-1 a RunId is registered CREATE-NEW - an explicit duplicate is refused (RUNID_EXISTS), no artifact cross-pollution.
# NOTE: ASCII-only. Paths/policy from config.ps1.
param(
  [Parameter(Mandatory = $true)][ValidateSet('discover', 'resolve', 'plan', 'plan2spec', 'compile', 'create', 'patch', 'modify', 'validate', 'preview', 'list_reports', 'inspect_template', 'sample_data', 'promote', 'restore')][string]$Verb,
  [string]$Spec = '',
  [string]$Patch = '',
  [string]$Term = '',
  [string]$Png = '',
  [string]$Pdf = '',
  [string]$Intent = '',
  [string]$ExpectTotals = '',
  [string]$Target = '',
  [string]$Sample = '',
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

$inner = $Verb
if ($Verb -eq 'create') { $inner = 'compile' }
if ($Verb -eq 'modify') { $inner = 'patch' }
# Phase-2 B-sect: inspect_template runs the same engine runner channel as patch (runraw); promote/restore are
#   engine-mutex file moves over the deployed artifact (no JVM boot).

if (-not $RunId) { $RunId = [guid]::NewGuid().ToString('N') }
if (-not (Test-RunId $RunId)) { Write-Output '{"ok":false,"error":"-RunId must match ^[A-Za-z0-9_-]{1,64}$","nextActions":["omit -RunId to get an auto-generated one"]}'; exit 2 }
$runDir = "$agentDir\runs\$RunId"
# r17 P2-1 -> r22d -> r22e refined RunId registration, judged by THE ENGINE ARTIFACT, not the directory:
#   the cross-pollution site is compile.json/patch.json being overwritten while assembly reads it - so an
#   engine verb refuses ONLY when its OWN engine artifact already exists in the run dir (REAL re-entry).
#   Zero-engine products (plan.json/reportSpec.json) in the same dir are the demo-defined chain handoff
#   (plan->plan2spec->create must share one runId). New-Item without -Force still guards the concurrent
#   first-create window.
$artFile = $null
if ($inner -eq 'compile') { $artFile = "$runDir\compile.json" }
elseif ($inner -eq 'patch') { $artFile = "$runDir\patch.json" }   # zero-engine verbs: artFile stays $null = re-entry allowed
elseif ($Verb -eq 'inspect_template') { $artFile = "$runDir\inspect.json" }   # engine verb: one inspect per RunId (written by the engine script, pass or fail)
elseif ($Verb -eq 'promote') { $artFile = "$runDir\promote.json" }            # deployed-state change: one per RunId
elseif ($Verb -eq 'restore') { $artFile = "$runDir\restore.json" }
if ($artFile -and (Test-Path $artFile)) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '"}'); exit 1 }
if (-not (Test-Path $runDir)) { try { New-Item -ItemType Directory -Path $runDir -ErrorAction Stop | Out-Null } catch { } }
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
# r16 P1#2 + step3 (revised r17): the WHOLE critical section (mutex + leftover-check + kill + active sentinel
#   claim/release + run) lives in the main flow (this function), so recovery can ONLY happen while holding the
#   execution right - there is no standalone dangerous recover/enter action anymore. Mutual exclusion = OS named
#   Mutex (kernel). Crash recovery = leftover-process IDENTITY check, r17 THREE-STATE (docs/gpt/r17.md):
#   - owner alive OR owner identity unknown (access error / corrupt sentinel values) -> RUNTIME_BUSY refuse;
#   - owner gone -> identity-scoped orphan kill: proceed on gone/killed/spared; unknown/stuck -> refuse.
#   - java.pid pending (host died in the spawn window, P1-3) / corrupt / unreadable (P1-4) is UNKNOWN,
#     never "no JVM found" - refuse instead of racing an unidentifiable JVM.
#   create_report/modify_report run OUTSIDE the mutex (they don't touch the engine) to shorten the lock hold
#   (r16 sec.3). Returns @{gained; busy; rc}.
function Invoke-UnderMutex([scriptblock]$RunBody, [string]$DupCheckFile = '') {
  . (Join-Path $PSScriptRoot '_identity.ps1')
  $activeFile = "$($cfg.RuntimeDir)\active.json"
  $histFile = "$($cfg.RuntimeDir)\history.log"
  $mtx = New-Object System.Threading.Mutex($false, $cfg.MutexName)
  $gained = $false; $busy = $false; $rc = $null
  try {
    try { $gained = $mtx.WaitOne([TimeSpan]::FromSeconds($cfg.AcquireTimeoutSec)) }
    catch [System.Threading.AbandonedMutexException] { $gained = $true }
    if (-not $gained) { return @{ gained = $false; busy = $false; rc = $null } }
    # r23 P1: the entry RunId check happens BEFORE WaitOne, so two same-RunId callers can BOTH pass it.
    #   The mutex serializes them and (r22e) the first caller writes its engine artifact BEFORE releasing -
    #   so re-checking the artifact HERE, inside the mutex and before the claim, makes the second caller
    #   refuse deterministically: the same RunId can never run the engine twice. (No lock/queue/token added.)
    if ($DupCheckFile -and (Test-Path $DupCheckFile)) {
      return @{ gained = $true; busy = $false; dup = $true; rc = $null }
    }
    # leftover-process check (only reachable while we hold the mutex)
    # r19 P1: Test-Path false is NOT proof of absence - classify with Get-FilePresence, refuse on unreadable/unknown.
    $pres = Get-FilePresence $activeFile
    if ($pres -eq 'unreadable' -or $pres -eq 'unknown') {
      $busy = $true; return @{ gained = $true; busy = $true; rc = $null }   # cannot confirm -> RUNTIME_BUSY, never claim
    }
    if ($pres -eq 'readable') {
      $a = $null
      try { $t = (Get-Content $activeFile -Raw -Encoding UTF8).TrimStart([char]0xFEFF); if ($t) { $a = $t | ConvertFrom-Json } } catch { $a = $null }
      if (-not $a) { $busy = $true; return @{ gained = $true; busy = $true; rc = $null } }   # corrupt -> fail-closed
      $ownerCls = Classify-Owner ([int]$a.ownerPid) ([long]$a.ownerStart)
      # 'gone' only: definitive verdict. alive = live owner; unknown = cannot confirm (r17 P1-2) -> both refuse.
      if ($ownerCls -ne 'gone') { $busy = $true; return @{ gained = $true; busy = $true; rc = $null } }
      $st = Kill-OrphanJvm $cfg.RunsDir ([string]$a.runId)
      # proceed on gone (nothing registered / exited / recorded pid recycled - the reusing process is never
      #   touched) / killed (verified object killed, exit confirmed).
      #   unknown (pidfile pending/corrupt/unreadable, identity unreadable) or stuck (kill did not take
      #   effect in time) => we cannot confirm the leftover JVM is gone -> REFUSE, never start a 2nd (r17).
      if ($st -ne 'gone' -and $st -ne 'killed' -and $st -ne 'spared') { $busy = $true; return @{ gained = $true; busy = $true; rc = $null } }
      if (Test-Path $cfg.FineDbLck) { Remove-Item $cfg.FineDbLck -Force -ErrorAction SilentlyContinue }
      Add-Content -Path $histFile -Value ((Get-Date).ToString('o') + " RECOVER " + [string]$a.runId) -Encoding ASCII -ErrorAction SilentlyContinue
    }
    # claim sentinel (owner identity = this process; the java identity is registered separately in java.pid by engine_launch)
    $ost = SelfStartTicks
    WriteAtomic $activeFile ((@{ runId = $RunId; ownerPid = $PID; ownerStart = $ost; claimedAt = (Get-Date).ToString('o') } | ConvertTo-Json -Compress))
    Add-Content -Path $histFile -Value ((Get-Date).ToString('o') + " ACQUIRE " + $RunId) -Encoding ASCII -ErrorAction SilentlyContinue
    try { $rc = & $RunBody } finally {
      # r17 P1-5: clear the sentinel ONLY when THIS run's java is confirmed gone (engine_launch waits for exit on the
      #   normal path; an exception in the body may leave the JVM alive). Unconfirmed (alive / pending / corrupt /
      #   unreadable pidfile) -> KEEP the sentinel + history HOLD: the next run then refuses or identity-recovers
      #   instead of seeing "no sentinel -> no leftover" and racing a live JVM.
      $javaGone = Confirm-RunJavaGone $cfg.RunsDir $RunId
      $cur = $null; try { if (Test-Path $activeFile) { $t2 = (Get-Content $activeFile -Raw -Encoding UTF8).TrimStart([char]0xFEFF); if ($t2) { $cur = $t2 | ConvertFrom-Json } } } catch { }
      if ($cur -and [string]$cur.runId -eq $RunId) {
        if ($javaGone) {
          Remove-Item $activeFile -Force -ErrorAction SilentlyContinue
          Add-Content -Path $histFile -Value ((Get-Date).ToString('o') + " RELEASE " + $RunId) -Encoding ASCII -ErrorAction SilentlyContinue
        } else {
          Add-Content -Path $histFile -Value ((Get-Date).ToString('o') + " HOLD " + $RunId) -Encoding ASCII -ErrorAction SilentlyContinue
        }
      }
    }
    return @{ gained = $true; busy = $false; rc = $rc }
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
    if (-not $Term) { Write-Output '{"ok":false,"error":"-Term required","nextActions":["fr_agent.ps1 -Verb resolve -Term <business-term>","run -Verb discover for the model term list"]}'; exit 2 }
    $env:AGENT_TERM = $Term
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\resolve.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_TERM -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/resolve.json"
    exit $rc
  }
  'plan' {
    if (-not $Intent) { Write-Output '{"ok":false,"error":"-Intent required (intent JSON file)","nextActions":["write the intent JSON and pass -Intent <path>","run -Verb discover for model terms and capabilities"]}'; exit 2 }
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
    if (-not $Png -and -not $Pdf) { Write-Output '{"ok":false,"error":"-Png or -Pdf required","nextActions":["pass the cpt/png path to render: -Verb preview -Png <file.png>"]}'; exit 2 }
    $env:AGENT_PNG = $Png
    $env:AGENT_PDF = $Pdf
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\preview.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_PNG -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_PDF -ErrorAction SilentlyContinue
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
    if (-not $Spec) { Write-Output '{"ok":false,"error":"-Spec required","nextActions":["plan chain: -Verb plan -Intent <file> then -Verb plan2spec then -Verb create","or write a ReportSpec JSON and pass -Spec <path>"]}'; exit 2 }
    $specText = [System.IO.File]::ReadAllText((Join-Path $ROOT $Spec), [System.Text.Encoding]::UTF8)
    $outName = [string]($specText | ConvertFrom-Json).outName
    $r = $null
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
      # r22e: artifact assembly moved BACK INSIDE the mutex (r16 sec.3 shortened the hold, but the r22e
      #   registration judged by engine-artifact existence only works if compile.json is complete+visible
      #   BEFORE the mutex releases - a second same-RunId call must see it and refuse, never race the
      #   artifact read across the release point). ~1s nashorn step, no engine lock cost.
      $env:AGENT_RUN_ID = $RunId
      & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\create_report.js" | Out-Null
      $artRc = $LASTEXITCODE
      Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
      @{ rc = $rc; artRc = $artRc }   # both codes; caller surfaces ONE contract line
    }
    $r = Invoke-UnderMutex $body $artFile
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '"}'); exit 1 }   # r23: artifact appeared while we waited -> same RunId already ran
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY"}'); exit 1 }
    $rc = $r.rc.rc; $artRc = $r.rc.artRc
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/compile.json","artifact":"logs/agent/runs/' + $RunId + '/artifact.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'patch' {
    if (-not $Patch) { Write-Output '{"ok":false,"error":"-Patch required","nextActions":["run -Verb inspect_template -Target fineagent/<name>.cpt for real cell coordinates, then -Verb modify -Patch <spec>"]}'; exit 2 }
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
      # r22e: artifact assembly inside the mutex (same rationale as the compile verb - patch.json must be
      #   complete+visible before ReleaseMutex so a second same-RunId modify call refuses instead of racing).
      $env:AGENT_RUN_ID = $RunId
      & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\application\modify_report.js" | Out-Null
      $artRc = $LASTEXITCODE
      Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
      @{ rc = $rc; artRc = $artRc }
    }
    $r = Invoke-UnderMutex $body $artFile
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '"}'); exit 1 }   # r23
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY"}'); exit 1 }
    $rc = $r.rc.rc; $artRc = $r.rc.artRc
    $okAll = ($rc -eq 0) -and ($artRc -eq 0)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/patch.json","artifact":"logs/agent/runs/' + $RunId + '/artifact.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'list_reports' {
    # Phase-2 B-sect: inventory of deployed reports (zero engine, read-only).
    $env:AGENT_DEPLOYDIR = $cfg.DeployDir
    & $java '-cp' $jar 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\list_reports.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_DEPLOYDIR -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/list_reports.json"
    exit $rc
  }
  'sample_data' {
    # Phase-2 B-sect: read-only LIMIT sampling through the model whitelist (zero ENGINE-init; plain JVM +
    # java.sql thin shell). Classpath adds WEB-INF/lib/* so the MSSQL JDBC driver is reachable via
    # DriverManager ServiceLoader (same jar set the engine classpath carries - engine_launch.ps1:21).
    if (-not $Sample) { Write-Output '{"ok":false,"error":"-Sample required (spec JSON file: {entity, columns?, limit?, where?})","nextActions":["entity names come from -Verb discover"]}'; exit 2 }
    $env:AGENT_SAMPLE = $Sample
    $cpSql = "$jar;$FR\webapps\webroot\WEB-INF\lib\*"
    & $java '-cp' $cpSql 'jdk.nashorn.tools.Shell' "$ROOT\agent\tools\sample_data.js"
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_SAMPLE -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/sample.json"
    exit $rc
  }
  'inspect_template' {
    # Phase-2 B-sect: read-only template checkup over the engine (sheet dims + cell texts + dataset/param
    # names) so the external Agent can craft real PatchSpec coordinates. Engine verb (mutex + java.pid).
    if (-not $Target) { Write-Output '{"ok":false,"error":"-Target required (fineagent/<name>.cpt)","nextActions":["run -Verb list_reports first to pick a deployed report"]}'; exit 2 }
    $body = {
      $env:TEMPLATE_TARGET = $Target
      $env:FR_AGENT_JAVA_PIDFILE = "$runDir\java.pid"
      $log = "$runDir\inspect.log"
      & "$ROOT\runraw.ps1" 'template/inspect_main.js' $cfg.Heap *> $log
      $rc = $LASTEXITCODE
      Remove-Item env:TEMPLATE_TARGET -ErrorAction SilentlyContinue
      Remove-Item env:FR_AGENT_JAVA_PIDFILE -ErrorAction SilentlyContinue
      @{ rc = $rc }
    }
    $r = Invoke-UnderMutex $body $artFile
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '"}'); exit 1 }
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY"}'); exit 1 }
    $rc = $r.rc.rc
    $insp = $null
    if (Test-Path "$runDir\inspect.json") { $insp = [System.IO.File]::ReadAllText("$runDir\inspect.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $okAll = ($rc -eq 0) -and ($insp -and $insp.ok)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/inspect.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'promote' {
    # Phase-2 B-sect: deploy a verified patched cpt from this run's staging onto the deployed source
    # (in-place). Fail-closed: manifest must exist and every regression must pass. Engine-mutex (deployed
    # artifact state change; no JVM boot inside the body).
    $body = {
      $rcP = 0
      $err = $null
      try {
        $pj = [System.IO.File]::ReadAllText("$runDir\patch.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if ($pj.ok -ne $true) { throw 'patch.json ok!=true (modify must succeed first)' }
        $mf = $pj.manifest
        if (-not $mf) { throw 'patch.json has no manifest' }
        if ($mf.diffClean -ne $true) { throw ('refusing to promote: diffClean=' + $mf.diffClean) }
        if ($mf.execution -and $mf.execution.pass -ne $true) { throw ('refusing to promote: execution regression failed (' + $mf.execution.reason + ')') }
        if ($mf.render -and $mf.render.pass -ne $true) { throw ('refusing to promote: render regression failed (' + $mf.render.reason + ')') }
        foreach ($dc in @($mf.datasetChecks)) { if ($dc -and $dc.pass -ne $true) { throw ('refusing to promote: dataset regression failed (' + $dc.where + ': ' + $dc.reason + ')') } }
        $staged = $mf.out
        if (-not (Test-Path $staged)) { throw "staged patched cpt missing: $staged" }
        if (-not $pj.patch) { throw 'patch.json missing patch path (source identity)' }
        $patchSpec = [System.IO.File]::ReadAllText((Join-Path $ROOT $pj.patch), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        $srcRel = $patchSpec.sourceCpt
        if ($srcRel -notmatch '^fineagent/[^\\/]+' -or $srcRel -like '*..*') { throw "sourceCpt outside whitelist: $srcRel" }
        $deployed = Join-Path $cfg.DeployDir ($srcRel -replace '^fineagent/', '')
        if (-not (Test-Path $deployed)) { throw "deployed source missing: $deployed" }
        Copy-Item -Force $staged $deployed
        $h1 = (Get-FileHash $staged -Algorithm MD5).Hash
        $h2 = (Get-FileHash $deployed -Algorithm MD5).Hash
        if ($h1 -ne $h2) { throw 'post-copy hash mismatch (deploy failed, deployed artifact left as patched copy - run restore)' }
        $obj = [ordered]@{ tool = 'promote'; runId = $RunId; ok = $true; staged = $staged; deployed = $deployed; bytes = (Get-Item $deployed).Length; md5 = $h1 }
        WriteAtomic "$runDir\promote.json" ($obj | ConvertTo-Json -Depth 4)
      } catch {
        $rcP = 1; $err = $_.Exception.Message
        $obj = [ordered]@{ tool = 'promote'; runId = $RunId; ok = $false; error = $err; nextActions = @('re-run -Verb modify and require ok=true before promote', 'inspect -Verb inspect_template -Target <sourceCpt> for real cell coordinates') }
        WriteAtomic "$runDir\promote.json" ($obj | ConvertTo-Json -Depth 4)
      }
      @{ rc = $rcP }
    }
    $r = Invoke-UnderMutex $body $artFile
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '"}'); exit 1 }
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY"}'); exit 1 }
    $pr = $null
    if (Test-Path "$runDir\promote.json") { $pr = [System.IO.File]::ReadAllText("$runDir\promote.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $okAll = ($r.rc.rc -eq 0) -and ($pr -and $pr.ok)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/promote.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'restore' {
    # Phase-2 B-sect: undo a promote - copy the run's staged .orig.cpt back over the deployed source.
    # Fail-closed: needs this run's patch.json + staging .orig.cpt; hash-verified after copy.
    $body = {
      $rcP = 0
      try {
        $pj = [System.IO.File]::ReadAllText("$runDir\patch.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if (-not $pj.patch) { throw 'patch.json missing patch path (source identity)' }
        $patchSpec = [System.IO.File]::ReadAllText((Join-Path $ROOT $pj.patch), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        $srcRel = $patchSpec.sourceCpt
        if ($srcRel -notmatch '^fineagent/[^\\/]+' -or $srcRel -like '*..*') { throw "sourceCpt outside whitelist: $srcRel" }
        $base = Split-Path -Leaf $srcRel
        $orig = Join-Path $pj.stagingDir ($base -replace '\.cpt$', '.orig.cpt')
        if (-not (Test-Path $orig)) { throw "staged original missing: $orig (modify keeps it automatically)" }
        $deployed = Join-Path $cfg.DeployDir ($srcRel -replace '^fineagent/', '')
        if (-not (Test-Path $deployed)) { throw "deployed source missing: $deployed" }
        Copy-Item -Force $orig $deployed
        $h1 = (Get-FileHash $orig -Algorithm MD5).Hash
        $h2 = (Get-FileHash $deployed -Algorithm MD5).Hash
        if ($h1 -ne $h2) { throw 'post-copy hash mismatch' }
        $obj = [ordered]@{ tool = 'restore'; runId = $RunId; ok = $true; orig = $orig; deployed = $deployed; bytes = (Get-Item $deployed).Length; md5 = $h1 }
        WriteAtomic "$runDir\restore.json" ($obj | ConvertTo-Json -Depth 4)
      } catch {
        $rcP = 1
        $obj = [ordered]@{ tool = 'restore'; runId = $RunId; ok = $false; error = $_.Exception.Message; nextActions = @('restore needs the SAME runId that ran modify (staging .orig.cpt lives per-run)', 'check logs/agent/runs/<runId>/staging for the kept original') }
        WriteAtomic "$runDir\restore.json" ($obj | ConvertTo-Json -Depth 4)
      }
      @{ rc = $rcP }
    }
    $r = Invoke-UnderMutex $body $artFile
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT"}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '"}'); exit 1 }
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY"}'); exit 1 }
    $rs = $null
    if (Test-Path "$runDir\restore.json") { $rs = [System.IO.File]::ReadAllText("$runDir\restore.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $okAll = ($r.rc.rc -eq 0) -and ($rs -and $rs.ok)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/restore.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  default { Write-Output '{"ok":false,"error":"unknown verb","nextActions":["available verbs: discover resolve plan plan2spec create(validate) modify(patch) preview list_reports inspect_template sample_data promote restore"]}'; exit 2 }
}
