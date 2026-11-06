// _ir_neg_selftest.js — 迭代 1 负测试第一层（无 FR 环境依赖，对齐用户"快速测试不绑引擎"方向）：
//   ① 源文件 parse 门：new Function 只编译不执行，SyntaxError 即炸；
//   ② validate 抗炸门：任意残缺/恶意 IR 必须返回诊断数组，validator 自身绝不抛异常；
//   ③ 新断言命中门：迭代 1 严格化（when 恰三选一/value 缺失/list 递归/then 白名单与类型/
//      scope/column 成员/highlight 形态）逐项期望诊断。
// 跑法：nashorn.jar 即可，不碰 FineDB、不占 FR 环境：
//   java -cp "<FR>/jre/lib/ext/nashorn.jar" jdk.nashorn.tools.Shell logs/_ir_neg_selftest.js
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
var JPaths = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(JPaths.get(ROOT + '/' + p)), 'UTF-8')); }

// ① parse 门（make_api.js 的 Nashorn 专有 API 只在运行期解析，编译期不碰 Java 类）
['lib/ir.js', 'make_api.js'].forEach(function (f) {
  var ok = true;
  try { new Function(src(f)); } catch (e) { ok = false; print('PARSE: ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});

load(ROOT + '/lib/ir.js');
function errsOf(ir) { try { return Ir.validate(ir); } catch (e) { FAILS++; print('VALIDATOR THREW: ' + e); return []; } }
// I0-01（r2）错误结构契约：validate 每项 = {code, path(JSON 路径), message}；etext 兼容旧串便于过渡断言
function etext(e) { return (e && typeof e === 'object') ? [e.code, e.path, e.message].join(' ') : String(e); }
function has(ir, frag) { return errsOf(ir).some(function (e) { return etext(e).indexOf(frag) >= 0; }); }
function codeAt(ir, code, path) {
  return errsOf(ir).some(function (e) { return e && e.code === code && e.path === path; });
}
function shapeOk(ir) {
  return errsOf(ir).every(function (e) {
    return e && typeof e === 'object' && typeof e.code === 'string' && typeof e.path === 'string' && typeof e.message === 'string';
  });
}

// ② 抗炸门：残缺输入全部要可读诊断，不许异常
[null, undefined, 42, 'str', [], {}, { sheets: null }, { sheets: [] }, { sheets: [null] },
  { sheets: [{}] }, { sheets: [{ blocks: [] }] }, { sheets: [{ blocks: [null] }] },
  { sheets: [{ blocks: [{ type: 'detail', dataset: 'x' }] }] },
  { sheets: [{ blocks: [{ type: 'cells', items: [null, {}, 7] }] }], datasets: 'notarray' },
  { sheets: [{ blocks: [{ type: 'title', text: 'a' }, { type: 'header', columns: null }, { type: 'detail', columns: [null] }] }], datasets: [null, {}] },
  { param: {} }, { param: { widgets: [null, { kind: 'nav' }, { kind: 'editor', x: 1 }] } },
  { toolbar: { buttons: [null, 'nosuch'] } }, { watermark: {} },
  { sheets: [{ blocks: [{ type: 'chart', kind: 'zzz', dataset: 'gone' }] }], datasets: [] },
  // I0-01 补：审计 jjs 实测坐实的 5+3 条「真值非数组」自炸路径（columns/items/sumCols/floats/
  //   param.filters/toolbar.buttons + chart.values/rows），修复前此处必须红（VALIDATOR THREW）。
  { sheets: [{ blocks: [{ type: 'detail', dataset: 'd', columns: {} }] }], datasets: [] },
  { sheets: [{ blocks: [{ type: 'cells', items: {} }] }], datasets: [] },
  { sheets: [{ blocks: [{ type: 'total', sumCols: 'x' }] }], datasets: [] },
  { sheets: [{ blocks: [{ type: 'title', text: 't', span: 1 }], floats: {} }], datasets: [] },
  { sheets: [{ blocks: [{ type: 'chart', kind: 'bar', dataset: 'd', category: 'c', values: 'x' }] }], datasets: [] },
  { sheets: [{ blocks: [{ type: 'title', text: 't', span: 1 }] }], datasets: [], param: { widgets: [{ kind: 'label', text: 'l', x: 0, y: 0, w: 1, h: 1 }], filters: 'x' } },
  { sheets: [{ blocks: [{ type: 'title', text: 't', span: 1 }] }], datasets: [], toolbar: { buttons: 'export' } },
  { sheets: [{ blocks: [{ type: 'title', text: 't', span: 1 }] }], datasets: [{ name: 'd', columns: [{ name: 'c', type: 'text' }], rows: 'x', params: 7 }] },
].forEach(function (bad, i) {
  var before = FAILS;
  var es = errsOf(bad);
  check('NO-THROW#' + i + ' -> ' + JSON.stringify(es).slice(0, 110), FAILS === before && Array.isArray(es));
});

// ②b 缺容器短路：记录即返回，不得再被 forEach 自炸（审计 P1-2 行为固化）；I0-01 起为结构化单条
var scErrs = errsOf({ datasets: [] });
check('short-circuit no sheets = 单条结构化 REQUIRED',
  JSON.stringify(scErrs) === '[{"code":"REQUIRED","path":"sheets","message":"no sheets"}]');
check('多 sheet 零误报（A1：object 每 sheet 独立游标）', errsOf({ sheets: [{ name: 's1', blocks: [{ type: 'cells', items: [{ c: 0, text: 'a' }] }] }, { name: 's2', blocks: [{ type: 'cells', items: [{ c: 0, text: 'b' }] }] }], datasets: [{ name: 'd', columns: [{ name: 'c', type: 'text' }], rows: [['x']] }] }).length === 0);

// ③ 迭代 1 新断言逐项命中（同一份最小 IR 上翻来覆去地坏）
var DS = [{ name: 'ds1', columns: [{ name: '机型', type: 'text' }, { name: 'score', type: 'number' }], rows: [['A', 1]] }];
function detIR(conds, hl, colsConds) {
  var col = { name: '机型', type: 'text' };
  if (colsConds) col.conditions = colsConds;
  return {
    sheets: [{ name: 's1', widthsPt: [100, 100], blocks: [
      { type: 'title', text: 't', span: 2, heightPt: 30 },
      { type: 'header', columns: [col], heightPt: 20 },
      { type: 'detail', dataset: 'ds1', columns: [col], heightPt: 20, conditions: conds, highlight: hl },
      { type: 'total', label: '合计', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 20 }
    ] }],
    datasets: DS
  };
}
check('when 混写=恰三选一', has(detIR([{ when: { formula: 'a>1', column: '机型', value: 'A' }, then: { bg: 1 } }]), 'exactly one'));
check('column 条件缺 value', has(detIR([{ when: { column: '机型' }, then: { bg: 1 } }]), 'needs value or formulaValue'));
check('formula 空白', has(detIR([{ when: { formula: '   ' }, then: { bg: 1 } }]), 'when.formula empty'));
check('list 子条件递归（JSON 路径 list[0]）', has(detIR([{ when: { list: [{ column: '机型', op: '<' }] }, then: { bg: 1 } }]), 'list[0]'));
check('list 空=缺三选一', has(detIR([{ when: { list: [] }, then: { bg: 1 } }]), 'when needs formula|column|list'));
check('then 未知 action', has(detIR([{ when: { formula: 'a>1' }, then: { bg: 1, 歪动作: 'x' } }]), 'unsupported action'));
check('then.page 类型', has(detIR([{ when: { formula: 'a>1' }, then: { page: '3' } }]), 'then.page must be number'));
check('then.sizePt 类型', has(detIR([{ when: { formula: 'a>1' }, then: { sizePt: 'big' } }]), 'then.sizePt must be number'));
check('scope 类型', has(detIR([{ when: { formula: 'a>1' }, then: { bg: 1 }, scope: '行' }]), 'scope must be number'));
check('op 非法', has(detIR([{ when: { column: '机型', op: '~', value: 'A' }, then: { bg: 1 } }]), 'unknown op ~'));
check('valueType=number 但值非数', has(detIR([{ when: { column: 'score', op: '<', value: 'x', valueType: 'number' }, then: { bg: 1 } }]), 'not a number'));
check('when.column 不在 DS 列', codeAt(detIR([{ when: { column: '幽灵列', op: '=', value: 'x' }, then: { bg: 1 } }]), 'UNKNOWN_REF', 'sheets[0].blocks[2].conditions[0].when.column'));
check('列级 conditions.column 不在 DS 列', codeAt(detIR(null, null, [{ when: { column: '幽灵列L', op: '=', value: 'x' }, then: { bg: 1 } }]), 'UNKNOWN_REF', 'sheets[0].blocks[2].columns[0].conditions[0].when.column'));
check('highlight 缺 value', has(detIR(null, { column: '机型', op: '=', bg: 1 }), 'highlight needs value'));
check('highlight 坏 op', has(detIR(null, { column: '机型', op: '@@', value: 'A', bg: 1 }), 'highlight unknown op'));
check('highlight.column 不在 DS 列', codeAt(detIR(null, { column: '幽灵列H', op: '=', value: 'A', bg: 1 }), 'UNKNOWN_REF', 'sheets[0].blocks[2].highlight.column'));
// 合法形态必须零误报（回归门不被新断言踩）
var okIR = detIR([
  { name: '优良', when: { column: 'score', op: '>=', value: 90, valueType: 'number' }, then: { bg: 0xE4F5E9, color: 0x1E7B34 } },
  { name: '偶行', when: { formula: 'row() % 2 == 0' }, then: { bg: 1 } },
  { name: '组', when: { list: [{ column: '机型', op: '==', value: 'A' }, { column: 'score', op: '>', formulaValue: '0' }] }, then: { bold: true, sizePt: 12 } }
], { column: 'score', op: '>=', value: 6000, bg: -8996 }, [{ when: { column: '机型', op: 'contains', value: 'A' }, then: { color: 1 } }]);
var okErrs = errsOf(okIR);
check('合法 IR 零误报（期望 []）' + (okErrs.length ? ' got: ' + okErrs.join(' ; ') : ''), okErrs.length === 0);

// ④ 迭代 2 契约：版本识别 / 拒未知版本 / compile 输入不可变+幂等 / 能力清单
function verErrs(ir) { return errsOf(ir).filter(function (s) { return s.indexOf('IR_VERSION') >= 0; }); }
check('irVersion 缺省视为当前版（不误报）', verErrs(okIR).length === 0);
check('irVersion=当前版不误报', verErrs({ irVersion: Ir.IR_VERSION, sheets: okIR.sheets, datasets: okIR.datasets }).length === 0);
check('irVersion 未知被拒', has({ irVersion: '99', sheets: [{ blocks: [] }] }, 'UNSUPPORTED_IR_VERSION'));
check('irVersion 未知短路（仅一条诊断）', errsOf({ irVersion: '2', sheets: [] }).length === 1);
// rawIR 直通：旧实现 extrasOut 直接向 spec.IR 挂属性=污染调用方；迭代 2 深拷贝后应绝不动输入
var specRaw = {
  IR: { sheets: [{ name: 's1', widthsPt: [100], blocks: [
    { type: 'title', text: 't', span: 1, heightPt: 30 },
    { type: 'header', columns: [{ name: 'a', type: 'text', widthPt: 100 }], heightPt: 20 },
    { type: 'detail', dataset: 'd', columns: [{ name: 'a', type: 'text' }], heightPt: 20 },
    { type: 'total', label: '合', span: 1, aggregate: { fn: 'sum', col: -1 }, heightPt: 20 }
  ] }], datasets: [{ name: 'd', columns: [{ name: 'a', type: 'text' }], rows: [['x']] }] },
  watermark: { text: 'WM' }, toolbar: { buttons: ['export'] }
};
var c1 = Ir.compile(specRaw), c2 = Ir.compile(specRaw);
check('compile 不改输入(rawIR 原对象无 watermark)', specRaw.IR.watermark == null);
check('compile 不改输入(rawIR 原对象无 toolbar)', specRaw.IR.toolbar == null);
check('compile 幂等（两次产物一致）', JSON.stringify(c1) === JSON.stringify(c2));
check('compile rawIR 注入 extrasOut 生效', c1.watermark && c1.watermark.text === 'WM' && c1.toolbar);
check('compile rawIR 补 irVersion', c1.irVersion === Ir.IR_VERSION);
// 默认 compile 路径：产物带版本、且不改输入 spec
var trad = { title: 'T', columns: [{ name: 'a', label: 'A', type: 'number', widthPt: 100 }], heightsPt: { title: 30, header: 20, row: 20, total: 20 }, data: [[1]] };
var tradIR = Ir.compile(trad);
check('默认 compile 带 irVersion', tradIR.irVersion === Ir.IR_VERSION);
check('默认 compile 不改输入 spec', trad.irVersion == null);
// 能力清单（机器读边界）
var cap = Ir.capabilities();
check('能力清单 irVersion 一致', cap.irVersion === Ir.IR_VERSION);
check('能力清单 singleSheet=supported', cap.sheet.singleSheet === 'supported');
check('能力清单 multiSheet=supported（A1）', cap.sheet.multiSheet === 'supported');
check('能力清单 reverseFromCpt=unsupported', cap.dataset.reverseFromCpt === 'unsupported');
check('能力清单列 type 词表=I0-05 定案（迭代 3 标注兑现）', (function () {
  var ct = Ir.capabilities().columnType;
  return ct.embedded.indexOf('decimal') >= 0 && ct.embedded.indexOf('long') >= 0 && ct.embedded.indexOf('date') >= 0 &&
    ct.embedded.indexOf('datetime') >= 0 && ct.embedded.indexOf('boolean') >= 0 &&
    String(ct.note).indexOf('probe_typemap') >= 0;
})());

// ===== ⑤ I0-01（r2.md）校验完整化批：数组闸/有限数/枚举/拒数组对象/必填/超链族/结构契约 =====
var BC = [{ name: '机型', type: 'text' }, { name: 'score', type: 'number' }];
function baseIR() {
  return {
    sheets: [{ name: 's1', widthsPt: [100, 100], blocks: [
      { type: 'title', text: 't', span: 2, heightPt: 30 },
      { type: 'header', columns: JSON.parse(JSON.stringify(BC)), heightPt: 20 },
      { type: 'detail', dataset: 'ds1', columns: JSON.parse(JSON.stringify(BC)), heightPt: 20 },
      { type: 'total', label: '合计', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 20 }
    ] }],
    datasets: [{ name: 'ds1', columns: JSON.parse(JSON.stringify(BC)), rows: [[('A'), 1]] }]
  };
}
function mut(f) { var ir = baseIR(); f(ir); return ir; }
check('基线 IR 零误报（新闸升级后）', errsOf(baseIR()).length === 0);
check('错误结构契约全项 {code,path,message}', shapeOk(mut(function (ir) { ir.sheets[0].blocks[2].columns = {}; ir.watermark = []; ir.sheets[0].floats = [{}]; })));
// INVALID_ARRAY：真值非数组必须诊断（此前 5 处自炸 TypeError，审计 jjs 坐实）
check('INVALID_ARRAY columns', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns = {}; }), 'INVALID_ARRAY', 'sheets[0].blocks[2].columns'));
check('INVALID_ARRAY items', codeAt(mut(function (ir) { ir.sheets[0].blocks = [{ type: 'cells', items: 'x' }]; }), 'INVALID_ARRAY', 'sheets[0].blocks[0].items'));
check('INVALID_ARRAY sumCols', codeAt(mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, sumCols: 3 }; }), 'INVALID_ARRAY', 'sheets[0].blocks[3].sumCols'));
check('INVALID_ARRAY floats', codeAt(mut(function (ir) { ir.sheets[0].floats = {}; }), 'INVALID_ARRAY', 'sheets[0].floats'));
check('INVALID_ARRAY chart.values', codeAt(mut(function (ir) { ir.sheets[0].blocks.push({ type: 'chart', kind: 'bar', dataset: 'ds1', category: '机型', values: 'x' }); }), 'INVALID_ARRAY', 'sheets[0].blocks[4].values'));
check('INVALID_ARRAY param.filters', codeAt(mut(function (ir) { ir.param = { widgets: [{ kind: 'label', text: 'l', x: 0, y: 0, w: 1, h: 1 }], filters: 'x' }; }), 'INVALID_ARRAY', 'param.filters'));
check('INVALID_ARRAY toolbar.buttons', codeAt(mut(function (ir) { ir.toolbar = { buttons: 'export' }; }), 'INVALID_ARRAY', 'toolbar.buttons'));
check('INVALID_ARRAY rows', codeAt(mut(function (ir) { ir.datasets[0].rows = 'x'; }), 'INVALID_ARRAY', 'datasets[0].rows'));
check('INVALID_ARRAY rows[0]', codeAt(mut(function (ir) { ir.datasets[0].rows = ['x']; }), 'INVALID_ARRAY', 'datasets[0].rows[0]'));
check('INVALID_ARRAY widthsPt', codeAt(mut(function (ir) { ir.sheets[0].widthsPt = {}; }), 'INVALID_ARRAY', 'sheets[0].widthsPt'));
check('INVALID_ARRAY ds.params', codeAt(mut(function (ir) { ir.datasets[0].params = 'x'; }), 'INVALID_ARRAY', 'datasets[0].params'));
// INVALID_NUMBER：NaN/Infinity 不得借 typeof==='number' 过关（此前全放行）
check('INVALID_NUMBER title.heightPt NaN', codeAt(mut(function (ir) { ir.sheets[0].blocks[0].heightPt = NaN; }), 'INVALID_NUMBER', 'sheets[0].blocks[0].heightPt'));
check('INVALID_NUMBER widthsPt[1] NaN', codeAt(mut(function (ir) { ir.sheets[0].widthsPt = [100, NaN]; }), 'INVALID_NUMBER', 'sheets[0].widthsPt[1]'));
check('INVALID_NUMBER then.page Infinity', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { page: Infinity } }]; }), 'INVALID_NUMBER', 'sheets[0].blocks[2].conditions[0].then.page'));
check('INVALID_NUMBER floats.leftPt NaN', codeAt(mut(function (ir) { ir.sheets[0].floats = [{ leftPt: NaN, text: 'f' }]; }), 'INVALID_NUMBER', 'sheets[0].floats[0].leftPt'));
check('INVALID_NUMBER param.widgets[0].x Infinity', codeAt(mut(function (ir) { ir.param = { widgets: [{ kind: 'editor', name: 'p', x: Infinity, y: 0, w: 1, h: 1 }] }; }), 'INVALID_NUMBER', 'param.widgets[0].x'));
check('INVALID_NUMBER cond.scope NaN', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { bg: 1 }, scope: NaN }]; }), 'INVALID_NUMBER', 'sheets[0].blocks[2].conditions[0].scope'));
// INVALID_ENUM：白名单缺口（block.type / aggregate.fn / dataset.kind）
check('INVALID_ENUM 未知 block.type', codeAt(mut(function (ir) { ir.sheets[0].blocks[0].type = 'garbage'; }), 'INVALID_ENUM', 'sheets[0].blocks[0].type'));
check('INVALID_ENUM aggregate.fn（后端硬编码只 =SUM）', codeAt(mut(function (ir) { ir.sheets[0].blocks[3].aggregate.fn = 'median'; }), 'INVALID_ENUM', 'sheets[0].blocks[3].aggregate.fn'));
check('INVALID_ENUM dataset.kind', codeAt(mut(function (ir) { ir.datasets[0].kind = 'oracle'; }), 'INVALID_ENUM', 'datasets[0].kind'));
check('合法 block.type=space 零误报（object.js case space 实证）', errsOf(mut(function (ir) { ir.sheets[0].blocks.splice(3, 0, { type: 'space', heightPt: 12 }); })).length === 0);
// INVALID_TYPE：对象字段拒数组/标量
check('INVALID_TYPE watermark=[]', codeAt(mut(function (ir) { ir.watermark = ['a']; }), 'INVALID_TYPE', 'watermark'));
check('INVALID_TYPE toolbar=[]', codeAt(mut(function (ir) { ir.toolbar = []; }), 'INVALID_TYPE', 'toolbar'));
check('INVALID_TYPE param=[]', codeAt(mut(function (ir) { ir.param = []; }), 'INVALID_TYPE', 'param'));
check('INVALID_TYPE highlight=[]', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].highlight = []; }), 'INVALID_TYPE', 'sheets[0].blocks[2].highlight'));
check('INVALID_TYPE link=[]', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = []; }), 'INVALID_TYPE', 'sheets[0].blocks[2].link'));
check('INVALID_TYPE it.st="nope"', codeAt(mut(function (ir) { ir.sheets[0].blocks = [{ type: 'cells', items: [{ c: 0, text: 'a', st: 'nope' }] }]; }), 'INVALID_TYPE', 'sheets[0].blocks[0].items[0].st'));
// REQUIRED：必填字段补洞（此前静默放行，object 层才炸或更糟——静默产坏报表）
check('REQUIRED title.text', codeAt(mut(function (ir) { delete ir.sheets[0].blocks[0].text; }), 'REQUIRED', 'sheets[0].blocks[0].text'));
check('REQUIRED title.span', codeAt(mut(function (ir) { delete ir.sheets[0].blocks[0].span; }), 'REQUIRED', 'sheets[0].blocks[0].span'));
check('REQUIRED total.aggregate|sumCols 二选一', codeAt(mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, heightPt: 20 }; }), 'REQUIRED', 'sheets[0].blocks[3].aggregate'));
check('REQUIRED detail.dataset', codeAt(mut(function (ir) { delete ir.sheets[0].blocks[2].dataset; }), 'REQUIRED', 'sheets[0].blocks[2].dataset'));
check('REQUIRED column.name 非空（detail 绑定列）', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns = [{ type: 'text' }, BC[1]]; }), 'REQUIRED', 'sheets[0].blocks[2].columns[0].name'));
check('header label-only 零误报（官方重建形态 rebuild_first 实证）', errsOf(mut(function (ir) { ir.sheets[0].blocks[1].columns = [{ label: 'A' }, { label: 'B' }]; })).length === 0);
check('REQUIRED dataset.name', codeAt(mut(function (ir) { delete ir.datasets[0].name; }), 'REQUIRED', 'datasets[0].name'));
check('DUPLICATE dataset.name', codeAt(mut(function (ir) { ir.datasets.push({ name: 'ds1', columns: BC, rows: [] }); }), 'DUPLICATE', 'datasets[1].name'));
check('INVALID_SHAPE rows 宽度≠columns 数', codeAt(mut(function (ir) { ir.datasets[0].rows = [['A']]; }), 'INVALID_SHAPE', 'datasets[0].rows[0]'));
// 超链族：reportlet 路径闸（isRelUrl 同规 + 禁 ..）/ targetFrame 白名单 / params 形态
check('INVALID_URL reportlet 绝对 scheme', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'http://evil/x.cpt' }; }), 'INVALID_URL', 'sheets[0].blocks[2].link.reportlet'));
check('INVALID_URL reportlet .. 穿越', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: '../secret.cpt' }; }), 'INVALID_URL', 'sheets[0].blocks[2].link.reportlet'));
check('合法 reportlet 子目录/根路径零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'drill/激光钻取_api.cpt' }; })).length === 0);
check('INVALID_TARGET targetFrame 坏', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', targetFrame: 'bad<fr >' }; }), 'INVALID_TARGET', 'sheets[0].blocks[2].link.targetFrame'));
check('合法 targetFrame=_self 零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', targetFrame: '_self' }; })).length === 0);
check('REQUIRED link.params[].name', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', params: [{ value: '1' }] }; }), 'REQUIRED', 'sheets[0].blocks[2].link.params[0].name'));
check('REQUIRED ds.params[].name', codeAt(mut(function (ir) { ir.datasets[0].params = [{ formula: '=$$$' }]; }), 'REQUIRED', 'datasets[0].params[0].name'));
check('合法 ds.params 零误报（drill 实形）', errsOf(mut(function (ir) { ir.datasets[0].params = [{ name: 'day', value: '2026-09-13' }]; })).length === 0);
check('UNKNOWN_REF 未知 dataset 引用仍命中', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].dataset = 'ghost'; }), 'UNKNOWN_REF', 'sheets[0].blocks[2].dataset'));
// ===== 批A（2026-11-04）条件动作满血：then 增 value/border/link/widget（官方 717/19/7/1）=====
//   探针依据：probe_hla2（4 action ctors）+ probe_hla2b（CellBorderStyle set ö Style/Color）+ 官方 XML 四样本。
check('批A then.value 串零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { value: '低' } }]; })).length === 0);
check('批A then.value{formula} 零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { column: '机型', value: 'A' }, then: { value: { formula: '=IF(A3>50,"高","低")' } } }]; })).length === 0);
check('批A then.value 数字=INVALID_TYPE', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { value: 3 } }]; }), 'INVALID_TYPE', 'sheets[0].blocks[2].conditions[0].then.value'));
check('批A then.value Unknown 键', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { value: { formula: '=1', x: 1 } } }]; }), 'INVALID_ENUM', 'sheets[0].blocks[2].conditions[0].then.value'));
check('批A then.value{formula 缺}', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { value: {} } }]; }), 'REQUIRED', 'sheets[0].blocks[2].conditions[0].then.value.formula'));
check('批A then.border 合法零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { column: 'score', value: 59, valueType: 'number' }, then: { border: { bottom: { line: 2, color: -9721345 } } } }]; })).length === 0);
check('批A then.border 四边混合零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { border: { top: { line: 0 }, bottom: { line: 2, color: -1 }, left: { line: 0 }, right: { line: 0 } } } }]; })).length === 0);
check('批A then.border 未知边', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { border: { topn: { line: 1 } } } }]; }), 'INVALID_ENUM', 'sheets[0].blocks[2].conditions[0].then.border'));
check('批A then.border 无边', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { border: {} } }]; }), 'REQUIRED', 'sheets[0].blocks[2].conditions[0].then.border'));
check('批A then.border line 缺', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { border: { top: {} } } }]; }), 'REQUIRED', 'sheets[0].blocks[2].conditions[0].then.border.top.line'));
check('批A then.border line 串', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { border: { top: { line: 'thin' } } } }]; }), 'INVALID_NUMBER', 'sheets[0].blocks[2].conditions[0].then.border.top.line'));
check('批A then.border line 6 越界', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { border: { top: { line: 6, color: -1 } } } }]; }), 'INVALID_NUMBER', 'sheets[0].blocks[2].conditions[0].then.border.top.line'));
check('批A then.border color 串', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { border: { top: { line: 1, color: 'blue' } } } }]; }), 'INVALID_TYPE', 'sheets[0].blocks[2].conditions[0].then.border.top.color'));
check('批A then.link reportlet 零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { link: { reportlet: 'fineagent/sub1_api.cpt', name: '看' } } }]; })).length === 0);
check('批A then.link web 相对零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { link: { web: { url: '/webroot/decision/view/report?viewlet=x' } } } }]; })).length === 0);
check('批A then.link .. 穿越', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { link: { reportlet: '../x.cpt' } } }]; }), 'INVALID_URL', 'sheets[0].blocks[2].conditions[0].then.link.reportlet'));
check('批A then.link 空对象', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { link: {} } }]; }), 'REQUIRED', 'sheets[0].blocks[2].conditions[0].then.link'));
check('批A then.widget editor 零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].conditions = [{ when: { formula: 'a' }, then: { widget: { kind: 'editor', name: '备注框', value: '待录入' } } }]; })).length === 0);
check('批A then.widget number 零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].conditions = [{ when: { formula: 'a' }, then: { widget: { kind: 'number', value: 20 } } }]; })).length === 0);
check('批A then.widget 缺 kind', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].conditions = [{ when: { formula: 'a' }, then: { widget: {} } }]; }), 'REQUIRED', 'sheets[0].blocks[2].columns[0].conditions[0].then.widget.kind'));
check('批A then.widget 非法 kind', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].conditions = [{ when: { formula: 'a' }, then: { widget: { kind: 'label' } } }]; }), 'INVALID_ENUM', 'sheets[0].blocks[2].columns[0].conditions[0].then.widget.kind'));
check('批A then.widget value 非串/数', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].conditions = [{ when: { formula: 'a' }, then: { widget: { kind: 'editor', value: true } } }]; }), 'INVALID_TYPE', 'sheets[0].blocks[2].columns[0].conditions[0].then.widget.value'));
check('批A then.widget 非对象', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].conditions = [{ when: { formula: 'a' }, then: { widget: 'editor' } }]; }), 'INVALID_TYPE', 'sheets[0].blocks[2].columns[0].conditions[0].then.widget'));
// ===== 批B（2026-11-04）图表装饰层：tooltip/label/marker/lineStyle/trend/stack + alpha/bg/border/conditions/unit =====
//   探针依据 probe_chartdeco/2/3（挂接=ConditionCollection；枚举一手）+ 官方 DataVisualization.cpt 条件集形态。
function chartIR(k, extra) {
  var blk = { type: 'chart', kind: k, dataset: 'd', category: '机型', values: ['产量'], heightPt: 210 };
  if (extra) Object.keys(extra).forEach(function (ek) { blk[ek] = extra[ek]; });
  return { sheets: [{ name: 's1', widthsPt: [220], blocks: [
    { type: 'cells', heightPt: 30, items: [{ c: 0, text: 'x' }] },
    blk
  ] }], datasets: [{ name: 'd', columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }], rows: [['A', 1]] }] };
}
check('批B V图全装饰零误报', errsOf(chartIR('vbar', {
  tooltip: { muti: false, formats: { series: true, value: '#,##0', percent: true } },
  label: { enable: true, position: 2 },
  marker: { type: 'circle', radius: 5, common: true },
  lineStyle: { type: 'dashed', style: 'curve', width: 2 },
  trend: { type: 'linear', name: 'T', pre: 2, after: 2 },
  stack: { stacked: true, stackId: 'S' },
  conditions: [{ when: { column: '产量', op: '>', value: 150, valueType: 'number' }, then: { seriesColor: 0xD0392E } }],
  alpha: 0.5, bg: 0xFFFFFF, border: { color: -1, style: 1 }, axisY: { min: 0, max: 260, unit: 50 }
})).length === 0);
check('批B legacy 拒装饰', codeAt(chartIR('bar', { tooltip: {} }), 'INVALID_SHAPE', 'sheets[0].blocks[1].tooltip'));
check('批B legacy 拒 chart 条件', codeAt(chartIR('pie', { conditions: [{ when: { formula: 'a' }, then: { seriesColor: 1 } }] }), 'INVALID_SHAPE', 'sheets[0].blocks[1].conditions'));
check('批B marker 非白名单', codeAt(chartIR('vline', { marker: { type: 'star2' } }), 'INVALID_ENUM', 'sheets[0].blocks[1].marker.type'));
check('批B lineStyle type 非白名单', codeAt(chartIR('vline', { lineStyle: { type: 'wavy' } }), 'INVALID_ENUM', 'sheets[0].blocks[1].lineStyle.type'));
check('批B lineStyle style 非白名单', codeAt(chartIR('vline', { lineStyle: { style: 'zigzag' } }), 'INVALID_ENUM', 'sheets[0].blocks[1].lineStyle.style'));
check('批B trend type 非白名单', codeAt(chartIR('vline', { trend: { type: 'magic' } }), 'INVALID_ENUM', 'sheets[0].blocks[1].trend.type'));
check('批B trend 缺 type', codeAt(chartIR('vline', { trend: { name: 'T' } }), 'REQUIRED', 'sheets[0].blocks[1].trend.type'));
check('批B alpha 越界', codeAt(chartIR('vbar', { alpha: 2 }), 'INVALID_NUMBER', 'sheets[0].blocks[1].alpha'));
check('批B tooltip formats 未知键', codeAt(chartIR('vbar', { tooltip: { formats: { bogus: true } } }), 'INVALID_ENUM', 'sheets[0].blocks[1].tooltip.formats.bogus'));
check('批B tooltip formats 数字', codeAt(chartIR('vbar', { tooltip: { formats: { value: 42 } } }), 'INVALID_TYPE', 'sheets[0].blocks[1].tooltip.formats.value'));
check('批B stack 仅 vbar/varea', codeAt(chartIR('vline', { stack: { stacked: true } }), 'INVALID_SHAPE', 'sheets[0].blocks[1].stack'));
check('批B cond then 键白名单', codeAt(chartIR('vbar', { conditions: [{ when: { formula: 'a' }, then: { bg: 1 } }] }), 'INVALID_ENUM', 'sheets[0].blocks[1].conditions[0].then.bg'));
check('批B cond alpha 越界', codeAt(chartIR('vbar', { conditions: [{ when: { formula: 'a' }, then: { alpha: 1.5 } }] }), 'INVALID_NUMBER', 'sheets[0].blocks[1].conditions[0].then.alpha'));
check('批B axisY.unit 缺加成（老键不受扰）', errsOf(chartIR('vbar', { axisY: { min: 0, max: 100 } })).length === 0);
// ===== 审查轮1（2026-11-06）P2：spec 白名单键的 IR 闸 =====
check('审查1 legend 未知键拒', codeAt(chartIR('vbar', { legend: { magic: 1 } }), 'INVALID_ENUM', 'sheets[0].blocks[1].legend.magic'));
check('审查1 legend position 非数拒', codeAt(chartIR('vbar', { legend: { position: 'x' } }), 'INVALID_NUMBER', 'sheets[0].blocks[1].legend.position'));
check('审查1 legend 合法零误报', errsOf(chartIR('vbar', { legend: { fontPt: 10, color: 0x333333, position: 1, visible: true, bold: true } })).length === 0);
check('审查1 barInterval 非数拒', codeAt(chartIR('vbar', { barInterval: '0.5' }), 'INVALID_NUMBER', 'sheets[0].blocks[1].barInterval'));
check('审查1 sheet 缺名拒', codeAt(mut(function (ir) { delete ir.sheets[0].name; }), 'REQUIRED', 'sheets[0].name'));
check('审查1 sheet 重名拒', codeAt(mut(function (ir) { ir.sheets.push(JSON.parse(JSON.stringify(ir.sheets[0]))); }), 'DUPLICATE', 'sheets[1].name'));
check('审查2 sheet 名 __proto__ 重复拒', codeAt(mut(function (ir) { ir.sheets[0].name = '__proto__'; ir.sheets.push(JSON.parse(JSON.stringify(ir.sheets[0]))); }), 'DUPLICATE', 'sheets[1].name'));
check('审查1 paper 非数拒', codeAt(mut(function (ir) { ir.sheets[0].paper = { width: 'x', height: 100, top: 0, left: 0, bottom: 0, right: 0 }; }), 'INVALID_NUMBER', 'sheets[0].paper.width'));
check('审查1 hideRows 非整数拒', codeAt(mut(function (ir) { ir.sheets[0].hideRows = [1.5]; }), 'INVALID_NUMBER', 'sheets[0].hideRows[0]'));
check('审查1 hideRows/hideCols 合法零误报', errsOf(mut(function (ir) { ir.sheets[0].hideRows = [1]; ir.sheets[0].hideCols = [0]; })).length === 0);
check('审查1 多 sheet + write 拒', codeAt(mut(function (ir) {
  ir.sheets.push({ name: 's2', blocks: [{ type: 'cells', heightPt: 20, items: [{ c: 0, text: 'y' }] }] });
  ir.write = { table: { name: 't' }, columns: [{ name: 'c', cell: [0, 0] }] };
}), 'UNSUPPORTED_CAPABILITY', 'write'));
check('审查1 vscatter 缺 x/y 拒', codeAt(chartIR('vscatter', {}), 'REQUIRED', 'sheets[0].blocks[1]'));
// 审查轮2：sumCols col0（与合计 label 同格）与 legacy barInterval（无 legend 会被 object 丢）都要拒
check('审查2 sumCols col0 拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, sumCols: [{ col: 0 }] }; }), 'UNSUPPORTED_CAPABILITY', 'sheets[0].blocks[3].sumCols[0].col'));
check('审查2 legacy barInterval 无 legend 拒', codeAt(chartIR('bar', { barInterval: 0.5 }), 'INVALID_SHAPE', 'sheets[0].blocks[1].barInterval'));
check('审查2 legacy barInterval 带 legend 零误报', errsOf(chartIR('bar', { barInterval: 0.5, legend: { position: 1 } })).length === 0);
// ===== 2026-11-06 P1：合计行非 sum 聚合（IR aggregate.fn + sumCols.fn） =====
function totalIR(agg) { return mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, aggregate: agg }; }); }
check('P1 aggregate avg 零误报', errsOf(totalIR({ fn: 'avg', col: 1 })).length === 0);
check('P1 aggregate count/min/max 零误报', errsOf(totalIR({ fn: 'count', col: 1 })).length === 0 && errsOf(totalIR({ fn: 'min', col: 1 })).length === 0 && errsOf(totalIR({ fn: 'max', col: 1 })).length === 0);
check('P1 aggregate ratio 零误报', errsOf(totalIR({ fn: 'ratio', num: 1, den: 1 })).length === 0);
check('P1 aggregate 未知 fn 拒', codeAt(totalIR({ fn: 'magic', col: 1 }), 'INVALID_ENUM', 'sheets[0].blocks[3].aggregate.fn'));
check('P1 aggregate ratio 缺 den 拒', codeAt(totalIR({ fn: 'ratio', num: 1 }), 'REQUIRED', 'sheets[0].blocks[3].aggregate.den'));
check('P1 aggregate col 0 拒（label 格）', codeAt(totalIR({ fn: 'sum', col: 0 }), 'UNSUPPORTED_CAPABILITY', 'sheets[0].blocks[3].aggregate.col'));
check('P1 aggregate col 小数拒', codeAt(totalIR({ fn: 'sum', col: 1.5 }), 'INVALID_NUMBER', 'sheets[0].blocks[3].aggregate.col'));
check('P1 aggregate col 越界拒（>25）', codeAt(totalIR({ fn: 'sum', col: 26 }), 'INVALID_NUMBER', 'sheets[0].blocks[3].aggregate.col'));
check('P1 aggregate.format 非串拒', codeAt(totalIR({ fn: 'avg', col: 1, format: 5 }), 'INVALID_TYPE', 'sheets[0].blocks[3].aggregate.format'));
check('审2 aggregate 未知键拒', codeAt(totalIR({ fn: 'sum', col: 1, fromat: '0.0' }), 'UNSUPPORTED_CAPABILITY', 'sheets[0].blocks[3].aggregate.fromat'));
check('审2 ratio 不用 col', codeAt(totalIR({ fn: 'ratio', num: 1, den: 1, col: 1 }), 'UNSUPPORTED_CAPABILITY', 'sheets[0].blocks[3].aggregate.col'));
check('审2 非 ratio 不用 num', codeAt(totalIR({ fn: 'sum', col: 1, num: 1 }), 'UNSUPPORTED_CAPABILITY', 'sheets[0].blocks[3].aggregate.num'));
check('P1 sumCols fn 合法零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, sumCols: [{ col: 1, fn: 'avg' }] }; })).length === 0);
check('P1 sumCols fn 越词表拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, sumCols: [{ col: 1, fn: 'ratio' }] }; }), 'INVALID_ENUM', 'sheets[0].blocks[3].sumCols[0].fn'));
check('P1 sumCols 重复列拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, sumCols: [{ col: 1, fn: 'avg' }, { col: 1, fn: 'count' }] }; }), 'DUPLICATE', 'sheets[0].blocks[3].sumCols[1].col'));
check('P1 sumCols fn+formula 互斥拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, sumCols: [{ col: 1, fn: 'avg', formula: '=SUM(B3)' }] }; }), 'UNSUPPORTED_CAPABILITY', 'sheets[0].blocks[3].sumCols[0]'));
check('P1 sumCols+aggregate 互斥拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[3] = { type: 'total', label: 'T', span: 1, sumCols: [{ col: 1 }], aggregate: { fn: 'sum', col: 1 } }; }), 'UNSUPPORTED_CAPABILITY', 'sheets[0].blocks[3]'));
// ===== 批C（2026-11-05）页眉页脚 + 模板级 attrMark =====
//   探针依据 probe_pagehf/_hf7/9（sheet.setHeader/setFooter(int,ReportHF)；裸 classpath 撞 license 墙、env 后可用）。
function hfIR(hf, extra) {
  var ir = { sheets: [{ name: 's1', widthsPt: [120], blocks: [
    { type: 'cells', heightPt: 30, items: [{ c: 0, text: 'x' }] }
  ] }], datasets: [{ name: 'd', columns: [{ name: 'v', type: 'text' }], rows: [['a']] }] };
  if (hf) ir.sheets[0].headerFooter = hf;
  if (extra) Object.keys(extra).forEach(function (k) { ir[k] = extra[k]; });
  return ir;
}
check('批C headerFooter 全形零误报', errsOf(hfIR({
  header: { center: [{ text: '页眉', fontPt: 10, bold: true }], bg: 0xEEF3FA },
  footer: { center: [{ formula: '"第" + $$page_number + "页"', fontPt: 9 }, { date: 'yyyy-MM-dd', newLine: true }], right: [{ text: 'fineagent' }] }
})).length === 0);
check('批C pageNumber/totalPages 零误报', errsOf(hfIR({ footer: { center: [{ pageNumber: true }, { totalPages: true }] } })).length === 0);
check('批C 空 headerFooter 拒', codeAt(hfIR({}), 'REQUIRED', 'sheets[0].headerFooter'));
check('批C side 空三列拒', codeAt(hfIR({ header: {} }), 'REQUIRED', 'sheets[0].headerFooter.header'));
check('批C 元素双键拒', codeAt(hfIR({ footer: { center: [{ text: 'a', formula: '=1' }] } }), 'INVALID_TYPE', 'sheets[0].headerFooter.footer.center[0]'));
check('批C 元素全空拒', codeAt(hfIR({ footer: { center: [{ fontPt: 9 }] } }), 'REQUIRED', 'sheets[0].headerFooter.footer.center[0]'));
check('批C text 非串拒', codeAt(hfIR({ footer: { left: [{ text: 3 }] } }), 'INVALID_TYPE', 'sheets[0].headerFooter.footer.left[0].text'));
check('批C list 空数组拒', codeAt(hfIR({ footer: { center: [] } }), 'INVALID_ARRAY', 'sheets[0].headerFooter.footer.center'));
check('批C templateId 非串拒', codeAt(hfIR(null, { templateId: 42 }), 'INVALID_TYPE', 'templateId'));
check('批C templateId 合法零误报', errsOf(hfIR(null, { templateId: 'b7e3f2a1' })).length === 0);
check('批C templateTheme 缺 name 拒', codeAt(hfIR(null, { templateTheme: { dark: false } }), 'REQUIRED', 'templateTheme.name'));
check('批C templateTheme 全形零误报', errsOf(hfIR(null, { templateTheme: { name: '兼容主题', dark: false } })).length === 0);
check('批C templateTheme dark 非布拒', codeAt(hfIR(null, { templateTheme: { name: 'x', dark: 'yes' } }), 'INVALID_TYPE', 'templateTheme.dark'));
// ===== 批D（2026-11-05）字典三形态 + 日期/文本列格式 =====
function dictColIR(dict) {
  var col = { name: '机型', type: 'text' };
  if (dict) col.dict = dict;
  return { sheets: [{ name: 's1', widthsPt: [120], blocks: [
    { type: 'title', text: 't', span: 1, heightPt: 30 },
    { type: 'header', columns: [col], heightPt: 20 },
    { type: 'detail', dataset: 'd', columns: [col], heightPt: 20 }
  ] }], datasets: [{ name: 'd', columns: [{ name: '机型', type: 'text' }], rows: [['A']] }] };
}
check('批D dict custom map 零误报', errsOf(dictColIR({ A: '合格', B: '返修' })).length === 0);
check('批D dict tableData 零误报', errsOf(dictColIR({ tableData: { ds: 'd', keyIdx: 0, valIdx: 0 } })).length === 0);
check('批D dict tableData 缺 ds 拒', codeAt(dictColIR({ tableData: { keyIdx: 0 } }), 'REQUIRED', 'sheets[0].blocks[2].columns[0].dict.tableData.ds'));
check('批D dict tableData 键 idx 非数拒', codeAt(dictColIR({ tableData: { ds: 'd', keyIdx: 'x' } }), 'INVALID_NUMBER', 'sheets[0].blocks[2].columns[0].dict.tableData.keyIdx'));
check('批D dict formula 零误报', errsOf(dictColIR({ formula: '=CONCATENATE(机型, "-档")' })).length === 0);
check('批D dict formula 非串拒', codeAt(dictColIR({ formula: 7 }), 'INVALID_TYPE', 'sheets[0].blocks[2].columns[0].dict.formula'));
check('批D dict 混形态拒', codeAt(dictColIR({ formula: '=1', tableData: { ds: 'd' } }), 'INVALID_ENUM', 'sheets[0].blocks[2].columns[0].dict.formula'));
check('批D dict 空对象拒', codeAt(dictColIR({}), 'INVALID_TYPE', 'sheets[0].blocks[2].columns[0].dict'));
// ===== 批E（2026-11-05）事件 JS 体系：linkTo.js/参数回填 + dialog 弹窗 + width/height/title =====
check('批E linkTo js/dialog 全形零误报', errsOf(mut(function (ir) {
  ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', title: '看',
    width: 800, height: 500, dialog: { title: '钻取窗', center: true, left: 100, top: 50 },
    js: [{ name: '回填', recalc: true, params: [{ name: 'p1', formula: '=$$$' }, { name: 'p2', value: 'x' }] }] };
})).length === 0);
check('批E dialog 未知键拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', dialog: { zoom: true } }; }), 'INVALID_ENUM', 'sheets[0].blocks[2].link.dialog.zoom'));
check('批E dialog center 非布拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', dialog: { center: 'yes' } }; }), 'INVALID_TYPE', 'sheets[0].blocks[2].link.dialog.center'));
check('批E width 非数拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', width: 'wide' }; }), 'INVALID_NUMBER', 'sheets[0].blocks[2].link.width'));
check('批E js 缺 params.name 拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', js: [{ params: [{ value: 1 }] }] }; }), 'REQUIRED', 'sheets[0].blocks[2].link.js[0].params[0].name'));
check('批E js.recalc 非布拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].link = { by: '机型', reportlet: 'a.cpt', js: [{ recalc: 1 }] }; }), 'INVALID_TYPE', 'sheets[0].blocks[2].link.js[0].recalc'));
check('批E then.link 同享 js/dialog 闸', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].conditions = [{ when: { formula: 'a' }, then: { link: { reportlet: 'a.cpt', dialog: { bad: 1 } } } }]; }), 'INVALID_ENUM', 'sheets[0].blocks[2].conditions[0].then.link.dialog.bad'));
// ===== 批F（2026-11-05）填报章：IR.write 结构闸 + 编辑器 reg + write 工具栏按钮族 =====
function writeIR(write) {
  var ir = mut(function (ir) { ir.write = write; });
  return ir;
}
check('批F write 全形零误报', errsOf(writeIR({ name: 'S1', connection: 'ATOM_LIVE', table: { schema: '', name: 't1' }, columns: [{ name: '月份', isKey: true, cell: [0, 2] }, { name: '数量', cell: [1, 2] }], })).length === 0);
check('批F write 缺 table.name 拒', codeAt(writeIR({ columns: [{ name: 'a', cell: [0, 2] }] }), 'REQUIRED', 'write.table.name'));
check('批F write 缺 columns 拒', codeAt(writeIR({ table: { name: 't1' } }), 'REQUIRED', 'write.columns'));
check('批F write column 缺 cell 拒', codeAt(writeIR({ table: { name: 't1' }, columns: [{ name: 'a' }] }), 'REQUIRED', 'write.columns[0].cell'));
check('批F write cell 非二元拒', codeAt(writeIR({ table: { name: 't1' }, columns: [{ name: 'a', cell: [0] }] }), 'REQUIRED', 'write.columns[0].cell'));
check('批F write verifiers 结构化拒（一处真相）', codeAt(writeIR({ table: { name: 't1' }, columns: [{ name: 'a', cell: [0, 2] }], verifiers: [{ formula: '1>0', message: 'x' }] }), 'UNSUPPORTED_CAPABILITY', 'write.verifiers'));
check('批F widget reg 白名单串零误报', errsOf(mut(function (ir) { ir.param = { widgets: [{ kind: 'editor', name: 'p', reg: 'phone', x: 0, y: 0, w: 1, h: 1 }] }; })).length === 0);
check('批F widget reg 白名单外拒', codeAt(mut(function (ir) { ir.param = { widgets: [{ kind: 'editor', name: 'p', reg: 'zip', x: 0, y: 0, w: 1, h: 1 }] }; }), 'INVALID_ENUM', 'param.widgets[0].reg'));
check('批F widget reg custom 缺正则拒', codeAt(mut(function (ir) { ir.param = { widgets: [{ kind: 'editor', name: 'p', reg: { err: 'x' }, x: 0, y: 0, w: 1, h: 1 }] }; }), 'REQUIRED', 'param.widgets[0].reg.custom'));
check('批F widget reg custom 全形零误报', errsOf(mut(function (ir) { ir.param = { widgets: [{ kind: 'editor', name: 'p', reg: { custom: '^.{1,3}$', err: 'x' }, x: 0, y: 0, w: 1, h: 1 }] }; })).length === 0);
check('批F toolbar write 按钮零误报', errsOf(mut(function (ir) { ir.toolbar = { buttons: ['submit', 'appendRow', 'deleteRow', 'showCellValue', 'appendColumnRow'] }; })).length === 0);
check('批F toolbar 未知键仍拒', codeAt(mut(function (ir) { ir.toolbar = { buttons: ['magicBtn'] }; }), 'INVALID_ENUM', 'toolbar.buttons[0]'));
// ===== 批G（2026-11-05）小特性：条码/子报表/自定义分组 =====
check('批G barcode 全形零误报', errsOf(mut(function (ir) {
  ir.sheets[0].blocks = [{ type: 'cells', items: [{ c: 0, text: 'FA001', barcode: { type: 1, barHeight: 40, barWidth: 1.5, drawingText: true } }] }];
})).length === 0);
check('批G barcode type 非数拒', codeAt(mut(function (ir) { ir.sheets[0].blocks = [{ type: 'cells', items: [{ c: 0, text: 'x', barcode: { type: 'qr' } }] }]; }), 'INVALID_NUMBER', 'sheets[0].blocks[0].items[0].barcode.type'));
check('批G barcode 未知键拒', codeAt(mut(function (ir) { ir.sheets[0].blocks = [{ type: 'cells', items: [{ c: 0, text: 'x', barcode: { color: 1 } }] }]; }), 'INVALID_ENUM', 'sheets[0].blocks[0].items[0].barcode.color'));
check('批G subreport 零误报', errsOf(mut(function (ir) {
  ir.sheets[0].blocks = [{ type: 'cells', items: [{ c: 0, subreport: 'fineagent/销售明细_api.cpt' }] }];
})).length === 0);
check('批G subreport 非串拒', codeAt(mut(function (ir) { ir.sheets[0].blocks = [{ type: 'cells', items: [{ c: 0, subreport: 7 }] }]; }), 'INVALID_TYPE', 'sheets[0].blocks[0].items[0].subreport'));
check('批G groupCustom 全形零误报', errsOf(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].groupCustom = { other: 1, otherDisplay: '其他', more: true, force: true }; })).length === 0);
check('批G groupCustom 未知键拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].groupCustom = { bogus: 1 }; }), 'INVALID_ENUM', 'sheets[0].blocks[2].columns[0].groupCustom.bogus'));
check('批G groupCustom other 非数拒', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns[0].groupCustom = { other: 'x' }; }), 'INVALID_NUMBER', 'sheets[0].blocks[2].columns[0].groupCustom.other'));
// ===== 批H（2026-11-05）单元格排序（license 墙 env 后已破；setSortFormula v1 通路） =====
check('批H sort 结构化拒（一处真相：墙破缺语料不盲写）', codeAt(mut(function (ir) { ir.sheets[0].blocks[2].columns[1].sort = { formula: '=-C3' }; }), 'UNSUPPORTED_CAPABILITY', 'sheets[0].blocks[2].columns[1].sort'));


// ===== 审查轮2（2026-11-06）P1-A/P1-B 契约负例：ir 放行必须 object 真消费，不许静默丢 =====
// P1-A：label.summary 无论 true/{format}，非 vpie 一律结构化拒
check('P1-A 非 vpie label.summary=true 拒', codeAt(chartIR('vbar', { label: { enable: true, summary: true } }), 'INVALID_SHAPE', 'sheets[0].blocks[1].label.summary'));
check('P1-A 非 vpie label.summary={format} 拒', codeAt(chartIR('vline', { label: { enable: true, summary: { format: '#,##0' } } }), 'INVALID_SHAPE', 'sheets[0].blocks[1].label.summary'));
check('P1-A vpie label.summary=true 零误报', errsOf(chartIR('vpie', { label: { enable: true, summary: true } })).length === 0);
check('P1-A vpie label.summary={format} 零误报', errsOf(chartIR('vpie', { label: { enable: true, summary: { format: '#,##0' } } })).length === 0);
// P1-B：legacy 公共轴键零误报（含既有 #46 min/max）；Van 专属 title/unit/alerts 在 legacy 结构化拒
check('P1-B legacy bar 无 legend 公共 axisY 零误报', errsOf(chartIR('bar', { axisY: { fontPt: 10, color: 0x333333, showLabel: true, min: 0, max: 1000 } })).length === 0);
check('P1-B legacy line axisX 公共键零误报', errsOf(chartIR('line', { axisX: { fontPt: 10 } })).length === 0);
check('P1-B legacy axisY.title 结构化拒（setTitle 实测不序列化）', codeAt(chartIR('bar', { axisY: { title: '销售额' } }), 'INVALID_SHAPE', 'sheets[0].blocks[1].axisY.title'));
check('P1-B legacy axisY.unit 结构化拒', codeAt(chartIR('bar', { axisY: { unit: 50 } }), 'INVALID_SHAPE', 'sheets[0].blocks[1].axisY.unit'));
check('P1-B legacy axisY.alerts 结构化拒', codeAt(chartIR('bar', { axisY: { alerts: [{ value: 150 }] } }), 'INVALID_SHAPE', 'sheets[0].blocks[1].axisY.alerts'));
check('P1-B vbar 全轴配置零误报', errsOf(chartIR('vbar', { axisY: { max: 260, unit: 50, title: '产量', alerts: [{ value: 150 }] }, axisX: { title: '机型' } })).length === 0);

// ===== R3-0（2026-11-06）cells rowSpan 契约：整数约束 + 块内重叠静态拒 =====
function cellsIR(items) {
  return { sheets: [{ name: 's1', widthsPt: [120, 120], blocks: [{ type: 'cells', heightPt: 24, items: items }] }],
    datasets: [{ name: 'd', columns: [{ name: 'a', type: 'text' }], rows: [['x']] }] };
}
check('R3-0 rowSpan=2 无 r 零误报', errsOf(cellsIR([{ c: 0, rowSpan: 2, text: 'a' }, { c: 1, text: 'b' }])).length === 0);
check('R3-0 rowSpan=3 + 显式 r 混合零误报', errsOf(cellsIR([{ c: 0, r: 0, rowSpan: 3, text: 'a' }, { c: 1, r: 0, text: 'b' }, { c: 1, r: 1, text: 'c' }])).length === 0);
check('R3-0 rowSpan=0 拒', codeAt(cellsIR([{ c: 0, rowSpan: 0, text: 'a' }]), 'INVALID_NUMBER', 'sheets[0].blocks[0].items[0].rowSpan'));
check('R3-0 rowSpan=-1 拒', codeAt(cellsIR([{ c: 0, rowSpan: -1, text: 'a' }]), 'INVALID_NUMBER', 'sheets[0].blocks[0].items[0].rowSpan'));
check('R3-0 rowSpan=1.5 拒', codeAt(cellsIR([{ c: 0, rowSpan: 1.5, text: 'a' }]), 'INVALID_NUMBER', 'sheets[0].blocks[0].items[0].rowSpan'));
check('R3-0 r=-1 拒', codeAt(cellsIR([{ c: 0, r: -1, text: 'a' }]), 'INVALID_NUMBER', 'sheets[0].blocks[0].items[0].r'));
check('R3-0 r=2.5 拒', codeAt(cellsIR([{ c: 0, r: 2.5, text: 'a' }]), 'INVALID_NUMBER', 'sheets[0].blocks[0].items[0].r'));
check('R3-0 块内显式 r 重叠拒', codeAt(cellsIR([{ c: 0, r: 0, rowSpan: 2, text: 'a' }, { c: 0, r: 1, text: 'b' }]), 'DUPLICATE', 'sheets[0].blocks[0].items[1]'));
check('R3-0 块内同行同列重复拒', codeAt(cellsIR([{ c: 0, text: 'a' }, { c: 0, text: 'b' }]), 'DUPLICATE', 'sheets[0].blocks[0].items[1]'));
check('R3-0 单行 cells 零回归', errsOf(cellsIR([{ c: 0, text: 'a' }, { c: 1, text: 'b' }])).length === 0);


// ===== 批I（2026-11-05）vbubble 图种（VanChartBubblePlot + BubbleTableDefinition，vscatter 同法） =====
check('批I vbubble 零误报', errsOf(chartIR('vbubble', { seriesName: '机型线', x: '机型', y: '产量', bubbleSize: '产量' })).length === 0);

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
