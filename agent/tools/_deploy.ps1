# _deploy.ps1 - Phase-3 deploy-safety helpers shared by fr_agent.ps1 promote/restore branches.
#   Same layer as _identity.ps1 (function definitions only, no state, no new infrastructure).
#   Get-FileSha256    : uppercase hex SHA-256 of a file; $null when missing/unreadable (caller fail-closes).
#                       One algorithm for the whole guard chain (sourceHash / origHash / deployedHash /
#                       promotedHash / restoredHash) - matches the engine side (template/patch_main.js
#                       java.security.MessageDigest SHA-256, uppercase hex).
#   Replace-FileAtomic: same-volume temp file + .NET File.Replace (kernel-atomic swap on NTFS). On ANY failure
#                       the target file is left byte-identical and the exception propagates to the caller,
#                       which records the diagnosis and exits non-zero. NO Copy-Item/Move-Item -Force fallback
#                       here ON PURPOSE (Phase-3 spec C: silent-overwrite deployment is banned; on a filesystem
#                       that cannot support File.Replace the operation FAILS EXPLICITLY and the deployed file
#                       is preserved - recovery = fix the cause and re-run promote/restore).
# NOTE: ASCII-only (PS 5.1 GBK lesson).
# 3.1-1 (stage3 final check S1): FULL verdict-field comparison between the manifest embedded in patch.json
#   and the manifest the patch engine wrote to staging (manifest.json). The previous 4-field compare
#   (sourceCpt/out/diffClean/sourceHash) left execution/render/datasetChecks judged from the EMBEDDED copy
#   only (fr_agent.ps1 verdict guards) - a tampered embedded verdict (pass=true) beside a refusing disk
#   manifest promoted a patch the run itself had rejected. Now every decisive verdict field must agree;
#   disagreement = tampered/swapped evidence = refuse BEFORE touching the deployed file. Cosmetic fields
#   (pixelStats etc.) are not compared. Returns '' when equal, else a comma-joined field list.
function Compare-ManifestVerdict($Emb, $Disk) {
  $mism = @()
  if ($null -eq $Emb -or $null -eq $Disk) { return 'manifest' }
  foreach ($f in @('sourceCpt', 'out', 'sourceHash', 'datasetOps')) {
    if ([string]$Emb.$f -ne [string]$Disk.$f) { $mism += $f }
  }
  if (($Emb.diffClean -ne $true) -or ($Disk.diffClean -ne $true)) { $mism += 'diffClean' }
  foreach ($f in @('execution', 'render', 'datasetChecks')) {
    $a = $Emb.$f; $b = $Disk.$f
    if (($null -eq $a) -ne ($null -eq $b)) { $mism += $f; continue }   # presence must agree (fail-closed)
    if ($null -ne $a) {
      $ja = ''; $jb = ''
      try { $ja = ($a | ConvertTo-Json -Compress -Depth 8) } catch { $ja = '<unserializable>' }
      try { $jb = ($b | ConvertTo-Json -Compress -Depth 8) } catch { $jb = '<unserializable>' }
      if ([string]$ja -ne [string]$jb) { $mism += $f }
    }
  }
  return ($mism -join ', ')
}
# 3.1-3 (stage3 final check S3): deploy operation log - append-only JSONL inside the run dir.
#   PREPARED is written BEFORE the atomic swap (with the hashes that identify the intended swap),
#   COMMITTED after the post-swap hash verify. A crash between swap and promote.json/restore.json is then
#   detectable on the next call by comparing the ACTUAL deployed-file hash against the recorded staged/orig
#   hashes: the retry either completes the commit (re-materialize the lost artifact from verified on-disk
#   state) or refuses exactly as before (SOURCE_CHANGED / DEPLOYED_CHANGED). No new infrastructure: a
#   per-run log file beside the existing promote.json/restore.json.
function Add-DeployStateEvent([string]$RunDir, [hashtable]$Fields) {
  $e = @{ v = 1; at = (Get-Date).ToString('o') }
  foreach ($k in $Fields.Keys) { $e[$k] = $Fields[$k] }
  # P1-2a (backlog P1x2 fix 1): a deploy-state write failure must fail the caller LOUDLY, never be
  #   swallowed. PREPARED is the crash-recovery evidence: writing it with -ErrorAction SilentlyContinue
  #   and proceeding to File.Replace left a swapped deployed file with no recovery trail when the disk
  #   was full / locked / read-only. Main-flow callers (promote/restore) treat every event write as
  #   transactional: PREPARED failure aborts BEFORE the swap, COMMITTED failure leaves the explicit
  #   ok=false unfinished state the same-RunId retry then completes. The failure catch writes its
  #   FAILED_* diagnostic best-effort around this function so it can never mask the original error.
  # Phase-4 batch-1 (torn-tail repair): a previous writer may have died mid-line (file does not end
  #   with a newline). The fragment was never a complete event; leaving it in place and appending
  #   after it would glue our event onto the torn line (one corrupt line mid-log). Drop the fragment
  #   first so the invariant 'every complete line is an event' survives recovery.
  $lp = Join-Path $RunDir 'deploy_state.jsonl'
  try {
    if (Test-Path -LiteralPath $lp -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($lp)
      if ($bytes.Length -gt 0 -and $bytes[$bytes.Length - 1] -ne 10) {
        $cut = $bytes.Length
        while ($cut -gt 0 -and $bytes[$cut - 1] -ne 10) { $cut-- }
        if ($cut -gt 0) { [System.IO.File]::WriteAllBytes($lp, [byte[]]$bytes[0..($cut - 1)]) }
        else { [System.IO.File]::WriteAllBytes($lp, [byte[]]@()) }   # the whole file is one torn fragment
      }
    }
    Add-Content -Path $lp -Value ($e | ConvertTo-Json -Compress -Depth 4) -Encoding ASCII -ErrorAction Stop
  } catch {
    throw ('deploy_state.jsonl write failed: ' + $_.Exception.Message)
  }
  return $true
}
# Phase-4 batch-1 (log reading policy, four states - ask P2):
#   MISSING     : no deploy_state.jsonl -> no evidence (callers judge; NOT an error - D8 semantics).
#   UNREADABLE  : file exists but cannot be read (locked/held exclusively) -> Error (fail-closed;
#                 restore refuses with the explicit log diagnosis instead of falling back silently).
#   TORN TAIL   : the LAST non-empty line is unparseable -> abandoned partial write, recoverable; it
#                 is skipped (TornTail=true) and Add-DeployStateEvent repairs it before the next append.
#   MID CORRUPT : an unparseable line that is NOT the tail -> the log was edited/damaged after the
#                 fact, the evidence chain is broken -> Error (restore refuses).
#   OUT OF ORDER: the append-only log must replay as a per-verb state machine (PREPARED -> SWAPPED ->
#                 COMMITTED, FAILED_* terminal, COMMITTED from the no-attempt state only with
#                 recovered=1) -> any other sequence is tampering/reordering -> Error.
# Returns @{ Events = <list>; Error = <'' or diagnosis>; TornTail = <bool> }. Error is authoritative:
# callers must refuse on a non-empty Error and never fall back to the readable prefix.
function Test-DeployStateEventOrder($Events) {
  $st = @{ promote = 'none'; restore = 'none' }
  for ($i = 0; $i -lt $Events.Count; $i++) {
    $e = $Events[$i]
    $v = [string]$e.verb
    if (($v -ne 'promote') -and ($v -ne 'restore')) { return ('line ' + ($i + 1) + ': unknown verb "' + $v + '"') }
    $ev = [string]$e.event
    $s = $st[$v]
    switch ($ev) {
      'PREPARED' { $st[$v] = 'prepared' }   # a new attempt may start after any ending (crash/failure/commit)
      'SWAPPED' {
        if ($s -ne 'prepared') { return ('line ' + ($i + 1) + ': ' + $v + ' SWAPPED without a preceding uncompleted PREPARED') }
        $st[$v] = 'swapped'
      }
      'COMMITTED' {
        if (($s -ne 'prepared') -and ($s -ne 'swapped') -and (-not $e.recovered)) {
          return ('line ' + ($i + 1) + ': ' + $v + ' COMMITTED without PREPARED/SWAPPED and without recovered=1')
        }
        $st[$v] = 'none'
      }
      'FAILED_BEFORE_SWAP' { $st[$v] = 'none' }   # terminal for the attempt; a retry may start anew
      'FAILED_AFTER_SWAP' { $st[$v] = 'none' }
      default { return ('line ' + ($i + 1) + ': unknown event "' + $ev + '"') }
    }
  }
  return ''
}
function Get-DeployStateEvents([string]$RunDir) {
  $out = New-Object System.Collections.Generic.List[object]
  $res = @{ Events = $out; Error = ''; TornTail = $false }
  $p = Join-Path $RunDir 'deploy_state.jsonl'
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { return $res }   # MISSING: no evidence, not corruption
  $lines = $null
  try { $lines = [System.IO.File]::ReadAllLines($p, [System.Text.Encoding]::UTF8) }
  catch { $res.Error = ('deploy_state.jsonl unreadable: ' + $_.Exception.Message); return $res }   # UNREADABLE: fail-closed
  $lastIdx = -1
  for ($i = $lines.Count - 1; $i -ge 0; $i--) { if (('' + $lines[$i]).Trim()) { $lastIdx = $i; break } }
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $t = ('' + $lines[$i]).Trim()
    if (-not $t) { continue }
    $o = $null
    try { $o = $t | ConvertFrom-Json } catch { $o = $null }
    if (-not $o) {
      if ($i -eq $lastIdx) { $res.TornTail = $true; continue }   # TORN TAIL: abandoned partial write
      $res.Error = ('deploy_state.jsonl corrupt at line ' + ($i + 1) + ' (not the tail; refusing to trust the log)')
      return $res   # MID CORRUPT: evidence chain broken
    }
    if (-not $o.event) { $res.Error = ('deploy_state.jsonl line ' + ($i + 1) + ' carries no event field'); return $res }
    $out.Add($o)
  }
  $ordErr = Test-DeployStateEventOrder $out
  if ($ordErr) { $res.Error = ('deploy_state.jsonl out of order: ' + $ordErr); return $res }   # OUT OF ORDER
  return $res
}
function Get-FileSha256([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  try {
    $fs = [System.IO.File]::OpenRead($Path)
    try {
      $sha = New-Object System.Security.Cryptography.SHA256CryptoServiceProvider
      try { $h = $sha.ComputeHash($fs) } finally { $sha.Dispose() }
    } finally { $fs.Close() }
    return ([System.BitConverter]::ToString($h)) -replace '-', ''
  } catch { return $null }
}

function Replace-FileAtomic([string]$SourcePath, [string]$TargetPath) {
  if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) { throw ("atomic replace: source missing: " + $SourcePath) }
  if (-not (Test-Path -LiteralPath $TargetPath -PathType Leaf)) { throw ("atomic replace: target missing: " + $TargetPath) }
  $dir = Split-Path -Parent $TargetPath
  $tmp = Join-Path $dir ('._deploy_' + [guid]::NewGuid().ToString('N') + '.tmp')
  try {
    # stage the new bytes on the SAME volume as the target (File.Replace requires it)
    [System.IO.File]::Copy($SourcePath, $tmp, $true)
    try {
      # PS 5.1 method binder turns a literal $null into "" for string params -> ArgumentException; [NullString]::Value passes a REAL null (probed)
      [System.IO.File]::Replace($tmp, $TargetPath, [NullString]::Value)   # atomic swap; target untouched when this throws
    } catch {
      throw ("atomic replace failed: " + $_.Exception.Message)   # explicit diagnosis, target preserved
    }
  } finally {
    # after a successful Replace the tmp path no longer exists; after a failure remove the staged copy
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  }
  return $true
}
