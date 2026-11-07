param([Parameter(Mandatory = $true)][string]$Script, [string]$Out = '', [string]$Heap = '1200m', [switch]$NoKill)
# 2026-11-04 heap cap (README #46/#47): memory-tight host needs -Xmx ceiling; override with -Heap.
# 2026-11-06 commit preflight REMOVED (user decision): the #46 native-crash accident happened under the
#   UNLIMITED default heap (maxRAM/4 = 6G + j2v8). The -Xmx cap above is the actual fix; the preflight
#   (heap+900 < commit remaining) was its belt-and-braces and misfired on small heaps (FINE at 1776MB free
#   with -Xmx400m, yet exit 8). Real reservation failures surface as JVM/native non-zero exits, fail-closed.
# r13 P2-C: FR install root from env FR_HOME (single source, matches Paths.js), default preserved for manual gate use.
# r16: Java launch unified via engine_launch.ps1 (records java.pid on the agent path when FR_AGENT_JAVA_PIDFILE is set).
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'engine_launch.ps1')
# 2026-11-07 CWD anchoring (05b60c3 follow-up): nashorn resolves a RELATIVE script name against the JVM
#   working directory (the CALLER's CWD), not this repo root - reproduced from a TEMP CWD ('is not a file',
#   rc=103, engine never started). External callers may invoke from any directory and fr_agent.ps1 passes
#   relative names for the engine verbs (create -> make_api.js; patch/inspect_template -> template/*.js via
#   runraw.ps1), so anchor a relative -Script to THIS file's directory. Same root-relative semantics as
#   runtime/paths.js (FR_AGENT_HOME); absolute paths pass through unchanged. engine_launch.ps1 untouched.
if (-not [System.IO.Path]::IsPathRooted($Script)) { $Script = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $Script)) }
$FR = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
if (-not $NoKill) { Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force }
$lck = "$FR\webapps\webroot\WEB-INF\embed\finedb\db.lck"
if (-not $NoKill -and (Test-Path $lck)) { Remove-Item $lck -Force }
exit (Start-EngineJava -FrHome $FR -Script $Script -Out $Out -Heap $Heap -PidFile $env:FR_AGENT_JAVA_PIDFILE)
