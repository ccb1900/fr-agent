param([string]$Path = 'D:/fineagent/GENERATOR_DESIGN.md')
$b = [System.IO.File]::ReadAllBytes($Path)
$strict = New-Object System.Text.UTF8Encoding($false, $true)
try {
  $t = $strict.GetString($b); $enc = 'utf8'
} catch {
  $t = [System.Text.Encoding]::GetEncoding(936).GetString($b); $enc = 'gbk'
}
$lines = $t -split "`r`n"
if ($lines.Count -lt 3) { $lines = $t -split "`n" }
$rep = @()
$rep += "encoding=$enc chars=$($t.Length) lines=$($lines.Count)"
$rep += "--- last 14 ---"
$rep += ($lines | Select-Object -Last 14)
$rep += "--- headings ---"
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^#{1,3} ') { $rep += ("{0}: {1}" -f ($i + 1), $lines[$i]) }
}
[System.IO.File]::WriteAllLines($Path + '.report.txt', $rep, (New-Object System.Text.UTF8Encoding($false)))
"wrote $Path.report.txt"
