// verify/fast_acceptance.js — Agent 验收基准完整性门（无引擎；fast 套件）
//   定位：只证明"验收基准自身是自洽的"，不证明任何任务被真实执行过、更不证明报表正确。
//   检查面：
//     ① benchmark.json ↔ tasks/*.json（路径/ID/分组/逐文件 sha256，LF 归一化）
//     ② 任务引用的能力 ID 必须存在于 application/capability_manifest.js；requiredCapabilities 必须
//        agentAvailable=true（否则"PASS 资格"是广告）
//     ③ dataAssertions 必须命中 fixture oracle；agentTools 必须是 fr_agent.ps1 的真实 verb；提示词不得泄漏内部词
//     ④ fixture manifest 逐文件哈希 + 行数 + oracle 的几条加总不变量（防数据/真值漂移）
//     ⑤ acceptance/results/**/*.json（若有）逐个过 ResultSchema：证据层级/评分/能力闭包/部署安全
//   不通过即 exit 1；不修改任何文件。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var MessageDigest = J('java.security.MessageDigest');

var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0, CHECKS = 0, WARNINGS = 0;
function check(name, cond) {
  CHECKS++;
  if (!cond) { FAILS++; print('CHECK FAIL: ' + name); }
}
function warn(name, cond) {
  if (!cond) { WARNINGS++; print('CHECK WARN: ' + name); }
}
function readText(p) {
  return String(new (J('java.lang.String'))(Files.readAllBytes(Paths.get(p)), 'UTF-8')).replace(/^\uFEFF/, '');
}
function exists(p) { return Files.exists(Paths.get(p)); }
function hexOf(bytes) {
  var HEX = '0123456789abcdef', out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    out += HEX.charAt((b >> 4) & 0xf) + HEX.charAt(b & 0xf);
  }
  return out;
}
function sha256(text) {
  var md = MessageDigest.getInstance('SHA-256');
  return hexOf(md.digest(J('java.lang.String').valueOf(text).getBytes('UTF-8')));
}
function normHash(text) { return sha256(String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')); }
function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function isArr(o) { return Object.prototype.toString.call(o) === '[object Array]'; }
function isObj(o) { return o !== null && typeof o === 'object' && !isArr(o); }
function isStr(o) { return typeof o === 'string' && o.length > 0; }

load(ROOT + '/application/capability_manifest.js');
load(ROOT + '/acceptance/result_schema.js');
var MF = CapabilityManifest.build();
var capMap = Object.create(null);
['chart', 'condition', 'write', 'page', 'product'].forEach(function (seg) {
  MF[seg].forEach(function (c) { capMap[c.name] = c; });
});
var BENCH_PATH = ROOT + '/acceptance/benchmark.json';
check('benchmark.json exists', exists(BENCH_PATH));
if (!exists(BENCH_PATH)) { print('FAST-ACCEPTANCE FAIL: benchmark.json missing'); System.exit(1); }
var bench = JSON.parse(readText(BENCH_PATH));

// ---- ① 索引结构 ----
check('benchmarkVersion present', isStr(bench.benchmarkVersion));
check('specDate present', /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(bench.specDate)));
check('sourceOfTruth names build_tasks.js', String(bench.sourceOfTruth || '').indexOf('acceptance/tools/build_tasks.js') >= 0);
check('taskModelDoc present', String(bench.taskModelDoc || '') === 'acceptance/README.md');
check('capability ledger source pinned', String((bench.capabilityLedger || {}).source) === 'application/capability_manifest.js');
check('fixture manifest path pinned', String((bench.fixture || {}).manifest) === 'acceptance/fixtures/sales/manifest.json');
check('result levels complete', isArr(bench.resultLevels) && bench.resultLevels.length === 6);
check('evidence tiers documented', isObj(bench.evidenceTiers) && hasOwn(bench.evidenceTiers, 'specValid') && hasOwn(bench.evidenceTiers, 'interaction') && hasOwn(bench.evidenceTiers, 'analysis') && hasOwn(bench.evidenceTiers, 'note'));

// ---- ② 任务文件/哈希/能力/真值键/工具/提示词/权重 ----
var tasks = bench.tasks;
check('tasks is an array', isArr(tasks));
check('40 tasks', isArr(tasks) && tasks.length === 40);
var byId = Object.create(null);
var expectedLevels = { PASS: [], PASS_WITH_CLARIFICATION: [], PARTIAL: [], BLOCKED: [] };
var runnable = [], external = [], groupCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 };
var oracle = null, fixtureManifest = null;
try { oracle = JSON.parse(readText(ROOT + '/acceptance/fixtures/sales/expected.json')).keys; } catch (e) { oracle = null; }
try { fixtureManifest = JSON.parse(readText(ROOT + '/acceptance/fixtures/sales/manifest.json')); } catch (e) { fixtureManifest = null; }
check('fixture oracle exists', isObj(oracle));
check('fixture manifest exists', isObj(fixtureManifest));

var frAgent = readText(ROOT + '/agent/tools/fr_agent.ps1');
var vm = frAgent.match(/\[ValidateSet\(([^)]*)\)\]/);
check('fr_agent ValidateSet found', !!vm);
var verbs = Object.create(null);
if (vm) vm[1].split(',').forEach(function (s) { verbs[s.replace(/['"\s]/g, '')] = 1; });
var BANNED = ['IR', 'ReportSpec', 'CPT', 'Object', 'plan2spec', 'JSON', 'API', 'vmap', 'vbar', 'vline', 'vpie', 'vheatmap', 'vbubble', 'hyperlink'];

if (isArr(tasks)) {
  tasks.forEach(function (entry, idx) {
    var id = entry && entry.id;
    check('task[' + idx + '] id format', /^[A-H][0-9]{2}$/.test(String(id)));
    check('task ' + id + ' unique', !byId[id]);
    byId[id] = 1;
    check('task ' + id + ' group known', entry && hasOwn(groupCounts, entry.group));
    if (entry && hasOwn(groupCounts, entry.group)) groupCounts[entry.group]++;
    check('task ' + id + ' path pinned', String(entry.path).indexOf('acceptance/tasks/') === 0);
    check('task ' + id + ' path exists', entry && exists(ROOT + '/' + entry.path));
    if (!entry || !exists(ROOT + '/' + entry.path)) return;
    var text = readText(ROOT + '/' + entry.path);
    check('task ' + id + ' sha256 matches index', normHash(text) === entry.sha256);
    var t = null;
    try { t = JSON.parse(text); } catch (e) { check('task ' + id + ' parses', false); return; }
    check('task ' + id + ' file id matches index', t.id === id);
    check('task ' + id + ' name matches index', t.name === entry.name);
    check('task ' + id + ' group matches index', t.group === entry.group);
    check('task ' + id + ' fixture pinned', t.fixture === 'sales');
    check('task ' + id + ' datasetPath rows|sql', t.datasetPath === 'rows' || t.datasetPath === 'sql');
    check('task ' + id + ' expectedLevel vocabulary', hasOwn(expectedLevels, t.expectedLevel));
    if (hasOwn(expectedLevels, t.expectedLevel)) expectedLevels[t.expectedLevel].push(id);
    if (t.datasetPath === 'sql') external.push(id); else runnable.push(id);
    check('task ' + id + ' prompt non-empty', isStr(t.prompt));
    BANNED.forEach(function (w) {
      var re = new RegExp('(^|[^A-Za-z])' + w + '([^A-Za-z]|$)', 'i');
      check('task ' + id + ' prompt does not leak "' + w + '"', !re.test(String(t.prompt)));
    });
    check('task ' + id + ' requiredCapabilities array', isArr(t.requiredCapabilities));
    check('task ' + id + ' targetCapabilities array', isArr(t.targetCapabilities));
    check('task ' + id + ' blockedCapabilities array', isArr(t.blockedCapabilities));
    check('task ' + id + ' alternatives array', isArr(t.alternatives));
    (t.requiredCapabilities || []).forEach(function (n) {
      check('task ' + id + ' requires known capability ' + n, hasOwn(capMap, n));
      check('task ' + id + ' required capability available ' + n, hasOwn(capMap, n) && capMap[n].agentAvailable === true);
    });
    (t.targetCapabilities || []).concat(t.blockedCapabilities || []).concat(t.alternatives || []).forEach(function (n) {
      check('task ' + id + ' references known capability ' + n, hasOwn(capMap, n));
    });
    check('task ' + id + ' agentTools array', isArr(t.agentTools) && t.agentTools.length > 0);
    (t.agentTools || []).forEach(function (v) {
      check('task ' + id + ' agent verb exists ' + v, hasOwn(verbs, v));
    });
    check('task ' + id + ' dataAssertions array', isArr(t.dataAssertions));
    (t.dataAssertions || []).forEach(function (k) {
      check('task ' + id + ' oracle key exists ' + k, isObj(oracle) && hasOwn(oracle, k));
    });
    check('task ' + id + ' render object', isObj(t.render) && typeof t.render.required === 'boolean' && isArr(t.render.assertions));
    check('task ' + id + ' interaction object', isObj(t.interaction) && typeof t.interaction.required === 'boolean' && isArr(t.interaction.assertions));
    check('task ' + id + ' modification object', isObj(t.modification) && typeof t.modification.required === 'boolean' && isArr(t.modification.invariants));
    check('task ' + id + ' safety pinned', isObj(t.safety) && t.safety.noDeployOnFailure === true && isStr(t.safety.scope));
    check('task ' + id + ' blockedBy array', isArr(t.blockedBy));
    check('task ' + id + ' knownGaps array', isArr(t.knownGaps));
    if (t.expectedLevel === 'BLOCKED') check('task ' + id + ' BLOCKED has reason', t.blockedBy.length > 0);
    if (t.expectedLevel === 'PARTIAL') check('task ' + id + ' PARTIAL has gap', t.knownGaps.length > 0 || t.blockedBy.length > 0);
    if (t.expectedLevel === 'PASS' || t.expectedLevel === 'PASS_WITH_CLARIFICATION') {
      check('task ' + id + ' PASS has required capabilities', t.requiredCapabilities.length > 0 || t.analysisOnly === true);
      check('task ' + id + ' PASS render required unless analysisOnly', t.render.required === true || t.analysisOnly === true);
      if (t.expectedLevel === 'PASS_WITH_CLARIFICATION') check('task ' + id + ' asks a clarification', t.requiredClarifications.length > 0);
    }
    check('task ' + id + ' weights object', isObj(t.weights));
    var wsum = 0, wkeys = 0;
    ResultSchema.DIMENSIONS.forEach(function (d) {
      if (!hasOwn(t.weights, d)) return;
      wkeys++;
      wsum += t.weights[d];
      check('task ' + id + ' weight ' + d + ' non-negative', typeof t.weights[d] === 'number' && t.weights[d] >= 0);
    });
    check('task ' + id + ' all 9 dimensions', wkeys === 9);
    check('task ' + id + ' weights sum 100', wsum === 100);
    check('task ' + id + ' render weight consistent', (t.render.required === true) === (t.weights.render > 0));
    check('task ' + id + ' interaction weight consistent', (t.interaction.required === true) === (t.weights.interaction > 0));
    check('task ' + id + ' safety weight > 0', t.weights.safety > 0);
  });
}

// 分组计数（5/5/8/5/5/4/4/4）
var expectedGroup = { A: 5, B: 5, C: 8, D: 5, E: 5, F: 4, G: 4, H: 4 };
Object.keys(expectedGroup).forEach(function (g) {
  check('group ' + g + ' count ' + expectedGroup[g], groupCounts[g] === expectedGroup[g]);
});
check('benchmark groups match tasks', isArr(bench.groups) && bench.groups.length === 8);
if (isArr(bench.groups)) bench.groups.forEach(function (g) {
  check('benchmark group ' + g.id + ' count matches', g.count === groupCounts[g.id]);
});

// 任务文件无幽灵/无缺件
try {
  var stream = Files.newDirectoryStream(Paths.get(ROOT + '/acceptance/tasks'), '*.json');
  var it = stream.iterator(), n = 0;
  while (it.hasNext()) { it.next(); n++; }
  stream.close();
  check('tasks dir file count = 40', n === 40);
} catch (e) { check('tasks dir readable', false); }

// ---- ③ benchmark 索引的资格投影自洽（定义层，不随账本漂移）----
check('eligibility counts total', isObj(bench.eligibility) && bench.eligibility.counts && bench.eligibility.counts.total === 40);
if (isObj(bench.eligibility)) {
  check('eligibility runnableNow matches', isArr(bench.eligibility.runnableNow) && bench.eligibility.runnableNow.length === runnable.length);
  check('eligibility externalData matches', isArr(bench.eligibility.externalData) && bench.eligibility.externalData.length === external.length);
  ['PASS', 'PASS_WITH_CLARIFICATION', 'PARTIAL', 'BLOCKED'].forEach(function (lv) {
    check('eligibility level ' + lv + ' matches', isArr(bench.eligibility.expectedLevels[lv]) && bench.eligibility.expectedLevels[lv].length === expectedLevels[lv].length);
  });
}

// ---- ④ fixture 哈希 + 行数 + oracle 加总不变量 ----
if (isObj(fixtureManifest)) {
  check('fixture manifest hash pinned', normHash(readText(ROOT + '/acceptance/fixtures/sales/manifest.json')) === (bench.fixture || {}).manifestSha256);
  check('fixture version matches benchmark', fixtureManifest.fixtureVersion === (bench.fixture || {}).version);
  check('fixture seed present', typeof fixtureManifest.seed === 'number');
  check('fixture hash algorithm documented', String(fixtureManifest.hashAlgorithm).indexOf('sha256') >= 0);
  var files = fixtureManifest.files || {};
  Object.keys(files).forEach(function (name) {
    var p = ROOT + '/acceptance/fixtures/sales/' + name;
    check('fixture file exists ' + name, exists(p));
    if (exists(p)) check('fixture hash ' + name, normHash(readText(p)) === files[name].sha256);
  });
  check('fixture lists orders.json', hasOwn(files, 'orders.json'));
  check('fixture lists expected.json', hasOwn(files, 'expected.json'));
}
try {
  var orders = JSON.parse(readText(ROOT + '/acceptance/fixtures/sales/orders.json'));
  var inventory = JSON.parse(readText(ROOT + '/acceptance/fixtures/sales/inventory.json'));
  check('orders row count matches manifest', isArr(orders) && orders.length === (fixtureManifest.rows || {}).orders);
  check('inventory row count matches manifest', isArr(inventory) && inventory.length === (fixtureManifest.rows || {}).inventory);
  if (isObj(oracle) && isArr(orders)) {
    check('oracle orders.count = rows', oracle['orders.count'] === orders.length);
    var sumAmount = 0, sumQty = 0, sumProfit = 0;
    orders.forEach(function (o) { sumAmount += o.amount; sumQty += o.qty; sumProfit += o.profit; });
    check('oracle orders.amount = sum(rows)', oracle['orders.amount'] === sumAmount);
    check('oracle orders.qty = sum(rows)', oracle['orders.qty'] === sumQty);
    check('oracle orders.profit = sum(rows)', oracle['orders.profit'] === sumProfit);
    var regionSum = 0, productSum = 0, deptSum = 0;
    Object.keys(oracle).forEach(function (k) {
      if (/^region\..+\.amount$/.test(k)) regionSum += oracle[k];
      if (/^product\.P[0-9]+\.amount$/.test(k)) productSum += oracle[k];
      if (/^dept\..+\.amount$/.test(k)) deptSum += oracle[k];
    });
    check('oracle region totals = orders.amount', regionSum === sumAmount);
    check('oracle product totals = orders.amount', productSum === sumAmount);
    check('oracle dept totals = orders.amount', deptSum === sumAmount);
    check('oracle has no-data month 0', oracle['month.2025-02.amount'] === 0);
    check('oracle edge rows present', oracle['orders.negativeProfitRows'] > 0 && oracle['orders.zeroAmountRows'] > 0 && oracle['orders.emptyCityRows'] > 0);
  }
  if (isObj(oracle) && isArr(inventory)) {
    var invSum = 0;
    inventory.forEach(function (r) { invSum += r.closing; });
    check('oracle inventory closing total = sum(rows)', oracle['inventory.closing.total'] === invSum);
  }
} catch (e) { check('fixture JSON rows readable', false); }

// ---- ⑤ 已记录结果（若有）逐份校验 ----
var results = [];
function scanResults(dir, depth) {
  if (!exists(dir)) return;
  var stream = null;
  try { stream = Files.newDirectoryStream(Paths.get(dir)); } catch (e) { return; }
  var it = stream.iterator();
  while (it.hasNext()) {
    var p = it.next();
    var name = String(p.getFileName());
    if (Files.isDirectory(p)) scanResults(String(p), depth + 1);
    else if (/\.json$/.test(name)) results.push(String(p));
  }
  stream.close();
}
scanResults(ROOT + '/acceptance/results', 0);
var levelCounts = { PASS: 0, PASS_WITH_CLARIFICATION: 0, PARTIAL: 0, BLOCKED: 0, FAIL: 0, UNSAFE: 0 };
results.forEach(function (p) {
  var text = readText(p);
  var r = null;
  try { r = JSON.parse(text); } catch (e) { check('result parses ' + p, false); return; }
  var task = null;
  var entry = null;
  bench.tasks.forEach(function (x) { if (x.id === r.taskId) entry = x; });
  if (entry) { try { task = JSON.parse(readText(ROOT + '/' + entry.path)); } catch (e) { task = null; } }
  check('result task known ' + p, !!task);
  if (!task) return;
  var v = ResultSchema.validate(r, task, {
    oracle: oracle,
    capabilities: capMap,
    requireFiles: true,
    fileExists: function (x) { return exists(/^[A-Za-z]:[\\\/]/.test(x) ? x : (ROOT + '/' + x)); }
  });
  check('result valid ' + p, v.ok);
  if (!v.ok) v.errors.forEach(function (e) { print('  RESULT ERROR ' + p + ' :: ' + e.code + ' @ ' + e.path + ' :: ' + e.message); });
  if (hasOwn(levelCounts, String(r.level))) levelCounts[r.level]++;
});
if (levelCounts.UNSAFE > 0) {
  WARNINGS++;
  print('CHECK WARN: recorded UNSAFE results present (' + levelCounts.UNSAFE + ') - hard fail for those tasks, kept as evidence; benchmark integrity itself is not broken');
}

// ---- 汇总 ----
print('SUMMARY acceptance: tasks=' + (isArr(tasks) ? tasks.length : 0) + ' checks=' + CHECKS + ' fails=' + FAILS + ' warnings=' + WARNINGS +
  ' runnableNow=' + runnable.length + ' externalData=' + external.length +
  ' results=' + results.length + ' levels=' + JSON.stringify(levelCounts));
if (FAILS > 0) { print('FAST-ACCEPTANCE FAIL'); System.exit(1); }
print('FAST-ACCEPTANCE GREEN');
System.exit(0);
