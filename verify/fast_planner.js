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

['semantic/planner/capability.js', 'semantic/planner/planner.js', 'semantic/planner/termnorm.js'].forEach(function (f) {
  var ok = true; try { new Function(src(f)); } catch (e) { ok = false; print('PARSE ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});

load(ROOT + '/lib/report_spec.js');       // caps（AGGREGATIONS/AGG_UNIMPLEMENTED/REJECTED）
load(ROOT + '/lib/isodate.js');           // I5.1 spec_validator 的 dateRange 单点（sql intent 校验需）
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
// —— C6（2026-11-06 收口）：deferred/rejected 聚合指标累计阻断——不允许"成功"产出悄悄少指标的报表
//    （此前部分指标可解析时整体仍 ready：被拒指标静默蒸发，报表口径悄悄变窄）
var rC6mix = plan({ outName: 'c6mix', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }, { term: 'avgScore' }], rows: mkRows(1) });
check('C6 部分指标 deferred（聚合指标）→ 不得 ready', rC6mix.status !== 'ready' && rC6mix.reportSpec === null && hasWarn(rC6mix, /I5/));
var rC6agg = plan({ outName: 'c6agg', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }, { term: 'rowNo', aggregation: 'avg' }], rows: mkRows(1) });
check('C6 部分指标 deferred（显式 avg）→ 不得 ready', rC6agg.status !== 'ready' && rC6agg.reportSpec === null && hasWarn(rC6agg, /I3|I5/));
var rC6unk = plan({ outName: 'c6unk', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }, { term: '___幽灵指标___' }], rows: mkRows(1) });
// 阶段2 A段 P1c（2026-11-07）：未知术语同样阻断——旧断言「仅记 warning 仍 ready」钉的是被审查点名的静默丢缺陷
//   （已知+未知混合指标时报表悄悄少指标，与 sql 路成员缺失 memberMissing→rejected 不一致），按修复更新。
check('P1c 未知术语 → 阻断不 ready + 保留模型缺口 warning', hasWarn(rC6unk, /模型缺口/) && rC6unk.status !== 'ready' && rC6unk.reportSpec === null);
var rfil = plan({ outName: 'fl', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), filters: [{ column: 'stage' }] });
check('filters 越权→deferred(I2/I3) 记录', hasWarn(rfil, /I2/));
var rcht = plan({ outName: 'ch', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), chart: { kind: 'vbar', category: 'bizTime', value: 'rowNo' } });
check('chart 直通（2026-11-07 两路支持）→ ready 且 spec 带 chart', rcht.status === 'ready' && rcht.reportSpec.presentation.chart.kind === 'vbar');
var rchtR = plan({ outName: 'chr', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), chart: { kind: 'vradar', category: 'bizTime', value: 'rowNo' } });
check('vradar 直通（2026-11-08 雷达图）→ ready 且 spec 带 vradar', rchtR.status === 'ready' && rchtR.reportSpec.presentation.chart.kind === 'vradar');
var rchtF = plan({ outName: 'chf', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), chart: { kind: 'vfunnel', category: 'bizTime', value: 'rowNo' } });
check('vfunnel 直通（2026-11-08 漏斗图）→ ready 且 spec 带 vfunnel', rchtF.status === 'ready' && rchtF.reportSpec.presentation.chart.kind === 'vfunnel');
var rchtB = plan({ outName: 'chb', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), chart: { kind: 'vbox', category: 'bizTime', value: 'rowNo' } });
check('vbox 直通（2026-11-08 箱线图）→ ready 且 spec 带 vbox', rchtB.status === 'ready' && rchtB.reportSpec.presentation.chart.kind === 'vbox');
['bar3d', 'pie3d', 'area3d', 'donut', 'donut3d'].forEach(function (k) {
  var r = plan({ outName: 'legacy_' + k, dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), chart: { kind: k, category: 'bizTime', value: 'rowNo' } });
  check('legacy ' + k + ' 直通 → ready 且 spec 带 ' + k, r.status === 'ready' && r.reportSpec.presentation.chart.kind === k);
});
// —— C6 同口径扩展（2026-11-07 B段复审）：rows 路 intent.filters/intent.chart 被能力墙丢掉时
//    不得 ready（与 metrics 同理：数据范围/报表结构悄悄变窄比失败更危险）。此前仅 warning 仍 ready。
check('C6 同口径: rows 路 intent.filters 被丢 → 不得 ready', rfil.status !== 'ready' && rfil.reportSpec === null);
check('C6 同口径: rows 路 intent.chart 直通不再被丢', rcht.status === 'ready' && rcht.reportSpec !== null);
check('C6 同口径: filters 阻断时 owner 归属能力墙', hasWarn(rfil, /I2/) && rfil.status === 'rejected');

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
check('I5.1-P2 SQL 幽灵维度：非 ready + warning + 不入 spec', sqlGhost.status !== 'ready' && hasWarn(sqlGhost, /模型缺口/) && (!sqlGhost.reportSpec || sqlGhost.reportSpec.dataset.dimensions.indexOf('___幽灵维___') < 0));
var sqlGhostM = plan({ outName: 'g2', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['幽灵指标'] } });
check('I5.1-P2 SQL 幽灵指标：非 ready（语义未决不塞生成链）', sqlGhostM.status !== 'ready' && hasWarn(sqlGhostM, /模型缺口/));
check('SQL 意图不改输入（纯）', (function () { var s = JSON.stringify(sqlIntent); plan(sqlIntent); return JSON.stringify(sqlIntent) === s; })());

// —— I1.1（r4 P2）：sql 路已支持的意图片段直通，不再"报了暂不支持却 ready"或静默丢
var sqlRich = plan({
  outName: 'rich', dataset: {
    kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord',
    dimensions: ['bizDate'], metrics: ['planned'], dateRange: { from: '2026-09-13', to: '2026-09-22' },
    filters: [{ field: 'machine_id', op: '==', value: 'M1' }], sort: [{ field: 'bizDate', dir: 'desc' }], topN: { n: 5 }
  },
  presentation: { chart: { kind: 'bar', category: 'bizDate', value: 'planned' } }
});
check('I1.1 sql 路 filters/sort/topN 直通 dataset', sqlRich.status === 'ready' && (function () {
  var d = sqlRich.reportSpec && sqlRich.reportSpec.dataset;
  return d && d.filters && d.filters.length === 1 && d.sort && d.sort.length === 1 && d.topN && d.topN.n === 5;
})());
check('I1.1 sql 路 presentation.chart 直通（不被静默丢弃）', sqlRich.status === 'ready' && sqlRich.reportSpec.presentation.chart.kind === 'bar' && sqlRich.reportSpec.presentation.chart.value === 'planned');
check('I1.1 sql 路透传产物过 I1 校验 0 err', sqlRich.reportSpec && SpecValidator.validate(sqlRich.reportSpec).length === 0);
var sqlTopChart = plan({ outName: 'tc', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'] }, chart: { kind: 'line', category: 'bizDate', value: 'planned' } });
check('I1.1 sql 路顶层 chart 也转 presentation.chart（rows 路才 deferred）', sqlTopChart.status === 'ready' && sqlTopChart.reportSpec.presentation.chart.kind === 'line');
var sqlTopFilters = plan({ outName: 'tf', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'] }, filters: [{ field: 'stage', value: 'X' }] });
check('I1.1 顶层 filters(数组) 转入 dataset.filters', sqlTopFilters.status === 'ready' && sqlTopFilters.reportSpec.dataset.filters.length === 1);
check('I1.1 sql 路非法 presentation 键→rejected（不再静默放过）', plan({ outName: 'bp', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'] }, presentation: { foo: 1 } }).status === 'rejected');

// —— 2026-11-06（B2/B4/C2 收尾）：params/sheet 从意图到 reportSpec 必须透传（此前 planner 只带 presentation）
var rParams = plan({ outName: 'pp', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), params: [{ kind: 'date', name: 'd', value: '2026-01-01' }] });
check('params 透传到 rows reportSpec 且 ready', rParams.status === 'ready' && rParams.reportSpec.params && rParams.reportSpec.params[0].kind === 'date');
var rSheet = plan({ outName: 'ps', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), sheet: { hideRows: [1] } });
check('sheet.hideRows 透传到 rows reportSpec 且 ready', rSheet.status === 'ready' && rSheet.reportSpec.sheet && rSheet.reportSpec.sheet.hideRows[0] === 1);
check('非法 params→rejected（透传后由 SpecValidator 拒）', plan({ outName: 'pi', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), params: [{ kind: 'magic', name: 'x' }] }).status === 'rejected');
check('非法 sheet 键→rejected（透传后由 SpecValidator 拒）', plan({ outName: 'si', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), sheet: { magic: 1 } }).status === 'rejected');
var sqlParams = plan({ outName: 'sp', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned'] }, params: [{ kind: 'combo', name: 'line', values: ['A', 'B'] }] });
check('params 透传到 sql reportSpec 且 ready', sqlParams.status === 'ready' && sqlParams.reportSpec.params && sqlParams.reportSpec.params[0].kind === 'combo');
var rExtra = plan({ outName: 'px', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), extraSheets: [{ name: '明细', dimensions: [{ field: 'bizTime', label: '日期', widthPt: 120 }], metrics: [{ field: 'n', label: '数', aggregation: 'sum', dataType: 'number', widthPt: 100 }], dataset: { rows: [['2026-01-01', 1]] }, presentation: { showTotal: false } }] });
check('extraSheets 透传到 rows reportSpec 且 ready', rExtra.status === 'ready' && rExtra.reportSpec.extraSheets && rExtra.reportSpec.extraSheets[0].name === '明细');
check('非法 extraSheets（重名 sheet1）→rejected', plan({ outName: 'py', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: mkRows(1), extraSheets: [{ name: 'sheet1', dimensions: [{ field: 'bizTime', label: '日期', widthPt: 120 }], metrics: [{ field: 'n', label: '数', aggregation: 'sum', dataType: 'number', widthPt: 100 }], dataset: { rows: [['2026-01-01', 1]] } }] }).status === 'rejected');

// ===== r14 P2: TermNorm 术语归一（候选契约 target/ref/column；中文 label→规范成员；歧义/非成员透传不臆造） =====
load(ROOT + '/semantic/planner/termnorm.js');
var resolveFn = function (t) { return ModelResolver.resolve(idx, String(t)); };
check('TermNorm canonicalMember metric→ref', TermNorm.canonicalMember({ target: 'metric', ref: 'planned' }) === 'planned');
check('TermNorm canonicalMember dimension→ref', TermNorm.canonicalMember({ target: 'dimension', ref: 'bizDate' }) === 'bizDate');
check('TermNorm canonicalMember property→null（不是 planner 成员名）', TermNorm.canonicalMember({ target: 'property', ref: 'InspectionRecord.bizDate', column: 'laser_aaa.biz_date' }) === null);
// 受控 resolveFn 单测映射逻辑（真实模型维度 label 全歧义，见下条透传断言）
var fakeResolve = function (t) {
  if (t === '业务日期') return { status: 'resolved', candidates: [{ target: 'dimension', ref: 'bizDate', confidence: 'high' }] };
  if (t === '幽灵') return { status: 'ambiguous', candidates: [{ target: 'property', ref: 'X' }, { target: 'dimension', ref: 'Y' }] };
  return { status: 'unknown', candidates: [] };
};
check('TermNorm 受控: 维度 label→规范维度名', JSON.stringify(TermNorm.normalizeList(['业务日期'], fakeResolve)) === JSON.stringify(['bizDate']));
check('TermNorm 受控: 对象形式 {term} 归一保留对象', JSON.stringify(TermNorm.normalizeList([{ term: '业务日期' }], fakeResolve)) === JSON.stringify([{ term: 'bizDate' }]));
check('TermNorm 受控: ambiguous 原样透传（不自动选）', JSON.stringify(TermNorm.normalizeList(['幽灵'], fakeResolve)) === JSON.stringify(['幽灵']));
check('TermNorm 受控: unknown 原样透传（不臆造）', JSON.stringify(TermNorm.normalizeList(['不存在'], fakeResolve)) === JSON.stringify(['不存在']));
// 真实模型：指标 label 唯一可解析→规范指标名；维度 label 全歧义→原样透传（诚实反映模型现状，非 bug）
check('TermNorm 真实: 指标中文 label→规范指标名', JSON.stringify(TermNorm.normalizeList(['计划数'], resolveFn)) === JSON.stringify(['planned']));
check('TermNorm 真实: 歧义维度 label 原样透传', JSON.stringify(TermNorm.normalizeList(['业务日期'], resolveFn)) === JSON.stringify(['业务日期']));
// 端到端：维度用名（透传即规范名）+ 指标用中文 label（归一→planned/done）→ planner ready
var cnIntent = { outName: 'cn', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: TermNorm.normalizeList(['bizDate'], resolveFn), metrics: TermNorm.normalizeList(['计划数', '完成数'], resolveFn), dateRange: { from: '2026-09-13', to: '2026-09-13' } } };
var cnPlan = plan(cnIntent);
check('r14 中文指标 label 端到端→ready（归一后成员校验通过）', cnPlan.status === 'ready' && cnPlan.reportSpec.dataset.metrics.indexOf('planned') >= 0 && cnPlan.reportSpec.dataset.metrics.indexOf('done') >= 0);

// ===== B1（night-shift）：sql 分支的 ambiguous 术语必须反问，不得混入"成员缺失"硬拒 =====
// 「机台」双指（machine 维度 + Machine.machineId property）——胶水原样透传原文后，planner 需按 ctx.resolve
//   区分 ambiguous（→ unresolvedQuestions 反问，status=ambiguous）与纯 unknown（→ rejected 不编造）。
function planSql(dims, mets) {
  return plan({ outName: 'b1', dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord', dimensions: dims, metrics: mets, dateRange: { from: '2026-09-13', to: '2026-09-22' } } });
}
var b1Amb = planSql(['bizDate', '机台'], ['planned']);
check('B1: sql 维度 ambiguous（机台）→ status=ambiguous（反问，非 rejected）', b1Amb.status === 'ambiguous');
check('B1: unresolvedQuestions 含 机台 且 requiresConfirmation=true', b1Amb.status === 'ambiguous' && (b1Amb.unresolvedQuestions || []).some(function (q) { return q.requiresConfirmation === true && JSON.stringify(q).indexOf('机台') >= 0; }));
check('B1: ambiguous 时不得给出 reportSpec', b1Amb.status === 'ambiguous' && b1Amb.reportSpec === null);
var b1Unknown = planSql(['bizDate', '销售员'], ['planned']);
check('B1: sql 维度纯 unknown（销售员）→ 保持 rejected（不编造）', b1Unknown.status === 'rejected' && (b1Unknown.reportSpec === null));
var b1Mix = planSql(['bizDate', '机台'], ['planned', '幽灵指标']);
check('B1: 混合（ambiguous+unknown）→ 优先反问（ambiguous）', b1Mix.status === 'ambiguous');
var b1Clean = planSql(['bizDate', 'machine'], ['planned', 'done', 'completionRate']);
check('B1: 全部规范成员 → ready 不回归', b1Clean.status === 'ready' && b1Clean.reportSpec.dataset.dimensions.indexOf('machine') >= 0);

// ===== 2026-11-08 层间一致性：rows 路 chart 坐标引用归一（业务术语 -> 物理列）=====
//   此前 dims/metrics 已 mapTerm 成物理列，但 chart.category/value 原样透传：plan 报 ready，
//   create 期 Ir.validate 却 UNKNOWN_REF。这里钉住"术语归一 + 物理列原样 + 未知不臆造 + 不改调用方"。
function planRows(chart) {
  return plan({ outName: 'rp', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: [['2026-01-01', 1]], presentation: { showTotal: false, chart: chart } });
}
var rpTerm = planRows({ kind: 'vbar', category: 'bizTime', value: 'rowNo' });
check('rows chart 术语引用 -> 归一为物理列', rpTerm.status === 'ready' && rpTerm.reportSpec.presentation.chart.category === 'biz_time' && rpTerm.reportSpec.presentation.chart.value === 'row_number');
var rpField = planRows({ kind: 'vbar', category: 'biz_time', value: 'row_number' });
check('rows chart 物理列引用原样保留', rpField.status === 'ready' && rpField.reportSpec.presentation.chart.category === 'biz_time' && rpField.reportSpec.presentation.chart.value === 'row_number');
var rpGhost = planRows({ kind: 'vbar', category: 'ghost', value: 'rowNo' });
check('rows chart 未知引用不臆造', rpGhost.status === 'ready' && rpGhost.reportSpec.presentation.chart.category === 'ghost' && rpGhost.reportSpec.presentation.chart.value === 'row_number');
var rpIntent = { outName: 'rp2', dimensions: ['bizTime'], metrics: [{ term: 'rowNo' }], rows: [['2026-01-01', 1]], presentation: { showTotal: false, chart: { kind: 'vbar', category: 'bizTime', value: 'rowNo' } } };
plan(rpIntent);
check('rows chart 归一不修改调用方 intent', rpIntent.presentation.chart.category === 'bizTime' && rpIntent.presentation.chart.value === 'rowNo');

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
