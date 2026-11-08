# build_jar_surface.ps1 - jar-level chart-surface accounting (engine truth beyond the demo CPT corpus).
#   Why: the 240-demo corpus is NOT the engine surface. The core jars carry ~53 Plot/Plot4VanChart
#   classes; this script enumerates them, joins them with data/jar_surface_classifications.json
#   (supported / base / unsupported+reason) and writes data/jar_surface_analysis.json.
#   Every scanned class MUST have a classification entry; one that does not is an accounting blind
#   spot and fails the build (exit 2). A classification with no matching class is stale (also fails).
#   Engine-free (reads jar files only; no java, no FineDB). ASCII-only.
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fr = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
$dirs = @((Join-Path $fr 'lib'), (Join-Path $fr 'server\lib'), (Join-Path $fr 'webapps\webroot\WEB-INF\lib'))
$classMapPath = Join-Path $RepoRoot 'data\jar_surface_classifications.json'
$outPath = Join-Path $RepoRoot 'data\jar_surface_analysis.json'
if (-not (Test-Path $classMapPath)) { Write-Output ('JAR-SURFACE FAIL classification table missing: ' + $classMapPath); exit 2 }
$clsMap = [System.IO.File]::ReadAllText($classMapPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$seen = @{}
$plots = @()
$jarCount = 0
foreach ($d in $dirs) {
  if (-not (Test-Path $d)) { continue }
  foreach ($j in Get-ChildItem -LiteralPath $d -Filter '*.jar' -File) {
    $jarCount++
    $z = $null
    try { $z = [IO.Compression.ZipFile]::OpenRead($j.FullName) } catch { continue }
    try {
      foreach ($e in $z.Entries) {
        $n = $e.FullName
        if ($n -notmatch '^com/fr/(plugin/)?chart/.*(Plot|Plot4VanChart)\.class$') { continue }
        if ($n.Contains('$')) { continue }
        $cn = $n.Substring(0, $n.Length - 6) -replace '/', '.'
        if (-not $seen.ContainsKey($cn)) { $seen[$cn] = 1; $plots += $cn }
      }
    } finally { $z.Dispose() }
  }
}
$plots = @($plots | Sort-Object)
$table = @{}
foreach ($p in $clsMap.classes.PSObject.Properties) { $table[$p.Name] = $p.Value }

$entries = @()
$unclassified = @()
$counts = @{ supported = 0; base = 0; unsupported = 0 }
foreach ($cn in $plots) {
  if (-not $table.ContainsKey($cn)) { $unclassified += $cn; continue }
  $rec = $table[$cn]
  $st = '' + $rec.status
  if (-not $counts.ContainsKey($st)) { $counts[$st] = 0 }
  $counts[$st]++
  $entries += [ordered]@{ class = $cn; status = $st; cap = $(if ($rec.cap) { '' + $rec.cap } else { '' }); reason = $(if ($rec.reason) { '' + $rec.reason } else { '' }) }
}
$stale = @()
foreach ($cn in $table.Keys) { if (-not $seen.ContainsKey($cn)) { $stale += $cn } }

$out = [ordered]@{
  tool = 'build_jar_surface'
  generatedAt = (Get-Date).ToString('o')
  frHome = $fr
  coreJars = $jarCount
  plotClassCount = $plots.Count
  counts = $counts
  classes = $entries
  unclassified = $unclassified
  stale = $stale
  note = 'Core-jar chart plot classes only (designer/UI/paid-plugin jars excluded by scan roots). supported=wired to a capability; base=abstract/base class; unsupported=concrete family not wired, reason recorded. unclassified/stale must be empty.'
}
[System.IO.File]::WriteAllText($outPath, ($out | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ('JAR-SURFACE jars=' + $jarCount + ' plots=' + $plots.Count + ' supported=' + $counts['supported'] + ' base=' + $counts['base'] + ' unsupported=' + $counts['unsupported'] + ' unclassified=' + $unclassified.Count + ' stale=' + $stale.Count)
if ($unclassified.Count -gt 0) {
  Write-Output 'UNCLASSIFIED plot classes (accounting blind spot):'
  $unclassified | ForEach-Object { Write-Output ('  ' + $_) }
  exit 2
}
if ($stale.Count -gt 0) {
  Write-Output 'STALE classification entries (class not in core jars):'
  $stale | ForEach-Object { Write-Output ('  ' + $_) }
  exit 2
}
exit 0
