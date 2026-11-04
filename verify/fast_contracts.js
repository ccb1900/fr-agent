// verify/fast_contracts.js — r8 A1 统一创作契约离线测（零引擎）
//   标尺：Create/Modify 产出同形 ReportArtifact；结构校验能抓非法；RunResult/patch 诊断统一为 {code,path,message,stage,severity}；
//   验收口径 = 执行成功 + 无 error 诊断 + validation 不为 false（warn 不阻断）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + f)), 'UTF-8')); }
['application/contracts.js', 'application/create_report.js', 'application/modify_report.js'].forEach(function (f) {
  var ok = true; try { new Function(src(f)); } catch (e) { ok = false; print('PARSE ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});
load(ROOT + '/application/contracts.js');

var gen = ReportArtifact.create({
  sourceType: 'generated', outName: '日报', cptPath: 'x.cpt', pngPath: 'x.png',
  execution: ReportArtifact.executionFromRunResult({ success: true, exit: 0, stages: { input_load: 'passed', execute: 'passed' }, diagnostics: [] }),
  validation: { ok: true, checks: [] },
  spec: { path: 'examples/report-spec/daily_report.sql.json', kind: 'report-spec' }
});
check('generated 产物契约合法', ReportArtifact.validate(gen).ok === true);
check('acceptance 通过（成功+validation=true）', ReportArtifact.acceptance(gen).ok === true);
check('artifactId 稳定（sourceType:outName）', gen.artifactId === 'generated:日报');
check('generated 缺 spec→非法', (function () { var a = JSON.parse(JSON.stringify(gen)); a.spec = null; return ReportArtifact.validate(a).ok === false; })());
check('patched 缺 patch→非法', ReportArtifact.validate(ReportArtifact.create({ sourceType: 'patched', outName: 'p', cptPath: 'c' })).ok === false);
check('未知 sourceType 被规整为 generated（非法值不落地）', ReportArtifact.create({ sourceType: 'evil', outName: 'x', cptPath: 'c' }).sourceType === 'generated');

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

// 验收口径
var failed = ReportArtifact.create({
  sourceType: 'generated', outName: 'f', cptPath: 'c', spec: { path: 's' },
  execution: ReportArtifact.executionFromRunResult(rrBad), diagnostics: ReportArtifact.diagnosticsFromRunResult(rrBad)
});
check('执行失败→acceptance=false', ReportArtifact.acceptance(failed).ok === false);
var warned = ReportArtifact.create({
  sourceType: 'generated', outName: 'w', cptPath: 'c', spec: { path: 's' },
  execution: ReportArtifact.executionFromRunResult({ success: true, exit: 0, stages: { execute: 'passed' } }),
  diagnostics: [{ code: 'EVIDENCE_WARN', message: 'stale', severity: 'warn' }]
});
check('warn 诊断不阻断 acceptance', ReportArtifact.acceptance(warned).ok === true);
var valFail = ReportArtifact.create({
  sourceType: 'generated', outName: 'v', cptPath: 'c', spec: { path: 's' },
  execution: ReportArtifact.executionFromRunResult({ success: true, exit: 0, stages: {} }),
  validation: { ok: false, checks: [{ name: 'x', pass: false }] }
});
check('validation=false→acceptance=false', ReportArtifact.acceptance(valFail).ok === false);
check('create 不改输入 parts', (function () {
  var parts = { sourceType: 'generated', outName: 'o', cptPath: 'c', spec: { path: 's' }, diagnostics: ['x'] };
  var snap = JSON.stringify(parts);
  ReportArtifact.create(parts);
  return JSON.stringify(parts) === snap;
})());

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
