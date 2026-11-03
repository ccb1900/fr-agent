# tools_br_run.ps1 — 数据浏览器六次渲染（3 张正式 + 3 组探针参数），一次跑完
$ErrorActionPreference = 'Continue'
$base = 'D:\fineagent'

function Run($spec, $out, $page, $size, $stage, $d1, $d2, $dump) {
  $env:REPORT_SPEC = $spec  if ($out)   { $env:BR_OUT = $out }   else { Remove-Item env:BR_OUT -ErrorAction SilentlyContinue }
  if ($page)  { $env:BR_PAGE = $page }  else { Remove-Item env:BR_PAGE -ErrorAction SilentlyContinue }
  if ($size)  { $env:BR_SIZE = $size }  else { Remove-Item env:BR_SIZE -ErrorAction SilentlyContinue }
  if ($stage) { $env:BR_STAGE = $stage } else { Remove-Item env:BR_STAGE -ErrorAction SilentlyContinue }
  if ($d1)    { $env:BR_D1 = $d1 }      else { Remove-Item env:BR_D1 -ErrorAction SilentlyContinue }
  if ($d2)    { $env:BR_D2 = $d2 }      else { Remove-Item env:BR_D2 -ErrorAction SilentlyContinue }
  $env:RESULT_DUMP = $dump
  Write-Host "=== $spec out=$out page=$page size=$size stage=$stage d1=$d1 -> $dump"
  & "$base\run.ps1" "$base\make_api.js" | Select-Object -Last 6
}

Run "reports/br_laser_aaa.js"      '' 2  50 '' '' ''       "$base\logs\_br_aaa_p2_grid.txt"
Run "reports/br_laser_aaa.js"      '' 1  10 'L' '' ''      "$base\logs\_br_aaa_stageL_grid.txt"
Run "reports/br_laser_aaa.js"      '' 1  20 '' '2026-09-13' '2026-09-13' "$base\logs\_br_aaa_d13_grid.txt"
Run "reports/br_laser_aaa.js"      '' '' '' '' '' ''       "$base\logs\_br_aaa_grid.txt"
Run "reports/br_laser_aaa_gosa.js" '' '' '' '' '' ''       "$base\logs\_br_gosa_grid.txt"
Run "reports/br_laser_pwr.js"      '' '' '' '' '' ''       "$base\logs\_br_pwr_grid.txt"
