param([int]$From = 0)
$b = [System.IO.File]::ReadAllBytes('D:\fineagent\README.md')
$gbk = [System.Text.Encoding]::GetEncoding(936)
$tail = $gbk.GetString($b, $b.Length - $From, $From)
$lines = $tail -split "`n"
$i = 0
foreach ($l in $lines) { $i++; "{0,3}|{1}" -f $i, $l }
