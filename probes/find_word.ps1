[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\demo'
$files = Get-ChildItem $root -Recurse -File -Filter *.cpt
$words = @('Freeze', 'frozenColumn', 'frozenRow', 'FreezePosition', 'ReportSettings', 'PageHeader', '<Header', '<Footer', 'WatermarkAttr', 'ToolBarManager', 'RichText', 'FloatElement')
foreach ($w in $words) {
  $hit = $null
  foreach ($f in $files) {
    $c = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
    if ($c.Contains($w)) { $hit = $f; break }
  }
  if ($hit) { Write-Output ("{0,-18} -> {1}  ({2} hits)" -f $w, $hit.FullName.Substring($root.Length + 1), ([regex]::Matches([IO.File]::ReadAllText($hit.FullName, [Text.Encoding]::UTF8), [regex]::Escape($w))).Count) }
  else { Write-Output ("{0,-18} -> none" -f $w) }
}
