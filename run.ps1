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
$FR = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
if (-not $NoKill) { Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force }
$lck = "$FR\webapps\webroot\WEB-INF\embed\finedb\db.lck"
if (-not $NoKill -and (Test-Path $lck)) { Remove-Item $lck -Force }
exit (Start-EngineJava -FrHome $FR -Script $Script -Out $Out -Heap $Heap -PidFile $env:FR_AGENT_JAVA_PIDFILE)
