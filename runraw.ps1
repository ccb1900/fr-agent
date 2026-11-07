param([Parameter(Mandatory = $true)][string]$Script, [string]$Heap = '1200m')
# 2026-11-04 heap cap (README #46/#47): -Xmx ceiling, override with -Heap; no java-kill / no FineDB lock cleanup by design.
# r13 P2-C: FR install root from env FR_HOME (single source), default preserved.
# r16 P1#1: patch path now records java.pid too (unified launch) so the supervisor's leftover check can identify the JVM.
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'engine_launch.ps1')
# 2026-11-07 CWD anchoring (05b60c3 follow-up): same premise as run.ps1 - nashorn resolves a relative
#   script name against the CALLER's JVM working directory; fr_agent.ps1 patch/inspect_template call this
#   runner with bare relative names ('template/patch_main.js', 'template/inspect_main.js'), so an external
#   agent invoking from any non-root directory broke the verb here ('is not a file', rc=103). Anchor the
#   relative -Script to THIS file's directory (root-relative semantics as runtime/paths.js); absolutes pass.
if (-not [System.IO.Path]::IsPathRooted($Script)) { $Script = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $Script)) }
$FR = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
exit (Start-EngineJava -FrHome $FR -Script $Script -Heap $Heap -PidFile $env:FR_AGENT_JAVA_PIDFILE)
