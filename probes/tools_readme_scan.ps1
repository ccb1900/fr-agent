param([switch]$Tail)
$b = [System.IO.File]::ReadAllBytes('D:\fineagent\README.md')
$gbk = [System.Text.Encoding]::GetEncoding(936)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$head = $gbk.GetString($b[0..400])
"first400 as GBK: " + ($head -replace "`r","" -replace "`n"," | ")
$asUtf8 = $utf8.GetString($b)
"first400 as UTF8: " + (($asUtf8.Substring(0,[Math]::Min(200,$asUtf8.Length))) -replace "`r","" -replace "`n"," | ")
$txt = $gbk.GetString($b)
$lines = $txt -split "`r`n"
"lines=" + $lines.Count
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^\s*#+\s' -or $lines[$i] -match '^\s*\d+\.\s') { "{0}: {1}" -f ($i + 1), $lines[$i] }
}
