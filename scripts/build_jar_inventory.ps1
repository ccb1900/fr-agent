# build_jar_inventory.ps1 - E1 engine-truth inventory: what classes the CORE jars physically contain.
#   Why: the demo CPT corpus is not the engine surface. A capability's ledger row must be anchored to a
#   class that exists in the installed jars (free/core, not paid plugin jars), or to a documented engine
#   fact. This script scans the install once and writes data/jar_class_inventory.json:
#     generatedAt      - when the scan ran
#     jars[]           - core jar name + entry count + length (a fingerprint of the install we judged)
#     packageCounts{}  - com.fr.<pkg> class counts for the WHOLE com.fr tree (the universe size)
#     resolved{}       - every class named by the pipeline/manifest/map -> the core jar that carries it
#     missing[]        - named by the pipeline but NOT in any core jar (a real E1 gap, must be empty)
#   The named-class set is collected from: lib/*.js, template/*.js, agent/tools/*.js, data/engine_class_map.json,
#   application/capability_manifest.js evidence. Re-run after a FineReport upgrade; the fast gate
#   verify/fast_jar_provenance.js re-checks the committed inventory against the map and the manifest.
#   ASCII-only (PS 5.1 GBK lesson). Engine-free apart from reading jar files (no java, no FineDB).
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fr = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
$dirs = @(
  (Join-Path $fr 'lib'),
  (Join-Path $fr 'server\lib'),
  (Join-Path $fr 'webapps\webroot\WEB-INF\lib')
)
$jars = @()
foreach ($d in $dirs) {
  if (-not (Test-Path $d)) { continue }
  foreach ($j in Get-ChildItem -LiteralPath $d -Filter '*.jar' -File) {
    $jars += $j
  }
}
# dedupe by full path, then by name+length (the same library may be staged twice)
$seen = @{}
$uniq = @()
foreach ($j in $jars) {
  $k = $j.Name + '|' + $j.Length
  if ($seen.ContainsKey($k)) { continue }
  $seen[$k] = 1
  $uniq += $j
}
Write-Output ('jar-scan: ' + $uniq.Count + ' core jars')

# ---- 1) collect the class names we must be able to resolve ----
#   Java class names are PascalCase in this codebase; a name whose LAST segment starts lowercase is a
#   package mention or a glued method call ('...Type.getAlignType', 'com.fr.report.web'), not a class.
$named = New-Object System.Collections.Generic.HashSet[string]
function Add-Names([string]$text) {
  foreach ($m in [regex]::Matches($text, 'com\.fr\.[A-Za-z0-9_.$]+')) {
    $t = $m.Value.TrimEnd('.')
    if ($t.Contains('$')) { $t = $t.Substring(0, $t.IndexOf('$')) }      # inner class resolves via its outer
    if ($t -cmatch '\.[a-z][A-Za-z0-9_]*$') { continue }                 # package / method mention
    $last = $t.Substring($t.LastIndexOf('.') + 1)
    if ($last -cnotmatch '^[A-Z]') { continue }                          # not a class name
    if ($t -cmatch '^com\.fr\.[A-Za-z0-9_.$]+$') { [void]$named.Add($t) }
  }
}
foreach ($sub in @('lib', 'template', 'agent\tools')) {
  $p = Join-Path $RepoRoot $sub
  if (-not (Test-Path $p)) { continue }
  foreach ($f in Get-ChildItem -LiteralPath $p -File -Filter '*.js') {
    Add-Names ([System.IO.File]::ReadAllText($f.FullName))
  }
}
foreach ($f in @('application\capability_manifest.js', 'data\engine_class_map.json')) {
  $p = Join-Path $RepoRoot $f
  if (Test-Path $p) { Add-Names ([System.IO.File]::ReadAllText($p)) }
}
Write-Output ('named classes: ' + $named.Count)

# ---- 2) scan jars: package counts + resolve the named set ----
$pkgCounts = @{}
$resolved = @{}
$jarInfo = @()
$totalClasses = 0
foreach ($j in $uniq) {
  $z = $null
  try { $z = [IO.Compression.ZipFile]::OpenRead($j.FullName) } catch { continue }
  $n = 0
  try {
    foreach ($e in $z.Entries) {
      $fn = $e.FullName
      if ($fn -notlike '*.class') { continue }
      $n++
      if ($fn -like 'com/fr/*') {
        $rel = $fn.Substring(7)               # strip 'com/fr/'
        $slash = $rel.IndexOf('/')
        if ($slash -gt 0) {
          $pkg = $rel.Substring(0, $slash)
          if (-not $pkgCounts.ContainsKey($pkg)) { $pkgCounts[$pkg] = 0 }
          $pkgCounts[$pkg]++
        }
      }
      $cn = $fn.Substring(0, $fn.Length - 6) -replace '/', '.'
      if ($cn.Contains('$')) { $cn = $cn.Substring(0, $cn.IndexOf('$')) }   # inner classes resolve via the outer
      if (($named.Contains($cn)) -and (-not $resolved.ContainsKey($cn))) {
        $resolved[$cn] = $j.Name
      }
    }
  } finally { $z.Dispose() }
  $totalClasses += $n
  $jarInfo += [ordered]@{ name = $j.Name; classes = $n; bytes = $j.Length }
}
$missing = @()
foreach ($c in $named) { if (-not $resolved.ContainsKey($c)) { $missing += $c } }
$missing = @($missing | Sort-Object)

$out = [ordered]@{
  tool = 'build_jar_inventory'
  generatedAt = (Get-Date).ToString('o')
  frHome = $fr
  jars = $jarInfo
  jarCount = $jarInfo.Count
  totalClasses = $totalClasses
  packageCounts = $pkgCounts
  namedCount = $named.Count
  resolved = $resolved
  missing = $missing
  note = 'resolved = named by lib/template/agent*.js + data/engine_class_map.json + manifest evidence, found in a CORE jar (lib, server/lib, WEB-INF/lib; paid plugin jars under WEB-INF/plugins are NOT scanned). missing must be empty for the pipeline to be E1-anchored.'
}
$outPath = Join-Path $RepoRoot 'data\jar_class_inventory.json'
[System.IO.File]::WriteAllText($outPath, ($out | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ('resolved=' + $resolved.Count + ' missing=' + $missing.Count + ' -> ' + $outPath)
if ($missing.Count -gt 0) {
  Write-Output 'MISSING (named by the pipeline but absent from every core jar):'
  $missing | ForEach-Object { Write-Output ('  ' + $_) }
  exit 2
}
exit 0
