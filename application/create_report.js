// application/create_report.js — r8 A1 + r10-A：Create 操作（compile 产物 → 统一 ReportArtifact；零引擎）
//   r10-A：AGENT_RUN_ID 必需；输入/输出全部走 logs/agent/runs/{runId}/；validate.json/preview.json 必须带同一 runId
//   （防陈旧验收硬校验）；artifact 原子写；任何失败 exit 1（不产成功假象）。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
load(ROOT + '/application/contracts.js');

var runId = System.getenv('AGENT_RUN_ID');
if (!runId) { print('{"ok":false,"error":"AGENT_RUN_ID required (r10-A: per-run isolation)"}'); System.exit(2); }
var runDir = runDirOf(runId);

var comp = tryJson(runDir + '/compile.json');
if (!comp) { writeJson(runDir + '/artifact.json', { ok: false, error: 'compile.json missing in run dir; run compile verb first', runId: runId }); print('{"ok":false,"error":"compile.json missing"}'); System.exit(1); }
if (comp.runId && String(comp.runId) !== String(runId)) { print('{"ok":false,"error":"compile.json belongs to run ' + comp.runId + ', not ' + runId + '"}'); System.exit(1); }
var rr = tryJson(absOf(comp.runResult));
// r10-A ③：validate.json 必须属于本 run（带 runId 且一致）才并入验收
var valPath = runDir + '/validate.json';
var val = null;
if (exists(valPath)) {
  var vj = tryJson(valPath);
  if (vj && String(vj.runId) === String(runId)) val = vj;
  else if (vj) { print('{"ok":false,"error":"validate.json runId mismatch: ' + vj.runId + ' vs ' + runId + '"}'); System.exit(1); }
}
// r10-A ③：preview.json 同 run 才并入
var prevPath = runDir + '/preview.json';
var prev = null;
if (exists(prevPath)) {
  var pj2 = tryJson(prevPath);
  if (pj2 && String(pj2.runId) === String(runId)) prev = pj2;
}

var art = ReportArtifact.create({
  sourceType: 'generated',
  outName: comp.outName,
  runId: runId,
  cptPath: comp.cptPath, pngPath: comp.pngPath, pdfPath: comp.pdfPath,
  execution: ReportArtifact.executionFromRunResult(rr),
  validation: val ? { ok: val.ok === true, checks: val.checks || [] } : null,
  preview: (prev && prev.exists) ? { path: prev.png, bytes: prev.bytes, width: prev.width, height: prev.height, blankish: prev.blankish } : null,
  diagnostics: ReportArtifact.diagnosticsFromRunResult(rr),
  spec: { path: comp.spec, kind: 'report-spec' },
  patch: null,
  staging: null
});
var shape = ReportArtifact.validate(art);
shape.issues.forEach(function (i) { art.diagnostics.push(ReportArtifact.normalizeDiagnostic(i)); });
var acc = ReportArtifact.acceptance(art);
var ok = shape.ok && acc.ok;
atomicWriteUtf(runDir + '/artifact.json', JSON.stringify(art, null, 1));
System.exit(ok ? 0 : 1);
