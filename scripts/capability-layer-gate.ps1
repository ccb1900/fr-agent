# capability-layer-gate.ps1 - Phase-4 batch-2-2: capability ID -> nine-layer PASS/BLOCKED matrix.
#   Single machine-judged pipeline the ask demands: any FineReport native capability enters through
#   ONE gate whose layers are computed from the ledgers + disk truth, never hand-written per cap:
#     probe    - the evidence's probe/carrier/fast/spec-carrier files actually exist on disk
#     object   - manifest v3 construction layer (construction evidence rules enforced by fast_manifest_evidence)
#     cpt      - manifest v3 serialization layer
#     render   - manifest v3 rendering layer (serialization-only = web behavior invisible in static PNG -> BLOCKED)
#     ir       - the capability word is in lib/ir.js (IR contract vocabulary, dumped live via nashorn)
#     spec     - the capability word is in lib/report_spec.js / lib/spec_validator.js (ReportSpec entrance)
#     planner  - the family flows through the planner chain (semantic/planner + agent/tools/plan.js)
#     agent    - manifest v3 agentAvailable (the ONLY layer allowed to advertise to the Agent)
#     manifest - entry present in capability_manifest.js v3 + evidence non-empty + regressionScope rules
#   Exit codes: 0 = known capability, matrix produced (BLOCKED layers allowed - they ARE the answer);
#               2 = unknown capability id (negative control MUST fail here, never print all-PASS);
#               3 = manifest/IR dump unavailable (java/nashorn missing) - BLOCKED, not a fake green.
#   regressionScope reconciliation is done HERE against the manifest as the single source (no separate
#   drifting report): regression=verified requires a scope in {ir,object,cpt,serialization,rendering,agent}.
#   ASCII-only (PS 5.1 GBK lesson). Engine-free decision-making except the one nashorn dump process.
param(
  [string]$Capability = '',
  [string]$Id = '',
  [Parameter(Position = 0)][string]$CapArg = ''
)
$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$target = $Capability
if (-not $target) { $target = $Id }
if (-not $target) { $target = $CapArg }
if (-not $target) {
  Write-Output 'LAYER-GATE FAIL no capability id given (usage: capability-layer-gate.ps1 -Capability <id> | <id> | -Id <id>)'
  exit 2
}

# ---- manifest + IR vocabulary dump (one nashorn process; FR_HOME env-or-default like the matrix) ----
$fr = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
$java = Join-Path $fr 'jre\bin\java.exe'
$nashorn = Join-Path $fr 'jre\lib\ext\nashorn.jar'
if (-not (Test-Path $java)) { Write-Output ('LAYER-GATE BLOCKED FR java missing: ' + $java); exit 3 }
$work = Join-Path $RepoRoot 'logs\_layer_gate'
New-Item -ItemType Directory -Force -Path $work | Out-Null
$dumpJs = Join-Path $work 'dump.js'
$dumpOut = Join-Path $work 'dump.txt'
$js = @'
var ROOT = java.lang.System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/application/capability_manifest.js');
load(ROOT + '/lib/ir.js');
var m = CapabilityManifest.build();
['chart', 'condition', 'write', 'page', 'product'].forEach(function (seg) {
  (m[seg] || []).forEach(function (c) {
    var ev = String(c.evidence || '').replace(/\|/g, ' / ').replace(/[\r\n]/g, ' ');
    print(['CAP', seg, c.name, c.construction, c.serialization, c.rendering, c.regression, (c.regressionScope || ''), (c.agentAvailable ? 'true' : 'false'), ev].join('|'));
  });
});
var ic = Ir.capabilities();
print('IRCHART|legacy=' + (ic.chart.legacy || []).join(',') + '|van=' + (ic.chart.vanChart || []).join(',') + '|deco=' + Object.keys(ic.chart.deco || {}).join(','));
print('IRPARAM|' + Object.keys(ic.param || {}).join(','));
print('IRCOND|keys=' + Object.keys(ic.condition || {}).join(',') + '|then=' + (ic.condition.thenActions || []).join(','));
print('IRDOMAIN|' + Object.keys(ic).join(','));
'@
[System.IO.File]::WriteAllText($dumpJs, $js, (New-Object System.Text.UTF8Encoding($false)))
$env:FR_AGENT_HOME = $RepoRoot
$dumpText = & $java '-Djava.awt.headless=true' '-Xmx400m' '-cp' $nashorn 'jdk.nashorn.tools.Shell' $dumpJs 2>&1
$dumpRc = $LASTEXITCODE
$caps = New-Object System.Collections.Generic.List[object]
$irChart = ''; $irParam = ''; $irCond = ''; $irDomain = ''
foreach ($ln in $dumpText) {
  $s = '' + $ln
  if ($s.StartsWith('CAP|')) {
    $p = $s.Split('|')
    $caps.Add([pscustomobject]@{ seg = $p[1]; name = $p[2]; construction = $p[3]; serialization = $p[4]; rendering = $p[5]; regression = $p[6]; scope = $p[7]; agentAvailable = ($p[8] -eq 'true'); evidence = $p[9] })
  } elseif ($s.StartsWith('IRCHART|')) { $irChart = $s }
  elseif ($s.StartsWith('IRPARAM|')) { $irParam = $s }
  elseif ($s.StartsWith('IRCOND|')) { $irCond = $s }
  elseif ($s.StartsWith('IRDOMAIN|')) { $irDomain = $s }
}
if ($dumpRc -ne 0 -or $caps.Count -lt 20) { Write-Output ("LAYER-GATE BLOCKED manifest dump unavailable (rc=$dumpRc entries=" + $caps.Count + ')'); exit 3 }

$entry = $null
foreach ($c in $caps) { if ($c.name -eq $target) { $entry = $c; break } }
if (-not $entry) {
  Write-Output ("LAYER-GATE FAIL unknown capability id: $target (not in capability_manifest v3; known=" + $caps.Count + ' entries)')
  exit 2
}

# ---- layer computations (each verdict cites its source) ----
$verdicts = New-Object System.Collections.Generic.List[string]
function Add-Verdict([string]$layer, [bool]$pass, [string]$detail) {
  $v = 'BLOCKED'; if ($pass) { $v = 'PASS' }
  $script:verdicts.Add(($layer + ' ' + $v + ' :: ' + $detail))
}
# probe layer: the evidence's referenced files must exist on disk
$ev = [string]$entry.evidence
$probeRefs = New-Object System.Collections.Generic.List[string]
foreach ($m in [regex]::Matches($ev, 'probes/([A-Za-z0-9_.-]+\.js)')) { $probeRefs.Add('probes/' + $m.Groups[1].Value) }
foreach ($m in [regex]::Matches($ev, 'reports/([A-Za-z0-9_.-]+\.js)')) { $probeRefs.Add('reports/' + $m.Groups[1].Value) }
foreach ($m in [regex]::Matches($ev, 'verify/([A-Za-z0-9_.-]+\.js)')) { $probeRefs.Add('verify/' + $m.Groups[1].Value) }
foreach ($m in [regex]::Matches($ev, 'examples/([A-Za-z0-9_./-]+\.json)')) { $probeRefs.Add('examples/' + $m.Groups[1].Value) }
foreach ($m in [regex]::Matches($ev, 'probe_([A-Za-z0-9_]+)')) { $probeRefs.Add('probes/' + $m.Groups[0].Value + '.js') }
foreach ($m in [regex]::Matches($ev, 'fast_([a-z_]+)')) { $probeRefs.Add('verify/fast_' + $m.Groups[1].Value + '.js') }
foreach ($m in [regex]::Matches($ev, 'carrier ([A-Za-z0-9_]+)')) { $probeRefs.Add('reports/' + $m.Groups[1].Value + '.js'); $probeRefs.Add('reports/test_' + $m.Groups[1].Value + '.js') }
$found = @()
foreach ($r in ($probeRefs | Select-Object -Unique)) { if (Test-Path (Join-Path $RepoRoot $r)) { $found += $r } }
if ($found.Count -ge 1) { Add-Verdict 'probe' $true ('evidence file present: ' + ($found -join ', ')) }
else { Add-Verdict 'probe' $false ('evidence names no existing probe/carrier/fast file (refs=' + (($probeRefs | Select-Object -Unique) -join ',') + ')') }
# object / cpt / render layers: manifest v3 four-layer fields are the ledger
Add-Verdict 'object' ($entry.construction -eq 'verified') ('manifest construction=' + $entry.construction)
Add-Verdict 'cpt' ($entry.serialization -eq 'verified') ('manifest serialization=' + $entry.serialization)
if ($entry.rendering -eq 'verified') { Add-Verdict 'render' $true 'manifest rendering=verified' }
else { Add-Verdict 'render' $false ('manifest rendering=' + $entry.rendering + ' (web-interaction capabilities stay static-PNG-invisible by the same rule as the official corpus)') }
# ir layer: the capability word must live in lib/ir.js (contract vocabulary)
$irText = [System.IO.File]::ReadAllText((Join-Path $RepoRoot 'lib\ir.js'))
$parts = $target.Split('.')
$fam = $parts[0]; $leaf = if ($parts.Length -gt 1) { $parts[$parts.Length - 1] } else { $parts[0] }
$irTok = $leaf
if ($fam -eq 'condition' -and $parts[1] -eq 'then') { $irTok = $parts[2] }
if ($fam -eq 'agent') { $irTok = '' }
if ($fam -eq 'spec' -and $parts[1] -eq 'sql') { $irTok = 'sql' }
if ($fam -eq 'spec' -and $parts[1] -eq 'params') { $irTok = 'param' }
if ($fam -eq 'spec' -and $parts[1] -eq 'rows') { $irTok = 'rows' }
if ($fam -eq 'sheet') { $irTok = 'hideRows' }
if ($fam -eq 'write') { $irTok = 'ReportWriteAttr' }
if ($fam -eq 'template') { $irTok = 'patchVersion' }
if ($fam -eq 'page' -and $leaf -eq 'headerFooter') { $irTok = 'headerFooter' }
if ($fam -eq 'page' -and $leaf -eq 'templateMarks') { $irTok = 'templateId' }
if ($fam -eq 'page' -and $leaf -eq 'repeatHeaderRow') { $irTok = 'repeatHeaderRow' }
if ($fam -eq 'page' -and $leaf -eq 'multiSheet') { $irTok = 'extraSheets' }
if ($fam -eq 'page' -and $leaf -eq 'freezeWeb') { $irTok = '' }
if ($fam -eq 'cell') { $irTok = @('subreport' , 'barcode' , 'CustomGrouper' , 'rowSpan' , 'PolyWorkSheet' , 'sort')[$parts[1] -as [int]] }
if ($irTok -and $irText.Contains($irTok)) { Add-Verdict 'ir' $true ("lib/ir.js carries the contract word '" + $irTok + "'") }
else { Add-Verdict 'ir' $false ("IR vocabulary has no word for this cap (tok='" + $irTok + "'; product-layer caps live in contracts/manifest, not IR)") }
# spec layer: ReportSpec entrance word in lib/report_spec.js + lib/spec_validator.js
$specText = ([System.IO.File]::ReadAllText((Join-Path $RepoRoot 'lib\report_spec.js'))) + ([System.IO.File]::ReadAllText((Join-Path $RepoRoot 'lib\spec_validator.js')))
$specTok = $leaf
if ($fam -eq 'condition' -and $parts[1] -eq 'then') { $specTok = $parts[2] }
if ($fam -eq 'write') { $specTok = '' }
if ($fam -eq 'template') { $specTok = '' }
if ($fam -eq 'agent') { $specTok = '' }
if ($fam -eq 'page' -and $leaf -eq 'freezeWeb') { $specTok = '' }
if ($fam -eq 'cell' -and ($leaf -eq 'subreport' -or $leaf -eq 'barcode' -or $leaf -eq 'groupCustom' -or $leaf -eq 'poly')) { $specTok = '' }
if ($specTok -and $specText.Contains($specTok)) { Add-Verdict 'spec' $true ("ReportSpec surface carries '" + $specTok + "'") }
else { Add-Verdict 'spec' $false ("no ReportSpec entrance word (tok='" + $specTok + "'; rawIR-only capability - Agent reaches it via IR, not spec)") }
# planner layer: the family flows through the planner chain
$plText = ([System.IO.File]::ReadAllText((Join-Path $RepoRoot 'semantic\planner\planner.js'))) + ([System.IO.File]::ReadAllText((Join-Path $RepoRoot 'agent\tools\plan.js')))
$plTok = ''
if ($fam -eq 'chart' -or $fam -eq 'condition') { $plTok = 'presentation' }
elseif ($fam -eq 'spec') { $plTok = 'sql' }
elseif ($fam -eq 'agent') { $plTok = 'intent' }
elseif ($fam -eq 'page' -and $leaf -eq 'multiSheet') { $plTok = 'extraSheets' }
if ($plTok -and $plText.Contains($plTok)) { Add-Verdict 'planner' $true ("planner chain carries '" + $plTok + "' (semantic/planner/planner.js + agent/tools/plan.js)") }
else { Add-Verdict 'planner' $false ("planner chain has no entrance for this family (tok='" + $plTok + "')") }
# agent layer: the ONLY advertising layer
if ($entry.agentAvailable) { Add-Verdict 'agent' $true 'manifest agentAvailable=true' }
else { Add-Verdict 'agent' $false ('manifest agentAvailable=false; evidence: ' + $ev.Substring(0, [Math]::Min(120, $ev.Length))) }
# manifest layer: entry + evidence + regressionScope reconciliation (auto-checked against the manifest as single source)
$scopes = @('ir', 'object', 'cpt', 'serialization', 'rendering', 'agent')
$mfOk = ($ev.Length -gt 0)
$mfDetail = 'entry in capability_manifest v3; evidence non-empty; regressionScope=' + $(if ($entry.scope) { $entry.scope } else { '-' })
if ($entry.regression -eq 'verified' -and -not ($scopes -contains $entry.scope)) {
  $mfOk = $false
  $mfDetail = 'regression=verified but regressionScope not in the v3 vocabulary (ir/object/cpt/serialization/rendering/agent): ' + $entry.scope
}
Add-Verdict 'manifest' $mfOk $mfDetail

$passN = 0; $blockedN = 0
foreach ($v in $verdicts) { if ($v.Contains(' PASS ')) { $passN++ } else { $blockedN++ } }
Write-Output ("LAYER-GATE cap=$target seg=$($entry.seg)")
foreach ($v in $verdicts) { Write-Output ('LAYER ' + $v) }
Write-Output ("LAYER-GATE END cap=$target pass=$passN blocked=$blockedN evidence=" + $ev.Substring(0, [Math]::Min(160, $ev.Length)))
exit 0
