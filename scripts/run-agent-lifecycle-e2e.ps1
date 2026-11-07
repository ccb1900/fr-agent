# scripts/run-agent-lifecycle-e2e.ps1 - Agent product lifecycle E2E verifier (the ruler for the product
#   positioning: an EXTERNAL agent drives ONE report through the FULL lifecycle using ONLY fr_agent.ps1
#   verbs, and every visible result is asserted):
#     discover(list_reports) -> understand(inspect_template + sample_data + resolve)
#     -> create(plan -> plan2spec -> create) -> check(validate + truth-grid + preview)
#     -> modify -> deploy(promote) -> restore, deployment rollback-safe (hash chains).
#   Composition (Golden v1 is the verified baseline, NOT reimplemented - AGENTS sec.N): the
#     create->restore chain is delegated UNCHANGED to scripts/run-golden-e2e.ps1 under THIS script's
#     RunId; this script adds the discover/understand phases plus an independent PAYLOAD AUDIT (re-reads
#     the per-run JSON files, so a green run cannot rest on stdout alone).
#   Negative control (-NegativeControl): re-invokes THIS script with -Agent pointing at a stub whose
#     output is EMPTY (the injected fault: core returns empty). The verifier MUST then fail (exit != 0);
#     a 0 there means the check is vacuously green and the script exits 1. This is the anti-false-green
#     proof required by the improvement item.
#   ASCII-only (PS 5.1 GBK lesson, AGENTS sec.5): every CJK value comes from UTF-8 fixtures/payloads or
#     char codes, never from literals in this file. Exit 0 = green; 1 = failure.
param(
  [string]$Root = 'D:\fineagent',
  [string]$RunId = ('ale' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)),
  [string]$Intent = 'logs/agent/golden/g1_intent.json',
  [string]$Totals = '33531:26531',
  [string]$Agent = '',            # default: the real entry point agent\tools\fr_agent.ps1
  [switch]$NegativeControl
)
$ErrorActionPreference = 'Continue'
if (-not $Agent) { $Agent = Join-Path $Root 'agent\tools\fr_agent.ps1' }
$golden = Join-Path $Root 'scripts\run-golden-e2e.ps1'
$script:fails = 0
$script:stop = $false
function Fail($msg) { Write-Host ("PHASE FAIL: {0}" -f $msg); $script:fails++; $script:stop = $true }
function Ok($msg) { Write-Host ("PHASE OK: {0}" -f $msg) }

# One verb call exactly as the external agent makes it: ONE ASCII JSON contract line (take the LAST
#   {..} line - engine verbs may print log chatter first; the contract line is emitted last), with the
#   detailed UTF-8 payload in the per-run file the line names.
function Invoke-Verb($name, $extra) {
  if ($script:stop) { Write-Host ("PHASE {0} SKIP (prior failure)" -f $name); return $null }
  $raw = & powershell -NoProfile -ExecutionPolicy Bypass -File $Agent @extra 2>$null
  $jsonLine = ($raw | Where-Object { $_ -match '^\s*\{' } | Select-Object -Last 1)
  if (-not $jsonLine) { Fail ("{0}: NO contract line (core returned empty?)" -f $name); return $null }
  $j = $null
  try { $j = $jsonLine | ConvertFrom-Json } catch { Fail ("{0}: bad JSON -> {1}" -f $name, $jsonLine); return $null }
  if ($j.ok -ne $true) { Fail ("{0}: ok={1} -> {2}" -f $name, $j.ok, $jsonLine); return $null }
  return $j
}
function Read-Payload($rel) {
  $p = Join-Path $Root ($rel -replace '/', '\')
  if (-not (Test-Path $p)) { Fail ("payload missing: {0}" -f $rel); return $null }
  try { return [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
  catch { Fail ("payload unreadable as UTF-8 JSON: {0}" -f $rel); return $null }
}

if ($NegativeControl) {
  # Inject the fault "core returns empty" at the contract boundary (the entry point itself) and prove
  # the verifier goes red. No production file is touched: the stub lives under logs\agent\e2e_neg.
  $stubDir = Join-Path $Root 'logs\agent\e2e_neg'
  New-Item -ItemType Directory -Force -Path $stubDir | Out-Null
  $stub = Join-Path $stubDir 'stub_fr_agent.ps1'
  [System.IO.File]::WriteAllText($stub, "# negative-control stub: core contract output is EMPTY (fault injection)`r`nexit 0`r`n", (New-Object System.Text.UTF8Encoding($false)))
  $childRun = ('alenc' + (Get-Date -Format 'HHmmss') + [guid]::NewGuid().ToString('N').Substring(0, 4))
  $null = & powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Root $Root -Agent $stub -RunId $childRun 2>&1
  $rc = $LASTEXITCODE
  if ($rc -eq 0) {
    Write-Host 'NEGATIVE CONTROL FAILED: verifier returned 0 against an empty-output core (false green - the check is vacuous)'
    exit 1
  }
  Write-Host ("NEGATIVE CONTROL HELD: empty core -> verifier failed rc={0} (the check can fail)" -f $rc)
  exit 0
}

# ---- PHASE 1: discover - what reports exist on the deployed surface (visible result: count + a pick)
$lr = Invoke-Verb 'list_reports' @('-Verb', 'list_reports')
$inspectTarget = $null
if ($lr) {
  $pl = Read-Payload $lr.result
  if ($pl) {
    if ($pl.count -lt 1) { Fail 'list_reports: deployed surface reports 0 (count field)' }
    elseif (@($pl.reports).Count -ne $pl.count) { Fail ("list_reports: count={0} but reports[] has {1}" -f $pl.count, @($pl.reports).Count) }
    else {
      $cand = @($pl.reports | Where-Object { $_.file -like '*_api.cpt' -and $_.pngBytes })
      if ($cand.Count -lt 1) { Fail 'list_reports: no self-produced _api.cpt with a companion PNG (inspect target unfound)' }
      else { $inspectTarget = [string]$cand[0].sourceCpt; Ok ("discover/list_reports: count={0}, inspect target picked from tool output (bytes={1})" -f $pl.count, $cand[0].bytes) }
    }
  }
}

# ---- PHASE 2: understand - inspect_template / sample_data / resolve, each an independent verb run
# (same shape an outside agent gets: real cell coordinates, read-only LIMIT sample, tri-state resolve)
if (-not $script:stop) {
  if (-not $inspectTarget) { Fail 'understand: no inspect target from discover phase' }
  else {
    $insp = Invoke-Verb 'inspect_template' @('-Verb', 'inspect_template', '-Target', $inspectTarget)
    if ($insp) {
      $pl = Read-Payload $insp.result
      if ($pl) {
        $cells = @($pl.sheets[0].cells)
        if ($pl.sheetCount -lt 1 -or $cells.Count -lt 1) { Fail ('inspect_template: sheetCount={0} cells={1} (no visible template content)' -f $pl.sheetCount, $cells.Count) }
        else { Ok ("understand/inspect_template: sheets={0} cells={1} (real coordinates, read-only)" -f $pl.sheetCount, $cells.Count) }
      }
    }
  }
}
if (-not $script:stop) {
  $runDirAbs = Join-Path $Root ("logs\agent\runs\{0}" -f $RunId)
  New-Item -ItemType Directory -Force -Path $runDirAbs | Out-Null
  $sampleSpecRel = "logs/agent/runs/$RunId/sample_spec.json"
  [System.IO.File]::WriteAllText((Join-Path $runDirAbs 'sample_spec.json'), '{"entity":"InspectionRecord","columns":["bizDate","stage","score"],"limit":5}', (New-Object System.Text.UTF8Encoding($false)))
  $sd = Invoke-Verb 'sample_data' @('-Verb', 'sample_data', '-Sample', $sampleSpecRel)
  if ($sd) {
    $pl = Read-Payload $sd.result
    if ($pl) {
      if ($pl.returned -lt 1 -or @($pl.rows).Count -lt 1) { Fail 'sample_data: 0 rows returned (source data invisible to the agent)' }
      elseif (@($pl.columns).Count -ne 3) { Fail ("sample_data: columns={0} (expected 3)" -f @($pl.columns).Count) }
      else { Ok ("understand/sample_data: returned={0} rows, entity={1}, read-only LIMIT sample" -f $pl.returned, $pl.entity) }
    }
  }
}
if (-not $script:stop) {
  $term = [string]::Join('', [char[]]@(0x5B8C, 0x6210, 0x7387))   # the business word for completionRate (CJK kept out of this ASCII file)
  $rs = Invoke-Verb 'resolve' @('-Verb', 'resolve', '-Term', $term)
  if ($rs) {
    $pl = Read-Payload $rs.result
    if ($pl) {
      if ($pl.status -ne 'resolved' -and $pl.status -ne 'ambiguous') { Fail ("resolve: status={0} (tri-state broken: expected resolved|ambiguous on exit 0)" -f $pl.status) }
      elseif ($pl.status -eq 'resolved' -and @($pl.candidates).Count -lt 1) { Fail 'resolve: resolved with 0 candidates (no visible answer)' }
      else { Ok ("understand/resolve: status={0} candidates={1}" -f $pl.status, @($pl.candidates).Count) }
    }
  }
}

# ---- PHASE 3: create -> check -> verify -> modify -> deploy -> restore
# Delegated UNCHANGED to the golden e2e (verified baseline chain: plan+plan2spec+create+validate with
# totals+day@machine truth-grid+preview+modify with regression verdicts+promote+restore+baseline-restore,
# all fail-fast). This script's RunId carries the whole chain so the payload audit below reads one run.
if (-not $script:stop) {
  Write-Host 'PHASE create->restore: delegated to scripts/run-golden-e2e.ps1 (verified baseline chain, this RunId)'
  & powershell -NoProfile -ExecutionPolicy Bypass -File $golden -Root $Root -RunId $RunId -Intent $Intent -Totals $Totals
  $rcG = $LASTEXITCODE
  if ($rcG -ne 0) { Fail ("golden chain rc={0}" -f $rcG) }
  else { Ok 'golden chain rc=0 (plan+create+validate+truth-grid+preview+modify+promote+restore+baseline)' }
}

# ---- PHASE 4: payload audit - independent FILE truth for the decisive results (not stdout trust):
# plan ready, validate/artifact bound to THIS runId, modify verdicts true, promote/restore hash chains.
if (-not $script:stop) {
  $rd = "logs/agent/runs/$RunId"
  $plan = Read-Payload "$rd/plan.json"
  if ($plan -and $plan.status -ne 'ready') { Fail ("plan.json status={0} (expected ready)" -f $plan.status) }
  $val = Read-Payload "$rd/validate.json"
  if ($val) {
    if ($val.ok -ne $true) { Fail 'validate.json ok!=true' }
    elseif ($val.runId -ne $RunId) { Fail 'validate.json runId mismatch (stale acceptance guard broken)' }
  }
  $art = Read-Payload "$rd/artifact.json"
  if ($art) {
    if (-not $art.pngPath) { Fail 'artifact.json pngPath empty (no visible deliverable)' }
    elseif ($art.runId -ne $RunId) { Fail 'artifact.json runId mismatch' }
  }
  $patch = Read-Payload "$rd/patch.json"
  if ($patch) {
    $m = $patch.manifest
    if ($patch.ok -ne $true -or -not $m -or $m.diffClean -ne $true -or $m.execution.pass -ne $true -or $m.render.pass -ne $true) { Fail 'patch.json modify verdict not all true (diffClean/execution/render)' }
  }
  $pr = Read-Payload "$rd/promote.json"
  if ($pr) {
    if ($pr.ok -ne $true -or -not $pr.sourceHash -or -not $pr.origHash -or -not $pr.deployedHash -or -not $pr.promotedHash) { Fail 'promote.json missing ok or the SHA-256 hash chain (deploy not evidenced)' }
  }
  $rs = Read-Payload "$rd/restore.json"
  if ($rs) {
    if ($rs.ok -ne $true -or -not $rs.origHash -or -not $rs.restoredHash) { Fail 'restore.json missing ok or hash chain (rollback not evidenced)' }
  }
  if (-not $script:fails) { Ok 'payload audit: plan=ready; validate/artifact bound to this runId; patch verdicts true; promote/restore hash chains present' }
}

if ($script:fails -eq 0) { Write-Host ("AGENT LIFECYCLE E2E PASS (discover+understand+create->restore chain+payload audit, runId={0})" -f $RunId); exit 0 }
Write-Host ("AGENT LIFECYCLE E2E FAILED, failures={0}" -f $script:fails)
exit 1
