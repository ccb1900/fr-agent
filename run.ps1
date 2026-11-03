param([Parameter(Mandatory = $true)][string]$Script, [string]$Out = '')
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
if ($Out -ne '') {
  & $java '-Djava.awt.headless=true' '-cp' $cp 'jdk.nashorn.tools.Shell' $Script *> $Out
  "EXIT=$LASTEXITCODE log=$Out"
} else {
  & $java '-Djava.awt.headless=true' '-cp' $cp 'jdk.nashorn.tools.Shell' $Script
}
