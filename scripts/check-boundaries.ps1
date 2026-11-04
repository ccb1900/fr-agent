# check-boundaries.ps1 — ABR-1 依赖方向检查（轻量静态扫描，不加载任何 JS）
# 用法：powershell -File scripts\check-boundaries.ps1   ; 违例输出 + EXIT=1
# 规则（docs/architecture/dependency-rules.md）：
#   R1 lib/ 不得引用 features/ —— 唯一豁免 lib/browser.js（ABR-1 兼容垫片）
#   R2 lib/ir.js 必须保持零运行时依赖 —— 不得出现 Java.type / com.fr.
#   R3 runtime/ 不得持有业务报表知识 —— 不得引用 reports/ 或 BROWSER 或 laser 业务字样
#   R4 reports*/ 不得直接加载后端 —— 不得 load lib/object.js|cpt.js|ir.js（dbpass 凭据外围件不属后端）
#   R5 make_api.js 不得直接加载已迁移 Feature —— 不得出现 features/data_browser
$ErrorActionPreference = 'Stop'
$root = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
$viol = @()

# R1
Get-ChildItem "$root\lib" -Filter '*.js' | Where-Object { $_.Name -ne 'browser.js' } | ForEach-Object {
  if (Select-String -Path $_.FullName -Pattern 'features/|features\\' -Quiet) {
    $viol += "R1 lib/$($_.Name) 引用了 features/"
  }
}
# R2
if (Select-String -Path "$root\lib\ir.js" -Pattern 'Java\.type|com\.fr\.' -Quiet) {
  $viol += "R2 lib/ir.js 出现运行时依赖（Java.type/com.fr.）"
}
# R3
Get-ChildItem "$root\runtime" -Filter '*.js' | ForEach-Object {
  if (Select-String -Path $_.FullName -Pattern 'reports/|BROWSER|laser' -Quiet) {
    $viol += "R3 runtime/$($_.Name) 含业务报表知识"
  }
}
# R4
Get-ChildItem "$root\reports","$root\reports_prod" -Filter 'br_*.js' | ForEach-Object {
  if (Select-String -Path $_.FullName -Pattern "load\('D:/fineagent/lib/(object|cpt|ir)\.js'\)") {
    $viol += "R4 $($_.Name) 直接加载后端"
  }
}
# R5
if (Select-String -Path "$root\make_api.js" -Pattern 'features/data_browser' -Quiet) {
  $viol += "R5 make_api.js 直接加载已迁移 Feature"
}
# R6 Runner 接线断言（2026-11-04 审计后增补，docs/architecture/dependency-rules.md）
# R6a make_api.js 必含 Runtime/Paths 接线（文档声明的调用链可被机器验证）
foreach ($pat in @("Paths\.runtime\('bootstrap\.js'\)", "Paths\.runtime\('datasource\.js'\)", 'Runtime\.initialize\(\)', 'Paths\.lib\(', 'runtime/paths\.js')) {
  if (-not (Select-String -Path "$root\make_api.js" -Pattern $pat -Quiet)) {
    $viol += "R6a make_api.js 缺少接线断言: $pat"
  }
}
# R6b make_api.js 不得内联 FR 激活链/连接注册（只属 runtime/*）
if (Select-String -Path "$root\make_api.js" -Pattern 'ActivatorToolBox|SimpleWork|DatasourceManager' -Quiet) {
  $viol += "R6b make_api.js 内联了本应归属 runtime 的激活链/连接注册（ActivatorToolBox/SimpleWork/DatasourceManager）"
}
# R6c make_api.js 不得出现 load('D:... 硬编码绝对路径（路径单点在 runtime/paths.js）
if (Select-String -Path "$root\make_api.js" -Pattern "load\('D:" -Quiet) {
  $viol += "R6c make_api.js 出现硬编码绝对 load 路径（应走 Paths / FR_AGENT_HOME 单点）"
}

if ($viol.Count -gt 0) {
  Write-Host 'BOUNDARY VIOLATIONS:'
  $viol | ForEach-Object { Write-Host "  $_" }
  exit 1
}
Write-Host 'BOUNDARIES OK (R1-R6 clean)'
exit 0
