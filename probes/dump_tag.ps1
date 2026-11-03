param([string]$File, [string]$Tag, [int]$Before = 200, [int]$Len = 2500, [int]$Count = 1)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$c = [IO.File]::ReadAllText($File, [Text.Encoding]::UTF8)
$idx = -1; $n = 0
while ($n -lt $Count) {
  $idx = $c.IndexOf($Tag, $idx + 1)
  if ($idx -lt 0) { break }
  $s = [Math]::Max(0, $idx - $Before)
  Write-Output ("===== hit {0} @ {1} =====" -f ($n + 1), $idx)
  Write-Output $c.Substring($s, [Math]::Min($Len, $c.Length - $s))
  $n++
}
if ($n -eq 0) { Write-Output "NO MATCH: $Tag" }
