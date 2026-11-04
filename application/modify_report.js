// application/modify_report.js — r8 A1：Modify 操作（把 patch 产物封装成统一 ReportArtifact；零引擎）
//   输入：logs/agent/patch.json（patch verb 产物，含 manifest 的结构/执行/渲染/数据集检查）
//   输出：logs/agent/artifact.json（sourceType=patched；与 Create 同形态，Agent 不必区分两套结果）
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/application/contracts.js');
function readUtf(abs) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(abs)), 'UTF-8')).replace(/^\uFEFF/, ''); }
function exists(abs) { return Files.exists(Pth.get(abs)); }
function tryJson(abs) { try { return JSON.parse(readUtf(abs)); } catch (e) { return null; } }

var pj = tryJson(System.getenv('AGENT_PATCH') || (ROOT + '/logs/agent/patch.json'));
if (!pj) { print('{"ok":false,"error":"patch.json missing; run patch verb first"}'); System.exit(2); }
var mf = pj.manifest || {};
var outAbs = mf.out || null;
var postPng = ROOT + '/logs/template_staging/_post.png';
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
  cptPath: outAbs,
  pngPath: preview ? preview.path : null,
  pdfPath: null,
  execution: ReportArtifact.executionFromPatch(pj),
  validation: val,
  preview: preview,
  diagnostics: ReportArtifact.diagnosticsFromPatch(pj),
  spec: null,
  patch: { path: pj.patch, exit: pj.exit, manifestPath: pj.manifestPath, namedStyles: mf.namedStyles, structDelta: mf.structDelta },
  staging: { dir: ROOT + '/logs/template_staging', manifest: pj.manifestPath }
});
var shape = ReportArtifact.validate(art);
shape.issues.forEach(function (i) { art.diagnostics.push(ReportArtifact.normalizeDiagnostic(i)); });
var acc = ReportArtifact.acceptance(art);
var ok = shape.ok && acc.ok;
Files.createDirectories(Pth.get(ROOT + '/logs/agent'));
Files.write(Pth.get(ROOT + '/logs/agent/artifact.json'), J('java.lang.String').valueOf(JSON.stringify(art, null, 1)).getBytes('UTF-8'));
System.exit(ok ? 0 : 1);
