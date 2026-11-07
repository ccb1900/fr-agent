// probes/scan_all_specs.js — I0-01 零误报门：reports/ 全量 spec 离线 compile+validate
//   动机（ub-mode Build the Lever）：ir.js 校验完整化批（I0-01/r2）新闸必须放过全部 42 张在库
//   spec——这是"合法报表=回归门"铁律；引擎跑一张要杀 java+分钟级，本扫描纯 nashorn 秒级全扫。
//   依赖面实测：spec 只 load runtime/paths.js（env 门面）与 lib/dbpass.js（java.nio 读文件）
//   + features/data_browser/browser.js（grep 实证零 com.fr / 零 Java.type）→ 无 FR 引擎可跑。
// 跑法：
//   "D:\software\FineReport_11.0\jre\bin\java.exe" -cp "D:\software\FineReport_11.0\jre\lib\ext\nashorn.jar" jdk.nashorn.tools.Shell probes/scan_all_specs.js
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/runtime/paths.js');
load(ROOT + '/lib/ir.js');

var files = new java.io.File(ROOT + '/reports').listFiles();
var names = [];
for (var i = 0; i < files.length; i++) if (files[i].isFile() && /\.js$/.test(files[i].getName())) names.push(files[i].getName());
names.sort();

var bad = 0, ok = 0, skipped = 0;
names.forEach(function (fn) {
  var rel = 'reports/' + fn;
  try { SPEC = undefined; } catch (eDel) { }
  try {
    load(ROOT + '/' + rel);
  } catch (e) {
    // 既有环境耦合不算回归：spec 加载期读 probe 产物（如 sproduct_dump.txt，probe_dumpA 产出、不入库）
    if (/NoSuchFile/.test(String(e))) { skipped++; print('SKIP ' + rel + ' (missing local probe artifact: ' + e + ')'); return; }
    bad++; print('LOAD FAIL ' + rel + ': ' + e); return;
  }
  if (typeof SPEC === 'undefined' || SPEC == null) { skipped++; print('SKIP ' + rel + ' (no global SPEC)'); return; }
  var ir;
  try { ir = Ir.compile(SPEC); } catch (e2) { bad++; print('COMPILE FAIL ' + rel + ': ' + e2); return; }
  var errs;
  try { errs = Ir.validate(ir); } catch (e3) { bad++; print('VALIDATOR THREW ' + rel + ': ' + e3); return; }
  if (errs.length) {
    bad++;
    print('VALIDATE FAIL ' + rel + ' (' + errs.length + ')');
    errs.slice(0, 12).forEach(function (e) {
      print('   ' + (e && e.code ? e.code + ' @ ' + e.path + ': ' + e.message : String(e)));
    });
  } else ok++;
});
// 2026-11-07：examples/report-spec/*.json 也进回归门（ReportSpec 路：validator 全量 + rows 路 compile+Ir.validate；
//   sql 路 compile 需 deps，仅 validator+结构闸，不打网络/库）
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/lib/isodate.js');
load(ROOT + '/lib/spec_validator.js');
load(ROOT + '/lib/spec_compiler.js');
var exDir = new java.io.File(ROOT + '/examples/report-spec');
var exs = exDir.exists() ? exDir.listFiles() : [];
var exNames = [];
for (var ei = 0; ei < exs.length; ei++) if (exs[ei].isFile() && /\.json$/.test(exs[ei].getName())) exNames.push(exs[ei].getName());
exNames.sort();
exNames.forEach(function (fn) {
  var rel = 'examples/report-spec/' + fn;
  var txt = String(new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(ROOT + '/' + rel)), 'UTF-8')).replace(/^﻿/, '');
  var rs = null;
  try { rs = JSON.parse(txt); } catch (e0) { bad++; print('SPEC JSON FAIL ' + rel + ': ' + e0); return; }
  var errs = [];
  try { errs = SpecValidator.validate(rs); } catch (e1) { bad++; print('SPEC VALIDATOR THREW ' + rel + ': ' + e1); return; }
  if (errs.length) {
    bad++; print('SPEC VALIDATE FAIL ' + rel + ' (' + errs.length + ')');
    errs.slice(0, 8).forEach(function (e) { print('   ' + (e && e.code ? e.code + ' @ ' + e.path + ': ' + e.message : String(e))); });
    return;
  }
  var hasSql = (rs.dataset && rs.dataset.kind === 'sql') || (Array.isArray(rs.extraSheets) && rs.extraSheets.some(function (x) { return x && x.dataset && x.dataset.kind === 'sql'; }));
  if (hasSql) { ok++; print('SPEC OK (sql: validator only) ' + rel); return; }
  var ir2 = null;
  try { ir2 = SpecCompiler.compile(rs); } catch (e2) { bad++; print('SPEC COMPILE FAIL ' + rel + ': ' + e2); return; }
  var ie = [];
  try { ie = Ir.validate(ir2); } catch (e3) { bad++; print('SPEC IR THREW ' + rel + ': ' + e3); return; }
  if (ie.length) {
    bad++; print('SPEC IR FAIL ' + rel + ' (' + ie.length + ')');
    ie.slice(0, 8).forEach(function (e) { print('   ' + (e && e.code ? e.code + ' @ ' + e.path + ': ' + e.message : String(e))); });
  } else ok++;
});
print('SCAN END: ok=' + ok + ' bad=' + bad + ' skipped=' + skipped);
System.exit(bad ? 1 : 0);
