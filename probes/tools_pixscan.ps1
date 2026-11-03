param([string]$Src,[string]$Axis='x',[int]$Fixed=0,[int]$From=0,[int]$To=100)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($Src)
$prev=''; $start=$From
for ($i=$From; $i -le $To; $i++) {
  $c = if ($Axis -eq 'x') { $bmp.GetPixel($i,$Fixed) } else { $bmp.GetPixel($Fixed,$i) }
  $k = '{0:X2}{1:X2}{2:X2}' -f $c.R,$c.G,$c.B
  if ($k -ne $prev) { if ($prev -ne '') { "{0}-{1} #{2}" -f $start,($i-1),$prev }; $prev=$k; $start=$i }
}
"{0}-{1} #{2}" -f $start,$To,$prev
$bmp.Dispose()
