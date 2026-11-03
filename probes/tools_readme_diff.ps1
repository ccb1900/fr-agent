param([string]$Src = 'D:/fineagent/_entry34.txt')
$b = [System.IO.File]::ReadAllBytes('D:\fineagent\README.md')
$gbk = [System.Text.Encoding]::GetEncoding(936)
$src = [System.IO.File]::ReadAllText($Src, (New-Object System.Text.UTF8Encoding($false)))
$add = $gbk.GetBytes($src)
$back = $gbk.GetString($b, $b.Length - $add.Length, $add.Length)
"srcChars=$($src.Length) backChars=$($back.Length)"
$max = [Math]::Max($src.Length, $back.Length)
$n = 0
for ($i = 0; $i -lt $max; $i++) {
  $a = if ($i -lt $src.Length) { $src[$i] } else { '<none>' }
  $c = if ($i -lt $back.Length) { $back[$i] } else { '<none>' }
  if ($a -ne $c) { $n++; if ($n -le 10) { "DIFF at $i : src='" + $a + "'(0x{0:X4}) back='" + $c + "'(0x{1:X4})" -f [int][char]$a, [int][char]$c } }
}
"totalDiffs=$n"
