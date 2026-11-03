[Console]::OutputEncoding = [Text.Encoding]::UTF8
$files = Get-ChildItem 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets' -Recurse -File -Filter *.cpt
$n = 0
foreach ($f in $files) {
  $c = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
  $i = $c.IndexOf('<Header ')
  if ($i -lt 0) { continue }
  $j = $c.IndexOf('</Header>', $i)
  $seg = $c.Substring($i, [Math]::Min($j - $i + 10, 3000))
  if ($seg -notmatch '<LeftList/>\s*<CenterList/>\s*<RightList/>') {
    Write-Output ("==== {0} ====" -f $f.FullName.Substring('D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets'.Length + 1))
    Write-Output $seg
    $n++
    if ($n -ge 2) { break }
  }
}
if ($n -eq 0) { Write-Output 'NO NON-EMPTY HEADER' }
