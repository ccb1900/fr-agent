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
