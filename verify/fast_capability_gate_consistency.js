// verify/fast_capability_gate_consistency.js — 能力账本与执行闸门机器级一致性门（无引擎）
//   动机（外部复核 2026-11-08）：discover/agentAvailableNames 是能力说明，PlannerCapability/SpecValidator
//   是执行闸门，两套口径无机器级一致性保证。本门把"可承诺的能力"与"闸门允许/拒绝"钉在同一处真相上：
//   ① manifest totals 与逐段计数一致；② unavailable 分类互斥且覆盖全部未承诺项；
//   ③ 已承诺能力不得有 rejected 层；④ PlannerCapability 词表与 ReportSpec.capabilities 的 chart/聚合
//     口径一致（chart 放开、filters/multiSheet 仍墙、sum 之外仍 deferred）——防止账本广告与闸门漂移。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
function src(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + p)), 'UTF-8')); }
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
(function () {
  var gLoad = (typeof load === 'function') ? load : null;
  if (!gLoad) { check('load available', false); return; }
  gLoad(ROOT + '/lib/report_spec.js');
  gLoad(ROOT + '/lib/isodate.js');
  gLoad(ROOT + '/lib/spec_validator.js');
  gLoad(ROOT + '/lib/spec_compiler.js');
  gLoad(ROOT + '/semantic/planner/capability.js');
  gLoad(ROOT + '/application/capability_manifest.js');

  var mf = CapabilityManifest.build();
  var segs = ['chart', 'condition', 'write', 'page', 'product'];
  var total = 0, aa = 0;
  segs.forEach(function (s) { (mf[s] || []).forEach(function (c) { total++; if (c.agentAvailable) aa++; }); });
  check('manifest totals 与逐段计数一致（93/67/26）', mf.totals.registered === total && mf.totals.agentAvailable === aa && mf.totals.unavailable === total - aa && total === 93 && aa === 67);
  check('unavailable 覆盖全部未承诺项且分类互斥', mf.unavailable.length === total - aa && mf.unavailable.every(function (x) {
    return ['webInteraction', 'unverifiedRendering', 'notImplemented', 'rejected', 'e5Evidence'].indexOf(x.reason) >= 0;
  }));
  var rejectedOpen = [];
  segs.forEach(function (s) { (mf[s] || []).forEach(function (c) {
    if (c.agentAvailable && (c.construction === 'rejected' || c.serialization === 'rejected' || c.rendering === 'rejected' || c.regression === 'rejected')) rejectedOpen.push(c.name);
  }); });
  check('无 rejected 能力被标 agentAvailable', rejectedOpen.length === 0);
  check('agentAvailableNames 与逐段名单一致', CapabilityManifest.agentAvailableNames().length === aa);
  var eg = mf.evidenceGrade;
  check('evidenceGrade 口径显式：fullE2e ⊆ agentAvailable', eg && Array.isArray(eg.fullE2e) && eg.fullE2e.every(function (n) {
    return CapabilityManifest.agentAvailableNames().indexOf(n) >= 0;
  }) && String(eg.note).indexOf('不等于') >= 0);

  // 闸门一致性：chart 已放开 / filters 与 multiSheet 仍 deferred / 非 sum 聚合仍非 supported
  var caps = ReportSpec.capabilities();
  var pc = PlannerCapability;
  check('Planner chart 已 supported（与 ReportSpec 两路出图一致）', pc.intentFeature('chart', caps).verdict === 'supported');
  check('Planner filters 仍 deferred', pc.intentFeature('filters', caps).verdict === 'deferred');
  check('Planner multiSheet 仍 deferred（extraSheets 走透传非顶层键）', pc.intentFeature('multiSheet', caps).verdict === 'deferred');
  check('Planner 非 sum 聚合仍 deferred/rejected（与 sum-only 口径一致）', pc.aggregation('avg', caps).verdict !== 'supported');
  // ReportSpec 侧必须确实能表达这些底层能力（否则"广告"没有承载）
  check('ReportSpec rows.chart 已登记', caps.datasets.rows.chart && typeof caps.datasets.rows.chart === 'object');
  check('ReportSpec sql.chart 含 vmap/vheatmap/vradar/vfunnel/vmultipie/vwordcloud', (function () {
    var a = caps.datasets.sql.chart.supported || []; return a.indexOf('vmap') >= 0 && a.indexOf('vheatmap') >= 0 && a.indexOf('vradar') >= 0 && a.indexOf('vfunnel') >= 0 && a.indexOf('vmultipie') >= 0 && a.indexOf('vwordcloud') >= 0;
  })());
})();
print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS ? 1 : 0);
