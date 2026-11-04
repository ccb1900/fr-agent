// verify/fast_sqlpath.js — I5-Q2 语义 ReportSpec(SQL 数据集) → cells IR 离线契约测（零引擎零连库）
//   标尺：I1 spec_validator/spec_compiler 扩 SQL 路后——sql 形态编译出的 IR 必过既有 Ir.validate（含 I0-01 SQL_READONLY）0 err；
//   派生 ratio 成 IR 公式格、base 指标 ds 绑定、总计 SUM；内嵌 rows 路逐字不破（opt-in，默认形状不变）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + f)), 'UTF-8')); }
function jt(f) { return JSON.parse(src(f)); }
function codeAt(errs, code, frag) { return errs.some(function (e) { return e.code === code && String(e.path).indexOf(frag) >= 0; }); }

['lib/report_spec.js', 'lib/spec_validator.js', 'lib/spec_compiler.js'].forEach(function (f) {
  var ok = true; try { new Function(src(f)); } catch (e) { ok = false; print('PARSE ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});
load(ROOT + '/lib/ir.js');
load(ROOT + '/lib/report_spec.js');
load(ROOT + '/lib/spec_validator.js');
load(ROOT + '/lib/spec_compiler.js');
load(ROOT + '/semantic/query/sqlbuilder.js');
var model = jt('models/production/model.json');
var spec = jt('examples/report-spec/daily_report.sql.json');

// ===== spec_validator sql 分支 =====
check('sql 语义 spec 过 spec_validator 0 err', SpecValidator.validate(spec).length === 0);
check('sql spec 自由文本 query 被拒', codeAt(SpecValidator.validate((function () { var s = JSON.parse(JSON.stringify(spec)); s.dataset.query = 'SELECT 1'; return s; })()), 'UNSUPPORTED_CAPABILITY', 'dataset.query'));
check('sql spec 缺 connection 被拒', codeAt(SpecValidator.validate((function () { var s = JSON.parse(JSON.stringify(spec)); delete s.dataset.connection; return s; })()), 'REQUIRED', 'dataset.connection'));
check('sql spec 坏日期被拒', codeAt(SpecValidator.validate((function () { var s = JSON.parse(JSON.stringify(spec)); s.dataset.dateRange.from = "2026-9-1' --"; return s; })()), 'INVALID_TYPE', 'dateRange'));

// ===== spec_compiler sql 路 → IR =====
var ir = SpecCompiler.compile(spec, { model: model, SqlBuilder: SqlBuilder });
check('sql IR 过 Ir.validate 0 err（含 I0-01 SQL_READONLY）', (function () { var e = Ir.validate(ir); if (e.length) print('  IR ERRS: ' + JSON.stringify(e).slice(0, 400)); return e.length === 0; })());
check('IR 数据集 kind=sql + connection=ATOM_LIVE + 单语句无分号', (function () {
  var d = ir.datasets[0];
  return d && d.kind === 'sql' && d.connection === 'ATOM_LIVE' && /^SELECT\b/.test(d.query) && d.query.indexOf(';') < 0 && /GROUP BY/.test(d.query) && /BETWEEN '2026-09-13' AND '2026-09-22'/.test(d.query);
})());
check('IR 明细含 base 列 ds 绑定（bizDate/planned/done）', (function () {
  var detail = ir.sheets[0].blocks.filter(function (b) { return b.dataset === 'ds1'; })[0];
  var bound = detail.items.filter(function (i) { return i.ds; }).map(function (i) { return i.ds.column; });
  return bound.indexOf('bizDate') >= 0 && bound.indexOf('planned') >= 0 && bound.indexOf('done') >= 0;
})());
check('派生 ratio 成 IR 公式格（*=明细行、非 ds 绑定）', (function () {
  var detail = ir.sheets[0].blocks.filter(function (b) { return b.dataset === 'ds1'; })[0];
  var rate = detail.items.filter(function (i) { return i.formula; })[0];
  return !!rate && /=.*\*100\/.*/.test(rate.formula.replace(/\s/g, ''));
})());
check('总计块含 SUM(base) + ratio 引用总计行', (function () {
  var tot = ir.sheets[0].blocks.filter(function (b) { return b.items && b.items.some(function (i) { return i.text === '总计'; }); })[0];
  if (!tot) return false;
  var fm = tot.items.filter(function (i) { return i.formula; }).map(function (i) { return i.formula; });
  return fm.some(function (f) { return /SUM\(/.test(f); }) && fm.some(function (f) { return /\*100\//.test(f.replace(/\s/g, '')); });
})());
check('模型指标 format 流到 ratio 格（I5 子代理发现并修的展示层 gap）', (function () {
  var detail = ir.sheets[0].blocks.filter(function (b) { return b.dataset === 'ds1'; })[0];
  var rate = detail.items.filter(function (i) { return i.formula; })[0];
  return !!rate && rate.st && rate.st.format === '#,##0.00';
})());
check('sql IR 确定序 + 输入不可变', (function () {
  var snap = JSON.stringify(spec);
  var a = JSON.stringify(SpecCompiler.compile(spec, { model: model, SqlBuilder: SqlBuilder }));
  var b = JSON.stringify(SpecCompiler.compile(spec, { model: model, SqlBuilder: SqlBuilder }));
  return a === b && JSON.stringify(spec) === snap;
})());

// ===== 内嵌 rows 路逐字不破（opt-in 反证）=====
load(ROOT + '/reports/sales_demo.js');
var salesEmbedded = { specVersion: '1', outName: '销售明细', report: { name: SPEC.title }, dimensions: SPEC.columns.slice(0, 3).map(function (c) { return { field: c.name, label: c.label, widthPt: c.widthPt }; }), metrics: [{ field: SPEC.columns[3].name, label: SPEC.columns[3].label, aggregation: 'sum', widthPt: SPEC.columns[3].widthPt, format: SPEC.columns[3].format }], dataset: { rows: SPEC.data } };
var irEmb = SpecCompiler.compile(salesEmbedded);   // 无 deps、无 dataset.kind → 内嵌路
check('内嵌 rows 路仍编译出 title/header/detail/total 四块 IR', irEmb.sheets[0].blocks.map(function (b) { return b.type; }).join(',') === 'title,header,detail,total' && irEmb.datasets[0].rows === SPEC.data);
check('内嵌 IR 过 Ir.validate 0 err', Ir.validate(irEmb).length === 0);

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
