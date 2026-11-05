param([Parameter(Mandatory = $true)][string]$Script, [string]$Heap = '1200m')
# 2026-11-04 heap cap (README #46/#47): -Xmx ceiling, override with -Heap; no java-kill / no FineDB lock cleanup by design.
# r13 P2-C: FR install root from env FR_HOME (single source), default preserved.
# r16 P1#1: patch path now records java.pid too (unified launch) so the supervisor's leftover check can identify the JVM.
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'engine_launch.ps1')
$FR = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
exit (Start-EngineJava -FrHome $FR -Script $Script -Heap $Heap -PidFile $env:FR_AGENT_JAVA_PIDFILE)
