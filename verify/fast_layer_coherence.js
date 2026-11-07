// verify/fast_layer_coherence.js - 层间协调一致性门（2026-11-08；无引擎，nashorn + java.nio）
//   动机：能力账本（manifest）是 Agent 承诺的一处真相，但它过去只被"字段值合法性"检查过，
//   没有对"每一层是否真的接上"做机器对账。本门把三组不变量钉死，任何一条不成立即 exit 1：
//   A. jar 锚定（E1）：construction=verified 的能力必须在 data/engine_class_map.json 里锚到一个
//      核心 jar 物理存在的类，且该类的字面量确实出现在其 module 文件里；map.none 里列为 rejected/
//      pending 的能力不得是 verified（账本自相矛盾）。
//   B. 入口可达（E2-E4）：agentAvailable=true 的能力必须在证据里点到一个磁盘上存在的可执行载体
//      （probes/ reports/ verify/ examples/ integration_runtime），否则"可承诺"没有执行通路。
//   C. 账本不撒谎：agentAvailable=true 的能力不得有任何一层是 rejected/pending；jar 清单必须
//      带 jarCount/totalClasses 指纹且 missing 为空（否则安装换了、账本没跟着换）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
function src(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + p)), 'UTF-8')); }
function exists(p) { try { return Files.exists(P.get(ROOT + '/' + p)); } catch (e) { return false; } }
var FAILS = 0;
function check(name, cond, detail) {
  if (cond) print('CHECK PASS: ' + name);
  else { FAILS++; print('CHECK FAIL: ' + name + (detail ? ' :: ' + detail : '')); }
}

load(ROOT + '/application/capability_manifest.js');
var mf = CapabilityManifest.build();
var map = JSON.parse(src('data/engine_class_map.json'));
var inv = JSON.parse(src('data/jar_class_inventory.json'));
var SEGS = ['chart', 'condition', 'write', 'page', 'product'];
var caps = [];
SEGS.forEach(function (s) { (mf[s] || []).forEach(function (c) { caps.push(c); }); });

// ---- A. jar anchoring ----
var resolved = inv.resolved || {};
var anchored = 0, unanchored = [], contradict = [], missingLiteral = [];
caps.forEach(function (c) {
  var name = c.name;
  var isVerified = (c.construction === 'verified');
  var none = (map.none && Object.prototype.hasOwnProperty.call(map.none, name)) ? String(map.none[name]) : null;
  if (none) {
    // 'runtime/...' entries are capabilities whose verified fact lives in the tool/runtime layer, not in
    // an engine class - verified is correct for them. 'pending:' / 'rejected:' entries must never be verified.
    if (isVerified && !/^runtime/.test(none)) contradict.push(name + ' (' + none + ')');
    return;
  }
  var entry = (map.exact && map.exact[name]) ? map.exact[name] : null;
  if (!entry) {
    var prefixes = Object.keys(map.family || {});
    for (var i = 0; i < prefixes.length; i++) { if (name.indexOf(prefixes[i]) === 0) { entry = map.family[prefixes[i]]; break; } }
  }
  if (!entry) { if (isVerified) unanchored.push(name); return; }
  if (isVerified) {
    anchored++;
    if (!resolved[entry['class']]) unanchored.push(name + ' (class absent from core jars: ' + entry['class'] + ')');
    else {
      var modText = '';
      try { modText = src(entry.module); } catch (e) { modText = ''; }
      if (modText.indexOf(String(entry['class'])) < 0) missingLiteral.push(name + ' (' + entry['class'] + ' not in ' + entry.module + ')');
    }
  }
});
var verifiedCount = caps.filter(function (c) { return c.construction === 'verified'; }).length;
check('jar 锚定：每个 construction=verified 能力都有核心 jar 类（' + anchored + '/' + verifiedCount + '）', unanchored.length === 0, unanchored.join(', '));
check('jar 锚定：映射类字面量确实出现在实现模块', missingLiteral.length === 0, missingLiteral.join(', '));
check('jar 锚定：map.none 的 rejected/pending 能力不得被标 verified', contradict.length === 0, contradict.join(', '));

// ---- B. executable entrance for every agentAvailable capability ----
//   Same evidence vocabulary the layer gate understands: literal probes/reports/verify/examples paths,
//   the 'carrier NAME' shorthand (reports/NAME.js or reports/test_NAME.js), 'fast_name'
//   (verify/fast_name.js) and 'probe_name' (probes/probe_name.js), plus integration_runtime.
var PATTERNS = [/probes\/[A-Za-z0-9_.-]+\.js/g, /reports\/[A-Za-z0-9_.-]+\.js/g, /verify\/[A-Za-z0-9_.-]+\.js/g, /examples\/[A-Za-z0-9_.\/-]+\.json/g];
var noEntrance = [];
caps.forEach(function (c) {
  if (!c.agentAvailable) return;
  var ev = String(c.evidence || '');
  var hit = false;
  PATTERNS.forEach(function (re) {
    var mm;
    while ((mm = re.exec(ev)) !== null) { if (exists(mm[0])) { hit = true; break; } }
  });
  if (!hit) {
    var carriers = ev.match(/carrier ([A-Za-z0-9_]+)/g) || [];
    for (var i = 0; i < carriers.length && !hit; i++) {
      var nm = carriers[i].replace(/^carrier /, '');
      if (exists('reports/' + nm + '.js') || exists('reports/test_' + nm + '.js')) hit = true;
    }
    var fasts = ev.match(/fast_([a-z_]+)/g) || [];
    for (var j = 0; j < fasts.length && !hit; j++) { if (exists('verify/fast_' + fasts[j].replace(/^fast_/, '') + '.js')) hit = true; }
    var probes = ev.match(/probe_([A-Za-z0-9_]+)/g) || [];
    for (var k = 0; k < probes.length && !hit; k++) { if (exists('probes/' + probes[k] + '.js')) hit = true; }
  }
  if (!hit && /integration_runtime/.test(ev) && exists('verify/integration_runtime.ps1')) hit = true;
  if (!hit) noEntrance.push(c.name);
});
var aa = caps.filter(function (c) { return c.agentAvailable; }).length;
check('入口可达：agentAvailable 能力都点到磁盘上存在的可执行载体（' + aa + ' 项）', noEntrance.length === 0, noEntrance.join(', '));

// ---- C. ledger does not lie + jar inventory fingerprint ----
var badLayer = [];
caps.forEach(function (c) {
  if (!c.agentAvailable) return;
  ['construction', 'serialization', 'rendering', 'regression'].forEach(function (k) {
    var v = String(c[k] || '');
    if (v === 'rejected' || v === 'pending' || v === 'unsupported') badLayer.push(c.name + '.' + k + '=' + v);
  });
});
check('账本不撒谎：agentAvailable 能力没有任何一层是 rejected/pending', badLayer.length === 0, badLayer.join(', '));
check('jar 清单指纹完整（jarCount>50 且 totalClasses>100000）', (inv.jarCount > 50) && (inv.totalClasses > 100000), 'jarCount=' + inv.jarCount + ' totalClasses=' + inv.totalClasses);
check('jar 清单 missing 为空（管线点名的类都能在核心 jar 找到）', Array.isArray(inv.missing) && inv.missing.length === 0, (inv.missing || []).join(', '));
check('jar 清单 namedCount 与 EngineClassMap 类一致（清单不是空壳）', inv.namedCount > 20 && Object.keys(resolved).length >= inv.namedCount, 'named=' + inv.namedCount + ' resolved=' + Object.keys(resolved).length);

// ---- D. summary numbers (printed, not asserted: the accounting the reader needs) ----
print('COHERENCE SUMMARY caps=' + caps.length + ' verified=' + verifiedCount + ' agentAvailable=' + aa + ' jarClassesNamed=' + Object.keys(resolved).length + ' coreJars=' + inv.jarCount + ' coreClasses=' + inv.totalClasses);
print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS ? 1 : 0);
