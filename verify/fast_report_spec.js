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

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
