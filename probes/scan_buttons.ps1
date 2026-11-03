[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\demo'
$set = @{}
foreach ($f in (Get-ChildItem $root -Recurse -File -Filter *.cpt)) {
  $c = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
  foreach ($m in [regex]::Matches($c, 'com\.fr\.report\.web\.button\.[A-Za-z0-9_.]+')) {
    $k = $m.Value
    if ($set.ContainsKey($k)) { $set[$k]++ } else { $set[$k] = 1 }
  }
}
$set.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "{0,5}  {1}" -f $_.Value, $_.Key }
