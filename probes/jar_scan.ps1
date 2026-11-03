param([string[]]$Patterns = @('rich', 'FloatElement', 'WatermarkAttr', 'ToolBar', 'VanChart'))
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$jars = @()
$jars += Get-ChildItem 'D:\software\FineReport_11.0\lib' -Filter *.jar -File
$jars += Get-ChildItem 'D:\software\FineReport_11.0\server\lib' -Filter *.jar -File
$jars += Get-ChildItem 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\lib' -Filter *.jar -File
foreach ($j in $jars) {
  try { $z = [IO.Compression.ZipFile]::OpenRead($j.FullName) } catch { continue }
  foreach ($e in $z.Entries) {
    $n = $e.FullName
    if ($n -notlike '*.class') { continue }
    foreach ($p in $Patterns) {
      if ($n -match $p) { Write-Output ("{0} :: {1}" -f $j.Name, $n); break }
    }
  }
  $z.Dispose()
}
