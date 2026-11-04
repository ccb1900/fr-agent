param([Parameter(Mandatory = $true)][string]$Script, [string]$Out = '', [string]$Heap = '1200m')
# 2026-11-04 heap cap (README #46/#47): memory-tight host needs -Xmx ceiling; override with -Heap
$FR = 'D:\software\FineReport_11.0'
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force
$lck = "$FR\webapps\webroot\WEB-INF\embed\finedb\db.lck"
if (Test-Path $lck) { Remove-Item $lck -Force }
$cp = @(
  "$FR\jre\lib\ext\nashorn.jar",
  "$FR\jre\lib\tools.jar",
  "$FR\.install4j\i4jruntime.jar",
  "$FR\.install4j\user.jar",
  "$FR\lib\*",
  "$FR\server\lib\*",
  "$FR\webapps\webroot\WEB-INF\lib\*"
) -join ';'
$java = "$FR\jre\bin\java.exe"
$heapArg = "-Xmx$Heap"
# 2026-11-04 commit preflight (README #46/#47): fail fast with actionable msg instead of JVM "Could not reserve"
$os = Get-CimInstance Win32_OperatingSystem
$freeMB = [int]($os.FreeVirtualMemory/1KB)
$heapMB = [int]($Heap.TrimEnd('M','m'))
$needMB = $heapMB + 900
if ($freeMB -lt $needMB) {
  Write-Output ("COMMIT_LIMIT_LOW: free={0}MB need~{1}MB (heap {2} + ~900MB native/headroom).{3}Close memory hogs (vmmemWSL => wsl --shutdown) or enlarge pagefile, then rerun. See README #46/#47." -f $freeMB, $needMB, $Heap, [char]10)
  exit 8
}
if ($Out -ne '') {
  & $java '-Djava.awt.headless=true' $heapArg '-cp' $cp 'jdk.nashorn.tools.Shell' $Script *> $Out
  "EXIT=$LASTEXITCODE log=$Out"
} else {
  & $java '-Djava.awt.headless=true' $heapArg '-cp' $cp 'jdk.nashorn.tools.Shell' $Script
}
