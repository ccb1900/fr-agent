// verify/fast_report_spec.js — I1（r2.md）ReportSpec 三件套离线契约测
//   红→绿标尺：① 编译深度等价=字节铁证的离线前证（SpecCompiler.compile(json) 与
//     Ir.compile(sales_demo.js 的 SPEC) JSON.stringify 全等——比 build() 具名键消费更严，过了字节必过）；
//   ② compile 输入不可变+幂等（ir.js #50 同纪律）；③ 校验负项全集（结构化 {code,path,message}，
//     对任意坏输入只产诊断不抛）；④ v1 词汇边界：sum 放行、未实现聚合/筛选/非 table 明确拒。
//   跑法同 fast 层：纯 nashorn.jar，不碰 FR/FineDB/产物字节。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
var JPaths = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(JPaths.get(ROOT + '/' + p)), 'UTF-8')); }

// ① parse 门（ES5 可编译面——新 lib 不许混入 let/=>/模板串）
['lib/report_spec.js', 'lib/spec_validator.js', 'lib/spec_compiler.js', 'make_api.js'].forEach(function (f) {
  var ok = true;
  try { new Function(src(f)); } catch (e) { ok = false; print('PARSE: ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});
// ② 靶 JSON 必须是合法 JSON（机器入口的输入面）
var rspecText = src('examples/report-spec/sales_demo.json');
var rspec = null;
try { rspec = JSON.parse(rspecText); check('sales_demo.json 合法 JSON', true); } catch (e) { check('sales_demo.json 合法 JSON: ' + e, false); }

load(ROOT + '/lib/ir.js');
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/lib/isodate.js');
load(ROOT + '/lib/spec_validator.js');
load(ROOT + '/lib/spec_compiler.js');

function etext(e) { return (e && typeof e === 'object') ? [e.code, e.path, e.message].join(' ') : String(e); }
function errsOf(rs) { try { return SpecValidator.validate(rs); } catch (e) { FAILS++; print('SPEC VALIDATOR THREW: ' + e); return []; } }
function codeAt(rs, code, path) { return errsOf(rs).some(function (e) { return e && e.code === code && e.path === path; }); }
function hasE(rs, frag) { return errsOf(rs).some(function (e) { return etext(e).indexOf(frag) >= 0; }); }

// ===== ③ 深度等价（I1 验收硬条件"同等功能报表"的离线前证） =====
load(ROOT + '/reports/sales_demo.js');   // 设全局 SPEC（纯字面量依赖）
var targetIR = Ir.compile(SPEC);
var compiled = null;
try { compiled = SpecCompiler.compile(rspec); } catch (e) { check('COMPILE 不抛: ' + e, false); }
check('ReportSpec 编译产物 ≡ Ir.compile(sales_demo)（JSON 全等）',
  compiled != null && JSON.stringify(compiled) === JSON.stringify(targetIR));
check('编译产物过 Ir.validate 零误报', (function () {
  if (compiled == null) return false;
  var e = Ir.validate(compiled);
  if (e.length) print('IR ERRS: ' + JSON.stringify(e).slice(0, 300));
  return e.length === 0;
})());

// ===== ④ compile 纯度（输入不可变 + 幂等，ir.js #50 同纪律） =====
var snapshot = JSON.stringify(rspec);
var c2 = SpecCompiler.compile(rspec);
check('compile 不改输入 ReportSpec', JSON.stringify(rspec) === snapshot);
check('compile 幂等（两次产物一致）', JSON.stringify(c2) === JSON.stringify(compiled));

// ===== ⑤ validator 负项全集（结构化错误 + 拒坏不抛 + v1 边界） =====
function mut(f) { var r = JSON.parse(rspecText); f(r); return r; }
check('shape 契约全项 {code,path,message}', (function () {
  return errsOf(mut(function (r) { r.dimensions = 'x'; r.metrics = [{}]; r.presentation = []; })).every(function (e) {
    return e && typeof e.code === 'string' && typeof e.path === 'string' && typeof e.message === 'string';
  });
})());
// 抗炸门：残缺/恶意输入一律产诊断，validator 自身绝不抛
[null, undefined, 42, 'str', [], {},
  { specVersion: '1' }, { specVersion: '1', dimensions: 'x', metrics: 'y', dataset: 'z' },
  { specVersion: '1', outName: 7, dimensions: [null, 'x'], metrics: [null], dataset: { rows: 'x' } },
  { specVersion: '1', outName: 'ok', dimensions: [{ field: 'd' }], metrics: [{ field: 'm', aggregation: 'sum' }], dataset: { rows: [[1]] } }
].forEach(function (bad, i) {
  var before = FAILS;
  var es = errsOf(bad);
  check('SPEC NO-THROW#' + i + ' -> ' + JSON.stringify(es).slice(0, 90), FAILS === before && Array.isArray(es));
});
// 版本契约
check('specVersion 缺省视为当前版（不误报）', !hasE(mut(function (r) { delete r.specVersion; }), 'UNSUPPORTED_SPEC_VERSION'));
check('specVersion 未知被拒', codeAt(mut(function (r) { r.specVersion = '99'; }), 'UNSUPPORTED_SPEC_VERSION', 'specVersion'));
// outName 路径安全（"不允许 Agent 指定任意输出位置"落点）
check('INVALID_PATH outName 含 /', codeAt(mut(function (r) { r.outName = 'a/b'; }), 'INVALID_PATH', 'outName'));
check('INVALID_PATH outName 含 ..', codeAt(mut(function (r) { r.outName = '..\\win'; }), 'INVALID_PATH', 'outName'));
check('REQUIRED outName 缺失', codeAt(mut(function (r) { delete r.outName; }), 'REQUIRED', 'outName'));
// 结构闸
check('INVALID_ARRAY dimensions', codeAt(mut(function (r) { r.dimensions = {}; }), 'INVALID_ARRAY', 'dimensions'));
check('INVALID_TYPE metrics 项拒数组', codeAt(mut(function (r) { r.metrics = [[]]; }), 'INVALID_TYPE', 'metrics[0]'));
check('REQUIRED dimension.label', codeAt(mut(function (r) { r.dimensions = [{ field: 'x' }]; }), 'REQUIRED', 'dimensions[0].label'));
check('REQUIRED dimension.field', codeAt(mut(function (r) { r.dimensions = [{ label: 'x' }]; }), 'REQUIRED', 'dimensions[0].field'));
check('dimension 不许带 aggregation（分组键非度量）', codeAt(mut(function (r) { r.dimensions = [{ field: 'x', label: 'x', aggregation: 'sum' }]; }), 'INVALID_ENUM', 'dimensions[0].aggregation'));
check('metric 必须 aggregation', codeAt(mut(function (r) { r.metrics = [{ field: 'm', label: 'M' }]; }), 'REQUIRED', 'metrics[0].aggregation'));
// 聚合词汇（sum-only）
check('INVALID_ENUM 未知聚合 garbage', codeAt(mut(function (r) { r.metrics[0].aggregation = 'garbage'; }), 'INVALID_ENUM', 'metrics[0].aggregation'));
check('UNSUPPORTED_CAPABILITY 未实现聚合 avg', hasE(mut(function (r) { r.metrics[0].aggregation = 'avg'; }), 'UNSUPPORTED_CAPABILITY'));
check('sum 聚合零误报', errsOf(mut(function (r) { r.metrics[0].aggregation = 'sum'; })).length === 0 || !hasE(mut(function (r) { r.metrics[0].aggregation = 'sum'; }), 'aggregation'));
// 数据集对齐闸
check('INVALID_SHAPE 行宽≠列数', codeAt(mut(function (r) { r.dataset.rows = [['a', 'b', 'c']]; }), 'INVALID_SHAPE', 'dataset.rows[0]'));
check('REQUIRED dataset.rows', codeAt(mut(function (r) { delete r.dataset.rows; }), 'REQUIRED', 'dataset.rows'));
// v1 能力边界（存在即拒，指向应接管的迭代）
check('UNSUPPORTED_CAPABILITY filters', hasE(mut(function (r) { r.filters = []; }), 'filters'));
check('UNSUPPORTED_CAPABILITY chart', hasE(mut(function (r) { r.chart = {}; }), 'chart'));
check('UNSUPPORTED_CAPABILITY query.type=semantic', codeAt(mut(function (r) { r.dataset.query = { type: 'semantic' }; }), 'UNSUPPORTED_CAPABILITY', 'dataset'));
check('presentation.type 非 table 拒', codeAt(mut(function (r) { r.presentation.type = 'chart'; }), 'INVALID_ENUM', 'presentation.type'));
// 数值有限闸 + 对象拒数组
check('INVALID_NUMBER widthPt NaN', codeAt(mut(function (r) { r.dimensions[0].widthPt = NaN; }), 'INVALID_NUMBER', 'dimensions[0].widthPt'));
check('INVALID_TYPE presentation=[]', codeAt(mut(function (r) { r.presentation = []; }), 'INVALID_TYPE', 'presentation'));
check('合法靶 spec 零误报', errsOf(rspec).length === 0);
// 幂等第二形态：同文本二次 parse → 同诊断
check('validate 确定序（同输入两次全等）', JSON.stringify(errsOf(mut(function (r) { r.metrics[0].aggregation = 'avg'; }))) === JSON.stringify(errsOf(mut(function (r) { r.metrics[0].aggregation = 'avg'; }))));

// ===== ⑥ I1.1（r4 P2）：sql 分支不再提前 return 跳过 presentation 校验；rows 路 chart 明确拒 =====
var sqlText = src('examples/report-spec/daily_report.sql.json');
var sqlSpec = JSON.parse(sqlText);
function mutSql(f) { var r = JSON.parse(sqlText); f(r); return r; }
check('sql 靶 spec 零误报', errsOf(sqlSpec).length === 0 || (print('SQL ERRS: ' + JSON.stringify(errsOf(sqlSpec)).slice(0, 300)), false));
check('I1.1 sql 路 showTotal 非布尔→INVALID_TYPE（旧版提前 return 放过）', codeAt(mutSql(function (r) { r.presentation.showTotal = 'yes'; }), 'INVALID_TYPE', 'presentation.showTotal'));
check('I1.1 sql 路 heightsPt.row 非数→INVALID_NUMBER', codeAt(mutSql(function (r) { r.presentation.heightsPt = { row: 'big' }; }), 'INVALID_NUMBER', 'presentation.heightsPt.row'));
check('I1.1 sql 路 presentation.type 越词表→INVALID_ENUM', codeAt(mutSql(function (r) { r.presentation.type = 'chart'; }), 'INVALID_ENUM', 'presentation.type'));
check('I1.1 presentation 未知键→UNSUPPORTED_CAPABILITY（写了不生效故拒）', codeAt(mutSql(function (r) { r.presentation.foo = 1; }), 'UNSUPPORTED_CAPABILITY', 'presentation.foo'));
check('I1.1 sql 路 chart 合法形状零误报', errsOf(JSON.parse(src('examples/report-spec/daily_chart.sql.json'))).length === 0);
check('I1.1 sql 路 chart.value 缺失→REQUIRED', codeAt(mutSql(function (r) { r.presentation.chart = { kind: 'bar', category: 'bizDate' }; }), 'REQUIRED', 'presentation.chart.value'));
// 2026-11-08（G3 业务验收）：compileSql 已发射 detail.conditions → sql 路 conditions 放开；cells 仍拒（无编译面）
check('sql 路 conditions 合法零误报（compileSql 已发射 detail.conditions）', errsOf(mutSql(function (r) {
  r.dimensions = ['bizDate'];
  r.metrics = ['planned'];
  r.presentation.conditions = [{ column: 1, when: { formula: '=B2<100' }, then: { color: 16711680, bold: true } }];
})).length === 0);
check('sql 路 cells 仍拒（无编译面，写了不生效故拒）', codeAt(mutSql(function (r) { r.presentation.cells = [{ c: 0, rowSpan: 2 }]; }), 'UNSUPPORTED_CAPABILITY', 'presentation.cells'));
check('sql 路 total 仍拒（未验证的编译面，保持明确拒绝）', codeAt(mutSql(function (r) { r.presentation.total = { label: 'T' }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total'));
check('I1.1 rows 路 presentation.chart 零误报（2026-11-07 消除 SQL-only 限制）', errsOf(mut(function (r) { r.presentation.chart = { kind: 'bar', category: 'd', value: 'm' }; })).length === 0);
// r8 A2：表头文案/列宽覆盖 + 脚注（迁移旧报表用；未知键/坏类型明确拒）
check('r8-A2 footnote 非字符串→INVALID_TYPE', codeAt(mutSql(function (r) { r.presentation.footnote = 123; }), 'INVALID_TYPE', 'presentation.footnote'));
check('r8-A2 列引用未知键→UNSUPPORTED_CAPABILITY', codeAt(mutSql(function (r) { r.dataset.dimensions = [{ term: 'bizDate', foo: 1 }]; }), 'UNSUPPORTED_CAPABILITY', 'dataset.dimensions[0].foo'));
check('r8-A2 列引用 widthPt 非数→INVALID_NUMBER', codeAt(mutSql(function (r) { r.dataset.metrics = [{ term: 'planned', widthPt: 'wide' }]; }), 'INVALID_NUMBER', 'dataset.metrics[0].widthPt'));
check('r8-A2 列引用 label 空串→INVALID_TYPE', codeAt(mutSql(function (r) { r.dataset.dimensions = [{ term: 'bizDate', label: '' }]; }), 'INVALID_TYPE', 'dataset.dimensions[0].label'));
// capabilities 与实际能力一字对齐（r4 P2：机器读清单不得撒谎）
check('I1.1 capabilities：sql 路 chart Van 族全列', ReportSpec.capabilities().datasets.sql.chart.supported.join('|') === 'bar|pie|line|bar3d|pie3d|area3d|donut|donut3d|vbar|vline|varea|vscatter|vbubble|vpie|vgauge|vmap|vheatmap|vradar|vfunnel|vbox|vmultipie|vwordcloud|vstructure|meter');
check('I1.1 capabilities：rows 路 chart/filters/sort/topN/join 均 unsupported', (function () {
  var r = ReportSpec.capabilities().datasets.rows;
  return typeof r.chart === 'object' && r.filters === 'unsupported' && r.sort === 'unsupported' && r.topN === 'unsupported' && r.join === 'unsupported';
})());
// 镜像 schema 不得与 validator 口径打架（声明式镜像同步演进，validator 仍是权威）
var schemaMirror = JSON.parse(src('schemas/report-spec.schema.json'));
check('I1.1 镜像 schema：presentation 含 chart 键', !!(schemaMirror.properties.presentation.properties.chart));
check('I1.1 镜像 schema：dataset 为 rows|sql 两形态 oneOf', (function () {
  var one = schemaMirror.properties.dataset.oneOf || [];
  var hasRows = one.some(function (b) { return b.required && b.required.indexOf('rows') >= 0; });
  var hasSql = one.some(function (b) { return b.properties && b.properties.kind && b.properties.kind.enum.indexOf('sql') >= 0; });
  return hasRows && hasSql;
})());
check('I1.1 镜像 schema：x-scope 同时列 rows/sql', !!(schemaMirror['x-scope'] && schemaMirror['x-scope'].rows && schemaMirror['x-scope'].sql));
// 审查轮1 P2：schema 必须镜像 B1-B6/C2 新键（presentation.conditions/cells/total、params、sheet）
check('审查1 镜像 schema：presentation 含 conditions/cells/total', (function () {
  var pr = schemaMirror.properties.presentation.properties;
  return !!(pr.conditions && pr.cells && pr.total);
})());
check('审查1 镜像 schema：顶层含 params/sheet', !!(schemaMirror.properties.params && schemaMirror.properties.sheet));

// ===== B1（2026-11-06）：conditions 进 ReportSpec + rows 路静默丢弃拒 =====
function baseRowsSpec(mut) {
  var rs = { specVersion: '1', report: { name: 't' }, outName: 't',
    dimensions: [{ field: 'line', label: '线', widthPt: 120 }],
    metrics: [{ field: 'n', label: '数', aggregation: 'sum', dataType: 'number', widthPt: 100 }],
    dataset: { kind: 'rows', rows: [['A', 1]] },
    presentation: { type: 'table', showTotal: true } };
  if (mut) mut(rs);
  return rs;
}
check('B1 conditions 零误报', errsOf(baseRowsSpec(function (rs) {
  rs.presentation.conditions = [{ name: 'c', when: { column: 'n', op: '<', value: 60, valueType: 'number' }, then: { bg: 16638754 } }];
})).length === 0);
check('B1 conditions 非数组拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.conditions = 'x'; }), 'INVALID_ARRAY', 'presentation.conditions'));
check('B1 conditions 项缺 when 拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.conditions = [{ then: { bg: 1 } }]; }), 'REQUIRED', 'presentation.conditions[0].when'));
check('B1 rows 路 dataset.sort 拒（不静默丢）', codeAt(baseRowsSpec(function (rs) { rs.dataset.sort = 'x'; }), 'UNSUPPORTED_CAPABILITY', 'dataset.sort'));
check('B1 rows 路 dataset.topN 拒', codeAt(baseRowsSpec(function (rs) { rs.dataset.topN = 5; }), 'UNSUPPORTED_CAPABILITY', 'dataset.topN'));
check('B1 rows 路 dataset.dateRange 拒', codeAt(baseRowsSpec(function (rs) { rs.dataset.dateRange = {}; }), 'UNSUPPORTED_CAPABILITY', 'dataset.dateRange'));
check('B1 rows 路 dataset.filters 拒', codeAt(baseRowsSpec(function (rs) { rs.dataset.filters = []; }), 'UNSUPPORTED_CAPABILITY', 'dataset.filters'));

// ===== C1（2026-11-06 收口）：dataset 契约严格化 =====
//   kind 词表（rows 缺省兼容）；rows/sql 数据集键白名单；dimensions/metrics item 键白名单。
check('C1 dataset.kind=csv → INVALID_ENUM', codeAt(baseRowsSpec(function (rs) { rs.dataset.kind = 'csv'; }), 'INVALID_ENUM', 'dataset.kind'));
check('C1 dataset.kind=数字 → INVALID_ENUM', codeAt(baseRowsSpec(function (rs) { rs.dataset.kind = 1; }), 'INVALID_ENUM', 'dataset.kind'));
check('C1 dataset.kind=sql 正例零误报', errsOf(baseSqlSpec()).length === 0);
check('C1 dataset.kind 缺省=rows 兼容（零误报）', errsOf(baseRowsSpec(function (rs) { delete rs.dataset.kind; })).length === 0);
check('C1 rows 数据集未知键拒', codeAt(baseRowsSpec(function (rs) { rs.dataset.magic = 1; }), 'UNSUPPORTED_CAPABILITY', 'dataset.magic'));
check('C1 rows 数据集 source2 未知键拒', codeAt(baseRowsSpec(function (rs) { rs.dataset.source2 = 'x'; }), 'UNSUPPORTED_CAPABILITY', 'dataset.source2'));
check('C1 rows 数据集 query 仍明确拒（既有）', codeAt(baseRowsSpec(function (rs) { rs.dataset.query = 'SELECT 1'; }), 'UNSUPPORTED_CAPABILITY', 'dataset'));
check('C1 sql 数据集未知键拒', codeAt(baseSqlSpec(function (rs) { rs.dataset.odbc = 'x'; }), 'UNSUPPORTED_CAPABILITY', 'dataset.odbc'));
check('C1 sql 数据集 schema 键放行（make_api 消费）', errsOf(baseSqlSpec(function (rs) { rs.dataset.schema = 'atom_live'; })).length === 0);
check('C1 sql 数据集 query 仍明确拒（自由文本 SQL）', codeAt(baseSqlSpec(function (rs) { rs.dataset.query = 'SELECT 1'; }), 'UNSUPPORTED_CAPABILITY', 'dataset.query'));
check('C1 dimension 未知键拒', codeAt(baseRowsSpec(function (rs) { rs.dimensions[0].type = 'text'; }), 'UNSUPPORTED_CAPABILITY', 'dimensions[0].type'));
check('C1 metric 未知键拒', codeAt(baseRowsSpec(function (rs) { rs.metrics[0].mystery = 1; }), 'UNSUPPORTED_CAPABILITY', 'metrics[0].mystery'));
check('C1 dimension aggregation 仍单 INVALID_ENUM（不双报）', (function () {
  var es = errsOf(baseRowsSpec(function (rs) { rs.dimensions[0].aggregation = 'sum'; }));
  var bad = es.filter(function (e) { return e.path === 'dimensions[0].aggregation'; });
  return bad.length === 1 && bad[0].code === 'INVALID_ENUM';
})());
check('C1 dims/metrics 白名单正例零回归', errsOf(baseRowsSpec()).length === 0);
check('C1 多Sheet extra 数据集未知键拒（路径带前缀）', codeAt(msSpec(function (rs) { rs.extraSheets[0].dataset.magic = 1; }), 'UNSUPPORTED_CAPABILITY', 'extraSheets[0].dataset.magic'));
check('B1 rows 路 footnote 零误报', errsOf(baseRowsSpec(function (rs) { rs.presentation.footnote = '注'; })).length === 0);
(function () {
  var c = null;
  try {
    c = SpecCompiler.compile(baseRowsSpec(function (rs) {
      rs.presentation.conditions = [{ name: 'c', when: { column: 'n', op: '<', value: 60, valueType: 'number' }, then: { bg: 1 } }];
      rs.presentation.footnote = '注';
    }));
  } catch (e) { check('B1 compile 不抛: ' + e, false); return; }
  var det = null, hasCells = false;
  c.sheets[0].blocks.forEach(function (b) {
    if (b.type === 'detail') det = b;
    if (b.type === 'cells' && b.items && b.items[0] && b.items[0].text === '注') hasCells = true;
  });
  check('B1 compile: detail.conditions 透传', !!(det && det.conditions && det.conditions.length === 1));
  check('B1 compile: footnote 发射 cells 块', hasCells);
})();

// ===== B2（2026-11-06）：params 参数面板进 ReportSpec =====
check('B2 params 零误报', errsOf(baseRowsSpec(function (rs) {
  rs.params = [{ kind: 'date', name: 'd', value: '2026-09-13' }, { kind: 'submit', name: 'go', text: '查询' }];
})).length === 0);
check('B2 params kind 越词表拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'magic', name: 'x' }]; }), 'INVALID_ENUM', 'params[0].kind'));
check('B2 params name 重复拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'x' }, { kind: 'editor', name: 'x' }]; }), 'DUPLICATE', 'params[1].name'));
check('B2 params 缺 name 拒（editor）', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor' }]; }), 'REQUIRED', 'params[0].name'));
(function () {
  var c = null;
  try { c = SpecCompiler.compile(baseRowsSpec(function (rs) { rs.params = [{ kind: 'number', name: 'n', value: 5 }]; })); } catch (e) { check('B2 compile 不抛: ' + e, false); return; }
  check('B2 compile: IR.param 注入 widgets', !!(c.param && c.param.widgets && c.param.widgets.length === 1 && c.param.widgets[0].kind === 'number'));
})();

// ===== B3/B4（2026-11-06）：presentation.cells + sheet 级扩展 =====
check('B3 presentation.cells 零误报', errsOf(baseRowsSpec(function (rs) { rs.presentation.cells = [{ c: 0, text: 'x' }]; })).length === 0);
check('B3 presentation.cells 非数组拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.cells = {}; }), 'INVALID_ARRAY', 'presentation.cells'));
check('B4 sheet 未知键拒', codeAt(baseRowsSpec(function (rs) { rs.sheet = { magic: 1 }; }), 'UNSUPPORTED_CAPABILITY', 'sheet.magic'));
check('B4 sheet 合法键零误报', errsOf(baseRowsSpec(function (rs) { rs.sheet = { watermark: { text: 'W' }, headerFooter: { header: { center: [{ text: 'h' }] } } }; })).length === 0);
(function () {
  var c = null;
  try {
    c = SpecCompiler.compile(baseRowsSpec(function (rs) {
      rs.presentation.cells = [{ c: 0, text: 'x' }];
      rs.sheet = { watermark: { text: 'W' } };
    }));
  } catch (e) { check('B3/B4 compile 不抛: ' + e, false); return; }
  var hasCells = false;
  (c.sheets[0].blocks || []).forEach(function (b) { if (b.type === 'cells' && b.items && b.items[0] && b.items[0].text === 'x') hasCells = true; });
  check('B3 compile: cells 块发射', hasCells);
  check('B4 compile: watermark 注入 workbook 级', !!(c.watermark && c.watermark.text === 'W'));
})();

// ===== B5（2026-11-06）：Van 图表族 + 装饰键进 ReportSpec =====
function baseSqlSpec(mut) {
  var rs = { specVersion: '1', report: { name: 't' }, outName: 't',
    dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord',
      dimensions: ['bizDate'], metrics: ['planned'],
      dateRange: { from: '2026-09-13', to: '2026-09-22' } },
    presentation: { type: 'table', chart: { kind: 'vbar', category: 'bizDate', value: 'planned' } } };
  if (mut) mut(rs);
  return rs;
}
check('B5 vbar chart 零误报', errsOf(baseSqlSpec()).length === 0);
check('B5 chart label 装饰零误报', errsOf(baseSqlSpec(function (rs) { rs.presentation.chart.label = { enable: true, position: 2 }; })).length === 0);
check('B5 chart 未知装饰键拒', codeAt(baseSqlSpec(function (rs) { rs.presentation.chart.magic = 1; }), 'UNSUPPORTED_CAPABILITY', 'presentation.chart.magic'));
check('B5 chart 非法 kind 拒', codeAt(baseSqlSpec(function (rs) { rs.presentation.chart.kind = 'magic'; }), 'INVALID_ENUM', 'presentation.chart.kind'));

// ===== B6（2026-11-06）：total.sumCols 多列求和 + params reg =====
check('B6 total.sumCols 零误报', errsOf(baseRowsSpec(function (rs) { rs.presentation.total = { label: '合计', sumCols: [{ col: 1 }] }; })).length === 0);
check('B6 total.sumCols 非数组拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: 'x' }; }), 'INVALID_ARRAY', 'presentation.total.sumCols'));
check('B6 params reg 零误报', errsOf(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'e', reg: { custom: '^x$' } }]; })).length === 0);
(function () {
  // 审查轮2：用 3 列（2 维+1 度）证明 span 取最小求和列（旧 n-1=2，新=1；2 列时会误判为通过）
  var rs3 = baseRowsSpec(function (rs) {
    rs.dimensions = [{ field: 'line', label: '线', widthPt: 120 }, { field: 'cat', label: '类', widthPt: 100 }];
    rs.dataset = { rows: [['A', 'X', 1]] };   // 审查3-3：3 列宽与维度+度量一致
    rs.presentation.total = { sumCols: [{ col: 1 }, { col: 2 }] };
  });
  var c = null;
  try { c = SpecCompiler.compile(rs3); } catch (e) { check('B6 compile 不抛: ' + e, false); return; }
  var t = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'total') t = b; });
  check('B6 compile: total 走 sumCols 通道（无 aggregate）', !!(t && t.sumCols && t.sumCols.length === 2 && !t.aggregate));
  check('审查1/2 B6: sumCols total span = 最小求和列号（3 列下 1≠n-1）', !!(t && t.span === 1 && t.span !== 2));
})();

// ===== 审查轮1（2026-11-06）：P1/P2 负项 =====
// P1-A：sql 路 cells/total 不发射 → 明确拒（不再绿着丢）。2026-11-08（G3）：conditions 已由
//   compileSql 发射到 detail.conditions，旧"conditions 拒"口径与实际编译面不符 → 改为放行断言
//   （正向覆盖见上文 'sql 路 conditions 合法零误报'；形状闸仍在 IR checkConditions）。
check('审查1 sql 路 conditions 放行（compileSql 发射 detail.conditions，2026-11-08 G3 口径）', errsOf(baseSqlSpec(function (rs) { rs.presentation.conditions = [{ column: 1, when: { formula: '=B2<100' }, then: { color: 16711680 } }]; })).length === 0);
check('审查1 sql 路 cells 拒', codeAt(baseSqlSpec(function (rs) { rs.presentation.cells = [{ c: 0, text: 'x' }]; }), 'UNSUPPORTED_CAPABILITY', 'presentation.cells'));
check('审查1 sql 路 total 拒', codeAt(baseSqlSpec(function (rs) { rs.presentation.total = { label: '合计' }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total'));
// P2：presentation.cells 绝对 r 必撞块游标 → 前置拒
check('审查1 presentation.cells 绝对 r 拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.cells = [{ c: 0, r: 0, text: 'x' }]; }), 'UNSUPPORTED_CAPABILITY', 'presentation.cells[0].r'));
// P2：total 未知键 / showTotal=false + total
check('审查1 total 未知键拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { magic: 1 }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total.magic'));
check('审查1 showTotal=false 时 total 拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.showTotal = false; rs.presentation.total = { label: 'x' }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total'));
// P2：params values 形状 / 未知键 / submit 缺文案
check('审查1 params values 非数组拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'combo', name: 'c', values: 'ab' }]; }), 'INVALID_ARRAY', 'params[0].values'));
check('审查1 params 未知键拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'e', magic: 1 }]; }), 'UNSUPPORTED_CAPABILITY', 'params[0].magic'));
check('审查1 params 名 __proto__ 重复仍拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: '__proto__' }, { kind: 'editor', name: '__proto__' }]; }), 'DUPLICATE', 'params[1].name'));
check('审查1 submit 缺文案拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'submit', name: 'go' }]; }), 'REQUIRED', 'params[0].text'));
// 2026-11-06 参数执行期筛选
check('参数 filter 零误报', errsOf(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'line', value: 'A', filter: { column: 'line', op: '=' } }]; })).length === 0);
check('参数 filter.op 越词表拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'line', filter: { column: 'line', op: '~~' } }]; }), 'INVALID_ENUM', 'params[0].filter.op'));
check('参数 filter.column 缺拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'line', filter: { op: '=' } }]; }), 'REQUIRED', 'params[0].filter.column'));
check('参数 filter 未知键拒', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'line', filter: { column: 'line', magic: 1 } }]; }), 'UNSUPPORTED_CAPABILITY', 'params[0].filter.magic'));
check('参数 filter 需具名（label 拒）', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'label', text: 'x', filter: { column: 'line' } }]; }), 'REQUIRED', 'params[0].name'));
check('sql 路参数 filter 拒', codeAt(baseSqlSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'line', filter: { column: 'line' } }]; }), 'UNSUPPORTED_CAPABILITY', 'params[0].filter'));
check('多参数 filter 拒（暂限 1 条）', codeAt(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'a1', filter: { column: 'line' } }, { kind: 'editor', name: 'a2', filter: { column: 'n' } }]; }), 'UNSUPPORTED_CAPABILITY', 'params'));
(function () {
  var c = null;
  try { c = SpecCompiler.compile(baseRowsSpec(function (rs) { rs.params = [{ kind: 'editor', name: 'line', value: 'A', filter: { column: 'line' } }]; })); } catch (e) { check('参数 filter compile 不抛: ' + e, false); return; }
  check('参数 filter compile: IR.param.filters 发射（op 缺省 =）', !!(c.param && c.param.filters && c.param.filters.length === 1 && c.param.filters[0].column === 'line' && c.param.filters[0].parameter === 'line' && c.param.filters[0].op === '='));
})();
// P2：散点/气泡 spec 用 x/y（不再过校验后必挂 IR）
check('审查1 vscatter 需 x/y', (function () {
  var es = errsOf(baseSqlSpec(function (rs) { rs.presentation.chart = { kind: 'vscatter', category: 'bizDate', value: 'planned' }; }));
  return es.some(function (e) { return e.code === 'REQUIRED' && e.path === 'presentation.chart.x'; }) &&
    es.some(function (e) { return e.code === 'UNSUPPORTED_CAPABILITY' && e.path === 'presentation.chart.category'; });
})());
check('审查1 vscatter x/y 零误报', errsOf(baseSqlSpec(function (rs) { rs.presentation.chart = { kind: 'vscatter', x: 'planned', y: 'planned' }; })).length === 0);
// D2 地图（sql 路编译：category/value + geoUrl 透传；无省份数据源，仅形状/IR 合同）
check('D2 vmap spec 零误报', errsOf(baseSqlSpec(function (rs) { rs.presentation.chart = { kind: 'vmap', mapType: 'point', category: 'bizDate', value: 'planned', geoUrl: 'assets/map/geographic/world/中国.json', zoom: 0 }; })).length === 0);
(function () {
  var deps = {
    model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } }
  };
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'vmap',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table', chart: { kind: 'vmap', mapType: 'point', category: 'd', value: 'm', geoUrl: 'assets/map/geographic/world/中国.json', zoom: 0 } } };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('D2 vmap compile 不抛: ' + e, false); return; }
  var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
  var ie = Ir.validate(c);
  if (ie.length) print('VMAP IR ERRS: ' + JSON.stringify(ie));
  check('D2 vmap compile 发射 geoUrl/zoom/mapType 且 IR 零误报', !!(cb && cb.kind === 'vmap' && cb.geoUrl && cb.zoom === 0 && cb.mapType === 'point' && ie.length === 0));
  // 区域图缺省（mapType 省略）仍可编译且 IR 零误报（area 默认路径）
  var rs2 = JSON.parse(JSON.stringify(rs));
  delete rs2.presentation.chart.mapType; rs2.presentation.chart.zoom = 4;
  try {
    var c2 = SpecCompiler.compile(rs2, deps);
    var cb2 = null; c2.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb2 = b; });
    check('D2 vmap area 缺省编译零误报', !!(cb2 && cb2.mapType == null && cb2.zoom === 4 && Ir.validate(c2).length === 0));
  } catch (e2) { check('D2 vmap area 缺省编译不抛: ' + e2, false); }
})();
// D2 热力图（2026-11-07）：vheatmap spec 路——heat 透传 + IR 零误报（真引擎载体 test_vheatmap PNG 已证）
(function () {
  var deps = {
    model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } }
  };
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'vheatmap',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table', chart: { kind: 'vheatmap', category: 'd', value: 'm', geoUrl: 'assets/map/geographic/world/中国.json', zoom: 0, heat: { radius: 35, blur: 45, minOpacity: 0, maxOpacity: 70 } } } };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('D2 vheatmap compile 不抛: ' + e, false); return; }
  var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
  var ie = Ir.validate(c);
  if (ie.length) print('VHEATMAP IR ERRS: ' + JSON.stringify(ie));
  check('D2 vheatmap compile 发射 geoUrl/zoom/heat 且 IR 零误报', !!(cb && cb.kind === 'vheatmap' && cb.geoUrl && cb.zoom === 0 && cb.heat && cb.heat.maxOpacity === 70 && ie.length === 0));
  // heat 缺省（整个 heat 键省略）编译零误报
  var rs2 = JSON.parse(JSON.stringify(rs));
  delete rs2.presentation.chart.heat;
  try {
    var c2 = SpecCompiler.compile(rs2, deps);
    var cb2 = null; c2.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb2 = b; });
    check('D2 vheatmap heat 缺省编译零误报', !!(cb2 && cb2.kind === 'vheatmap' && cb2.heat == null && Ir.validate(c2).length === 0));
  } catch (e2) { check('D2 vheatmap heat 缺省编译不抛: ' + e2, false); }
})();
// 2026-11-08 雷达图：vradar spec 路——category/value 编译 + IR 零误报（真引擎载体 reports/test_radar.js PNG 已证）
(function () {
  var deps = {
    model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } }
  };
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'vradar',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table', chart: { kind: 'vradar', category: 'd', value: 'm' } } };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('vradar compile 不抛: ' + e, false); return; }
  var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
  var ie = Ir.validate(c);
  if (ie.length) print('VRADAR IR ERRS: ' + JSON.stringify(ie));
  check('vradar compile 发射 kind=vradar 且 IR 零误报', !!(cb && cb.kind === 'vradar' && ie.length === 0));
})();
// 2026-11-08 漏斗图：vfunnel spec 路——category/value 编译 + IR 零误报（真引擎载体 reports/test_funnel.js PNG 已证）
(function () {
  var deps = {
    model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } }
  };
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'vfunnel',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table', chart: { kind: 'vfunnel', category: 'd', value: 'm' } } };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('vfunnel compile 不抛: ' + e, false); return; }
  var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
  var ie = Ir.validate(c);
  if (ie.length) print('VFUNNEL IR ERRS: ' + JSON.stringify(ie));
  check('vfunnel compile 发射 kind=vfunnel 且 IR 零误报', !!(cb && cb.kind === 'vfunnel' && ie.length === 0));
})();
// 2026-11-08 箱线图：vbox spec 路——category/values 编译 + IR 零误报（真引擎载体 reports/test_box.js PNG 已证）
(function () {
  var deps = {
    model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } }
  };
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'vbox',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table', chart: { kind: 'vbox', category: 'd', value: 'm' } } };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('vbox compile 不抛: ' + e, false); return; }
  var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
  var ie = Ir.validate(c);
  if (ie.length) print('VBOX IR ERRS: ' + JSON.stringify(ie));
  check('vbox compile 发射 kind=vbox 且 IR 零误报', !!(cb && cb.kind === 'vbox' && ie.length === 0));
})();
// 2026-11-08 legacy 3D/环形：bar3d/pie3d/area3d/donut/donut3d spec 路编译 + IR 零误报
(function () {
  var deps = {
    model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } }
  };
  ['bar3d', 'pie3d', 'area3d', 'donut', 'donut3d'].forEach(function (k) {
    var rs = { specVersion: '1', report: { name: 't' }, outName: k,
      dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
      presentation: { type: 'table', chart: { kind: k, category: 'd', value: 'm' } } };
    var c = null;
    try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('legacy ' + k + ' compile 不抛: ' + e, false); return; }
    var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
    var ie = Ir.validate(c);
    if (ie.length) print(k.toUpperCase() + ' IR ERRS: ' + JSON.stringify(ie));
    check('legacy ' + k + ' compile 发射 kind=' + k + ' 且 IR 零误报', !!(cb && cb.kind === k && ie.length === 0));
  });
})();
// 2026-11-08 多层饼：vmultipie spec 路 levels/value 编译 + IR 零误报
(function () {
  var deps = { model: { dimensions: [{ name: 'd', label: 'D' }, { name: 'd2', label: 'D2' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'd2', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } } };
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'vmultipie',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d', 'd2'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table', chart: { kind: 'vmultipie', levels: ['d', 'd2'], value: 'm' } } };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('vmultipie compile 不抛: ' + e, false); return; }
  var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
  var ie = Ir.validate(c);
  if (ie.length) print('VMULTIPIE IR ERRS: ' + JSON.stringify(ie));
  check('vmultipie compile 发射 levels[]/value 且 IR 零误报', !!(cb && cb.kind === 'vmultipie' && cb.levels && cb.levels.length === 2 && ie.length === 0));
})();
// 2026-11-08 词云：vwordcloud spec 路 wordName/wordValue 编译 + IR 零误报
(function () {
  var deps = { model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } } };
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'vwordcloud',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table', chart: { kind: 'vwordcloud', wordName: 'd', wordValue: 'm' } } };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('vwordcloud compile 不抛: ' + e, false); return; }
  var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
  var ie = Ir.validate(c);
  if (ie.length) print('VWORDCLOUD IR ERRS: ' + JSON.stringify(ie));
  check('vwordcloud compile 发射 wordName/wordValue 且 IR 零误报', !!(cb && cb.kind === 'vwordcloud' && cb.wordName === 'd' && cb.wordValue === 'm' && ie.length === 0));
})();
// 2026-11-08 结构图 rows 路：compileRows 发射 node* + IR 零误报
(function () {
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'structure_rows', dimensions: [{field:'node',label:'节点'},{field:'parent',label:'父'},{field:'name',label:'名'}], metrics: [{field:'value',label:'值',aggregation:'sum',dataType:'number'}], dataset: { rows: [['1','','总部',100],['2','1','研发',60]] },
    presentation: { type: 'table', showTotal: true, chart: { kind: 'vstructure', nodeId: 'node', parentId: 'parent', nodeName: 'name', nodeValue: 'value' } } };
  var ir = SpecCompiler.compile(rs, {});
  var ie = Ir.validate(ir);
  if (ie.length) print('VSTRUCTURE ROWS IR ERRS: ' + JSON.stringify(ie));
  var cb=null; ir.sheets[0].blocks.forEach(function(b){ if(b.type==='chart') cb=b; });
  check('structure rows compile 发射 node* 且 IR 零误报', !!(cb && cb.kind==='vstructure' && cb.nodeId==='node' && ie.length===0));
})();
// 2026-11-08 仪表盘：meter spec/rows 路 value 编译 + IR 零误报（真引擎 PNG 80/60/90/40）
(function () {
  var rs = { specVersion: '1', report: { name: 't' }, outName: 'meter_rows', dimensions: [{field:'line',label:'线'}], metrics: [{field:'value',label:'值',aggregation:'sum',dataType:'number'}], dataset: { rows: [['A线',80]] },
    presentation: { type: 'table', showTotal: true, chart: { kind: 'meter', value: 'value', seriesName: '产量' } } };
  var ir = SpecCompiler.compile(rs, {});
  var ie = Ir.validate(ir);
  if (ie.length) print('METER ROWS IR ERRS: ' + JSON.stringify(ie));
  var cb=null; ir.sheets[0].blocks.forEach(function(b){ if(b.type==='chart') cb=b; });
  check('meter rows compile 发射 value 且 IR 零误报', !!(cb && cb.kind==='meter' && cb.value==='value' && ie.length===0));
})();
check('审查2 bar 带 x/y 拒', (function () {
  var es = errsOf(baseSqlSpec(function (rs) { rs.presentation.chart.x = 'planned'; }));
  return es.some(function (e) { return e.code === 'UNSUPPORTED_CAPABILITY' && e.path === 'presentation.chart.x'; });
})());
// 审查轮2：sumCols 列 0 与合计 label 同格 → spec 前置拒
check('审查2 sumCols col0 拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 0 }] }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total.sumCols[0].col'));
// 审查轮2：散点编译链（stub deps）必须发射 x/y 且不带 category/value
(function () {
  var deps = {
    model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm1', label: 'M1' }, { name: 'm2', label: 'M2' }] },
    SqlBuilder: { build: function () {
      return { sql: 'SELECT 1', baseAliases: [
        { alias: 'd', role: 'dimension' }, { alias: 'm1', role: 'metric' }, { alias: 'm2', role: 'metric' }
      ] };
    } }
  };
  var rs = { specVersion: '1', report: { name: 't' }, outName: 't',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m1', 'm2'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table', chart: { kind: 'vscatter', x: 'm1', y: 'm2' } } };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('审查2 scatter compile 不抛: ' + e, false); return; }
  var cb = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'chart') cb = b; });
  check('审查2 scatter compile 发射 x/y 且无 category/value', !!(cb && cb.x === 'm1' && cb.y === 'm2' && cb.category == null && cb.value == null));
  var ie = Ir.validate(c);
  check('审查2 scatter 编译产物过 Ir.validate 零误报', ie.length === 0);
})();

// ===== C2（2026-11-06）：隐藏行列（sheet.hideRows/hideCols → object 行高/列宽归零） =====
check('C2 sheet.hideRows/hideCols 零误报', errsOf(baseRowsSpec(function (rs) { rs.sheet = { hideRows: [1], hideCols: [1, 3] }; })).length === 0);
check('C2 sheet.hideRows 非整数拒', codeAt(baseRowsSpec(function (rs) { rs.sheet = { hideRows: [1.5] }; }), 'INVALID_NUMBER', 'sheet.hideRows[0]'));
check('C2 sheet.hideCols 非数组拒', codeAt(baseRowsSpec(function (rs) { rs.sheet = { hideCols: 'x' }; }), 'INVALID_ARRAY', 'sheet.hideCols'));
// ===== 2026-11-06 P1：合计行非 sum 聚合（presentation.total.sumCols[].fn / total.aggregate） =====
check('P1 sumCols fn 零误报', errsOf(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 1, fn: 'avg' }] }; })).length === 0);
check('P1 sumCols fn 越词表拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 1, fn: 'ratio' }] }; }), 'INVALID_ENUM', 'presentation.total.sumCols[0].fn'));
check('P1 sumCols 重复列拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 1 }, { col: 1 }] }; }), 'DUPLICATE', 'presentation.total.sumCols[1].col'));
check('P1 sumCols fn+formula 互斥拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 1, fn: 'avg', formula: '=SUM(B3)' }] }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total.sumCols[0]'));
check('P1 total.aggregate ratio 零误报', errsOf(baseRowsSpec(function (rs) { rs.presentation.total = { aggregate: { fn: 'ratio', num: 1, den: 1, format: '0.00' } }; })).length === 0);
check('P1 total.aggregate 未知键拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { aggregate: { fn: 'sum', col: 1, magic: 1 } }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total.aggregate.magic'));
check('审2 ratio 不用 col', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { aggregate: { fn: 'ratio', num: 1, den: 1, col: 1 } }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total.aggregate.col'));
check('审2 非 ratio 不用 num', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { aggregate: { fn: 'sum', col: 1, num: 1 } }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total.aggregate.num'));
check('审2 aggregate 落点超表宽：编译期拒', (function () {
  try { SpecCompiler.compile(baseRowsSpec(function (rs) { rs.presentation.total = { aggregate: { fn: 'sum', col: 2 } }; })); return false; } catch (e) { return String(e).indexOf('超出表宽') >= 0; }
})());
check('审3 aggregate 落点超表宽：spec 前置拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { aggregate: { fn: 'sum', col: 2 } }; }), 'INVALID_NUMBER', 'presentation.total.aggregate'));
check('审3 sumCols 落点超表宽：spec 前置拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 2 }] }; }), 'INVALID_NUMBER', 'presentation.total.sumCols[0].col'));
check('审2 sumCols 落点超表宽：编译期拒', (function () {
  try { SpecCompiler.compile(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 2 }] }; })); return false; } catch (e) { return String(e).indexOf('超出表宽') >= 0; }
})());
check('P1 total.aggregate+sumCols 互斥拒', codeAt(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 1 }], aggregate: { fn: 'sum', col: 1 } }; }), 'UNSUPPORTED_CAPABILITY', 'presentation.total'));
(function () {
  var c = null;
  try { c = SpecCompiler.compile(baseRowsSpec(function (rs) { rs.presentation.total = { sumCols: [{ col: 1, fn: 'avg' }] }; })); } catch (e) { check('P1 sumCols fn compile 不抛: ' + e, false); return; }
  var t = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'total') t = b; });
  check('P1 compile: sumCols fn 直通 IR', !!(t && t.sumCols && t.sumCols[0].fn === 'avg'));
})();
(function () {
  var c = null;
  try { c = SpecCompiler.compile(baseRowsSpec(function (rs) { rs.presentation.total = { label: '比', aggregate: { fn: 'ratio', num: 1, den: 1, format: '0.00' } }; })); } catch (e) { check('P1 aggregate compile 不抛: ' + e, false); return; }
  var t = null; c.sheets[0].blocks.forEach(function (b) { if (b.type === 'total') t = b; });
  check('P1 compile: aggregate 直通且 label 生效', !!(t && t.aggregate && t.aggregate.fn === 'ratio' && t.label === '比' && t.span === 1));
})();
(function () {
  var c = null;
  try { c = SpecCompiler.compile(baseRowsSpec(function (rs) { rs.sheet = { hideRows: [1], hideCols: [2] }; })); } catch (e) { check('C2 compile 不抛: ' + e, false); return; }
  check('C2 compile: hideRows/hideCols 直通 sheet', !!(c.sheets[0].hideRows && c.sheets[0].hideRows[0] === 1 && c.sheets[0].hideCols && c.sheets[0].hideCols[0] === 2));
})();

// 2026-11-06（plan→create e2e P1）：planner rows 路列不带 widthPt，编译器必须补默认值（否则 IR widthsPt undefined 拒）
check('编译：缺省 widthPt 补 110 且 IR 零误报', (function () {
  var rs = baseRowsSpec(function (r) { delete r.dimensions[0].widthPt; delete r.metrics[0].widthPt; });
  var c = null;
  try { c = SpecCompiler.compile(rs); } catch (e) { print('WIDTH COMPILE FAIL ' + e); return false; }
  return c.sheets[0].widthsPt[0] === 110 && c.sheets[0].widthsPt[1] === 110 && Ir.validate(c).length === 0;
})());

// ===== 多 Sheet（ReportSpec extraSheets，rows-only） =====
function msSpec(mut) {
  var rs = baseRowsSpec(function (r) {
    r.extraSheets = [{ name: '明细', dimensions: [{ field: 'l2', label: '线2', widthPt: 120 }], metrics: [{ field: 'n2', label: '数2', aggregation: 'sum', dataType: 'number', widthPt: 100 }], dataset: { rows: [['X', 1]] }, presentation: { type: 'table', showTotal: false } }];
  });
  if (mut) mut(rs);
  return rs;
}
check('多Sheet extraSheets 零误报', errsOf(msSpec()).length === 0);
check('多Sheet 重名拒（占 sheet1）', codeAt(msSpec(function (rs) { rs.extraSheets[0].name = 'sheet1'; }), 'DUPLICATE', 'extraSheets[0].name'));
check('多Sheet 重名拒（两项同名）', codeAt(msSpec(function (rs) { rs.extraSheets.push(JSON.parse(JSON.stringify(rs.extraSheets[0]))); }), 'DUPLICATE', 'extraSheets[1].name'));
check('多Sheet SQL extra 零误报（2026-11-07 放开）', errsOf(msSpec(function (rs) { rs.extraSheets[0].dataset = { kind: 'sql', entity: 'E', connection: 'C', dimensions: ['d'] }; })).length === 0);
check('多Sheet 内部未知键拒（路径带前缀）', codeAt(msSpec(function (rs) { rs.extraSheets[0].presentation.magic = 1; }), 'UNSUPPORTED_CAPABILITY', 'extraSheets[0].presentation.magic'));
check('多Sheet extra sheet 未知键拒', codeAt(msSpec(function (rs) { rs.extraSheets[0].magic = 1; }), 'UNSUPPORTED_CAPABILITY', 'extraSheets[0].magic'));
(function () {
  var c = null;
  try { c = SpecCompiler.compile(msSpec()); } catch (e) { check('多Sheet compile 不抛: ' + e, false); return; }
  var d2 = null;
  (c.sheets[1].blocks || []).forEach(function (b) { if (b.type === 'detail') d2 = b.dataset; });
  check('多Sheet compile: 两 sheet 两数据集且第二张绑定 ds2',
    c.sheets.length === 2 && c.datasets.length === 2 && c.sheets[1].name === '明细' && c.datasets[1].name === 'ds2' && d2 === 'ds2');
  var ie = Ir.validate(c);
  if (ie.length) print('MS IR ERRS: ' + JSON.stringify(ie));
  check('多Sheet 编译产物过 Ir.validate 零误报', ie.length === 0);
})();
// —— 复审（2026-11-06 多 Sheet P1/P2）：sql 基表 extras 必须校验；workbook 级键/ dsName / 原型键
var extraOk = { name: '明细', dimensions: [{ field: 'l2', label: '线2', widthPt: 120 }], metrics: [{ field: 'n2', label: '数2', aggregation: 'sum', dataType: 'number', widthPt: 100 }], dataset: { rows: [['X', 1]] }, presentation: { type: 'table', showTotal: false } };
check('多Sheet sql 基表 + 合法 extra 零误报', errsOf(baseSqlSpec(function (rs) { rs.extraSheets = [JSON.parse(JSON.stringify(extraOk))]; })).length === 0);
check('多Sheet sql 基表 + 非法 extra 路径带前缀', codeAt(baseSqlSpec(function (rs) { rs.extraSheets = [JSON.parse(JSON.stringify(extraOk))]; rs.extraSheets[0].presentation.magic = 1; }), 'UNSUPPORTED_CAPABILITY', 'extraSheets[0].presentation.magic'));
check('多Sheet extra sheet.watermark 拒（workbook 级）', codeAt(msSpec(function (rs) { rs.extraSheets[0].sheet = { watermark: { text: 'W' } }; }), 'UNSUPPORTED_CAPABILITY', 'extraSheets[0].sheet.watermark'));
check('多Sheet extra sheet.toolbar 拒', codeAt(msSpec(function (rs) { rs.extraSheets[0].sheet = { toolbar: { buttons: ['export'] } }; }), 'UNSUPPORTED_CAPABILITY', 'extraSheets[0].sheet.toolbar'));
check('多Sheet 手写 dsName 拒（与 ds2 冲突）', codeAt(msSpec(function (rs) { rs.dsName = 'ds2'; }), 'UNSUPPORTED_CAPABILITY', 'dsName'));
check('多Sheet 名 constructor 不误判为重复', errsOf(msSpec(function (rs) { rs.extraSheets[0].name = 'constructor'; })).length === 0);
// 复审2：'__proto__' 也必须按普通键计（hasOwn 在原型链键上会假阴）
check('多Sheet 名 __proto__ 重复仍拒', codeAt(msSpec(function (rs) { rs.extraSheets[0].name = '__proto__'; rs.extraSheets.push({ name: '__proto__', dimensions: [{ field: 'l3', label: '线3', widthPt: 120 }], metrics: [{ field: 'n3', label: '数3', aggregation: 'sum', dataType: 'number', widthPt: 100 }], dataset: { rows: [['Y', 2]] }, presentation: { showTotal: false } }); }), 'DUPLICATE', 'extraSheets[1].name'));
// 复审：SQL 基表 + rows extra 的编译链（stub deps）——2 sheet/2 数据集且 IR 零误报
(function () {
  var deps = {
    model: { dimensions: [{ name: 'd', label: 'D' }], metrics: [{ name: 'm', label: 'M' }] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: 'd', role: 'dimension' }, { alias: 'm', role: 'metric' }] }; } }
  };
  var rs = { specVersion: '1', report: { name: 'base' }, outName: 'msSql',
    dataset: { kind: 'sql', connection: 'C', entity: 'E', dimensions: ['d'], metrics: ['m'], dateRange: { from: '2026-01-01', to: '2026-01-02' } },
    presentation: { type: 'table' },
    extraSheets: [JSON.parse(JSON.stringify(extraOk))] };
  var c = null;
  try { c = SpecCompiler.compile(rs, deps); } catch (e) { check('多Sheet sql 基表 compile 不抛: ' + e, false); return; }
  var ie = Ir.validate(c);
  if (ie.length) print('MS SQL IR ERRS: ' + JSON.stringify(ie));
  check('多Sheet sql 基表 + rows extra: 2 sheet/2 数据集且 IR 零误报', c.sheets.length === 2 && c.datasets.length === 2 && c.datasets[1].name === 'ds2' && ie.length === 0);
})();
(function () {
  var rs = msSpec(function (r) { r.extraSheets[0].name = 'constructor'; });
  var c = null;
  try { c = SpecCompiler.compile(rs); } catch (e) { check('多Sheet 原型名 compile 不抛: ' + e, false); return; }
  check('多Sheet 原型名编译产物过 Ir.validate', Ir.validate(c).length === 0);
})();

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
