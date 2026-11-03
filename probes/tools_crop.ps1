param([string]$Src,[string]$Dst,[int]$X,[int]$Y,[int]$W,[int]$H,[int]$Zoom=2)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Src)
$bw = [int]($W * $Zoom)
$bh = [int]($H * $Zoom)
$bmp = New-Object System.Drawing.Bitmap -ArgumentList $bw, $bh
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$srcRect = New-Object System.Drawing.Rectangle -ArgumentList $X, $Y, $W, $H
$dstRect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $bw, $bh
$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose(); $img.Dispose()
$bmp.Save($Dst, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
"saved $Dst ${bw}x${bh}"
