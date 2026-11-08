# acceptance/tools/verify_oracle.ps1 - cross-language check of the acceptance fixture oracle.
#   Purpose: the JS generator (acceptance/tools/gen_fixture.js) writes expected.json from the same rows.
#   This script recomputes every oracle key with an INDEPENDENT implementation (PowerShell) and compares.
#   It validates report math baselines, not source-data business correctness (see acceptance/README.md).
#   ASCII-only (AGENTS sec.5: PS 5.1 parses .ps1 as ANSI).
#   Usage: powershell -NoProfile -File acceptance/tools/verify_oracle.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$fx = Join-Path $root 'acceptance\fixtures\sales'
$orders = Get-Content (Join-Path $fx 'orders.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$products = Get-Content (Join-Path $fx 'products.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$customers = Get-Content (Join-Path $fx 'customers.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$employees = Get-Content (Join-Path $fx 'employees.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$inventory = Get-Content (Join-Path $fx 'inventory.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$expected = (Get-Content (Join-Path $fx 'expected.json') -Raw -Encoding UTF8 | ConvertFrom-Json).keys

$prodById = @{}; foreach ($p in $products) { $prodById[$p.id] = $p }
$custById = @{}; foreach ($c in $customers) { $custById[$c.id] = $c }
$empById = @{}; foreach ($e in $employees) { $empById[$e.id] = $e }
$orderById = @{}; foreach ($o in $orders) { $orderById[$o.orderId] = $o }

$script:checks = 0
$script:fails = 0
function CheckText([string]$name, [string]$actual, [string]$expectedValue) {
  $script:checks++
  if ($actual -ne $expectedValue) {
    $script:fails++
    Write-Host ("ORACLE MISMATCH {0}: actual={1} expected={2}" -f $name, $actual, $expectedValue)
  }
}
function CheckNum([string]$name, [double]$actual, [double]$expectedValue) {
  $script:checks++
  if ([math]::Abs($actual - $expectedValue) -gt 0.000000001) {
    $script:fails++
    Write-Host ("ORACLE MISMATCH {0}: actual={1} expected={2}" -f $name, $actual, $expectedValue)
  }
}
function Round4([double]$x) { return [math]::Round($x, 4, [System.MidpointRounding]::AwayFromZero) }

$K = @{}
$totalQty = 0; $totalAmount = 0; $totalProfit = 0
$negRows = 0; $zeroRows = 0; $emptyCityRows = 0
$regionAmount = @{}; $regionOrders = @{}; $regionCustSets = @{}
$provinceAmount = @{}; $monthAmount = @{}; $productAmount = @{}; $categoryAmount = @{}
$deptAmount = @{}; $empAmount = @{}
$allCust = @{}; $allProd = @{}; $allEmp = @{}
$currentAmount = 0; $previousAmount = 0

foreach ($o in $orders) {
  $c = $custById[$o.customerId]
  $e = $empById[$o.employeeId]
  $p = $prodById[$o.productId]
  $totalQty += [double]$o.qty
  $totalAmount += [double]$o.amount
  $totalProfit += [double]$o.profit
  if ([double]$o.profit -lt 0) { $negRows++ }
  if ([double]$o.amount -eq 0) { $zeroRows++ }
  if ([string]::IsNullOrEmpty([string]$c.city)) { $emptyCityRows++ }

  if (-not $regionAmount.ContainsKey($c.region)) { $regionAmount[$c.region] = 0; $regionOrders[$c.region] = 0; $regionCustSets[$c.region] = @{} }
  $regionAmount[$c.region] += [double]$o.amount
  $regionOrders[$c.region] += 1
  $regionCustSets[$c.region][$c.id] = 1

  if (-not $provinceAmount.ContainsKey($c.province)) { $provinceAmount[$c.province] = 0 }
  $provinceAmount[$c.province] += [double]$o.amount

  $ym = ([string]$o.orderDate).Substring(0, 7)
  if (-not $monthAmount.ContainsKey($ym)) { $monthAmount[$ym] = 0 }
  $monthAmount[$ym] += [double]$o.amount

  if (-not $productAmount.ContainsKey($p.name)) { $productAmount[$p.name] = 0 }
  $productAmount[$p.name] += [double]$o.amount
  if (-not $categoryAmount.ContainsKey($p.category)) { $categoryAmount[$p.category] = 0 }
  $categoryAmount[$p.category] += [double]$o.amount

  if (-not $deptAmount.ContainsKey($e.dept)) { $deptAmount[$e.dept] = 0 }
  $deptAmount[$e.dept] += [double]$o.amount
  if (-not $empAmount.ContainsKey($e.name)) { $empAmount[$e.name] = 0 }
  $empAmount[$e.name] += [double]$o.amount

  $allCust[$o.customerId] = 1; $allProd[$o.productId] = 1; $allEmp[$o.employeeId] = 1
  if ($ym -ge '2025-07' -and $ym -le '2026-06') { $currentAmount += [double]$o.amount }
  if ($ym -ge '2024-07' -and $ym -le '2025-06') { $previousAmount += [double]$o.amount }
}

$K['orders.count'] = [double]$orders.Count
$K['orders.qty'] = $totalQty
$K['orders.amount'] = $totalAmount
$K['orders.profit'] = $totalProfit
$K['orders.customers'] = [double]$allCust.Count
$K['orders.products'] = [double]$allProd.Count
$K['orders.employees'] = [double]$allEmp.Count
$K['orders.negativeProfitRows'] = [double]$negRows
$K['orders.zeroAmountRows'] = [double]$zeroRows
$K['orders.emptyCityRows'] = [double]$emptyCityRows
$r1 = $orderById['SO202407-001']; $r2 = $orderById['SO202407-002']
$K['orders.first.orderId'] = [string]$r1.orderId
$K['orders.first.qty'] = [double]$r1.qty
$K['orders.first.unitPrice'] = [double]$r1.unitPrice
$K['orders.first.amount'] = [double]$r1.amount
$K['orders.row2.orderId'] = [string]$r2.orderId
$K['orders.row2.qty'] = [double]$r2.qty
$K['orders.row2.unitPrice'] = [double]$r2.unitPrice
$K['orders.row2.amount'] = [double]$r2.amount

foreach ($r in $regionAmount.Keys) {
  $K["region.${r}.amount"] = $regionAmount[$r]
  $K["region.${r}.orders"] = [double]$regionOrders[$r]
  $K["region.${r}.customers"] = [double]$regionCustSets[$r].Count
}
foreach ($p in $provinceAmount.Keys) { $K["province.${p}.amount"] = $provinceAmount[$p] }
$K['province.count'] = [double]$provinceAmount.Count
foreach ($m in $monthAmount.Keys) { $K["month.${m}.amount"] = $monthAmount[$m] }
$K['month.2025-02.amount'] = 0.0
$K['months.noData'] = '2025-02'
$twelve = @()
for ($i = 0; $i -lt 12; $i++) {
  $m = 7 + $i
  $y = 2025
  while ($m -gt 12) { $m -= 12; $y++ }
  $twelve += ("{0}-{1:D2}" -f $y, $m)
}
$K['months.12'] = $twelve -join '|'
foreach ($p in $products) {
  $K["product.$($p.id).amount"] = $productAmount[$p.name]
  $K["product.$($p.id).name"] = [string]$p.name
}
foreach ($c in $categoryAmount.Keys) { $K["category.${c}.amount"] = $categoryAmount[$c] }
foreach ($d in $deptAmount.Keys) { $K["dept.${d}.amount"] = $deptAmount[$d] }
foreach ($e in $employees) { $K["employee.$($e.id).amount"] = $empAmount[$e.name] }

$prodRank = @($products | ForEach-Object { [pscustomobject]@{ id = $_.id; name = $_.name; amount = [double]$productAmount[$_.name] } })
$prodRank = @($prodRank | Sort-Object @{ Expression = 'amount'; Descending = $true }, @{ Expression = 'id'; Descending = $false })
$K['product.top10'] = ($prodRank | Select-Object -First 10 | ForEach-Object { $_.name }) -join '|'
$K['product.top10.ids'] = ($prodRank | Select-Object -First 10 | ForEach-Object { $_.id }) -join '|'
$K['product.top10.amounts'] = ($prodRank | Select-Object -First 10 | ForEach-Object { $_.amount }) -join '|'

$empRank = @($employees | ForEach-Object { [pscustomobject]@{ id = $_.id; name = $_.name; amount = [double]$empAmount[$_.name] } })
$empRank = @($empRank | Sort-Object @{ Expression = 'amount'; Descending = $true }, @{ Expression = 'id'; Descending = $false })
$K['employee.rank'] = ($empRank | ForEach-Object { $_.name }) -join '|'
$K['employee.rank.amounts'] = ($empRank | ForEach-Object { $_.amount }) -join '|'

$K['inventory.rows'] = [double]$inventory.Count
$K['inventory.opening.total'] = [double](($inventory | Measure-Object -Property opening -Sum).Sum)
$K['inventory.inbound.total'] = [double](($inventory | Measure-Object -Property inbound -Sum).Sum)
$K['inventory.outbound.total'] = [double](($inventory | Measure-Object -Property outbound -Sum).Sum)
$K['inventory.closing.total'] = [double](($inventory | Measure-Object -Property closing -Sum).Sum)
$invByKey = @{}; foreach ($row in $inventory) { $invByKey["$($row.productId).$($row.warehouseId)"] = $row }
foreach ($invKey in @('P01.W01', 'P05.W02', 'P12.W04')) {
  $row = $invByKey[$invKey]
  $K["inventory.${invKey}.closing"] = [double]$row.closing
  $K["inventory.${invKey}.opening"] = [double]$row.opening
  $K["inventory.${invKey}.inbound"] = [double]$row.inbound
  $K["inventory.${invKey}.outbound"] = [double]$row.outbound
}

$lastMonth = [double]$monthAmount['2026-06']
$prevMonth = [double]$monthAmount['2026-05']
$K['analysis.mom.lastAmount'] = $lastMonth
$K['analysis.mom.prevAmount'] = $prevMonth
$K['analysis.mom.rate'] = Round4(($lastMonth - $prevMonth) / $prevMonth)
$K['analysis.yoy.currentAmount'] = $currentAmount
$K['analysis.yoy.previousAmount'] = $previousAmount
$K['analysis.yoy.rate'] = Round4(($currentAmount - $previousAmount) / $previousAmount)
$K['totals.profitRate'] = Round4($totalProfit / $totalAmount)
$filterRegion = $null
foreach ($p in $expected.PSObject.Properties) {
  if ($p.Name -match '^filter\.region\.(.+)\.amount$') { $filterRegion = $Matches[1] }
}
if ($filterRegion -ne $null) {
  $K["filter.region.${filterRegion}.amount"] = $regionAmount[$filterRegion]
  $K["filter.region.${filterRegion}.rows"] = [double]$regionOrders[$filterRegion]
}

$unchecked = 0
foreach ($p in $expected.PSObject.Properties) {
  $name = $p.Name
  if (-not $K.ContainsKey($name)) { $unchecked++; Write-Host ("ORACLE UNCHECKED: {0}" -f $name); continue }
  $ev = $p.Value
  if ($ev -is [array]) { CheckText $name ([string]$K[$name]) ([string]($ev -join '|')) }
  elseif ($ev -is [string]) { CheckText $name ([string]$K[$name]) ([string]$ev) }
  else { CheckNum $name ([double]$K[$name]) ([double]$ev) }
}
if ($unchecked -gt 0) { $script:fails++ }
if ($script:fails -eq 0) {
  Write-Host ("ORACLE CROSS-CHECK PASS ({0} keys, independent PowerShell recompute)" -f $script:checks)
} else {
  Write-Host ("ORACLE CROSS-CHECK FAIL (checks={0} fails={1} unchecked={2})" -f $script:checks, $script:fails, $unchecked)
}
exit $script:fails
