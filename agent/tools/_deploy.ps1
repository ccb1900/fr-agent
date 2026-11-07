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
  Add-Content -Path (Join-Path $RunDir 'deploy_state.jsonl') -Value ($e | ConvertTo-Json -Compress -Depth 4) -Encoding ASCII -ErrorAction SilentlyContinue
}
function Get-DeployStateEvents([string]$RunDir) {
  $out = New-Object System.Collections.Generic.List[object]
  $p = Join-Path $RunDir 'deploy_state.jsonl'
  if (Test-Path -LiteralPath $p -PathType Leaf) {
    try {
      foreach ($line in (Get-Content -LiteralPath $p -Encoding UTF8)) {
        $t = ('' + $line).Trim()
        if (-not $t) { continue }
        try { $o = $t | ConvertFrom-Json } catch { continue }
        if ($o) { $out.Add($o) }
      }
    } catch { }   # unreadable tail: the readable prefix still carries the evidence
  }
  return ,$out
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
