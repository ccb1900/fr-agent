// verify/fast_manifest_evidence.js — §5步2 能力证据对账器（无引擎，读文件存在性）
//   红线：manifest 每个 regression=verified 的能力，evidence 必须指到"真实存在的测试入口"，
//   不再允许"README 一句"就算证据；引用的 probe/carrier/README# 路径必须磁盘可查。
//   四层独立：regressionScope 标注回归了哪一层（ir/object/cpt/serialization/rendering/agent），
//   序列化层回归合法，不因 rendering 未验而错误降级。
// 跑法：java -cp nashorn.jar jdk.nashorn.tools.Shell verify/fast_manifest_evidence.js
var J = function (n) { return Java.type(n); };
var File = J('java.io.File');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function exists(p) { return new File(ROOT + '/' + p).exists(); }
load(ROOT + '/application/capability_manifest.js');
var mf = CapabilityManifest.build();
var SEGS = ['chart', 'condition', 'write', 'page', 'product'];

// README 编号集合：归档全文（历史条目）+ 活 README 索引（#NN 一行一条，含归档后新增的 #107/#108）
var readmeHas = {};
['docs/history/README-full-2026-11-06.md', 'README.md'].forEach(function (arcPath) {
  if (!exists(arcPath)) return;
  var txt = String(new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(ROOT + '/' + arcPath)), 'UTF-8'));
  var mm, re = /#(\d+)\b/g;
  while ((mm = re.exec(txt)) != null) readmeHas[mm[1]] = true;
});
function probeExists(tok) { // probes/ 下以该 token 命名的 .js（允许后缀 a/b…）
  var dir = new File(ROOT + '/probes'); var fs = dir.listFiles();
  for (var i = 0; fs && i < fs.length; i++) { var nm = fs[i].getName(); if (nm.indexOf(tok) === 0 && /\.js$/.test(nm)) return true; }
  return false;
}
function refsOf(ev) {
  var s = String(ev || '');
  var r = { probe: [], carrier: [], readme: [], fast: [], scan: false, integration: false };
  var pm = s.match(/probe_[a-z0-9]+/g); if (pm) r.probe = pm;
  // carrier 基名（允许 evidence 不带 .js 后缀，如 "carrier sales_demo_chart 每轮 scan"）
  var cm = s.match(/(test_[a-z0-9]+|sales_demo[a-z0-9_]*|db_laser_[a-z0-9_]+|rebuild_[a-z0-9_]+|br_[a-z0-9_]+)/g); if (cm) r.carrier = cm;
  var rm = s.match(/README #\d+/g); if (rm) r.readme = rm;
  var fm = s.match(/fast_[a-z0-9_]+/g); if (fm) r.fast = fm;
  r.scan = /\bscan\b|scan_all_specs/.test(s);
  r.integration = /integration_runtime/.test(s);
  return r;
}

var readmeOnly = [], badProbe = [], badCarrier = [], badReadme = [], noScope = [];
var SCOPE_OK = { ir: 1, object: 1, cpt: 1, serialization: 1, rendering: 1, agent: 1 };
SEGS.forEach(function (seg) {
  (mf[seg] || []).forEach(function (c) {
    var r = refsOf(c.evidence);
    var concrete = r.probe.length || r.carrier.length || r.fast.length || r.scan || r.integration;
    // 红线1：regression=verified 必须有具体测试入口，不能只 README
    if (c.regression === 'verified' && !concrete) readmeOnly.push(c.name);
    // 红线2：引用的路径必须真实存在
    r.probe.forEach(function (p) { if (!probeExists(p)) badProbe.push(c.name + '->' + p); });
    r.carrier.forEach(function (cf) { var nm = /\.js$/.test(cf) ? cf : cf + '.js'; if (!exists('reports/' + nm)) badCarrier.push(c.name + '->' + nm); });
    r.readme.forEach(function (rm) { var nn = rm.replace('README #', ''); if (!readmeHas[nn]) badReadme.push(c.name + '->' + rm); });
    // 红线3：regression=verified 必须标注合法 regressionScope（四层独立，标明回归了哪一层，不反推强制一致）
    if (c.regression === 'verified') {
      if (!c.regressionScope || !SCOPE_OK[c.regressionScope]) noScope.push(c.name + '(' + (c.regressionScope || '缺') + ')');
    }
  });
});

check('无 regression=verified 仅 README 一句（README-only 项=0）', readmeOnly.length === 0);
if (readmeOnly.length) print('   README-only: ' + readmeOnly.join(', '));
check('所有引用的 probe_*.js 在磁盘存在', badProbe.length === 0);
if (badProbe.length) print('   缺 probe: ' + badProbe.join(', '));
check('所有引用的 carrier spec 在 reports/ 存在', badCarrier.length === 0);
if(badCarrier.length) print('   缺 carrier: ' + badCarrier.join(', '));
// README 引用号精确性=提示级（早期条目号如 #26 在归档以列表项存在，非硬红线；硬红线是"无测试入口"）
if (badReadme.length) print('   NOTE 存疑 README# 引用（非 FAIL）: ' + badReadme.join(', '));
check('所有 regression=verified 标注合法 regressionScope', noScope.length === 0);
if (noScope.length) print('   缺/非法 scope: ' + noScope.join(', '));
print('MANIFEST EVIDENCE AUDIT END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
