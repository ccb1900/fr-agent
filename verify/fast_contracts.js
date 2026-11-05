// verify/fast_contracts.js — r8 A1 统一创作契约离线测（零引擎）；r10-A 扩 runId 唯一性/四层能力状态
//   标尺：Create/Modify 产出同形 ReportArtifact；结构校验能抓非法；RunResult/patch 诊断统一为 {code,path,message,stage,severity}；
//   验收口径 = 执行成功 + 无 error 诊断 + validation 不为 false（warn 不阻断）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + f)), 'UTF-8')); }
['application/contracts.js', 'application/create_report.js', 'application/modify_report.js', 'application/capability_manifest.js'].forEach(function (f) {
  var ok = true; try { new Function(src(f)); } catch (e) { ok = false; print('PARSE ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});
load(ROOT + '/application/contracts.js');
load(ROOT + '/application/capability_manifest.js');

var gen = ReportArtifact.create({
  sourceType: 'generated', outName: '日报', runId: 'r1', cptPath: 'x.cpt', pngPath: 'x.png',
  execution: ReportArtifact.executionFromRunResult({ success: true, exit: 0, stages: { input_load: 'passed', execute: 'passed' }, diagnostics: [] }),
  validation: { ok: true, checks: [] },
  spec: { path: 'examples/report-spec/daily_report.sql.json', kind: 'report-spec' }
});
var gen2 = ReportArtifact.create({ sourceType: 'generated', outName: '日报', runId: 'r2', cptPath: 'x.cpt', execution: { ok: false, exit: 1 }, spec: { path: 's' } });
check('generated 产物契约合法', ReportArtifact.validate(gen).ok === true);
check('acceptance 通过（成功+validation=true）', ReportArtifact.acceptance(gen).ok === true);
check('artifactId 带 runId 唯一（sourceType:outName@runId，r10-A）', gen.artifactId === 'generated:日报@r1' && gen2.artifactId === 'generated:日报@r2' && gen.artifactId !== gen2.artifactId);
check('缺 runId → 结构非法（r10-A 必填）', (function () { var a = ReportArtifact.create({ sourceType: 'generated', outName: 'x', cptPath: 'c', execution: { ok: false }, spec: { path: 's' } }); return ReportArtifact.validate(a).ok === false; })());
check('generated 缺 spec→非法', (function () { var a = JSON.parse(JSON.stringify(gen)); a.spec = null; return ReportArtifact.validate(a).ok === false; })());
check('patched 缺 patch→非法', ReportArtifact.validate(ReportArtifact.create({ sourceType: 'patched', outName: 'p', runId: 'r1', cptPath: 'c' })).ok === false);
check('未知 sourceType 被规整为 generated（非法值不落地）', ReportArtifact.create({ sourceType: 'evil', outName: 'x', runId: 'r1', cptPath: 'c' }).sourceType === 'generated');

// 诊断统一
var rrBad = { success: false, exit: 2, stages: { input_load: 'failed', execute: 'skipped' }, diagnostics: ['UNSUPPORTED_RELATION_KEY @ relationships[0].to.column: 缺证据', 'plain message'] };
var d = ReportArtifact.diagnosticsFromRunResult(rrBad);
check('RunResult 诊断结构化(CODE @ path: msg)', d[0].code === 'UNSUPPORTED_RELATION_KEY' && d[0].path === 'relationships[0].to.column' && d[0].message === '缺证据');
check('非结构化诊断保留原文', d.some(function (x) { return x.code === 'DIAG' && x.message === 'plain message'; }));
check('失败段生成 STAGE_FAILED（带 stage）', d.some(function (x) { return x.code === 'STAGE_FAILED' && x.stage === 'input_load'; }));
var ex = ReportArtifact.executionFromRunResult(rrBad);
check('执行视图 failedStage=input_load', ex.ok === false && ex.failedStage === 'input_load');

// patch 诊断
var pj = { ok: true, exit: 0, patch: 'p.json', manifest: { diffClean: false, execution: { pass: false, reason: '数据区意外变动' }, render: { pass: true }, datasetChecks: [{ pass: false, where: 'exported re-read', reason: '行数不符' }] } };
var pd = ReportArtifact.diagnosticsFromPatch(pj);
check('patch diff 不干净→DIFF_UNCLEAN', pd.some(function (x) { return x.code === 'DIFF_UNCLEAN'; }));
check('patch 执行失败→REGRESSION_EXECUTION', pd.some(function (x) { return x.code === 'REGRESSION_EXECUTION' && x.stage === 'regression'; }));
check('patch 数据集不符→DATASET_MISMATCH', pd.some(function (x) { return x.code === 'DATASET_MISMATCH'; }));
check('patch 执行视图 ok=false', ReportArtifact.executionFromPatch(pj).ok === false);
// ===== r14 P1: Patch 证据缺失必须 fail-closed（缺 manifest/diffClean/execution/render 不得当成成功） =====
check('r14 patch 完整证据→ok=true', ReportArtifact.executionFromPatch({ ok: true, exit: 0, manifest: { diffClean: true, execution: { pass: true }, render: { pass: true } } }).ok === true);
check('r14 patch manifest 缺失→ok=false（!==false 假通过已修）', ReportArtifact.executionFromPatch({ ok: true, exit: 0 }).ok === false);
check('r14 patch manifest 空→ok=false', ReportArtifact.executionFromPatch({ ok: true, exit: 0, manifest: {} }).ok === false);
check('r14 patch 缺 execution 回归→ok=false', ReportArtifact.executionFromPatch({ ok: true, exit: 0, manifest: { diffClean: true, render: { pass: true } } }).ok === false);
check('r14 patch 缺 render 回归→ok=false', ReportArtifact.executionFromPatch({ ok: true, exit: 0, manifest: { diffClean: true, execution: { pass: true } } }).ok === false);
check('r14 patch diffClean 缺失→ok=false', ReportArtifact.executionFromPatch({ ok: true, exit: 0, manifest: { execution: { pass: true }, render: { pass: true } } }).ok === false);
check('r14 patch manifest 缺失诊断含 MANIFEST_MISSING', ReportArtifact.diagnosticsFromPatch({ ok: true, exit: 0 }).some(function (x) { return x.code === 'MANIFEST_MISSING' && x.severity === 'error'; }));
check('r14 patch 缺 execution 诊断含 REGRESSION_EXECUTION', ReportArtifact.diagnosticsFromPatch({ ok: true, exit: 0, manifest: { diffClean: true, render: { pass: true } } }).some(function (x) { return x.code === 'REGRESSION_EXECUTION'; }));

// 验收口径
var failed = ReportArtifact.create({
  sourceType: 'generated', outName: 'f', runId: 'r1', cptPath: 'c', spec: { path: 's' },
  execution: ReportArtifact.executionFromRunResult(rrBad), diagnostics: ReportArtifact.diagnosticsFromRunResult(rrBad)
});
check('执行失败→acceptance=false', ReportArtifact.acceptance(failed).ok === false);
var warned = ReportArtifact.create({
  sourceType: 'generated', outName: 'w', runId: 'r1', cptPath: 'c', spec: { path: 's' },
  execution: ReportArtifact.executionFromRunResult({ success: true, exit: 0, stages: { execute: 'passed' } }),
  diagnostics: [{ code: 'EVIDENCE_WARN', message: 'stale', severity: 'warn' }]
});
check('warn 诊断不阻断 acceptance', ReportArtifact.acceptance(warned).ok === true);
var valFail = ReportArtifact.create({
  sourceType: 'generated', outName: 'v', runId: 'r1', cptPath: 'c', spec: { path: 's' },
  execution: ReportArtifact.executionFromRunResult({ success: true, exit: 0, stages: {} }),
  validation: { ok: false, checks: [{ name: 'x', pass: false }] }
});
check('validation=false→acceptance=false', ReportArtifact.acceptance(valFail).ok === false);
check('create 不改输入 parts', (function () {
  var parts = { sourceType: 'generated', outName: 'o', runId: 'r1', cptPath: 'c', spec: { path: 's' }, diagnostics: ['x'] };
  var snap = JSON.stringify(parts);
  ReportArtifact.create(parts);
  return JSON.stringify(parts) === snap;
})());

// ===== r10-B/r11-5：CapabilityManifest 五层能力状态（含 regression） =====
var mf = CapabilityManifest.build();
var SEGS = ['chart', 'condition', 'write', 'page', 'product'];
check('manifest 有五大段（chart/condition/write/page/product）', SEGS.every(function (s) { return Array.isArray(mf[s]) && mf[s].length > 0; }));
check('每能力五层状态齐全（含 regression，r11-5）', (function () {
  var ok = true;
  SEGS.forEach(function (seg) {
    (mf[seg] || []).forEach(function (cap) {
      if (!cap.name || typeof cap.construction !== 'string' || typeof cap.serialization !== 'string' || typeof cap.rendering !== 'string' || typeof cap.regression !== 'string' || typeof cap.agentAvailable !== 'boolean') ok = false;
    });
  });
  return ok;
})());
check('agentAvailable = 四层全 verified（含 regression；仅构造/仅序列化/无回归的不广告）', (function () {
  var allTrue = [], someFalse = [];
  SEGS.forEach(function (seg) { (mf[seg] || []).forEach(function (c) { if (c.agentAvailable) allTrue.push(c); else someFalse.push(c); }); });
  return allTrue.every(function (c) { return c.construction === 'verified' && c.serialization === 'verified' && c.rendering === 'verified' && c.regression === 'verified'; }) && someFalse.length > 0;
})());
check('serialization-only 能力（tooltip/条件超链/填报结构）agentAvailable=false（渲染属 web 行为不外宣）', (function () {
  var find = function (n) { var r = null; SEGS.forEach(function (seg) { (mf[seg] || []).forEach(function (c) { if (c.name === n) r = c; }); }); return r; };
  var tt = find('chart.tooltip'), lk = find('condition.then.link'), ws = find('write.structure');
  return tt && tt.rendering === 'serialization-only' && tt.agentAvailable === false && lk && lk.agentAvailable === false && ws && ws.agentAvailable === false;
})());
check('批B 渲染端三案收案 rendering=verified（stack/label/conditionalSeries；probe_r4m3/m7/m9+test_vanchart 载体实跑）', (function () {
  var find = function (n) { var r = null; SEGS.forEach(function (seg) { (mf[seg] || []).forEach(function (c) { if (c.name === n) r = c; }); }); return r; };
  var s = find('chart.stack'), l = find('chart.label'), cs = find('chart.conditionalSeries');
  return s && s.rendering === 'verified' && s.agentAvailable === true && l && l.rendering === 'verified' && l.agentAvailable === true && cs && cs.rendering === 'verified' && cs.agentAvailable === true;
})());
check('批H cell.sort 与 I6 style patch rejected（不硬凑）', (function () {
  var find = function (n) { var r = null; SEGS.forEach(function (seg) { (mf[seg] || []).forEach(function (c) { if (c.name === n) r = c; }); }); return r; };
  var so = find('cell.sort'), sp = find('template.patch.style');
  return so && so.serialization === 'rejected' && sp && sp.construction === 'rejected';
})());
check('r12 agent.runtime.serial 已收（agentAvailable=true）', (function () {
  var find = function (n) { var r = null; SEGS.forEach(function (seg) { (mf[seg] || []).forEach(function (c) { if (c.name === n) r = c; }); }); return r; };
  var rt = find('agent.runtime.serial'); return rt && rt.agentAvailable === true;
})());
check('manifest 带 evidence 引证（README/carrier/probe 可溯源）', (function () {
  var ok = true; SEGS.forEach(function (seg) { (mf[seg] || []).forEach(function (c) { if (!c.evidence || !String(c.evidence).match(/README #\d+|probe_|carrier|integration_runtime/)) ok = false; }); });
  return ok;
})());
check('agentAvailableNames 扁平名单非空:含 runtime.serial/stack（渲染已收）、不含 tooltip（serialization-only）', (function () {
  var names = CapabilityManifest.agentAvailableNames();
  return names.length > 0 && names.indexOf('agent.runtime.serial') >= 0 && names.indexOf('chart.stack') >= 0 && names.indexOf('chart.tooltip') < 0;
})());
// r11 P1 两套能力视图的机器可验证关系：词汇视图(ReportSpec.capabilities)与成熟度视图(manifest)不得互相矛盾——
//   凡 construction/serialization/rendering/regression 任一为 rejected 的能力，agentAvailable 必须为 false。
check('manifest 无 rejected 能力被标 agentAvailable（两视图不矛盾）', (function () {
  var ok = true;
  SEGS.forEach(function (seg) { (mf[seg] || []).forEach(function (c) {
    var anyRejected = (c.construction === 'rejected' || c.serialization === 'rejected' || c.rendering === 'rejected' || c.regression === 'rejected');
    if (anyRejected && c.agentAvailable) ok = false;
  }); });
  return ok;
})());

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
