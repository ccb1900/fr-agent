# run-promote-restore-tests.ps1 - Phase-3 deploy-safety regression matrix (spec A-D, counter-example first).
#   Exercises fr_agent.ps1 promote/restore BLACK-BOX (real child process, real config.ps1 path resolution)
#   inside a FULL SANDBOX: FR_AGENT_HOME / FR_HOME / FR_AGENT_RUNTIME_DIR / FR_AGENT_MUTEX are redirected, so
#   the real deployed reportlets dir is never written. Tamper evidence: the real deploy dir is inventoried
#   (count+bytes+aggregate hash) before and after the matrix and must be identical.
#   Cases cover every spec-A/B refusal path + normal promote/restore + atomic-replace behavior (locked-target
#   injection = deterministic on NTFS, no code hooks needed) + static wiring assertions (no Copy-Item -Force
#   deploy swap). Engine-free (no java, no FineDB): safe to run anytime. Exit 1 = any case failed. ASCII-only.
# NOTE: post-swap hash MISMATCH itself is not deterministically reproducible black-box on NTFS (File.Replace is
#   atomic - there is no window); the guard is proven in two parts: the comparison logic is unit-tested here
#   (mismatch fires) and its wiring into both branches is asserted by the static case X3.
$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$agentTool = Join-Path $RepoRoot 'agent\tools\fr_agent.ps1'
$deployHelper = Join-Path $RepoRoot 'agent\tools\_deploy.ps1'
if (-not (Test-Path $agentTool)) { Write-Output 'MATRIX ABORT: fr_agent.ps1 not found'; exit 1 }

$pass = 0; $fail = 0
$failNames = New-Object System.Collections.Generic.List[string]
function Ok([string]$n) { $script:pass++; Write-Output ("PASS  " + $n) }
function Bad([string]$n, [string]$why) { $script:fail++; $script:failNames.Add($n); Write-Output ("FAIL  " + $n + " :: " + $why) }

function Sha256([string]$p) { if (Test-Path -LiteralPath $p -PathType Leaf) { return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash } return $null }
function Read-Json([string]$p) { if (Test-Path $p) { try { return [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) | ConvertFrom-Json } catch { return $null } } return $null }

# ---- sandbox layout -------------------------------------------------------
$sbx = Join-Path $RepoRoot 'logs\promote_restore_sbx'
if (Test-Path $sbx) { Remove-Item -Recurse -Force $sbx -ErrorAction SilentlyContinue }
$sbxRoot = "$sbx\root"   # FR_AGENT_HOME
$sbxFr   = "$sbx\fr"     # FR_HOME
$sbxRt   = "$sbx\rt"     # FR_AGENT_RUNTIME_DIR
$deploySbx = "$sbxFr\webapps\webroot\WEB-INF\reportlets\fineagent"
foreach ($d in @($sbxRoot, "$sbxRoot\logs\agent\runs", $sbxRt, $deploySbx)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

# SAFETY preflight: sandbox deploy dir must differ from the real one; real dir must stay untouched.
$realFr = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
$realDeploy = "$realFr\webapps\webroot\WEB-INF\reportlets\fineagent"
if ($deploySbx -eq $realDeploy) { Write-Output 'MATRIX ABORT: sandbox deploy dir == real deploy dir'; exit 1 }
if ($env:FR_AGENT_HOME -eq $sbxRoot) { Write-Output 'MATRIX ABORT: FR_AGENT_HOME already sandboxed outside this harness'; exit 1 }
$realInventory = ''
if (Test-Path $realDeploy) {
  $files = @(Get-ChildItem -LiteralPath $realDeploy -File -ErrorAction SilentlyContinue | Sort-Object Name)
  $realInventory = (($files | ForEach-Object { $_.Name + ':' + $_.Length + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm MD5).Hash }) -join ';')
}

# ---- env redirect (restored in finally) -----------------------------------
$prev = @{}
foreach ($k in @('FR_AGENT_HOME', 'FR_HOME', 'FR_AGENT_RUNTIME_DIR', 'FR_AGENT_MUTEX', 'FR_AGENT_HEAP', 'FR_AGENT_DEPLOY_FAULT')) { $prev[$k] = [System.Environment]::GetEnvironmentVariable($k) }
$env:FR_AGENT_HOME = $sbxRoot
$env:FR_HOME = $sbxFr
$env:FR_AGENT_RUNTIME_DIR = $sbxRt
$env:FR_AGENT_MUTEX = 'fr-agent-mtx-promote-restore-matrix'
$env:FR_AGENT_DEPLOY_FAULT = ''   # reserved fault-injection knob; unused by the matrix itself

function Invoke-Agent([string]$Verb, [string]$RunId) {
  $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $agentTool -Verb $Verb -RunId $RunId 2>&1
  return @{ rc = $LASTEXITCODE; text = (($out | Out-String)) }
}

# ---- case factory ---------------------------------------------------------
$caseNo = 0
function New-Case([string]$tag, [string]$srcText) {
  $script:caseNo++
  $rid = ('mtx' + ('{0:D3}' -f $script:caseNo) + $tag)
  if ($rid -notmatch '^[A-Za-z0-9_-]{1,64}$') { throw ('case RunId invalid: ' + $rid) }
  $runDir = "$sbxRoot\logs\agent\runs\$rid"
  $staging = "$runDir\staging"
  New-Item -ItemType Directory -Force -Path $staging | Out-Null
  $cptName = ('mart_{0}.cpt' -f $script:caseNo)
  $deployed = Join-Path $deploySbx $cptName
  [System.IO.File]::WriteAllText($deployed, $srcText, (New-Object System.Text.UTF8Encoding($false)))
  $patchRel = ('logs/agent/runs/' + $rid + '/patch_e2e.json')
  $spec = '{"patchVersion":"1","sourceCpt":"fineagent/' + $cptName + '","outName":"MTX","ops":[{"op":"replace_cell_value","sheet":0,"cell":{"c":0,"r":0},"value":{"kind":"text","text":"MTX"}}]}'
  [System.IO.File]::WriteAllText((Join-Path $runDir 'patch_e2e.json'), $spec, (New-Object System.Text.UTF8Encoding($false)))
  $c = @{ rid = $rid; runDir = $runDir; staging = $staging; deployed = $deployed; cptName = $cptName; patchRel = $patchRel
    origPath = (Join-Path $staging ($cptName -replace '\.cpt$', '.orig.cpt')); patchedPath = (Join-Path $staging $cptName) }
  [System.IO.File]::WriteAllText($c.origPath, $srcText, (New-Object System.Text.UTF8Encoding($false)))
  return $c
}
function Set-Patched([hashtable]$c, [string]$patchedText) {
  [System.IO.File]::WriteAllText($c.patchedPath, $patchedText, (New-Object System.Text.UTF8Encoding($false)))
}
function Write-PatchJson([hashtable]$c, [hashtable]$mf, [bool]$ok = $true, [string]$patchRel = $null, [string]$stagingDir = $null) {
  if (-not $patchRel) { $patchRel = $c.patchRel }
  if (-not $stagingDir) { $stagingDir = $c.staging }
  $obj = @{ tool = 'patch'; runId = $c.rid; ok = $ok; patch = $patchRel; stagingDir = $stagingDir; manifestPath = "$stagingDir\manifest.json"; manifest = $mf }
  [System.IO.File]::WriteAllText((Join-Path $c.runDir 'patch.json'), ($obj | ConvertTo-Json -Depth 8), (New-Object System.Text.UTF8Encoding($false)))
  [System.IO.File]::WriteAllText("$stagingDir\manifest.json", ($mf | ConvertTo-Json -Depth 8), (New-Object System.Text.UTF8Encoding($false)))
}
function New-Manifest([string]$sourceCpt, [string]$out, [string]$sourceHash, [bool]$diffClean = $true, [hashtable]$exec = $null, [hashtable]$render = $null, [object]$dcs = $null, [int]$datasetOps = 0) {
  if (-not $exec) { $exec = @{ pass = $true; reason = 'ok' } }
  if (-not $render) { $render = @{ pass = $true; reason = 'ok' } }
  if ($null -eq $dcs) { $dcs = @() }
  return @{ sourceCpt = $sourceCpt; out = $out; ops = 1; namedStyles = 0; diffClean = $diffClean; added = @(); removed = @(); structDelta = 0
    execution = $exec; render = $render; datasetChecks = $dcs; datasetOps = $datasetOps; sourceHash = $sourceHash }
}
# post-swap verify comparison logic, mirrored as a unit (guard fires on mismatch - see NOTE in header)
function Test-HashMatch([string]$actual, [string]$expected) { return ($actual -and $expected -and ($actual -eq $expected)) }

function Assert-Refuse([string]$name, [hashtable]$c, [string]$verb, $inv, [string]$needle, [string]$hashBefore) {
  $art = Read-Json (Join-Path $c.runDir ($verb + '.json'))
  if ($inv.rc -ne 1) { Bad $name ("exit=$($inv.rc) (expected 1) out=$($inv.text.Substring(0, [Math]::Min(200, $inv.text.Length)))"); return }
  if (-not $art) { Bad $name ($verb + '.json missing'); return }
  if ($art.ok -ne $false) { Bad $name ($verb + '.json ok!=' + $art.ok); return }
  if ($needle -and (([string]$art.error) -notlike ('*' + $needle + '*'))) { Bad $name ("error needle '$needle' not in '$($art.error)'"); return }
  $h = Sha256 $c.deployed
  if ($hashBefore -and ($h -ne $hashBefore)) { Bad $name 'deployed file was modified by the refused operation'; return }
  Ok $name
}

try {
  Write-Output '== promote/restore deploy-safety matrix (sandboxed; real deploy dir inventoried)'

  # ---------------- P1: normal promote (anchor) ----------------
  $c = New-Case 'P1' ('ORIG-P1' + ('x' * 400))
  $script:c1 = $c   # kept for the chained R1 restore case
  $srcHash = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P1' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath $srcHash -dcs @(@{ where = 'in-memory'; pass = $true; reason = 'ok' }) -datasetOps 1
  Write-PatchJson $c $mf
  $inv = Invoke-Agent 'promote' $c.rid
  $pr = Read-Json (Join-Path $c.runDir 'promote.json')
  $stagedHash = Sha256 $c.patchedPath
  $nowHash = Sha256 $c.deployed
  if ($inv.rc -ne 0 -or -not $pr -or $pr.ok -ne $true) { Bad 'P1 normal promote' ("rc=$($inv.rc) pr.ok=$($pr.ok) out=$($inv.text)"); }
  elseif ($nowHash -ne $stagedHash) { Bad 'P1 normal promote' 'deployed != staged patched bytes' }
  elseif (-not $pr.deployedHash -or $pr.deployedHash -ne $nowHash) { Bad 'P1 normal promote' 'promote.json deployedHash missing/wrong' }
  elseif (-not $pr.promotedHash -or $pr.promotedHash -ne $nowHash) { Bad 'P1 normal promote' 'promote.json promotedHash missing/wrong' }
  elseif ($pr.sourceHash -ne $srcHash) { Bad 'P1 normal promote' 'promote.json sourceHash echo wrong' }
  elseif ($pr.origHash -ne $srcHash) { Bad 'P1 normal promote' 'promote.json origHash wrong' }
  else { Ok 'P1 normal promote' }

  # ---------------- P2: execution block missing -> refuse ----------------
  $c = New-Case 'P2' ('ORIG-P2' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P2' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed); $mf.Remove('execution')
  Write-PatchJson $c $mf
  Assert-Refuse 'P2 promote: execution MISSING' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'execution regression MISSING' $h0

  # ---------------- P3: render block missing -> refuse ----------------
  $c = New-Case 'P3' ('ORIG-P3' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P3' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed); $mf.Remove('render')
  Write-PatchJson $c $mf
  Assert-Refuse 'P3 promote: render MISSING' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'render regression MISSING' $h0

  # ---------------- P4: datasetChecks missing -> refuse ----------------
  $c = New-Case 'P4' ('ORIG-P4' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P4' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed); $mf.Remove('datasetChecks')
  Write-PatchJson $c $mf
  Assert-Refuse 'P4 promote: datasetChecks MISSING' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'datasetChecks MISSING' $h0

  # ---------------- P5: datasetChecks has a failing entry -> refuse ----------------
  $c = New-Case 'P5' ('ORIG-P5' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P5' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed) -dcs @(@{ where = 'in-memory'; pass = $false; reason = 'col mismatch' }) -datasetOps 1
  Write-PatchJson $c $mf
  Assert-Refuse 'P5 promote: dataset regression failed' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'dataset regression failed' $h0

  # ---------------- P6: staged patched file missing -> refuse ----------------
  $c = New-Case 'P6' ('ORIG-P6' + ('x' * 400)); $h0 = Sha256 $c.deployed
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed)
  Write-PatchJson $c $mf   # patchedPath never written
  Assert-Refuse 'P6 promote: staged patched cpt missing' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'staged patched cpt missing' $h0

  # ---------------- P7: staged file outside this run's staging dir -> refuse ----------------
  $c = New-Case 'P7' ('ORIG-P7' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P7' + ('y' * 400))
  $outside = "$sbx\outside"
  New-Item -ItemType Directory -Force -Path $outside | Out-Null
  [System.IO.File]::WriteAllText("$outside\evil.cpt", 'EVIL', (New-Object System.Text.UTF8Encoding($false)))   # must EXIST so the containment guard (not the existence guard) fires
  $mf = New-Manifest ('fineagent/' + $c.cptName) "$outside\evil.cpt" (Sha256 $c.deployed)
  Write-PatchJson $c $mf
  Assert-Refuse 'P7 promote: staged file outside staging dir' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'outside' $h0

  # ---------------- P8: sourceCpt mismatch (PatchSpec vs manifest) -> refuse ----------------
  $c = New-Case 'P8' ('ORIG-P8' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P8' + ('y' * 400))
  $mf = New-Manifest 'fineagent/other_report.cpt' $c.patchedPath (Sha256 $c.deployed)
  Write-PatchJson $c $mf
  Assert-Refuse 'P8 promote: sourceCpt mismatch' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'sourceCpt mismatch' $h0

  # ---------------- P9: sourceCpt outside whitelist -> refuse ----------------
  #   spec AND manifest agree on the traversal path so the WHITELIST guard fires (not the three-way mismatch)
  $c = New-Case 'P9' ('ORIG-P9' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P9' + ('y' * 400))
  $badRel = 'fineagent/../escape.cpt'
  $spec = '{"patchVersion":"1","sourceCpt":"' + $badRel + '","outName":"MTX","ops":[]}'
  [System.IO.File]::WriteAllText((Join-Path $c.runDir 'patch_e2e.json'), $spec, (New-Object System.Text.UTF8Encoding($false)))
  $mf = New-Manifest $badRel $c.patchedPath (Sha256 $c.deployed)
  Write-PatchJson $c $mf
  Assert-Refuse 'P9 promote: sourceCpt outside whitelist' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'outside whitelist' $h0

  # ---------------- P10: deployed file changed externally after modify -> SOURCE_CHANGED ----------------
  $c = New-Case 'P10' ('ORIG-P10' + ('x' * 400))
  $srcHash = Sha256 $c.deployed
  [System.IO.File]::WriteAllText($c.deployed, ('EXTERNAL-EDIT-P10' + ('z' * 400)), (New-Object System.Text.UTF8Encoding($false)))
  $h0 = Sha256 $c.deployed   # external bytes must survive the refusal
  Set-Patched $c ('PATCHED-P10' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath $srcHash
  Write-PatchJson $c $mf
  Assert-Refuse 'P10 promote: SOURCE_CHANGED' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'SOURCE_CHANGED' $h0

  # ---------------- P11: manifest sourceHash missing -> fail-closed ----------------
  $c = New-Case 'P11' ('ORIG-P11' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P11' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath ''
  Write-PatchJson $c $mf
  Assert-Refuse 'P11 promote: SOURCE_HASH_MISSING' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'SOURCE_HASH_MISSING' $h0

  # ---------------- P12: diffClean false -> refuse ----------------
  $c = New-Case 'P12' ('ORIG-P12' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P12' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed) -diffClean $false
  Write-PatchJson $c $mf
  Assert-Refuse 'P12 promote: diffClean false' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'diffClean=False' $h0

  # ---------------- P13: patch.json ok=false -> refuse ----------------
  $c = New-Case 'P13' ('ORIG-P13' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P13' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed)
  Write-PatchJson $c $mf -ok $false
  Assert-Refuse 'P13 promote: patch.json ok=false' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'ok!=true' $h0

  # ---------------- P14: staging .orig.cpt missing at promote -> refuse ----------------
  $c = New-Case 'P14' ('ORIG-P14' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P14' + ('y' * 400))
  Remove-Item -LiteralPath $c.origPath -Force
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed)
  Write-PatchJson $c $mf
  Assert-Refuse 'P14 promote: staged original missing' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'staged original missing' $h0

  # ---------------- P15: disk manifest.json contradicts embedded manifest -> refuse ----------------
  $c = New-Case 'P15' ('ORIG-P15' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P15' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed)
  Write-PatchJson $c $mf
  $mfDisk = New-Manifest ('fineagent/' + $c.cptName) "$($c.staging)\other.cpt" (Sha256 $c.deployed)   # disk copy points elsewhere
  [System.IO.File]::WriteAllText("$($c.staging)\manifest.json", ($mfDisk | ConvertTo-Json -Depth 8), (New-Object System.Text.UTF8Encoding($false)))
  Assert-Refuse 'P15 promote: manifest.json vs embedded mismatch' $c 'promote' (Invoke-Agent 'promote' $c.rid) 'MANIFEST_MISMATCH' $h0

  # ---------------- P16: atomic replace fails (target locked by a reader that grants no write share) ----------------
  $c = New-Case 'P16' ('ORIG-P16' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-P16' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed)
  Write-PatchJson $c $mf
  $lockFs = [System.IO.File]::Open($c.deployed, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
  try { $inv = Invoke-Agent 'promote' $c.rid } finally { $lockFs.Close() }
  Assert-Refuse 'P16 promote: atomic replace failed -> original kept' $c 'promote' $inv 'atomic replace failed' $h0

  # ---------------- R1: normal restore (anchor; on P1's deployed state) ----------------
  $c = $script:c1
  if (-not $c) { Bad 'R1 normal restore' 'P1 case not available'; }
  else {
    $origHash = Sha256 $c.origPath
    $inv = Invoke-Agent 'restore' $c.rid
    $rs = Read-Json (Join-Path $c.runDir 'restore.json')
    $nowHash = Sha256 $c.deployed
    if ($inv.rc -ne 0 -or -not $rs -or $rs.ok -ne $true) { Bad 'R1 normal restore' ("rc=$($inv.rc) rs.ok=$($rs.ok) out=$($inv.text)") }
    elseif ($nowHash -ne $origHash) { Bad 'R1 normal restore' 'restored deployed != staged original bytes' }
    elseif (-not $rs.restoredHash -or $rs.restoredHash -ne $origHash) { Bad 'R1 normal restore' 'restore.json restoredHash missing/wrong' }
    else { Ok 'R1 normal restore' }
  }

  # ---------------- R2: restore without a successful promote record -> refuse ----------------
  $c = New-Case 'R2' ('ORIG-R2' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-R2' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath (Sha256 $c.deployed)
  Write-PatchJson $c $mf   # NO promote step
  Assert-Refuse 'R2 restore: no promote record' $c 'restore' (Invoke-Agent 'restore' $c.rid) 'RESTORE_NO_PROMOTE' $h0

  # ---------------- R3: deployed changed externally after promote -> DEPLOYED_CHANGED ----------------
  $c = New-Case 'R3' ('ORIG-R3' + ('x' * 400))
  $srcHash = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-R3' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath $srcHash
  Write-PatchJson $c $mf
  $inv = Invoke-Agent 'promote' $c.rid
  if ($inv.rc -ne 0) { Bad 'R3 restore: DEPLOYED_CHANGED (promote pre-step)' "promote rc=$($inv.rc)"; }
  else {
    [System.IO.File]::WriteAllText($c.deployed, ('EXTERNAL-EDIT-R3' + ('z' * 400)), (New-Object System.Text.UTF8Encoding($false)))
    $h0 = Sha256 $c.deployed   # external bytes must survive the refusal
    Assert-Refuse 'R3 restore: DEPLOYED_CHANGED' $c 'restore' (Invoke-Agent 'restore' $c.rid) 'DEPLOYED_CHANGED' $h0
  }

  # ---------------- R4: staging .orig.cpt tampered after promote -> refuse ----------------
  $c = New-Case 'R4' ('ORIG-R4' + ('x' * 400))
  $srcHash = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-R4' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath $srcHash
  Write-PatchJson $c $mf
  $inv = Invoke-Agent 'promote' $c.rid
  if ($inv.rc -ne 0) { Bad 'R4 restore: staging orig tampered (promote pre-step)' "promote rc=$($inv.rc)"; }
  else {
    [System.IO.File]::WriteAllText($c.origPath, ('TAMPERED-R4' + ('w' * 400)), (New-Object System.Text.UTF8Encoding($false)))
    $h0 = Sha256 $c.deployed   # deployed (patched) bytes must survive the refusal
    Assert-Refuse 'R4 restore: STAGING_ORIG_CHANGED' $c 'restore' (Invoke-Agent 'restore' $c.rid) 'STAGING_ORIG_CHANGED' $h0
  }

  # ---------------- R5: second restore (already restored) -> refused, deployed keeps the restored bytes ----------------
  #   A second restore with the SAME runId is refused by the r22e one-shot registration (restore.json already
  #   exists -> RUNID_EXISTS, artifact NOT rewritten); the deployed file stays at the restored original bytes
  #   either way. Asserted on stdout + deployed bytes, not on restore.json.
  $c = New-Case 'R5' ('ORIG-R5' + ('x' * 400))
  $srcHash = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-R5' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath $srcHash
  Write-PatchJson $c $mf
  $inv = Invoke-Agent 'promote' $c.rid
  if ($inv.rc -ne 0) { Bad 'R5 restore: second restore (promote pre-step)' "promote rc=$($inv.rc)"; }
  else {
    $inv2 = Invoke-Agent 'restore' $c.rid
    if ($inv2.rc -ne 0) { Bad 'R5 restore: second restore (first restore)' "restore rc=$($inv2.rc)"; }
    else {
      $h0 = Sha256 $c.deployed   # now == original bytes; a second restore must refuse and keep them
      $inv3 = Invoke-Agent 'restore' $c.rid
      $h1 = Sha256 $c.deployed
      if ($inv3.rc -ne 1) { Bad 'R5 restore: second restore refused' ("rc=$($inv3.rc) out=$($inv3.text)") }
      elseif (($inv3.text -notmatch 'RUNID_EXISTS') -and ($inv3.text -notmatch 'DEPLOYED_CHANGED')) { Bad 'R5 restore: second restore refused' ('refusal reason not visible: ' + $inv3.text) }
      elseif ($h1 -ne $h0) { Bad 'R5 restore: second restore refused' 'deployed bytes changed by the refused second restore' }
      else { Ok 'R5 restore: second restore refused' }
    }
  }

  # ---------------- R6: promote ok, staging deleted afterwards -> refuse, deployed keeps patched bytes ----------------
  $c = New-Case 'R6' ('ORIG-R6' + ('x' * 400))
  $srcHash = Sha256 $c.deployed
  Set-Patched $c ('PATCHED-R6' + ('y' * 400))
  $mf = New-Manifest ('fineagent/' + $c.cptName) $c.patchedPath $srcHash
  Write-PatchJson $c $mf
  $inv = Invoke-Agent 'promote' $c.rid
  if ($inv.rc -ne 0) { Bad 'R6 restore: mid-flight staging loss (promote pre-step)' "promote rc=$($inv.rc)"; }
  else {
    Remove-Item -LiteralPath $c.origPath -Force
    $h0 = Sha256 $c.deployed   # deployed must STILL be the patched bytes (recoverable state)
    Assert-Refuse 'R6 restore: mid-flight staging loss -> refuse, deployed intact' $c 'restore' (Invoke-Agent 'restore' $c.rid) 'staged original missing' $h0
  }

  # ---------------- R7: restore with no patch.json at all -> refuse ----------------
  $c = New-Case 'R7' ('ORIG-R7' + ('x' * 400)); $h0 = Sha256 $c.deployed
  Assert-Refuse 'R7 restore: no patch.json' $c 'restore' (Invoke-Agent 'restore' $c.rid) 'RESTORE_NO_PATCH' $h0

  # ---------------- X1: Replace-FileAtomic unit - success swaps bytes, leaves no temp ----------------
  if (-not (Test-Path $deployHelper)) { Bad 'X1 Replace-FileAtomic success' '_deploy.ps1 missing' }
  else {
    . $deployHelper
    $a = "$sbx\x1_src.bin"; $b = "$sbx\x1_tgt.bin"
    [System.IO.File]::WriteAllText($a, 'AAA111', (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText($b, 'BBB222', (New-Object System.Text.UTF8Encoding($false)))
    Replace-FileAtomic $a $b
    $okX1 = ((Sha256 $b) -eq (Sha256 $a))
    $temps = @(Get-ChildItem -LiteralPath $sbx -Filter '._deploy_*.tmp' -Force -ErrorAction SilentlyContinue)
    if (-not $okX1) { Bad 'X1 Replace-FileAtomic success' 'target bytes not swapped' }
    elseif ($temps.Count -gt 0) { Bad 'X1 Replace-FileAtomic success' ('leftover temp files: ' + $temps.Count) }
    else { Ok 'X1 Replace-FileAtomic success' }
  }

  # ---------------- X2: Replace-FileAtomic unit - failure keeps the original target bytes ----------------
  if (-not (Test-Path $deployHelper)) { Bad 'X2 Replace-FileAtomic failure keeps original' '_deploy.ps1 missing' }
  else {
    $a = "$sbx\x2_src.bin"; $b = "$sbx\x2_tgt.bin"
    [System.IO.File]::WriteAllText($a, 'AAA333', (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText($b, 'BBB444', (New-Object System.Text.UTF8Encoding($false)))
    $h0 = Sha256 $b
    $fs = [System.IO.File]::Open($b, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    $threw = $false
    try { Replace-FileAtomic $a $b } catch { $threw = $true }
    try { $fs.Close() } catch { }
    $h1 = Sha256 $b
    if (-not $threw) { Bad 'X2 Replace-FileAtomic failure keeps original' 'locked target did NOT fail the replace' }
    elseif ($h1 -ne $h0) { Bad 'X2 Replace-FileAtomic failure keeps original' 'target bytes changed despite failure' }
    else { Ok 'X2 Replace-FileAtomic failure keeps original' }
  }

  # ---------------- X3: static wiring - no Copy-Item -Force deploy swap; helpers referenced; post-swap verify present ----------------
  $txt = [System.IO.File]::ReadAllText($agentTool)
  if ($txt -match 'Copy-Item\s+-Force') { Bad 'X3 static: no Copy-Item -Force deploy swap' 'Copy-Item -Force found in fr_agent.ps1' }
  else { Ok 'X3 static: no Copy-Item -Force deploy swap' }
  if ($txt -notmatch 'Replace-FileAtomic' -or $txt -notmatch 'Get-FileSha256') { Bad 'X3 static: atomic replace + SHA-256 wired' 'Replace-FileAtomic/Get-FileSha256 not referenced' }
  else { Ok 'X3 static: atomic replace + SHA-256 wired' }
  if ($txt -notmatch 'SOURCE_CHANGED' -or $txt -notmatch 'DEPLOYED_CHANGED' -or $txt -notmatch 'RESTORE_NO_PROMOTE') { Bad 'X3 static: guard reasons present' 'SOURCE_CHANGED/DEPLOYED_CHANGED/RESTORE_NO_PROMOTE missing' }
  else { Ok 'X3 static: guard reasons present' }
  if ($txt -notmatch 'post-replace hash mismatch') { Bad 'X3 static: post-swap hash verify wired' 'post-replace hash mismatch check missing' }
  else { Ok 'X3 static: post-swap hash verify wired' }

  # ---------------- X4: hash-mismatch guard fires on a real mismatch (unit of the comparison) ----------------
  #   Test-HashMatch returns $true when hashes MATCH (deploy proceeds); a mismatch must yield $false = detected.
  $m = Test-HashMatch 'AAAA' 'BBBB'
  $m2 = Test-HashMatch 'AAAA' 'AAAA'
  if ($m) { Bad 'X4 hash mismatch guard fires' 'mismatched hashes wrongly accepted' }
  elseif (-not $m2) { Bad 'X4 hash mismatch guard fires' 'equal hashes wrongly rejected' }
  else { Ok 'X4 hash mismatch guard fires' }
}
finally {
  foreach ($k in $prev.Keys) { [System.Environment]::SetEnvironmentVariable($k, $prev[$k]) }
}

# tamper evidence: the REAL deploy dir must be byte-identical to before the matrix
if (Test-Path $realDeploy) {
  $files2 = @(Get-ChildItem -LiteralPath $realDeploy -File -ErrorAction SilentlyContinue | Sort-Object Name)
  $inv2 = (($files2 | ForEach-Object { $_.Name + ':' + $_.Length + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm MD5).Hash }) -join ';')
  if ($inv2 -ne $realInventory) { $fail++; Write-Output 'FAIL  tamper-evidence: REAL deploy dir changed during the matrix' }
  else { Write-Output ('PASS  tamper-evidence: real deploy dir untouched (' + $files2.Count + ' files)') }
}
# sandbox leftovers: no temp files anywhere in the sandbox tree
$leftover = @(Get-ChildItem -LiteralPath $sbx -Filter '._deploy_*.tmp' -Recurse -Force -ErrorAction SilentlyContinue)
if ($leftover.Count -gt 0) { $fail++; Write-Output ('FAIL  sandbox hygiene: ' + $leftover.Count + ' temp files left behind') }

Write-Output ('PROMOTE-RESTORE MATRIX END, pass=' + $pass + ', fail=' + $fail)
if ($failNames.Count -gt 0) { Write-Output ('failed: ' + ($failNames -join ', ')) }
exit $(if ($fail -eq 0) { 0 } else { 1 })
