// verify/fast_planner.js — I4 确定性 planner 离线契约测（零引擎、零连库、零 LLM）
//   用真 I3 模型 + 真 I1 SpecValidator 作注入 ctx，跑 20+ 需求矩阵覆盖 r2 §4 四分支。
//   术语唯一/歧义分类经 logs 探针实测（非猜）：唯一属性=bizTime/rowNo/collectionDate/collectedAt；
//   歧义=score/fileKey/machineId/stage/records/path/bizDate；metric 名=avgScore/completionRate/planned/done。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + f)), 'UTF-8')); }
function jt(f) { return JSON.parse(src(f)); }
function threw(fn) { try { fn(); return false; } catch (e) { return true; } }

['semantic/planner/capability.js', 'semantic/planner/planner.js'].forEach(function (f) {
  var ok = true; try { new Function(src(f)); } catch (e) { ok = false; print('PARSE ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});

load(ROOT + '/lib/report_spec.js');       // caps（AGGREGATIONS/AGG_UNIMPLEMENTED/REJECTED）
load(ROOT + '/lib/spec_validator.js');    // I1 权威校验（注入 planner）
load(ROOT + '/semantic/model/vocab.js');
load(ROOT + '/semantic/model/registry.js');
load(ROOT + '/semantic/model/resolver.js');
load(ROOT + '/semantic/planner/capability.js');
load(ROOT + '/semantic/planner/planner.js');

var model = jt('models/production/model.json');
var idx = ModelRegistry.index(model);
var ctx = {
  resolve: function (t) { return ModelResolver.resolve(idx, t); },
  validateSpec: function (s) { return SpecValidator.validate(s); },
  capability: PlannerCapability,
  caps: ReportSpec,
  model: model
};
function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

// ===== capability.js 单元 =====
check('cap 聚合 sum→supported', PlannerCapability.aggregation('sum', ReportSpec).verdict === 'supported');
check('cap 聚合 avg→deferred 带 owner', (function () { var c = PlannerCapability.aggregation('avg', ReportSpec); return c.verdict === 'deferred' && !!c.owner; })());
check('cap 聚合 garbage→rejected', PlannerCapability.aggregation('garbage', ReportSpec).verdict === 'rejected');
check('cap filters→deferred owner I2/I3', (function () { var c = PlannerCapability.intentFeature('filters', ReportSpec); return c.verdict === 'deferred' && c.owner.indexOf('I2') >= 0; })());
check('cap metric 聚合指标→deferred（不降级成 sum）', PlannerCapability.metricTargetIsAggregate('metric', ReportSpec).verdict === 'deferred');

// ===== 20+ 需求矩阵 =====
function plan(intent) { return ReportPlanner.plan(intent, ctx); }
function hasWarn(res, ownerRe) { return res.validationWarnings.some(function (w) { return ownerRe.test(String(w.owner)); }); }
function mkRows(dimN) { var r = []; for (var i = 0; i < dimN; i++) r.push('c' + i); r.push(1); return [r]; }   // 末列=度量取数值（dims+1 列）

// —— 明确 → ready（真模型唯一解析 + 真 I1 校验 0 err）
var CLEAR = [['bizTime'], ['collectionDate'], ['collectedAt'], ['bizTime', 'collectionDate'], ['rowNo'], ['collectedAt', 'bizTime']];
var readyN = 0;
CLEAR.forEach(function (cs) {
  var r = plan({ outName: 'r', dimensions: cs, metrics: [{ term: 'rowNo' }], rows: mkRows(cs.length) });
  var specValid = r.status === 'ready' && r.reportSpec && SpecValidator.validate(r.reportSpec).length === 0;
  if (specValid) readyN++;
  check('明确需求[' + cs.join('+') + ']→ready 且 reportSpec 过 I1 校验 0 err', specValid);
});
check('ready 用例合计≥6', readyN >= 6);
var rnoTotal = plan({ outName: 'nt', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), presentation: { showTotal: false } });
check('showTotal=false 被尊重（非硬塞合计）', rnoTotal.status === 'ready' && rnoTotal.reportSpec.presentation.showTotal === false);
check('明确需求：无未决追问但有自决假设（不问版式）', rnoTotal.unresolvedQuestions.length === 0 && rnoTotal.assumptions.length >= 1);
var phr = plan({ outName: 'ph', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1) });
check('可解析物理列 field 落真列名 biz_time', phr.reportSpec && phr.reportSpec.dimensions[0].field === 'biz_time');

// —— 模糊 → unresolvedQuestions（不自动选、不编造）
['score', 'fileKey', 'machineId', 'stage', 'records'].forEach(function (t) {
  var r = plan({ outName: 'amb', dimensions: [t], metrics: [{ term: 'rowNo' }], rows: mkRows(1) });
  check('模糊术语[' + t + ']→unresolvedQuestion+requiresConfirmation 不自动选',
    r.status === 'ambiguous' && r.unresolvedQuestions.some(function (q) { return q.term === t && q.requiresConfirmation === true && q.candidates.length >= 2; }) && r.reportSpec === null);
});
var ram = plan({ outName: 'am', dimensions: ['bizTime'], metrics: [{ term: 'machineId' }], rows: mkRows(1) });
check('度量模糊也不自动选', ram.status === 'ambiguous' && ram.unresolvedQuestions.length >= 1);

// —— 越权 → deferred + owner，不降级、不入 spec
['avgScore', 'completionRate', 'planned'].forEach(function (mt) {
  var r = plan({ outName: 'agg', dimensions: ['bizTime'], metrics: [{ term: mt }], rows: mkRows(1) });
  check('I3 聚合指标[' + mt + ']→deferred(I5)，不入 spec', r.status === 'rejected' && hasWarn(r, /I5/) && (r.reportSpec === null || !r.reportSpec.metrics.some(function (m) { return m.label === mt; })));
});
var ravg = plan({ outName: 'avg2', dimensions: ['bizTime'], metrics: [{ term: 'rowNo', aggregation: 'avg' }], rows: mkRows(1) });
check('显式 avg 聚合→deferred(I3/I5) 不降级', ravg.status === 'rejected' && hasWarn(ravg, /I3|I5/));
var rfil = plan({ outName: 'fl', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), filters: [{ column: 'stage' }] });
check('filters 越权→deferred(I2/I3) 记录', hasWarn(rfil, /I2/));
var rcht = plan({ outName: 'ch', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), chart: { kind: 'bar' } });
check('chart 越权→deferred 记录', hasWarn(rcht, /I4|I5/));

// —— 未知 → 不编造字段
var runk = plan({ outName: 'uk', dimensions: ['___幽灵维度___'], metrics: [{ term: '___幽灵指标___' }], rows: [] });
check('未知术语→validationWarning(模型缺口)，不编造', (function () {
  var wOk = hasWarn(runk, /模型缺口/);
  var noFabricate = !runk.reportSpec || (runk.reportSpec.dimensions.concat(runk.reportSpec.metrics).every(function (c) { return String(c.field).indexOf('幽灵') < 0; }));
  return wOk && noFabricate;
})());
var rmix = plan({ outName: 'mix', dimensions: ['bizTime', '___不存在___'], metrics: [{ term: 'rowNo' }], rows: mkRows(1) });
check('混合：可解析入 spec、未知仅记 warning（不整体拒可解析部分）', hasWarn(rmix, /模型缺口/) && rmix.reportSpec && rmix.reportSpec.dimensions.length === 1 && rmix.reportSpec.dimensions[0].field === 'biz_time');

// —— 纯函数/确定序/输入不可变/自吐 spec 合法
var intent = { outName: 'pure', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1) };
var snap = JSON.stringify(intent);
check('planner 确定序（两次全等）', JSON.stringify(plan(intent)) === JSON.stringify(plan(intent)));
check('planner 不改输入意图', JSON.stringify(intent) === snap);
check('planner 抗炸：垃圾意图不抛', threw(function () { ReportPlanner.plan(null, ctx); ReportPlanner.plan(42, ctx); }) === false);
check('planner 自吐的 ready spec 必过 I1（无非法外泄）', (function () {
  var rr = plan({ outName: 'q', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1) });
  return rr.reportSpec && SpecValidator.validate(rr.reportSpec).length === 0;
})());

// —— I5：SQL 意图 opt-in（内嵌矩阵不受影响；模型成员校验不编造）
var sqlIntent = { outName: 'daily', reportName: '生产日报', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned', 'done', 'completionRate'], dateRange: { from: '2026-09-13', to: '2026-09-22' } } };
var sqlPlan = plan(sqlIntent);
check('SQL 意图→ready 且 reportSpec.dataset.kind=sql', sqlPlan.status === 'ready' && sqlPlan.reportSpec && sqlPlan.reportSpec.dataset.kind === 'sql' && sqlPlan.reportSpec.dataset.connection === 'ATOM_LIVE');
check('SQL reportSpec 过 I1 SpecValidator 0 err', sqlPlan.reportSpec && SpecValidator.validate(sqlPlan.reportSpec).length === 0);
check('SQL 意图 metrics 引用模型指标（含 ratio 不再 deferred）', sqlPlan.reportSpec.dataset.metrics.indexOf('completionRate') >= 0 && !hasWarn(sqlPlan, /deferred|I5/));
var sqlGhost = plan({ outName: 'g', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: ['___幽灵维___'], metrics: ['planned'] } });
check('SQL 意图幽灵维度→warning 模型缺口，不编造', hasWarn(sqlGhost, /模型缺口/));
check('SQL 意图不改输入（纯）', (function () { var s = JSON.stringify(sqlIntent); plan(sqlIntent); return JSON.stringify(sqlIntent) === s; })());

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
