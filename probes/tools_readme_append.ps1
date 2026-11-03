param([string]$TextFile)
$path = 'D:\fineagent\README.md'
$b = [System.IO.File]::ReadAllBytes($path)
$origLen = $b.Length
$last = $b[$origLen - 1]
"orig bytes=$origLen lastByte=0x{0:X2}" -f $last
$body = [System.IO.File]::ReadAllText($TextFile, (New-Object System.Text.UTF8Encoding($false)))
$gbk = [System.Text.Encoding]::GetEncoding(936)
$add = $gbk.GetBytes($body)
"append utf8chars={0} gbkbytes={1}" -f $body.Length, $add.Length
$out = New-Object byte[] ($origLen + $add.Length)
[Array]::Copy($b, 0, $out, 0, $origLen)
[Array]::Copy($add, 0, $out, $origLen, $add.Length)
[System.IO.File]::WriteAllBytes($path, $out)
$b2 = [System.IO.File]::ReadAllBytes($path)
"new bytes=$($b2.Length)"
$same = $true
for ($i = 0; $i -lt $origLen; $i++) { if ($b2[$i] -ne $b[$i]) { $same = $false; "DIFF AT $i"; break } }
"archived bytes unchanged=$same"
# 回读校验：整文件按 GBK 解码，末行必须能还原出追加文本
$back = $gbk.GetString($b2, $origLen, $add.Length)
"roundtrip equal=$($back -eq $body)"
