[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\demo'
$files = Get-ChildItem $root -Recurse -File -Filter *.cpt
$pats = @('<Frozen', '<Float', '<SubReport', 'cellSortAttr', '<RichText', '<PageFooter', '<Header', '<Watermark', '<ReportSettings', 'Barcode', '<Image', 'HtmlLabel', 'DictPresent', '<Present', '<SortCell', 'TreeComboBox', 'RadioGroup', 'CheckBoxGroup', '<ToolBar', 'com.fr.report.write', '<Condition', 'BlankPageContainer', '<ColumnRow', '<Parameter>')
foreach ($p in $pats) {
  $hit = $null
  foreach ($f in $files) {
    $c = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
    if ($c.Contains($p)) { $hit = $f; break }
  }
  if ($hit) {
    $rel = $hit.FullName.Substring($root.Length + 1)
    Write-Output ("{0,-18} -> {1}" -f $p, $rel)
  } else {
    Write-Output ("{0,-18} -> none" -f $p)
  }
}
