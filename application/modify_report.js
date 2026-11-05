// application/modify_report.js — r8 A1 + r10-A：Modify 操作（patch 产物 → 统一 ReportArtifact；零引擎）
//   r10-A：AGENT_RUN_ID 必需；patch.json 从 runDir 读且必须带同一 runId；artifact 原子写；失败 exit 1。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
load(ROOT + '/application/contracts.js');

var runId = System.getenv('AGENT_RUN_ID');
if (!runId) { print('{"ok":false,"error":"AGENT_RUN_ID required (r10-A: per-run isolation)"}'); System.exit(2); }
var runDir = runDirOf(runId);

var pj = tryJson(runDir + '/patch.json');
if (!pj) { writeJson(runDir + '/artifact.json', { ok: false, error: 'patch.json missing in run dir; run patch verb first', runId: runId }); print('{"ok":false,"error":"patch.json missing"}'); System.exit(1); }
if (String(pj.runId || '') !== String(runId)) { print('{"ok":false,"error":"patch.json belongs to run ' + (pj.runId || '(missing)') + ', not ' + runId + '"}'); System.exit(1); }
var mf = pj.manifest || {};
var outAbs = mf.out || null;
// r11-2：staging 随 run 隔离——patch.json 带其 staging 目录，modify 只读本 run 的产物（防并发串扰）
var stagingDir = pj.stagingDir || (ROOT + '/logs/template_staging');
var postPng = stagingDir + '/_post.png';
var checks = [];
function ck(name, pass, detail) { checks.push({ name: name, pass: !!pass, detail: detail == null ? null : String(detail) }); }
ck('结构 diff 未改部分不变', mf.diffClean === true, 'diffClean=' + mf.diffClean);
if (mf.execution) ck('执行回归', mf.execution.pass === true, mf.execution.reason);
if (mf.render) ck('渲染回归', mf.render.pass === true, mf.render.reason);
(mf.datasetChecks || []).forEach(function (c) { ck('数据集回归(' + c.where + ')', c.pass === true, c.reason); });
var val = { ok: checks.every(function (c) { return c.pass; }), checks: checks };

var preview = null;
if (exists(postPng)) {
  try {
    var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(postPng));
    preview = { path: postPng, bytes: +Files.size(Pth.get(postPng)), width: +img.getWidth(), height: +img.getHeight(), blankish: (+img.getWidth() < 10) };
  } catch (eP) { preview = null; }
}

var art = ReportArtifact.create({
  sourceType: 'patched',
  outName: mf.out ? String(mf.out).replace(/^.*\//, '').replace(/\.cpt$/, '') : (pj.patch || 'patched'),
  runId: runId,
  cptPath: outAbs,
  pngPath: preview ? preview.path : null,
  pdfPath: null,
  execution: ReportArtifact.executionFromPatch(pj),
  validation: val,
  preview: preview,
  diagnostics: ReportArtifact.diagnosticsFromPatch(pj),
  spec: null,
  patch: { path: pj.patch, exit: pj.exit, manifestPath: pj.manifestPath, namedStyles: mf.namedStyles, structDelta: mf.structDelta },
  staging: { dir: stagingDir, manifest: pj.manifestPath }
});
var shape = ReportArtifact.validate(art);
shape.issues.forEach(function (i) { art.diagnostics.push(ReportArtifact.normalizeDiagnostic(i)); });
var acc = ReportArtifact.acceptance(art);
var ok = shape.ok && acc.ok;
atomicWriteUtf(runDir + '/artifact.json', JSON.stringify(art, null, 1));
System.exit(ok ? 0 : 1);
