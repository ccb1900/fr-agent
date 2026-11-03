param([string]$File, [string]$Tag, [int]$Before = 250, [int]$Len = 600)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$c = [IO.File]::ReadAllText($File, [Text.Encoding]::UTF8)
$re = [regex]::new([regex]::Escape($Tag), 'IgnoreCase')
$n = 0
foreach ($m in $re.Matches($c)) {
  $s = [Math]::Max(0, $m.Index - $Before)
  Write-Output ("---- hit {0} @ {1} ----" -f ($n + 1), $m.Index)
  Write-Output $c.Substring($s, [Math]::Min($Len, $c.Length - $s))
  $n++
  if ($n -ge 4) { break }
}
if ($n -eq 0) { Write-Output "NO MATCH: $Tag" }
