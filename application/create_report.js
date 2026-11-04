// application/create_report.js — r8 A1：Create 操作（把 compile 产物封装成统一 ReportArtifact；零引擎）
//   输入：logs/agent/compile.json（compile verb 产物）+ runresult + validate.json + preview.json（后两者可选）
//   输出：logs/agent/artifact.json（ReportArtifact v1）+ 一行 ASCII JSON。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/application/contracts.js');
function readUtf(abs) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(abs)), 'UTF-8')).replace(/^\uFEFF/, ''); }
function exists(abs) { return Files.exists(Pth.get(abs)); }
function absOf(p) { return /^[A-Za-z]:[\\\/]/.test(String(p)) ? String(p) : (ROOT + '/' + String(p)); }
function tryJson(abs) { try { return JSON.parse(readUtf(abs)); } catch (e) { return null; } }

var comp = tryJson(System.getenv('AGENT_COMPILE') || (ROOT + '/logs/agent/compile.json'));
if (!comp) { print('{"ok":false,"error":"compile.json missing; run compile verb first"}'); System.exit(2); }
var rr = tryJson(absOf(comp.runResult));
// 防止"上一轮 validate.json"被误当本轮验收：只有 validate verb 显式开启时才并入
var val = (System.getenv('AGENT_WITH_VALIDATION') === '1') ? tryJson(ROOT + '/logs/agent/validate.json') : null;
var prev = tryJson(ROOT + '/logs/agent/preview.json');

var art = ReportArtifact.create({
  sourceType: 'generated',
  outName: comp.outName,
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
Files.createDirectories(Pth.get(ROOT + '/logs/agent'));
Files.write(Pth.get(ROOT + '/logs/agent/artifact.json'), J('java.lang.String').valueOf(JSON.stringify(art, null, 1)).getBytes('UTF-8'));
System.exit(ok ? 0 : 1);
