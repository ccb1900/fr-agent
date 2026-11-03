param([string]$Tag = 'cellSortAttr', [int]$Before = 0, [int]$Len = 260, [int]$Count = 3)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = 'D:\software\FineReport_11.0\webapps\webroot\WEB-INF\reportlets\demo'
$files = Get-ChildItem $root -Recurse -File -Filter *.cpt
$found = 0
foreach ($f in $files) {
  $c = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
  $idx = -1
  while ($found -lt $Count) {
    $idx = $c.IndexOf($Tag, $idx + 1)
    if ($idx -lt 0) { break }
    $s = [Math]::Max(0, $idx - $Before)
    $snippet = $c.Substring($s, [Math]::Min($Len, $c.Length - $s))
    if ($snippet -notmatch [regex]::Escape($Tag) + '\s*/>') {
      Write-Output ("===== {0} =====" -f $f.FullName.Substring($root.Length + 1))
      Write-Output $snippet
      $found++
    }
  }
  if ($found -ge $Count) { break }
}
if ($found -eq 0) { Write-Output "NO NON-EMPTY MATCH: $Tag" }
