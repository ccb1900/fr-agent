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
  [Parameter(Mandatory = $true)][ValidateSet('discover', 'resolve', 'plan', 'plan2spec', 'compile', 'create', 'patch', 'modify', 'validate', 'preview', 'list_reports', 'inspect_template', 'sample_data', 'promote', 'restore', 'assets')][string]$Verb,
  [ValidateSet('list', 'inspect', 'create', 'validate', 'publish')][string]$Action = 'list',
  [string]$Spec = '',
  [string]$Patch = '',
  [string]$Term = '',
  [string]$Png = '',
  [string]$Pdf = '',
  [string]$Intent = '',
  [string]$ExpectTotals = '',
  [string]$Target = '',
  [string]$Sample = '',
  [string]$Doc = '',
  [string]$RunId = ''
)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
. (Join-Path $PSScriptRoot '_deploy.ps1')   # Phase-3: Get-FileSha256 + Replace-FileAtomic (promote/restore deploy-safety)
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
elseif ($Verb -eq 'promote') { $artFile = "$runDir\promote.json" }            # deployed-state change: one COMMIT per RunId
elseif ($Verb -eq 'restore') { $artFile = "$runDir\restore.json" }
# P1-2b (backlog P1x2 fix 2): a deploy verb's RunId registration is claimed by a COMMITTED artifact
#   only. promote.json/restore.json with ok=false is the EXPLICIT UNFINISHED state the failure catch
#   writes - an existence-only refusal here deadlocked BOTH the same-RunId retry and restore after a
#   post-swap failure (the deployed file already carried new bytes with no tool path to commit or
#   undo). Re-entry re-runs the full guard chain; the deploy-state log + the ACTUAL deployed SHA-256
#   decide the outcome (complete the commit / undo the uncommitted swap / refuse again). Engine verbs
#   keep existence-only registration (the r22e cross-pollination guard, unchanged).
function Test-ArtifactCommitted([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  try { $o = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json } catch { return $true }   # unreadable: cannot confirm unfinished -> fail-closed
  if (-not $o) { return $true }
  return ($o.ok -eq $true)
}
if ($artFile -and (Test-Path $artFile)) {
  $regTaken = $true
  if (($Verb -eq 'promote' -or $Verb -eq 'restore') -and -not (Test-ArtifactCommitted $artFile)) { $regTaken = $false }
  if ($regTaken) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '","nextActions":["this RunId already has a committed artifact; use a new RunId for a new report, or run -Verb restore with this RunId to undo the existing one"]}'); exit 1 }
}
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
function Invoke-UnderMutex([scriptblock]$RunBody, [string]$DupCheckFile = '', [bool]$DupCheckCommittedOnly = $false) {
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
    #   P1-2b: deploy verbs pass DupCheckCommittedOnly - an ok=false artifact is the unfinished state the
    #   failure catch wrote, so the waiting caller re-enters instead of deadlocking (same rule as the door).
    if ($DupCheckFile -and (Test-Path $DupCheckFile)) {
      $isDup = $true
      if ($DupCheckCommittedOnly -and -not (Test-ArtifactCommitted $DupCheckFile)) { $isDup = $false }
      if ($isDup) { return @{ gained = $true; busy = $false; dup = $true; rc = $null } }
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
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT","nextActions":["wait and retry: the runtime mutex queue timed out (another run holds the FineReport engine)"]}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '","nextActions":["this RunId already has a committed artifact; use a new RunId for a new report, or run -Verb restore with this RunId to undo the existing one"]}'); exit 1 }   # r23: artifact appeared while we waited -> same RunId already ran
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY","nextActions":["another FineReport JVM holds the runtime mutex; wait for it to exit or stop it, then retry"]}'); exit 1 }
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
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT","nextActions":["wait and retry: the runtime mutex queue timed out (another run holds the FineReport engine)"]}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '","nextActions":["this RunId already has a committed artifact; use a new RunId for a new report, or run -Verb restore with this RunId to undo the existing one"]}'); exit 1 }   # r23
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY","nextActions":["another FineReport JVM holds the runtime mutex; wait for it to exit or stop it, then retry"]}'); exit 1 }
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
  'assets' {
    # D2 Dataset asset management. Zero engine, no FineReport mutex: pure file reads/writes
    #   over models/*/datasets + pure DatasetDef/DatasetRegistry/SqlBuilder functions.
    #   validate needs JDBC (same as sample_data: plain JVM + WEB-INF/lib driver + dbpass).
    $cpAssets = $jar; $cpNote = ''
    if ($Action -eq 'validate') { $cpAssets = "$jar;$FR\webapps\webroot\WEB-INF\lib\*"; $cpNote = ' (SQL classpath)' }
    $env:AGENT_ASSETS_ACTION = $Action
    if ($Target) { $env:AGENT_ASSETS_ID = $Target }
    if ($Action -eq 'create') {
      if (-not $Doc) { Write-Output '{"ok":false,"error":"-Doc required for assets -Action create (path to an asset JSON file)","nextActions":["write the asset JSON per docs/architecture/dataset-contract.md","fr_agent.ps1 -Verb assets -Action create -Doc <file>"]}'; Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue; exit 2 }
      $env:AGENT_ASSETS_DOC = $Doc
    }
    & $java '-cp' $cpAssets 'jdk.nashorn.tools.Shell' ($ROOT + '/agent/tools/assets.js')
    $rc = $LASTEXITCODE
    Remove-Item env:AGENT_ASSETS_ACTION -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_ASSETS_ID -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_ASSETS_DOC -ErrorAction SilentlyContinue
    Remove-Item env:AGENT_RUN_ID -ErrorAction SilentlyContinue
    Emit ($rc -eq 0) "logs/agent/runs/$RunId/assets.json"
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
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT","nextActions":["wait and retry: the runtime mutex queue timed out (another run holds the FineReport engine)"]}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '","nextActions":["this RunId already has a committed artifact; use a new RunId for a new report, or run -Verb restore with this RunId to undo the existing one"]}'); exit 1 }
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY","nextActions":["another FineReport JVM holds the runtime mutex; wait for it to exit or stop it, then retry"]}'); exit 1 }
    $rc = $r.rc.rc
    $insp = $null
    if (Test-Path "$runDir\inspect.json") { $insp = [System.IO.File]::ReadAllText("$runDir\inspect.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $okAll = ($rc -eq 0) -and ($insp -and $insp.ok)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/inspect.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'promote' {
    # Phase-3 spec A: deploy a verified patched cpt from this run's staging onto the deployed source.
    # Fail-closed chain (missing = refuse, never skip): patch.json ok==true -> manifest -> diffClean strictly
    # true -> execution/render blocks PRESENT and pass==true -> datasetChecks PRESENT, every entry pass==true
    # (count >= datasetOps when the patch carried dataset ops) -> stagingDir BOUND to this RunId
    # (STAGING_RUNID_MISMATCH) -> staged file exists INSIDE that staging dir -> disk manifest.json FULLY
    # agrees with the embedded manifest on every decisive verdict field (MANIFEST_MISMATCH) -> sourceCpt three-way
    # consistent (patch.json->PatchSpec vs manifest, whitelist) -> deployed file exists -> SHA-256(deployed)
    # == manifest.sourceHash (else SOURCE_CHANGED: deployed artifact changed since modify) -> staged
    # .orig.cpt present and matching sourceHash (staging grounds for restore) -> ATOMIC swap (same-volume
    # temp + File.Replace, original preserved on failure) -> post-swap SHA-256 verify -> promote.json records
    # sourceHash/origHash/deployedHash/promotedHash (restore's guard chain). Engine-mutex (deployed-state
    # change; no JVM boot inside the body).
    $body = {
      $rcP = 0
      $deployedHashNow = $null
      $swapDone = $false      # P1-2a: catch records FAILED_BEFORE_SWAP vs FAILED_AFTER_SWAP by this flag
      $recovered = $false
      try {
        if (-not (Test-Path "$runDir\patch.json")) { throw 'PROMOTE_NO_PATCH: patch.json missing (run -Verb modify first)' }
        $pj = [System.IO.File]::ReadAllText("$runDir\patch.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if ($pj.ok -ne $true) { throw 'patch.json ok!=true (modify must succeed first)' }
        $mf = $pj.manifest
        if (-not $mf) { throw 'patch.json has no manifest' }
        if ($mf.diffClean -ne $true) { throw ('refusing to promote: diffClean=' + $mf.diffClean) }
        if (-not $mf.execution) { throw 'refusing to promote: execution regression MISSING (fail-closed)' }
        if ($mf.execution.pass -ne $true) { throw ('refusing to promote: execution regression failed (' + $mf.execution.reason + ')') }
        if (-not $mf.render) { throw 'refusing to promote: render regression MISSING (fail-closed)' }
        if ($mf.render.pass -ne $true) { throw ('refusing to promote: render regression failed (' + $mf.render.reason + ')') }
        if ($null -eq $mf.datasetChecks) { throw 'refusing to promote: datasetChecks MISSING (fail-closed)' }
        $dcs = @($mf.datasetChecks)
        if ($mf.datasetOps -and ($mf.datasetOps -gt 0) -and ($dcs.Count -lt $mf.datasetOps)) { throw ('refusing to promote: datasetChecks count ' + $dcs.Count + ' < datasetOps ' + $mf.datasetOps + ' (fail-closed)') }
        foreach ($dc in $dcs) { if (-not $dc -or ($dc.pass -ne $true)) { throw ('refusing to promote: dataset regression failed (' + $dc.where + ': ' + $dc.reason + ')') } }
        $staged = $mf.out
        if (-not $staged) { throw 'manifest missing out (staged file path)' }
        if (-not $pj.stagingDir) { throw 'patch.json missing stagingDir' }
        # 3.1-2 (stage3 final check S2): staging is BOUND to this RunId. patch.json.stagingDir must BE this
        #   run's canonical staging dir ($agentDir\runs\<RunId>\staging) - the previous check only verified
        #   that the staged file lives INSIDE the self-declared dir, so a stagingDir pointing at ANOTHER
        #   RunId's staging with self-consistent content slipped through (exit=0 penetration proven on the
        #   baseline). Bind before any staged file is read; GetFullPath + case-insensitive compare.
        $stgExpected = [System.IO.Path]::GetFullPath("$runDir\staging")
        $stgFull = [System.IO.Path]::GetFullPath([string]$pj.stagingDir)
        if (-not $stgFull.TrimEnd('\').Equals($stgExpected.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase)) { throw ('refusing to promote: STAGING_RUNID_MISMATCH: patch.json.stagingDir "' + $pj.stagingDir + '" is not this RunId staging dir "' + $stgExpected + '" (staging is bound to the RunId; re-run -Verb modify with this RunId)') }
        if (-not (Test-Path $staged -PathType Leaf)) { throw "staged patched cpt missing: $staged" }
        $stagedFull = [System.IO.Path]::GetFullPath($staged)
        $stgFull = [System.IO.Path]::GetFullPath($pj.stagingDir)
        if (-not $stgFull.EndsWith('\')) { $stgFull += '\' }
        if (-not $stagedFull.StartsWith($stgFull, [System.StringComparison]::OrdinalIgnoreCase)) { throw "refusing to promote: staged file outside this run's staging dir: $staged" }
        if (-not $stagedFull.EndsWith('.cpt', [System.StringComparison]::OrdinalIgnoreCase)) { throw "refusing to promote: staged file is not a .cpt: $staged" }
        # disk manifest.json must agree with the manifest embedded in patch.json (tamper/swap guard)
        $mfDiskPath = Join-Path $pj.stagingDir 'manifest.json'
        if (-not (Test-Path $mfDiskPath -PathType Leaf)) { throw "refusing to promote: staging manifest.json missing: $mfDiskPath" }
        $mfDisk = [System.IO.File]::ReadAllText($mfDiskPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if (-not $mfDisk) { throw 'refusing to promote: staging manifest.json unreadable (fail-closed)' }
        # 3.1-1 (stage3 final check S1): FULL verdict comparison, not the old 4-field compare. The verdict
        #   guards above judge the EMBEDDED copy; a tampered embedded execution/render/datasetChecks beside
        #   a refusing disk manifest promoted a patch the run itself had rejected (exit=0 penetration proven
        #   on the baseline). Every decisive verdict field must now agree - Compare-ManifestVerdict in
        #   _deploy.ps1 returns the mismatching field names ('' = agree).
        $mismFields = Compare-ManifestVerdict $mf $mfDisk
        if ($mismFields -ne '') { throw ('refusing to promote: MANIFEST_MISMATCH: staging manifest.json disagrees with patch.json manifest on [' + $mismFields + '] (fail-closed: verdict evidence must be identical on disk and in the patch artifact)') }
        if (-not $pj.patch) { throw 'patch.json missing patch path (source identity)' }
        $patchSpec = [System.IO.File]::ReadAllText((Join-Path $ROOT $pj.patch), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        $srcRel = $patchSpec.sourceCpt
        if (-not $srcRel) { throw 'refusing to promote: PatchSpec missing sourceCpt' }
        if ($srcRel -notmatch '^fineagent/[^\\/]+' -or $srcRel -like '*..*') { throw "sourceCpt outside whitelist: $srcRel" }
        if (-not $mf.sourceCpt) { throw 'refusing to promote: manifest missing sourceCpt (fail-closed)' }
        if ([string]$mf.sourceCpt -ne [string]$srcRel) { throw "refusing to promote: sourceCpt mismatch (patch.json/PatchSpec '$srcRel' vs manifest '$($mf.sourceCpt)')" }
        $deployed = Join-Path $cfg.DeployDir ($srcRel -replace '^fineagent/', '')
        if (-not (Test-Path $deployed -PathType Leaf)) { throw "deployed source missing: $deployed" }
        # staging grounds for restore + swap identity, hashed BEFORE the deployed-state branch so the 3.1-3
        #   recovery can compare the ACTUAL deployed hash against the intended swap without re-derivation
        $origPath = Join-Path $pj.stagingDir ((Split-Path -Leaf $srcRel) -replace '\.cpt$', '.orig.cpt')
        if (-not (Test-Path $origPath -PathType Leaf)) { throw "staged original missing: $origPath (modify keeps it automatically)" }
        # version guard PRESENCE first: without a modify-time sourceHash every hash comparison below is
        #   meaningless (P11 fail-closed order), and the deployed-vs-sourceHash COMPARISON stays in the
        #   deployed-state branch together with the 3.1-3 recovery.
        if (-not $mf.sourceHash) { throw 'refusing to promote: SOURCE_HASH_MISSING (manifest carries no modify-time hash; re-run -Verb modify)' }
        $origHash = Get-FileSha256 $origPath
        if (-not $origHash) { throw "refusing to promote: cannot read staged original: $origPath" }
        if ($origHash -ne [string]$mf.sourceHash) { throw 'refusing to promote: staged .orig.cpt hash != modify-time sourceHash (staging original tampered/mismatched)' }
        $stagedHash = Get-FileSha256 $staged
        if (-not $stagedHash) { throw "refusing to promote: cannot read staged patched file: $staged" }
        $deployedHashNow = Get-FileSha256 $deployed
        if (-not $deployedHashNow) { throw "refusing to promote: cannot read deployed file for hashing: $deployed" }
        # 3.1-3 (stage3 final check S3) crash-window recovery: PREPARED is logged before the swap, COMMITTED
        #   after the hash-verified swap. A promote that died between Replace-FileAtomic and the promote.json
        #   commit left deployed == staged bytes with NO commit record; the retry used to deadlock on
        #   SOURCE_CHANGED. Now the retry recognizes that state by hash identity against the PREPARED record
        #   (stagedHash + sourceHash both matching) and COMPLETES the commit (never re-swaps). Without the
        #   PREPARED evidence the same byte state is still refused (fail-closed).
        if ($deployedHashNow -ne [string]$mf.sourceHash) {
          if ($deployedHashNow -eq $stagedHash) {
            $dsLog = Get-DeployStateEvents $runDir
            if ($dsLog.Error) { throw ('DEPLOY_LOG_UNTRUSTED: ' + $dsLog.Error + ' (crash recovery needs a trustworthy deploy log; refusing)') }
            foreach ($ev in $dsLog.Events) {
              if ([string]$ev.event -eq 'PREPARED' -and [string]$ev.verb -eq 'promote' -and ([string]$ev.stagedHash -eq [string]$stagedHash) -and ([string]$ev.sourceHash -eq [string]$mf.sourceHash)) { $recovered = $true }
            }
            if (-not $recovered) { throw ('SOURCE_CHANGED: deployed file hash ' + $deployedHashNow.Substring(0, 12) + '.. equals this run staged bytes but no PREPARED record exists for this RunId (not a recognizable uncommitted promote); refusing to overwrite') }
          } else {
            throw ('SOURCE_CHANGED: deployed file hash ' + $deployedHashNow.Substring(0, 12) + '.. != modify-time sourceHash ' + ([string]$mf.sourceHash).Substring(0, 12) + '.. (deployed artifact changed since modify; re-run modify on the current deployed state; refusing to overwrite)')
          }
        }
        if ($recovered) {
          # crash window / lost commit record: the swap already happened (deployed bytes == staged bytes,
          #   PREPARED on record) but the commit record (promote.json) was lost or left ok=false -> complete
          #   the commit from verified on-disk state. Never re-swaps.
          Add-DeployStateEvent $runDir @{ event = 'COMMITTED'; verb = 'promote'; runId = $RunId; promotedHash = $deployedHashNow; recovered = 1 }
          $deployedHash = $deployedHashNow
        } else {
          # P1-2a: PREPARED is transactional - a write failure THROWS here, so promote terminates BEFORE the
          #   swap and the deployed file is never touched without its recovery evidence on record.
          Add-DeployStateEvent $runDir @{ event = 'PREPARED'; verb = 'promote'; runId = $RunId; sourceHash = [string]$mf.sourceHash; origHash = $origHash; deployedBeforeHash = $deployedHashNow; stagedHash = $stagedHash }
          # ATOMIC deploy: same-volume temp + File.Replace; on ANY failure the deployed file is left untouched
          Replace-FileAtomic $staged $deployed | Out-Null
          $swapDone = $true
          Add-DeployStateEvent $runDir @{ event = 'SWAPPED'; verb = 'promote'; runId = $RunId; stagedHash = $stagedHash }
          $deployedHash = Get-FileSha256 $deployed
          if (-not $deployedHash) { throw 'post-replace hash mismatch: cannot hash the deployed file after the swap' }
          if ($deployedHash -ne $stagedHash) { throw 'post-replace hash mismatch (deployed artifact may be corrupted; run restore with this runId)' }
          # P1-2a: a COMMITTED write failure also throws -> the catch leaves the explicit ok=false unfinished
          #   state (deployed already carries the verified staged bytes); the same-RunId retry completes the
          #   commit from the PREPARED record + actual hash (the recovered branch above).
          Add-DeployStateEvent $runDir @{ event = 'COMMITTED'; verb = 'promote'; runId = $RunId; promotedHash = $deployedHash }
        }
        $obj = [ordered]@{ tool = 'promote'; runId = $RunId; ok = $true; recovered = $recovered; staged = $staged; deployed = $deployed; orig = $origPath; bytes = (Get-Item $deployed).Length; md5 = (Get-FileHash $deployed -Algorithm MD5).Hash
          sourceHash = [string]$mf.sourceHash; origHash = $origHash; deployedHash = $deployedHash; promotedHash = $deployedHash; deployedBeforeHash = $deployedHashNow; promoteAt = (Get-Date).ToString('o')
          concurrencyBoundary = 'single-writer deploy window: promote/restore hold the agent runtime named mutex across the whole guard+swap sequence (check-then-act: every hash guard runs inside the mutex immediately before File.Replace); a crashed or commit-lost swap is recovered by hash identity against the PREPARED/SWAPPED/COMMITTED deploy log, never re-swapped blindly; recovery covers process crash (killed host), not power loss (the deploy-state log and commit artifacts are OS-buffered, not fsynced)'; mutex = $cfg.MutexName }
        WriteAtomic "$runDir\promote.json" ($obj | ConvertTo-Json -Depth 4)
      } catch {
        $rcP = 1
        $err = '' + $_.Exception.Message
        # P1-2a: record which side of the swap the failure landed on. Best-effort: the authoritative
        #   diagnosis is the promote.json ok=false below - a failed diagnostic write here must not mask it.
        try {
          Add-DeployStateEvent $runDir @{ event = $(if ($swapDone -or $recovered) { 'FAILED_AFTER_SWAP' } else { 'FAILED_BEFORE_SWAP' }); verb = 'promote'; runId = $RunId; error = $err; deployedHashAtFail = $deployedHashNow }
        } catch { }
        $obj = [ordered]@{ tool = 'promote'; runId = $RunId; ok = $false; error = $err; deployedHashAtFail = $deployedHashNow
          nextActions = @('same-RunId retry: re-run -Verb promote with this RunId - a deployed file already carrying this run''s staged bytes with the PREPARED record present completes the commit; a not-swapped deployed file re-runs the full guard chain; anything else refuses with the actual deployed hash', 'or run -Verb restore with this RunId to undo this run''s uncommitted swapped promote (staged original back over the staged bytes)', 'or re-run -Verb modify (new RunId) on the current deployed state and require ok=true before promote', 'inspect -Verb inspect_template -Target <sourceCpt> for real cell coordinates') }
        WriteAtomic "$runDir\promote.json" ($obj | ConvertTo-Json -Depth 4)
      }
      @{ rc = $rcP }
    }
    $r = Invoke-UnderMutex $body $artFile $true
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT","nextActions":["wait and retry: the runtime mutex queue timed out (another run holds the FineReport engine)"]}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '","nextActions":["this RunId already has a committed artifact; use a new RunId for a new report, or run -Verb restore with this RunId to undo the existing one"]}'); exit 1 }
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY","nextActions":["another FineReport JVM holds the runtime mutex; wait for it to exit or stop it, then retry"]}'); exit 1 }
    $pr = $null
    if (Test-Path "$runDir\promote.json") { $pr = [System.IO.File]::ReadAllText("$runDir\promote.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $okAll = ($r.rc.rc -eq 0) -and ($pr -and $pr.ok)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/promote.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  'restore' {
    # Phase-3 spec B: undo a promote - put this run's staged .orig.cpt back over the deployed source.
    # Fail-closed chain: patch.json PRESENT (RESTORE_NO_PATCH) -> the promote STATE judged by the
    # deploy-state record + the actual deployed hash (P1-2b, not just promote.json existence/ok):
    #   a committed promote (ok=true with deployedHash+origHash) is undone by its recorded hash chain;
    #   an ok=false promote is undone ONLY as the recognizable swapped-uncommitted state (a PREPARED
    #   promote record matching the patch manifest sourceHash - the deployed file then carries this
    #   run's staged bytes); any other ok=false state refuses (RESTORE_NO_PROMOTE), so does an
    #   unreadable promote.json (RESTORE_NO_PROMOTE: cannot confirm what was committed)
    # -> stagingDir BOUND to this RunId (STAGING_RUNID_MISMATCH)
    # -> staged .orig.cpt present and hash-equal to the expected orig hash (STAGING_ORIG_CHANGED)
    # -> deployed file present and hash-equal to the expected deployed hash (else DEPLOYED_CHANGED: the
    # deployed artifact changed - restoring would clobber it; a PREPARED-backed "already swapped"
    # state completes the commit instead, 3.1-3 recovery) -> ATOMIC swap (original
    # preserved on failure) -> post-swap SHA-256 verify vs the original -> restore.json records the hash
    # chain. A refusal NEVER touches the deployed file (guards all run before the swap).
    $body = {
      $rcP = 0
      $deployedHashNow = $null
      $swapDone = $false      # P1-2a: catch records FAILED_BEFORE_SWAP vs FAILED_AFTER_SWAP by this flag
      $recovered = $false
      $undoUncommitted = $false
      try {
        if (-not (Test-Path "$runDir\patch.json")) { throw 'RESTORE_NO_PATCH: patch.json missing in this run (restore undoes THIS run modify)' }
        $pj = [System.IO.File]::ReadAllText("$runDir\patch.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        if (-not $pj.patch) { throw 'patch.json missing patch path (source identity)' }
        $prPath = "$runDir\promote.json"
        if (-not (Test-Path $prPath)) { throw 'RESTORE_NO_PROMOTE: no promote.json in this run (restore only undoes a promote of the SAME runId)' }
        $pr = [System.IO.File]::ReadAllText($prPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        # P1-2b (backlog P1x2 fix 2): judge the promote STATE, not promote.json existence/ok alone.
        #   ok=true = committed promote (restore undoes it by the recorded hash chain, as before).
        #   ok=false = the promote left an EXPLICIT UNFINISHED state; undo is possible ONLY for the
        #   recognizable swapped-uncommitted promote - a PREPARED promote record on the deploy-state
        #   log whose sourceHash matches this run's patch manifest (the staged-hash expectation then
        #   comes from that record, and the restore grounds from manifest.sourceHash). Any other
        #   ok=false state (guard refusal, no swap, no evidence) refuses fail-closed; an unreadable
        #   artifact refuses too (cannot confirm what was committed).
        $expectDeployed = $null
        $origExpect = $null
        if ($pr -and ($pr.ok -eq $true)) {
          if (-not $pr.deployedHash) { throw 'RESTORE_NO_PROMOTE: promote.json carries no deployedHash (promote predates the guard; re-run modify+promote with a new RunId)' }
          if (-not $pr.origHash) { throw 'RESTORE_NO_PROMOTE: promote.json carries no origHash (promote predates the guard; re-run modify+promote with a new RunId)' }
          # 2026-11-08 review P1: the endorsement must be THIS RunId's COMPLETE promote transaction - never
          #   another attempt's or another RunId's same-hash events. Replay the events in order: PREPARED
          #   opens a transaction (carrying sourceHash/origHash/stagedHash), SWAPPED carries the stagedHash
          #   forward, COMMITTED closes it with promotedHash; FAILED_* ends the current attempt. promote.json's
          #   three hashes must match the closing transaction's PREPARED+COMMITTED fields field-for-field,
          #   otherwise COMMIT_CHAIN_MISMATCH. ONE documented exception (Phase-4 batch-1 tail policy, matrix
          #   D10): when the log's LAST line is a torn partial write, the COMMITTED event was lost mid-flush -
          #   this RunId's PREPARED->SWAPPED pair witnessing the staged hash promote.json reports as
          #   deployedHash then closes the transaction. The exception is gated on TornTail being detected, so
          #   cleanly deleting the COMMITTED line still refuses (matrix D14).
          $dsLog = Get-DeployStateEvents $runDir
          if ($dsLog.Error) { throw ('DEPLOY_LOG_UNTRUSTED: ' + $dsLog.Error + ' (the commit chain cannot be confirmed from an untrustworthy deploy log; refusing)') }
          $openPrep = $null
          $tornSwap = $null
          $chainBacked = $false
          foreach ($ev in $dsLog.Events) {
            if ([string]$ev.verb -ne 'promote') { continue }
            if ([string]$ev.runId -ne [string]$RunId) { continue }   # a foreign-RunId event never endorses this run
            $evt = [string]$ev.event
            if ($evt -eq 'PREPARED') { $openPrep = $ev; $tornSwap = $null; continue }
            if ($evt -eq 'FAILED_BEFORE_SWAP' -or $evt -eq 'FAILED_AFTER_SWAP') { $openPrep = $null; $tornSwap = $null; continue }
            if (-not $openPrep) { continue }
            if ($evt -eq 'SWAPPED') {
              if ([string]$ev.stagedHash -ne [string]$openPrep.stagedHash) { $openPrep = $null; $tornSwap = $null; continue }
              $tornSwap = $openPrep   # the swap is witnessed by this RunId; a COMMITTED lost to the torn tail may close here
              continue
            }
            if ($evt -eq 'COMMITTED') {
              $tornSwap = $null
              $sameDeployed = ([string]$ev.promotedHash -eq [string]$pr.deployedHash)
              $sameOrig = ([string]$openPrep.origHash -eq [string]$pr.origHash)
              $sameSource = ([string]$openPrep.sourceHash -eq [string]$pr.sourceHash)
              $sameStaged = ([string]$openPrep.stagedHash -eq [string]$pr.deployedHash)
              if ($sameDeployed -and $sameOrig -and $sameSource -and $sameStaged) { $chainBacked = $true; break }
              $openPrep = $null
            }
          }
          if (-not $chainBacked -and $dsLog.TornTail -and $tornSwap) {
            if (([string]$tornSwap.origHash -eq [string]$pr.origHash) -and ([string]$tornSwap.sourceHash -eq [string]$pr.sourceHash) -and ([string]$tornSwap.stagedHash -eq [string]$pr.deployedHash)) { $chainBacked = $true }
          }
          if (-not $chainBacked) { throw ('COMMIT_CHAIN_MISMATCH: promote.json sourceHash/origHash/deployedHash do not match a PREPARED->COMMITTED transaction of THIS RunId field-for-field (foreign-RunId events, a tampered origHash and lost evidence all refuse); refusing to restore') }
          $expectDeployed = [string]$pr.deployedHash
          $origExpect = [string]$pr.origHash
        } elseif ($pr -and ($pr.ok -eq $false)) {
          if (-not $pj.manifest -or -not $pj.manifest.sourceHash) { throw 'RESTORE_NO_PROMOTE: this run promote.json ok=false and patch.json carries no manifest sourceHash (cannot judge the uncommitted-promote state; refusing)' }
          $prepEv = $null
          $dsLog2 = Get-DeployStateEvents $runDir
          if ($dsLog2.Error) { throw ('DEPLOY_LOG_UNTRUSTED: ' + $dsLog2.Error + ' (the uncommitted-promote state cannot be judged from an untrustworthy deploy log; refusing)') }
          foreach ($ev in $dsLog2.Events) {
            if ([string]$ev.event -eq 'PREPARED' -and [string]$ev.verb -eq 'promote' -and ([string]$ev.runId -eq [string]$RunId) -and ([string]$ev.sourceHash -eq [string]$pj.manifest.sourceHash) -and $ev.stagedHash) { $prepEv = $ev }
          }
          if (-not $prepEv) { throw 'RESTORE_NO_PROMOTE: this run promote.json ok=false and the deploy-state log has no PREPARED promote record (the promote never reached the swap; nothing uncommitted to undo); refusing' }
          $expectDeployed = [string]$prepEv.stagedHash
          $origExpect = [string]$pj.manifest.sourceHash
          $undoUncommitted = $true
        } else {
          throw 'RESTORE_NO_PROMOTE: this run promote.json is unreadable or carries no ok verdict (fail-closed: cannot confirm what was committed)'
        }
        # 3.1-2 (stage3 final check S2): same RunId binding as promote - restore reads the staged original
        #   through patch.json.stagingDir, so a stagingDir pointing at ANOTHER RunId's staging is refused.
        $stgExpected = [System.IO.Path]::GetFullPath("$runDir\staging")
        $stgFull = [System.IO.Path]::GetFullPath([string]$pj.stagingDir)
        if (-not $stgFull.TrimEnd('\').Equals($stgExpected.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase)) { throw ('refusing to restore: STAGING_RUNID_MISMATCH: patch.json.stagingDir "' + $pj.stagingDir + '" is not this RunId staging dir "' + $stgExpected + '" (staging is bound to the RunId; re-run -Verb modify with this RunId)') }
        $patchSpec = [System.IO.File]::ReadAllText((Join-Path $ROOT $pj.patch), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
        $srcRel = $patchSpec.sourceCpt
        if (-not $srcRel) { throw 'RESTORE_NO_PATCH: PatchSpec missing sourceCpt' }
        if ($srcRel -notmatch '^fineagent/[^\\/]+' -or $srcRel -like '*..*') { throw "sourceCpt outside whitelist: $srcRel" }
        $base = Split-Path -Leaf $srcRel
        $orig = Join-Path $pj.stagingDir ($base -replace '\.cpt$', '.orig.cpt')
        if (-not (Test-Path $orig -PathType Leaf)) { throw "staged original missing: $orig (modify keeps it automatically)" }
        $origHashNow = Get-FileSha256 $orig
        if (-not $origHashNow) { throw "cannot read staged original: $orig" }
        if ($origHashNow -ne $origExpect) {
          $ground = $(if ($undoUncommitted) { 'modify-time sourceHash (patch manifest)' } else { 'promote-time origHash' })
          throw ('STAGING_ORIG_CHANGED: staged original hash ' + $origHashNow.Substring(0, 12) + '.. != ' + $ground + ' ' + $origExpect.Substring(0, 12) + '.. (staging was modified; refusing)')
        }
        $deployed = Join-Path $cfg.DeployDir ($srcRel -replace '^fineagent/', '')
        if (-not (Test-Path $deployed -PathType Leaf)) { throw "deployed source missing: $deployed" }
        $deployedHashNow = Get-FileSha256 $deployed
        if (-not $deployedHashNow) { throw "cannot read deployed file for hashing: $deployed" }
        # 3.1-3 (stage3 final check S3) crash-window recovery for restore: a restore that died between
        #   Replace-FileAtomic and the restore.json commit left deployed == staged-original bytes with NO
        #   commit record; the retry used to deadlock on DEPLOYED_CHANGED. The retry recognizes that state
        #   by hash identity against the PREPARED restore record (origHash + deployedBeforeHash both
        #   matching) and COMPLETES the commit (re-materializes restore.json). Without the PREPARED evidence
        #   the same byte state is still refused (fail-closed).
        if ($deployedHashNow -ne $expectDeployed) {
          if ($deployedHashNow -eq $origHashNow) {
            $dsLog3 = Get-DeployStateEvents $runDir
            if ($dsLog3.Error) { throw ('DEPLOY_LOG_UNTRUSTED: ' + $dsLog3.Error + ' (crash recovery needs a trustworthy deploy log; refusing)') }
            foreach ($ev in $dsLog3.Events) {
              if ([string]$ev.event -eq 'PREPARED' -and [string]$ev.verb -eq 'restore' -and ([string]$ev.origHash -eq [string]$origHashNow) -and ([string]$ev.deployedBeforeHash -eq $expectDeployed)) { $recovered = $true }
            }
            if (-not $recovered) {
              if ($undoUncommitted) { throw ('RESTORE_NO_PROMOTE: deployed file already equals the staged original (hash ' + $deployedHashNow.Substring(0, 12) + '..) - this run has no uncommitted swapped bytes to undo; refusing') }
              throw ('DEPLOYED_CHANGED: deployed file hash ' + $deployedHashNow.Substring(0, 12) + '.. equals the staged original but no PREPARED restore record exists for this RunId (not a recognizable uncommitted restore); refusing')
            }
          } else {
            throw ('DEPLOYED_CHANGED: deployed file hash ' + $deployedHashNow.Substring(0, 12) + '.. != expected deployed hash ' + $expectDeployed.Substring(0, 12) + ' (deployed artifact changed; restoring would clobber it; refusing)')
          }
        }
        if ($recovered) {
          # crash window: the swap already happened (deployed bytes == staged original, PREPARED on record)
          #   but the commit record (restore.json) was lost -> complete the commit, never re-swap.
          Add-DeployStateEvent $runDir @{ event = 'COMMITTED'; verb = 'restore'; runId = $RunId; restoredHash = $origHashNow; recovered = 1 }
          $restoredHash = $origHashNow
        } else {
          # P1-2a: PREPARED is transactional - a write failure THROWS here, so restore terminates BEFORE the
          #   swap (same rule as promote).
          Add-DeployStateEvent $runDir @{ event = 'PREPARED'; verb = 'restore'; runId = $RunId; origHash = $origHashNow; deployedBeforeHash = $deployedHashNow }
          # ATOMIC restore: same-volume temp + File.Replace; on ANY failure the deployed file is left untouched
          Replace-FileAtomic $orig $deployed | Out-Null
          $swapDone = $true
          Add-DeployStateEvent $runDir @{ event = 'SWAPPED'; verb = 'restore'; runId = $RunId; origHash = $origHashNow }
          $restoredHash = Get-FileSha256 $deployed
          if (-not $restoredHash) { throw 'post-replace hash mismatch: cannot hash the deployed file after the swap' }
          if ($restoredHash -ne $origHashNow) { throw 'post-replace hash mismatch (restored file may be corrupted; inspect manually and re-promote from staging)' }
          # P1-2a: a COMMITTED write failure also throws -> explicit ok=false unfinished state; the same-RunId
          #   restore retry completes the commit from the PREPARED restore record + actual hash.
          Add-DeployStateEvent $runDir @{ event = 'COMMITTED'; verb = 'restore'; runId = $RunId; restoredHash = $restoredHash }
        }
        $obj = [ordered]@{ tool = 'restore'; runId = $RunId; ok = $true; recovered = $recovered; undoUncommittedPromote = $(if ($undoUncommitted) { 1 } else { 0 }); orig = $orig; deployed = $deployed; bytes = (Get-Item $deployed).Length; md5 = (Get-FileHash $deployed -Algorithm MD5).Hash
          origHash = $origHashNow; restoredHash = $restoredHash; deployedBeforeHash = $deployedHashNow; restoreAt = (Get-Date).ToString('o')
          concurrencyBoundary = 'single-writer deploy window: promote/restore hold the agent runtime named mutex across the whole guard+swap sequence (check-then-act: every hash guard runs inside the mutex immediately before File.Replace); a crashed or commit-lost swap is recovered by hash identity against the PREPARED/SWAPPED/COMMITTED deploy log, never re-swapped blindly; recovery covers process crash (killed host), not power loss (the deploy-state log and commit artifacts are OS-buffered, not fsynced)'; mutex = $cfg.MutexName }
        WriteAtomic "$runDir\restore.json" ($obj | ConvertTo-Json -Depth 4)
      } catch {
        $rcP = 1
        $err = '' + $_.Exception.Message
        # P1-2a: record which side of the swap the failure landed on. Best-effort: the authoritative
        #   diagnosis is the restore.json ok=false below - a failed diagnostic write here must not mask it.
        try {
          Add-DeployStateEvent $runDir @{ event = $(if ($swapDone -or $recovered) { 'FAILED_AFTER_SWAP' } else { 'FAILED_BEFORE_SWAP' }); verb = 'restore'; runId = $RunId; error = $err; deployedHashAtFail = $deployedHashNow }
        } catch { }
        $obj = [ordered]@{ tool = 'restore'; runId = $RunId; ok = $false; error = $err; deployedHashAtFail = $deployedHashNow
          nextActions = @('restore needs the SAME runId that ran modify AND either a committed promote (promote.json ok=true) or a recognizable uncommitted promote swap (PREPARED promote record on deploy_state.jsonl + deployed bytes == the recorded staged hash) - the latter is undone by re-running -Verb restore', 'check logs/agent/runs/<runId>/staging for the kept original, promote.json for the recorded hashes and deploy_state.jsonl for the swap-state trace') }
        WriteAtomic "$runDir\restore.json" ($obj | ConvertTo-Json -Depth 4)
      }
      @{ rc = $rcP }
    }
    $r = Invoke-UnderMutex $body $artFile $true
    if (-not $r.gained) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"QUEUE_TIMEOUT","nextActions":["wait and retry: the runtime mutex queue timed out (another run holds the FineReport engine)"]}'); exit 1 }
    if ($r.dup) { Write-Output ('{"ok":false,"reason":"RUNID_EXISTS","runId":"' + $RunId + '","nextActions":["this RunId already has a committed artifact; use a new RunId for a new report, or run -Verb restore with this RunId to undo the existing one"]}'); exit 1 }
    if ($r.busy) { Write-Output ('{"ok":false,"runId":"' + $RunId + '","reason":"RUNTIME_BUSY","nextActions":["another FineReport JVM holds the runtime mutex; wait for it to exit or stop it, then retry"]}'); exit 1 }
    $rs = $null
    if (Test-Path "$runDir\restore.json") { $rs = [System.IO.File]::ReadAllText("$runDir\restore.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    $okAll = ($r.rc.rc -eq 0) -and ($rs -and $rs.ok)
    Write-Output ('{"ok":' + $okAll.ToString().ToLower() + ',"runId":"' + $RunId + '","result":"logs/agent/runs/' + $RunId + '/restore.json"}')
    exit $(if ($okAll) { 0 } else { 1 })
  }
  default { Write-Output '{"ok":false,"error":"unknown verb","nextActions":["available verbs: discover resolve plan plan2spec create(validate) modify(patch) preview list_reports inspect_template sample_data promote restore"]}'; exit 2 }
}
