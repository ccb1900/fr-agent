param([string]$Word = 'sort', [int]$Count = 6)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\demo'
$files = Get-ChildItem $root -Recurse -File -Filter *.cpt
$found = 0
foreach ($f in $files) {
  $c = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
  foreach ($m in [regex]::Matches($c, '[S|s]ort[A-Za-z]*="[^"]*"')) {
    Write-Output ("{0} :: {1}" -f $f.FullName.Substring($root.Length + 1), $m.Value)
    $found++
    if ($found -ge $Count) { break }
  }
  if ($found -ge $Count) { break }
}
if ($found -eq 0) { Write-Output "NO sort attr" }
