param([Parameter(Mandatory = $true)][string]$Script, [string]$Heap = '1200m')
# 2026-11-04 heap cap (README #46/#47): -Xmx ceiling, override with -Heap; no java-kill / no FineDB lock cleanup by design
$FR = 'D:\software\FineReport_11.0'
$cp = @(
  "$FR\jre\lib\ext\nashorn.jar",
  "$FR\jre\lib\tools.jar",
  "$FR\.install4j\i4jruntime.jar",
  "$FR\.install4j\user.jar",
  "$FR\lib\*",
  "$FR\server\lib\*",
  "$FR\webapps\webroot\WEB-INF\lib\*"
) -join ';'
$heapArg = "-Xmx$Heap"
& "$FR\jre\bin\java.exe" '-Djava.awt.headless=true' $heapArg '-cp' $cp 'jdk.nashorn.tools.Shell' $Script
