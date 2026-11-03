# 一次性: 读 logs/wh_files.txt（path:lineNo），逐条打印旧口令 token 的上下文切片（安全截取）
# token 字节用码点拼装，本文件不落明文。
$list = Get-Content 'D:\fineagent\logs\wh_files.txt'
$tok = -join ((119,104,109,101,105,107,111,64,49,50,51) | ForEach-Object { [char]$_ })
$hits = 0
foreach($line in $list){
  if([string]::IsNullOrWhiteSpace($line)){ continue }
  $idx = $line.LastIndexOf(':')
  $f = $line.Substring(0,$idx)
  $ln = [int]$line.Substring($idx+1)
  $t = [System.IO.File]::ReadAllLines($f, [System.Text.Encoding]::UTF8)[$ln-1]
  $i = $t.IndexOf($tok)
  $hits++
  if($i -lt 0){
    Write-Output ('NOENC: ' + $f + ':' + $ln)
  } else {
    $a = [Math]::Max(0,$i-18)
    $len = [Math]::Min(36+$i-$a, $t.Length-$a)
    Write-Output ($f.Replace('D:\fineagent\','') + ':' + $ln + '  [' + $t.Substring($a,$len) + ']')
  }
}
Write-Output ('total=' + $hits)
# 说明: 上面的打印会把命中的明文片段写进终端/日志 —— 仅限本机排查用，产物别入库。
