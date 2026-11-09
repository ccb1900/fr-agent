# sync-fineresport-skill.ps1 - install the repo's finereport skill into the ZCode user skill root.
#   WHY: project-local .agents/skills is only discovered for sessions whose cwd is under D:\fineagent;
#   ZCode's stable cross-session root is ~/.agents/skills (discovery order #3, see docs/agent-skill.md).
#   The repo copy remains the source of truth; this script is the explicit install step.
#   Idempotent: writes only when bytes differ. ASCII-only (PS 5.1 reads .ps1 as GBK on zh hosts).
param([switch]$Force)
$ErrorActionPreference = 'Stop'

$src = Join-Path (Split-Path -Parent $PSScriptRoot) '.agents\skills\finereport'
$dst = Join-Path $env:USERPROFILE '.agents\skills\finereport'
if (-not (Test-Path (Join-Path $src 'SKILL.md'))) { Write-Output "SYNC FAIL: source missing $src"; exit 1 }

$files = @('SKILL.md') + @(Get-ChildItem -Path (Join-Path $src 'references') -Filter '*.md' -File | ForEach-Object { 'references\' + $_.Name })
$dirs = @($dst, (Join-Path $dst 'references'))
foreach ($d in $dirs) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null } }

$changed = 0
foreach ($rel in $files) {
    $a = Join-Path $src $rel
    $b = Join-Path $dst $rel
    $ha = (Get-FileHash -Algorithm SHA256 -Path $a).Hash
    $hb = if (Test-Path $b) { (Get-FileHash -Algorithm SHA256 -Path $b).Hash } else { '' }
    if ($ha -ne $hb -or $Force) {
        Copy-Item -Path $a -Destination $b -Force
        Write-Output ("SYNC COPY: " + $rel)
        $changed++
    }
}
Write-Output ("SYNC END: " + $files.Count + " files, " + $changed + " copied -> " + $dst)
