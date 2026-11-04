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
check('multi-sheet 即报（UNSUPPORTED_CAPABILITY token）', has({ sheets: [{ blocks: [{ type: 'cells', items: [{ c: 0, text: 'a' }] }] }, { blocks: [] }], datasets: [{ name: 'd', columns: [{ name: 'c', type: 'text' }], rows: [['x']] }] }, 'multi_sheet'));

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
check('能力清单 multiSheet=unsupported', cap.sheet.multiSheet === 'unsupported');
check('能力清单 reverseFromCpt=unsupported', cap.dataset.reverseFromCpt === 'unsupported');
check('能力清单列 type 词汇标注延后口径', cap.columnType.note.indexOf('迭代 3') >= 0);

// ===== ⑤ I0-01（r2.md）校验完整化批：数组闸/有限数/枚举/拒数组对象/必填/超链族/结构契约 =====
var BC = [{ name: '机型', type: 'text' }, { name: 'score', type: 'number' }];
function baseIR() {
  return {
    sheets: [{ name: 's1', widthsPt: [100, 100], blocks: [
      { type: 'title', text: 't', span: 2, heightPt: 30 },
      { type: 'header', columns: BC, heightPt: 20 },
      { type: 'detail', dataset: 'ds1', columns: BC, heightPt: 20 },
      { type: 'total', label: '合计', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 20 }
    ] }],
    datasets: [{ name: 'ds1', columns: BC, rows: [['A', 1]] }]
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

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
