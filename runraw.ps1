param([Parameter(Mandatory = $true)][string]$Script)
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
& "$FR\jre\bin\java.exe" '-Djava.awt.headless=true' '-cp' $cp 'jdk.nashorn.tools.Shell' $Script
