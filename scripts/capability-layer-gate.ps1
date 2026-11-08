# capability-layer-gate.ps1 - Phase-4 batch-2-2: capability ID -> layer PASS/BLOCKED/UNKNOWN matrix.
#   Single machine-judged pipeline the ask demands: any FineReport native capability enters through
#   ONE gate whose layers are computed from the ledgers + disk truth + LIVE CONTRACT RUNS, never hand-written
#   per cap and never from a shared substring in a source file (2026-11-08 review P2-3 removed that):
#     probe    - the evidence's probe/carrier/fast/spec-carrier/integration files actually exist on disk
#     tool     - tool-driven caps (template.patch.*, agent.*) have their verb branch + implementing file +
#                exercising test artifact wired (static wiring; runtime proof stays in the S-cases)
#     jar      - E1 anchor: the capability maps (data/engine_class_map.json) to a class that PHYSICALLY
#                exists in the installed core jars (data/jar_class_inventory.json), not to a demo CPT
#     object   - manifest v3 construction layer (construction evidence rules enforced by fast_manifest_evidence)
#     cpt      - manifest v3 serialization layer
#     render   - manifest v3 rendering layer (serialization-only = web behavior invisible in static PNG -> BLOCKED)
#     ir       - the capability token is an EXACT MEMBER of the live Ir.capabilities() vocabulary (nashorn dump)
#     spec     - the capability token is an EXACT MEMBER of the live ReportSpec.capabilities() surface
#     planner  - a REAL ReportPlanner.plan() run of a per-capability input intent, asserted against the EMITTED
#                spec path (presentation.chart.kind / dataset.filters / params[0].filter.op / ...). Capabilities
#                with no planner input/output contract are UNKNOWN, and the probe carries three negative
#                controls that MUST be refused, else every planner PASS is voided (self-test).
#     agent    - manifest v3 agentAvailable (the ONLY layer allowed to advertise to the Agent)
#     manifest - entry present in capability_manifest.js v3 + evidence non-empty + regressionScope rules
#   Exit codes: 0 = known capability, matrix produced (BLOCKED/UNKNOWN layers allowed - they ARE the answer);
#               2 = unknown capability id (negative control MUST fail here, never print all-PASS);
#               3 = manifest/IR/planner/jar dump unavailable - BLOCKED, not a fake green.
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
$planJs = Join-Path $work 'plan_probe.js'
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
print('IRBLOCK|' + Object.keys(ic.block || {}).join(','));
print('IRDATASET|' + Object.keys(ic.dataset || {}).join(','));
print('IRSHEET|' + Object.keys(ic.sheet || {}).join(','));
print('IRPARAM|' + Object.keys(ic.param || {}).join(','));
print('IRCOND|keys=' + Object.keys(ic.condition || {}).join(',') + '|then=' + (ic.condition.thenActions || []).join(','));
print('IRDOMAIN|' + Object.keys(ic).join(','));
'@
[System.IO.File]::WriteAllText($dumpJs, $js, (New-Object System.Text.UTF8Encoding($false)))
$env:FR_AGENT_HOME = $RepoRoot
$dumpText = & $java '-Djava.awt.headless=true' '-Xmx400m' '-cp' $nashorn 'jdk.nashorn.tools.Shell' $dumpJs 2>&1
$dumpRc = $LASTEXITCODE
$caps = New-Object System.Collections.Generic.List[object]
foreach ($ln in $dumpText) {
  $s = '' + $ln
  if ($s.StartsWith('CAP|')) {
    $p = $s.Split('|')
    $caps.Add([pscustomobject]@{ seg = $p[1]; name = $p[2]; construction = $p[3]; serialization = $p[4]; rendering = $p[5]; regression = $p[6]; scope = $p[7]; agentAvailable = ($p[8] -eq 'true'); evidence = $p[9] })
  }
}
if ($dumpRc -ne 0 -or $caps.Count -lt 20) { Write-Output ("LAYER-GATE BLOCKED manifest dump unavailable (rc=$dumpRc entries=" + $caps.Count + ')'); exit 3 }

$entry = $null
foreach ($c in $caps) { if ($c.name -eq $target) { $entry = $c; break } }
if (-not $entry) {
  Write-Output ("LAYER-GATE FAIL unknown capability id: $target (not in capability_manifest v3; known=" + $caps.Count + ' entries)')
  exit 2
}

# ---- planner contract probe: a REAL ReportPlanner.plan() per capability, with negative controls ----
#   Run as a second nashorn process so the gate is fail-closed when java is unavailable (exit 3).
#   Output lines: PLANC|cap|ready|why   NEGC|name|refused|why   NEGOK|bool   SPECJSON|{...}
$planJsSrc = @'
var ROOT = java.lang.System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
function src(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + p)), 'UTF-8')); }
load(ROOT + '/lib/ir.js'); load(ROOT + '/lib/report_spec.js'); load(ROOT + '/lib/isodate.js'); load(ROOT + '/lib/spec_validator.js'); load(ROOT + '/lib/spec_compiler.js');
load(ROOT + '/semantic/model/vocab.js'); load(ROOT + '/semantic/model/registry.js'); load(ROOT + '/semantic/model/resolver.js'); load(ROOT + '/semantic/planner/capability.js'); load(ROOT + '/semantic/planner/planner.js');
var model = JSON.parse(src('models/production/model.json'));
var schema = JSON.parse(src('data/schema_' + (model.source || 'atom_live_demo') + '.json'));
var idx = ModelRegistry.index(model);
var sc = ReportSpec.capabilities();
var ctx = { model: model, schema: schema, resolve: function (t) { return ModelResolver.resolve(idx, String(t)); }, validateSpec: function (s) { return SpecValidator.validate(s); }, capability: PlannerCapability, caps: sc };
function baseRows(pres, extra) { var it = { outName: 'gp', reportName: 'gp', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: [['2026-01-01', 1], ['2026-01-02', 2]], presentation: pres }; if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) it[k] = extra[k]; return it; }
function baseSql(pres, dextra) { var it = { outName: 'gps', reportName: 'gps', dataset: { kind: 'sql', entity: 'Machine', connection: 'main', dimensions: ['bizDate'], metrics: [{ term: 'planned' }] } }; if (dextra) for (var k in dextra) if (Object.prototype.hasOwnProperty.call(dextra, k)) it.dataset[k] = dextra[k]; if (pres) it.presentation = pres; return it; }
function getIn(o, path) { var seg = path.split('.'), cur = o; for (var i = 0; i < seg.length; i++) { if (cur === null || cur === undefined) return undefined; var m = /^\[(\d+)\]$/.exec(seg[i]); if (m) { cur = cur[+m[1]]; continue; } var mm = /^(.+)\[(\d+)\]$/.exec(seg[i]); if (mm) { cur = cur[mm[1]]; if (cur !== undefined) cur = cur[+mm[2]]; continue; } cur = cur[seg[i]]; } return cur; }
var C = {};
var CK = (sc.datasets || {}).sql ? (sc.datasets.sql.chart.supported || []) : [];
// scatter/bubble take x/y metric aliases and REJECT category/value (lib/spec_validator.js chart branch);
//   every other kind takes category/value. A contract probe that ignored this reported those two caps as
//   planner-refused when the product in fact routes them (a false negative, the mirror of the old false green).
for (var i = 0; i < CK.length; i++) {
  var k = CK[i];
  var chart = (k === 'vscatter' || k === 'vbubble')
    ? { kind: k, x: 'rowNo', y: 'rowNo' }
    : (k === 'vmultipie' ? { kind: k, levels: ['bizTime'], value: 'rowNo' } : (k === 'vwordcloud' ? { kind: k, wordName: 'bizTime', wordValue: 'rowNo' } : (k === 'vstructure' ? { kind: k, nodeId: 'bizTime', parentId: 'bizTime', nodeName: 'bizTime', nodeValue: 'rowNo' } : { kind: k, category: 'bizTime', value: 'rowNo' })));
  C['chart.' + k] = { intent: baseRows({ showTotal: false, chart: chart }), expect: 'presentation.chart.kind', eq: k };
}
var DECO = { 'chart.tooltip': { tooltip: { fmt: 'N0' } }, 'chart.label': { label: { show: true } }, 'chart.stack': { stack: true }, 'chart.trendLine': { trend: { show: true } }, 'chart.conditionalSeries': { conditions: [{ column: 1, when: { formula: '=B2<60' }, then: { style: { color: '0xFF0000' } } }] }, 'chart.axisYUnit': { axisY: { unit: 'pc' } }, 'chart.marker': { marker: { shape: 'circle' } }, 'chart.lineStyle': { lineStyle: { dashed: true } }, 'chart.areaFill': { alpha: 0.5 }, 'chart.effect': { alpha: 0.5 }, 'chart.seriesBorder': { border: { color: '0xFF0000' } }, 'chart.seriesImage': { bg: { image: 'assets/map/x.png' } }, 'chart.bubbleAttr': { marker: { size: 4 } } };
for (var dn in DECO) { var d = DECO[dn]; for (var dk in d) C[dn] = { intent: baseRows({ showTotal: false, chart: { kind: 'vbar', category: 'bizTime', value: 'rowNo' } }), expect: 'presentation.chart.' + dk, eq: undefined, patchChart: (function (kk, vv) { return function (ch) { ch[kk] = vv; }; })(dk, d[dk]) }; }
C['spec.sql.chart'] = { intent: baseSql({ showTotal: false, chart: { kind: 'vbar', category: 'bizDate', value: 'planned' } }), expect: 'presentation.chart.kind', eq: 'vbar' };
C['condition.formula'] = { intent: baseRows({ showTotal: true, conditions: [{ column: 1, when: { formula: '=B2<60' }, then: { style: { color: '0xFF0000' } } }] }), expect: 'presentation.conditions.[0].when.formula' };
C['condition.column'] = { intent: baseRows({ showTotal: true, conditions: [{ column: 1, when: { column: 'bizTime' }, then: { style: { color: '0xFF0000' } } }] }), expect: 'presentation.conditions.[0].when.column' };
C['condition.list'] = { intent: baseRows({ showTotal: true, conditions: [{ column: 1, when: { list: ['a', 'b'] }, then: { style: { color: '0xFF0000' } } }] }), expect: 'presentation.conditions.[0].when.list' };
C['condition.then.style'] = { intent: baseRows({ showTotal: true, conditions: [{ column: 1, when: { formula: '=B2<60' }, then: { style: { bold: true } } }] }), expect: 'presentation.conditions.[0].then.style' };
C['condition.then.border'] = { intent: baseRows({ showTotal: true, conditions: [{ column: 1, when: { formula: '=B2<60' }, then: { border: { color: '0xFF0000' } } }] }), expect: 'presentation.conditions.[0].then.border' };
C['condition.then.value'] = { intent: baseRows({ showTotal: true, conditions: [{ column: 1, when: { formula: '=B2<60' }, then: { value: 'x' } }] }), expect: 'presentation.conditions.[0].then.value' };
C['condition.then.link'] = { intent: baseRows({ showTotal: true, conditions: [{ column: 1, when: { formula: '=B2<60' }, then: { link: { target: 'http://x' } } }] }), expect: 'presentation.conditions.[0].then.link' };
C['condition.then.widget'] = { intent: baseRows({ showTotal: true, conditions: [{ column: 1, when: { formula: '=B2<60' }, then: { widget: { kind: 'button' } } }] }), expect: 'presentation.conditions.[0].then.widget' };
C['spec.rows.conditions'] = C['condition.formula'];
C['spec.rows.sum'] = { intent: baseRows({ showTotal: true }), expect: 'presentation.showTotal', eq: true };
C['spec.rows.totalAgg'] = { intent: baseRows({ showTotal: true, total: { label: 'avg', aggregate: { fn: 'avg', col: 1 } } }), expect: 'presentation.total.aggregate.fn', eq: 'avg' };
C['spec.rows.sumCols'] = { intent: baseRows({ showTotal: true, total: { label: 'T', sumCols: [{ col: 1, fn: 'avg', format: '#,##0.0' }] } }), expect: 'presentation.total.sumCols' };
C['spec.rows.cells'] = { intent: baseRows({ showTotal: true, cells: [{ c: 0, rowSpan: 2, text: 'span', st: { bold: true } }] }), expect: 'presentation.cells' };
C['cells.rowSpan'] = C['spec.rows.cells'];
C['spec.params.panel'] = { intent: baseRows({ showTotal: false }, { params: [{ kind: 'date', name: 'd1', value: '2026-01-01' }] }), expect: 'params' };
C['spec.params.filter'] = { intent: baseRows({ showTotal: false }, { params: [{ kind: 'editor', name: 'line', value: 'A', filter: { column: 'bizTime', op: '=' } }] }), expect: 'params.[0].filter.op', eq: '=' };
C['page.multiSheet'] = { intent: baseRows({ showTotal: true }, { extraSheets: [{ name: 'D2', dimensions: [{ field: 'bizTime', label: 'L' }], metrics: [{ field: 'rowNo', label: 'N', aggregation: 'sum', dataType: 'number' }], dataset: { rows: [['x', 1]] } }] }), expect: 'extraSheets' };
C['page.headerFooter'] = { intent: baseRows({ showTotal: true }, { sheet: { headerFooter: { left: 'A' } } }), expect: 'sheet.headerFooter' };
C['sheet.hideRowsCols'] = { intent: baseRows({ showTotal: true }, { sheet: { hideRows: [1] } }), expect: 'sheet.hideRows' };
C['page.cell.sort'] = { intent: baseSql(null, { sort: [{ field: 'bizDate', dir: 'desc' }] }), expect: 'dataset.sort' };
C['spec.sql.model'] = { intent: baseSql(null, null), expect: 'dataset.kind', eq: 'sql' };
C['spec.sql.filters'] = { intent: baseSql(null, { filters: [{ field: 'planned', op: '>', value: 1 }] }), expect: 'dataset.filters' };
C['spec.sql.sort'] = { intent: baseSql(null, { sort: [{ field: 'bizDate', dir: 'desc' }] }), expect: 'dataset.sort' };
C['spec.sql.topN'] = { intent: baseSql(null, { topN: 5 }), expect: 'dataset.topN', eq: 5 };
var NEG = [{ name: 'rows-top-level-filters', intent: baseRows({ showTotal: true }, { filters: [{ field: 'rowNo', op: '>', value: 1 }] }) }, { name: 'chart-bogus-kind', intent: baseRows({ showTotal: false, chart: { kind: 'vbarNope', category: 'bizTime', value: 'rowNo' } }) }, { name: 'sheet-bogus-key', intent: baseRows({ showTotal: true }, { sheet: { notAKey: 1 } }) }];
C['chart.mapLabel'] = { intent: baseRows({ showTotal: false, chart: { kind: 'vmap', category: 'bizTime', value: 'rowNo', mapLabel: { areaLabel: { enable: true, fontPt: 10, color: 255 } } } }), expect: 'presentation.chart.mapLabel' };
C['chart.mapTooltip'] = { intent: baseRows({ showTotal: false, chart: { kind: 'vmap', category: 'bizTime', value: 'rowNo', mapTooltip: { areaTooltip: { muti: false, format: '#,##0' } } } }), expect: 'presentation.chart.mapTooltip' };
C['chart.mapTooltipFormat'] = { intent: baseRows({ showTotal: false, chart: { kind: 'vmap', category: 'bizTime', value: 'rowNo', tooltip: { formats: { category: true, value: '#,##0.0' } } } }), expect: 'presentation.chart.tooltip.formats' };
C['chart.hyperlinkCell'] = { intent: baseRows({ showTotal: false, chart: { kind: 'vbar', category: 'bizTime', value: 'rowNo', hotHyperLink: { target: 'plot' } } }), expect: 'presentation.chart.hotHyperLink' };
C['chart.hotTooltip'] = { intent: baseRows({ showTotal: false, chart: { kind: 'vbar', category: 'bizTime', value: 'rowNo', hotTooltip: { position: 1, showMutiSeries: true } } }), expect: 'presentation.chart.hotTooltip' };
C['chart.labelBorder'] = { intent: baseRows({ showTotal: false, chart: { kind: 'vbar', category: 'bizTime', value: 'rowNo', label: { enable: true, border: { color: 16711680, style: 1, shape: 'rect' } } } }), expect: 'presentation.chart.label.border' };
function runC(c) { var it = JSON.parse(JSON.stringify(c.intent)); if (c.patchChart) c.patchChart(it.presentation.chart); var r = ReportPlanner.plan(it, ctx); if (r.status !== 'ready' || !r.reportSpec) return 'NO:' + r.status; var g = getIn(r.reportSpec, c.expect); if (g === undefined || g === null) return 'NO:no ' + c.expect; if (c.eq !== undefined && String(g) !== String(c.eq)) return 'NO:' + c.expect + '=' + g; return 'PASS:' + c.expect + '=' + g; }
// SPECC (2026-11-08 coherence round): the spec layer's executable contract. The capability's intent is
//   planned, the EMITTED spec must pass SpecValidator, compile through SpecCompiler, and the compiled IR
//   must pass Ir.validate with zero errors. A capability that can only exist in one of those surfaces
//   (validator whitelist but no compiler support, say) fails here instead of collecting a vocabulary green.
function runSpecC(c) {
  var it = JSON.parse(JSON.stringify(c.intent)); if (c.patchChart) c.patchChart(it.presentation.chart);
  var r = ReportPlanner.plan(it, ctx);
  if (r.status !== 'ready' || !r.reportSpec) return 'no:plan ' + r.status;
  var errs = SpecValidator.validate(r.reportSpec);
  if (errs && errs.length) return 'no:spec ' + errs[0].code + ' ' + errs[0].path;
  var ir = null, ie = [];
  try { ir = SpecCompiler.compile(r.reportSpec, {}); } catch (e) { ie = ['COMPILE_THROW: ' + e]; }
  if (ir) ie = Ir.validate(ir);
  if (ie && ie.length) return 'no:ir ' + ie[0].code + ' ' + ie[0].path;
  return 'ok:spec+compile+Ir.validate clean';
}
for (var nm in C) if (Object.prototype.hasOwnProperty.call(C, nm)) print('PLANC|' + nm + '|' + runC(C[nm]));
for (var nm2 in C) if (Object.prototype.hasOwnProperty.call(C, nm2)) print('SPECC|' + nm2 + '|' + runSpecC(C[nm2]));
var negOk = true;
for (var q = 0; q < NEG.length; q++) { var rn = ReportPlanner.plan(NEG[q].intent, ctx); if (rn.status === 'ready') { negOk = false; print('NEGC|' + NEG[q].name + '|ACCEPTED-BAD'); } else print('NEGC|' + NEG[q].name + '|refused'); }
print('NEGOK|' + negOk);
print('SPECJSON|' + JSON.stringify(sc));
// SPECTOK: the exact member-token set of ReportSpec.capabilities(), collected in JS (keys + string-array
//   leaves split on '(' and '.') so the gate can do EXACT membership instead of a source-text substring.
(function () {
  var toks = {};
  function walk(o) {
    if (o === null || o === undefined) return;
    if (o instanceof Array) { for (var i = 0; i < o.length; i++) { var v = o[i]; if (v && typeof v === 'object') walk(v); else { var t = String(v).replace(/\(.*/, '').split('.')[0]; if (t) toks[t] = 1; } } return; }
    if (typeof o === 'object') { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) { toks[k] = 1; walk(o[k]); } }
  }
  walk(sc);
  var arr = []; for (var t2 in toks) arr.push(t2);
  print('SPECTOK|' + arr.join(','));
})();
'@
[System.IO.File]::WriteAllText($planJs, $planJsSrc, (New-Object System.Text.UTF8Encoding($false)))
$planText = & $java '-Djava.awt.headless=true' '-Xmx400m' '-cp' $nashorn 'jdk.nashorn.tools.Shell' $planJs 2>&1
$planRc = $LASTEXITCODE
$PLANRES = @{}
$SPECRES = @{}
$planNegLines = @()
$negOk = ''
foreach ($ln in $planText) {
  $s = '' + $ln
  if ($s.StartsWith('PLANC|')) { $pp = $s.Split('|'); $PLANRES[$pp[1]] = $pp[2] }
  elseif ($s.StartsWith('SPECC|')) { $pp2 = $s.Split('|'); $SPECRES[$pp2[1]] = $pp2[2] }
  elseif ($s.StartsWith('NEGC|')) { $planNegLines += $s }
  elseif ($s.StartsWith('NEGOK|')) { $negOk = $s.Substring(6).Trim() }
}
if ($planRc -ne 0) { Write-Output ("LAYER-GATE BLOCKED planner probe unavailable (rc=$planRc)"); exit 3 }
# SELF-TEST (r14 principle: an invariant needs a counter-example, a green proves nothing by itself):
#   the probe's three deliberately invalid intents MUST be refused by the planner. If any is accepted,
#   the planner-contract machinery is not discriminating and NO planner layer may be reported as PASS.
if ($negOk -ne 'True') {
  Write-Output 'LAYER-GATE SELFTEST FAIL: planner negative controls were accepted - planner verdicts disabled'
  foreach ($n in $planNegLines) { Write-Output ('  ' + $n) }
  $PLANRES = @{}
}

# ---- layer computations (each verdict cites its source) ----
#   Three states: PASS (machine-verified positive), BLOCKED (machine-verified negative, or the ledger says
#   rejected/pending), UNKNOWN (this layer cannot be auto-verified for this capability - explicitly NOT a green,
#   and never written as PASS by a substring match). 2026-11-08 review P2-3: the old gate had only two states
#   and produced PASS from generic strings ('presentation' in the planner source), which is the false positive.
$verdicts = New-Object System.Collections.Generic.List[string]
function Add-Verdict([string]$layer, $state, [string]$detail) {
  $v = if ($state -is [bool]) { if ($state) { 'PASS' } else { 'BLOCKED' } } else { ('' + $state).ToUpper() }
  if (($v -ne 'PASS') -and ($v -ne 'BLOCKED')) { $v = 'UNKNOWN' }
  $script:verdicts.Add(($layer + ' ' + $v + ' :: ' + $detail))
}
function Layer-Verdict([string]$field) {
  if ($field -eq 'verified') { return 'PASS' }
  if (-not $field) { return 'UNKNOWN' }        # the ledger carries no verdict for this layer here
  return 'BLOCKED'                              # pending / unverified / rejected is never a green
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
foreach ($m in [regex]::Matches($ev, 'integration_runtime')) { $probeRefs.Add('verify/integration_runtime.ps1') }
$found = @()
foreach ($r in ($probeRefs | Select-Object -Unique)) { if (Test-Path (Join-Path $RepoRoot $r)) { $found += $r } }
if ($found.Count -ge 1) { Add-Verdict 'probe' $true ('evidence file present: ' + ($found -join ', ')) }
else { Add-Verdict 'probe' $false ('evidence names no existing probe/carrier/fast/spec/integration artifact (refs=' + (($probeRefs | Select-Object -Unique) -join ',') + ')') }
# tool layer (2026-11-08, coherence round): template.patch.* / agent.* capabilities have NO IR/spec/planner
#   entrance by design - their executable entrance is the agent tool chain (fr_agent.ps1 verb + the JS/PY
#   ops + the gate that exercises it). This layer asserts that WIRING statically: the verb branch exists,
#   the implementing file carries the op/API name, and the test artifact that exercises it exists on disk.
#   It is labelled static wiring, not runtime E2E (the runtime proof stays in verify/integration_runtime.ps1
#   S-cases / run-promote-restore matrix, cited in the manifest evidence).
$TOOLWIRE = @{
  'template.patch.cellValue' = @(@('agent/tools/fr_agent.ps1', "'patch' \{"), @('template/validator.js', 'replace_cell_value'), @('verify/fast_template.js', 'replace_cell_value'));
  'template.patch.dataset'   = @(@('agent/tools/fr_agent.ps1', "'patch' \{"), @('template/validator.js', 'replace_dataset'), @('verify/fast_template.js', 'replace_dataset'));
  'agent.plan'               = @(@('agent/tools/plan.js', 'ReportPlanner\.plan'), @('verify/fast_planner.js', 'ReportPlanner'));
  'agent.artifact.isolation' = @(@('agent/tools/_lib.js', 'runs'), @('agent/tools/fr_agent.ps1', 'RunId'), @('verify/integration_runtime.ps1', 'RunId'));
  'agent.runtime.serial'     = @(@('agent/tools/runtime.ps1', 'Mutex'), @('verify/integration_runtime.ps1', 'MUTEX|Mutex'));
}
$toolState = 'UNKNOWN'; $toolDetail = 'not a tool-driven capability (IR/spec/planner carry it)'
$toolFamily = ($target.StartsWith('template.') -or $target.StartsWith('agent.') -or $target.StartsWith('write.'))
if ($toolFamily -and (([string]$entry.construction -eq 'rejected') -or ([string]$entry.serialization -eq 'rejected'))) {
  $toolState = 'BLOCKED'; $toolDetail = 'manifest marks this capability rejected (deliberately not implemented); no tool entrance by design'
} elseif ($TOOLWIRE.ContainsKey($target)) {
  $missing = New-Object System.Collections.Generic.List[string]
  foreach ($ref in $TOOLWIRE[$target]) {
    $fp = Join-Path $RepoRoot $ref[0]
    if (-not (Test-Path $fp)) { $missing.Add($ref[0] + ': missing'); continue }
    $txt = [System.IO.File]::ReadAllText($fp)
    if (-not [regex]::IsMatch($txt, $ref[1])) { $missing.Add($ref[0] + ': no /' + $ref[1] + '/') }
  }
  if ($missing.Count -eq 0) { $toolState = 'PASS'; $toolDetail = 'static wiring present: ' + (($TOOLWIRE[$target] | ForEach-Object { $_[0] }) -join ', ') }
  else { $toolState = 'BLOCKED'; $toolDetail = 'tool wiring broken: ' + ($missing -join '; ') }
}
Add-Verdict 'tool' $toolState $toolDetail
# jar layer (E1, 2026-11-08 coherence round): the capability must be anchored to a class that PHYSICALLY
#   exists in the installed CORE jars - not merely to a demo CPT that happens to exercise a similar path.
#   data/engine_class_map.json is the single source (capability -> class + the module carrying the literal);
#   data/jar_class_inventory.json is the physical scan (scripts/build_jar_inventory.ps1). 'none' entries
#   record capabilities with no engine class by design, with the reason: pending/rejected -> BLOCKED,
#   runtime/tool layer -> UNKNOWN. A class that is named but absent from every core jar is a real E1 gap.
$jarState = 'UNKNOWN'; $jarDetail = 'no jar inventory yet (run scripts/build_jar_inventory.ps1)'
$mapPath = Join-Path $RepoRoot 'data\engine_class_map.json'
$invPath = Join-Path $RepoRoot 'data\jar_class_inventory.json'
if ((Test-Path $mapPath) -and (Test-Path $invPath)) {
  $emap = [System.IO.File]::ReadAllText($mapPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
  $inv = [System.IO.File]::ReadAllText($invPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
  $resolvedNames = @($inv.resolved.PSObject.Properties.Name)
  $noneProps = @($emap.none.PSObject.Properties.Name)
  if ($noneProps -contains $target) {
    $why = '' + $emap.none.$target
    if ($why.StartsWith('runtime')) { $jarState = 'UNKNOWN' } else { $jarState = 'BLOCKED' }
    $jarDetail = 'no engine class by design: ' + $why
  } else {
    $cls = ''; $src = ''
    $exactNames = @($emap.exact.PSObject.Properties.Name)
    if ($exactNames -contains $target) {
      $cls = '' + $emap.exact.$target.class
      $src = 'engine_class_map exact (' + $emap.exact.$target.module + ')'
    } else {
      foreach ($pre in @($emap.family.PSObject.Properties.Name)) {
        if ($target.StartsWith($pre)) { $cls = '' + $emap.family.$pre.class; $src = 'engine_class_map family ' + $pre + ' (' + $emap.family.$pre.module + ')'; break }
      }
    }
    # classes named directly by the manifest evidence are additional candidates (per-cap specificity wins)
    $evClasses = @([regex]::Matches($ev, 'com\.fr\.[A-Za-z0-9_.$]+') | ForEach-Object { $_.Value })
    $cands = @()
    foreach ($c in $evClasses) { if ($c) { $cands += $c } }
    if ($cls) { $cands += $cls }
    $hit = $null; $hitJar = $null
    foreach ($c in $cands) { if ($resolvedNames -contains $c) { $hit = $c; $hitJar = '' + $inv.resolved.$c; break } }
    if ($hit) { $jarState = 'PASS'; $jarDetail = 'class ' + $hit + ' present in core jar ' + $hitJar + ' (' + $src + ')' }
    elseif ($cands.Count -gt 0) { $jarState = 'BLOCKED'; $jarDetail = 'named class not found in any core jar: ' + (($cands | Select-Object -Unique) -join ', ') + ' (' + $src + ')' }
    else { $jarState = 'UNKNOWN'; $jarDetail = 'no engine class named by evidence or engine_class_map (E1 anchor missing)' }
  }
}
Add-Verdict 'jar' $jarState $jarDetail
# object / cpt / render layers: the manifest v3 four-layer fields are the ledger (enforced by
#   fast_manifest_evidence). verified=PASS; pending/rejected=BLOCKED (a known-not-achieved state, honest);
#   an absent field=UNKNOWN (this gate cannot judge it).
Add-Verdict 'object' (Layer-Verdict $entry.construction) ('manifest construction=' + $entry.construction)
Add-Verdict 'cpt' (Layer-Verdict $entry.serialization) ('manifest serialization=' + $entry.serialization)
Add-Verdict 'render' (Layer-Verdict $entry.rendering) ('manifest rendering=' + $entry.rendering + ' (web-interaction/static-PNG-invisible caps stay BLOCKED by the official-corpus rule)')
# ir layer: the capability token must be an EXACT SEGMENT of Ir.capabilities() (dumped live), or a
#   named ir.js contract constant (IR_EXTRA). A non-member is UNKNOWN (never a silent PASS) - the
#   reader cannot prove the IR path without an assertion, so it reports the gap instead of a green.
$parts = $target.Split('.')
$fam = $parts[0]; $leaf = if ($parts.Length -gt 1) { $parts[$parts.Length - 1] } else { $parts[0] }
$irTok = $leaf
if ($fam -eq 'condition' -and $parts[1] -eq 'then') { $irTok = $parts[2] }
elseif ($fam -eq 'chart') { $irTok = if ($leaf -eq 'trendLine') { 'trend' } elseif ($leaf -eq 'axisYUnit') { 'axisYUnit' } elseif ($leaf -eq 'conditionalSeries') { 'conditionalSeries' } elseif ($leaf -eq 'hotTooltip') { 'hotTooltip' } elseif ($leaf -eq 'mapTooltip') { 'mapTooltip' } elseif ($leaf -eq 'mapTooltipFormat') { 'mapTooltipFormat' } elseif ($leaf -eq 'mapLabel') { 'mapLabel' } elseif ($leaf -eq 'bubbleAttr') { 'bubble' } elseif ($leaf -eq 'seriesBorder') { 'seriesBorder' } elseif ($leaf -eq 'seriesImage') { 'seriesImage' } elseif ($leaf -eq 'effect') { 'effect' } elseif ($leaf -eq 'areaFill') { 'areaFill' } elseif ($leaf -eq 'hyperlinkCell') { 'hotHyperLink' } else { $leaf } }
elseif ($fam -eq 'spec' -and $parts[1] -eq 'sql') {
  # dataset domain keys live under dataset.* (embedded/sql); filters/sort/topN are builder options, not
  # IR vocabulary keys - they stay UNKNOWN here rather than borrowing an unrelated token.
  if ($leaf -eq 'chart') { $irTok = 'chart' } elseif ($leaf -eq 'model') { $irTok = 'dataset' } elseif ($leaf -eq 'filters' -or $leaf -eq 'sort' -or $leaf -eq 'topN') { $irTok = '' }
} elseif ($fam -eq 'spec' -and $parts[1] -eq 'rows') {
  if ($leaf -eq 'sum') { $irTok = 'total' } elseif ($leaf -eq 'conditions') { $irTok = 'condition' } elseif ($leaf -eq 'cells') { $irTok = 'cells' } elseif ($leaf -eq 'sumCols') { $irTok = 'total' } elseif ($leaf -eq 'totalAgg') { $irTok = 'total' } elseif ($leaf -eq 'params') { $irTok = 'param' } elseif ($leaf -eq 'filter') { $irTok = 'filter' } elseif ($leaf -eq 'panel') { $irTok = 'param' }
} elseif ($fam -eq 'spec' -and $parts[1] -eq 'params') {
  if ($leaf -eq 'panel') { $irTok = 'param' } elseif ($leaf -eq 'filter') { $irTok = 'filter' }
} elseif ($fam -eq 'write') { $irTok = 'ReportWriteAttr' }
elseif ($fam -eq 'template') { $irTok = 'patchVersion' }
elseif ($fam -eq 'sheet') { $irTok = 'hideRowsCols' }
elseif ($fam -eq 'cells') { $irTok = 'cells' }
elseif ($fam -eq 'cell') {
  if ($leaf -eq 'sort') { $irTok = 'sort' } elseif ($leaf -eq 'subreport') { $irTok = 'subreport' } elseif ($leaf -eq 'barcode') { $irTok = 'barcode' } elseif ($leaf -eq 'groupCustom') { $irTok = 'CustomGrouper' } elseif ($leaf -eq 'poly') { $irTok = 'PolyWorkSheet' }
} elseif ($fam -eq 'page') {
  if ($leaf -eq 'multiSheet') { $irTok = 'multiSheet' } elseif ($leaf -eq 'headerFooter') { $irTok = 'headerFooter' } elseif ($leaf -eq 'repeatHeaderRow') { $irTok = 'repeatHeaderRow' } elseif ($leaf -eq 'templateMarks') { $irTok = 'templateId' } elseif ($leaf -eq 'freezeWeb') { $irTok = '' } elseif ($leaf -eq 'cells.rowSpan' -or $leaf -eq 'rowSpan') { $irTok = 'cells' } elseif ($leaf -eq 'hideRowsCols') { $irTok = 'hideRowsCols' }
} elseif ($fam -eq 'product' -and $parts[1] -eq 'dataset' -and $parts[2] -eq 'databaseDict') { $irTok = 'databaseDict' }
elseif ($fam -eq 'cells') { $irTok = $leaf }        # cells.rowSpan -> rowSpan (top-level family, not page.<leaf>)
elseif ($fam -eq 'cell') {
  if ($leaf -eq 'sort') { $irTok = 'sort' } elseif ($leaf -eq 'subreport') { $irTok = 'subreport' } elseif ($leaf -eq 'barcode') { $irTok = 'barcode' } elseif ($leaf -eq 'groupCustom') { $irTok = 'CustomGrouper' } elseif ($leaf -eq 'poly') { $irTok = 'PolyWorkSheet' }
} elseif ($fam -eq 'sheet') {
  if ($leaf -eq 'hideRowsCols') { $irTok = 'hideRows' } elseif ($leaf -eq 'freezeWeb') { $irTok = '' }
} elseif ($fam -eq 'agent') { $irTok = '' }
# Build the EXACT IR vocabulary token set from the dumped lines. The IRCHART/IRCOND lines pack several
#   sub-lists ('legacy=bar,pie,line|van=vbar,...|deco=tooltip,...') separated by '|' AND ',' - so split on
#   BOTH, then strip the 'key=' label. Splitting only on ',' glued 'line|van=vbar' into one token and lost
#   every van-chart member (the bug that made chart.vbar report ir UNKNOWN for a capability IR does carry).
$irVocab = New-Object System.Collections.Generic.HashSet[string]
foreach ($ln in $dumpText) {
  $s = '' + $ln
  if (-not ($s.StartsWith('IRCHART|') -or $s.StartsWith('IRCOND|') -or $s.StartsWith('IRPARAM|') -or $s.StartsWith('IRDOMAIN|') -or $s.StartsWith('IRSHEET|') -or $s.StartsWith('IRBLOCK|') -or $s.StartsWith('IRDATASET|'))) { continue }
  $payload = $s.Substring($s.IndexOf('|') + 1)
  foreach ($piece in [regex]::Split($payload, '[|,]')) {
    $t = ($piece -replace '^[a-zA-Z]+=', '').Trim()   # 'legacy=bar' -> 'bar', 'van=vbar' -> 'vbar'
    if ($t) { [void]$irVocab.Add($t) }
  }
}
# Vocabulary membership: a non-member is UNKNOWN ("this gate cannot verify it"), never a green and never a
#   hard BLOCKED claim either - the IR/spec contract for such caps lives outside capabilities().
if (-not $irTok) { Add-Verdict 'ir' 'UNKNOWN' ('no IR contract token derived for this capability (it is reached through the template/write/agent layer, not the IR vocabulary)') }
elseif ($irVocab.Contains($irTok)) { Add-Verdict 'ir' 'PASS' ('Ir.capabilities() exact member "' + $irTok + '"') }
else { Add-Verdict 'ir' 'UNKNOWN' ("IR vocabulary has no exact member '" + $irTok + "' - cannot verify this layer here (an IR assertion would be required; no green from a substring)") }
# spec layer: the token is derived from the capability leaf and must be an EXACT MEMBER of the live
#   ReportSpec.capabilities() surface (dumped via SPECTOK). In-surface -> PASS; absent -> UNKNOWN, never a
#   green (absence here does not prove the capability is unreachable - many reach the engine via IR/rawIR,
#   which has its own layer). The old gate faked this by substring-matching a shared word like
#   'presentation' against the source text; that is exactly what this replaces.
$specTok = $leaf
if ($fam -eq 'condition' -and $parts[1] -eq 'then') { $specTok = $parts[2] }
if ($fam -eq 'chart') {
  # ReportSpec.capabilities() advertises 'conditions' for chart-conditional series; the rest of the deco
  # keys are only in the VALIDATOR whitelist, not in the advertised capability surface - they stay
  # UNKNOWN here (the IR layer and the manifest carry them) instead of being aliased into a green.
  if ($leaf -eq 'conditionalSeries') { $specTok = 'conditions' }
}
if ($fam -eq 'spec') {
  if ($leaf -eq 'model') { $specTok = 'sql' } elseif ($leaf -eq 'sum') { $specTok = 'showTotal' } elseif ($leaf -eq 'totalAgg') { $specTok = 'aggregate' } elseif ($leaf -eq 'filter') { $specTok = 'filter' } elseif ($leaf -eq 'topN') { $specTok = 'topN' } elseif ($leaf -eq 'chart') { $specTok = 'chart' } elseif ($leaf -eq 'filters') { $specTok = 'filters' } elseif ($leaf -eq 'sort') { $specTok = 'sort' } elseif ($leaf -eq 'conditions') { $specTok = 'conditions' } elseif ($leaf -eq 'cells') { $specTok = 'cells' } elseif ($leaf -eq 'sumCols') { $specTok = 'sumCols' } elseif ($leaf -eq 'panel') { $specTok = 'params' } elseif ($leaf -eq 'databaseDict') { $specTok = 'databaseDict' }
}
$specTokSet = New-Object System.Collections.Generic.HashSet[string]
foreach ($ln in $planText) {
  $s = '' + $ln
  if ($s.StartsWith('SPECTOK|')) { foreach ($t in $s.Substring(8).Split(',')) { if ($t.Trim()) { [void]$specTokSet.Add($t.Trim()) } } }
}
if ($specTokSet.Count -lt 5) { Write-Output 'LAYER-GATE BLOCKED spec vocabulary dump empty (SPECTOK missing)'; exit 3 }
if ($SPECRES.ContainsKey($target) -and (('' + $SPECRES[$target]).StartsWith('ok:'))) {
  # strongest form: the capability's intent survives plan -> SpecValidator -> SpecCompiler -> Ir.validate
  Add-Verdict 'spec' 'PASS' ('executable contract: plan -> SpecValidator -> SpecCompiler -> Ir.validate clean (' + ('' + $SPECRES[$target]).Substring(3) + ')')
}
elseif ($specTokSet.Contains($specTok)) { Add-Verdict 'spec' 'PASS' ('ReportSpec.capabilities() exact member "' + $specTok + '"') }
else { Add-Verdict 'spec' 'UNKNOWN' ("ReportSpec surface has no exact member '" + $specTok + "' and no executable spec contract covers it - not verifiable at this layer (many caps reach the engine via IR/rawIR, their own layer)") }
# planner layer: a REAL ReportPlanner.plan() run per capability contract (input intent -> emitted spec
#   path), not a substring of the planner source. EXACT input/output, with negative controls below that
#   MUST refuse - an always-true check would report green for a capability the planner cannot route.
$plResult = 'UNKNOWN'; $plDetail = 'no planner input/output contract for this capability (UNKNOWN - capability not exercised through the planner chain)'
if ($PLANRES.ContainsKey($target)) {
  $plc = '' + $PLANRES[$target]
  if ($plc.StartsWith('PASS:')) { $plResult = 'PASS'; $plDetail = 'ReportPlanner.plan ready, ' + $plc.Substring(5) }
  else { $plResult = 'BLOCKED'; $plDetail = 'planner contract run refused it: ' + $plc }
}
Add-Verdict 'planner' $plResult $plDetail
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

$passN = 0; $blockedN = 0; $unknownN = 0
foreach ($v in $verdicts) {
  if ($v -match ' (PASS) ::') { $passN++ }
  elseif ($v -match ' (UNKNOWN) ::') { $unknownN++ }
  else { $blockedN++ }
}
Write-Output ("LAYER-GATE cap=$target seg=$($entry.seg)")
foreach ($v in $verdicts) { Write-Output ('LAYER ' + $v) }
Write-Output ("LAYER-GATE END cap=$target pass=$passN blocked=$blockedN unknown=$unknownN selftest=" + $(if ($negOk -eq 'True') { 'PASS' } else { 'FAIL' }) + ' evidence=' + $ev.Substring(0, [Math]::Min(140, $ev.Length)))
exit 0
