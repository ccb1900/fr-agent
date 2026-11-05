param([Parameter(Mandatory = $true)][string]$Script, [string]$Out = '', [string]$Heap = '1200m', [switch]$NoKill)
# 2026-11-04 heap cap (README #46/#47): memory-tight host needs -Xmx ceiling; override with -Heap.
# r13 P2-C: FR install root from env FR_HOME (single source, matches Paths.js), default preserved for manual gate use.
# r16: Java launch unified via engine_launch.ps1 (records java.pid on the agent path when FR_AGENT_JAVA_PIDFILE is set).
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'engine_launch.ps1')
$FR = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
if (-not $NoKill) { Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force }
$lck = "$FR\webapps\webroot\WEB-INF\embed\finedb\db.lck"
if (-not $NoKill -and (Test-Path $lck)) { Remove-Item $lck -Force }
# commit preflight (README #46/#47) with bounded retry: committed memory can lag a few seconds after a previous JVM
#   exits (serial creates back-to-back); retry before declaring COMMIT_LIMIT_LOW so a transient dip does not fail a run.
$heapMB = [int]($Heap.TrimEnd('M','m'))
$needMB = $heapMB + 900
$freeMB = 0
for ($try = 0; $try -lt 6; $try++) {
  $os = Get-CimInstance Win32_OperatingSystem
  $freeMB = [int]($os.FreeVirtualMemory/1KB)
  if ($freeMB -ge $needMB) { break }
  Start-Sleep -Seconds 3
}
if ($freeMB -lt $needMB) {
  Write-Output ("COMMIT_LIMIT_LOW: free={0}MB need~{1}MB (heap {2} + ~900MB native/headroom).{3}Close memory hogs (vmmemWSL => wsl --shutdown) or enlarge pagefile, then rerun. See README #46/#47." -f $freeMB, $needMB, $Heap, [char]10)
  exit 8
}
exit (Start-EngineJava -FrHome $FR -Script $Script -Out $Out -Heap $Heap -PidFile $env:FR_AGENT_JAVA_PIDFILE)
