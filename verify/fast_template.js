// verify/fast_template.js — I6 core（validator/locator/diff）离线契约测（零引擎零 FR）
//   r2 I6 硬约束的机器化：白名单外 op 一律拒（探针不过=不做）、坐标/目标存在性、基线禁写、
//   导出字节 MD5 不可用→改"语义 token diff 判未改部分不变"。合成 XML，不连库不跑 FR。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(ROOT + '/' + f)), 'UTF-8')); }
function threw(fn) { try { fn(); return false; } catch (e) { return true; } }
['template/ops.js', 'template/validator.js', 'template/locator.js', 'template/diff.js'].forEach(function (f) {
  var ok = true; try { new Function(src(f)); } catch (e) { ok = false; print('PARSE ' + f + ' -> ' + e); }
  check('PARSE ' + f, ok);
});
load(ROOT + '/template/ops.js'); load(ROOT + '/template/validator.js'); load(ROOT + '/template/locator.js'); load(ROOT + '/template/diff.js'); load(ROOT + '/template/regression.js');
function codeAt(errs, code, frag) { return errs.some(function (e) { return e.code === code && String(e.path).indexOf(frag) >= 0; }); }
function hasE(errs, frag) { return errs.some(function (e) { return (e.code + ' ' + e.path + ' ' + e.message).indexOf(frag) >= 0; }); }

// ===== validator =====
var good = { patchVersion: '1', sourceCpt: 'fineagent/生产日报_I5闭环_api.cpt', outName: 'patched.cpt',
  ops: [ { op: 'replace_cell_value', sheet: 0, cell: { c: 0, r: 0 }, value: { kind: 'text', text: '新日报标题' } },
         { op: 'replace_dataset', name: 'ds1', columns: [{ name: 'a', type: 'integer' }, { name: 'b', type: 'text' }], rows: [[1, 'x']] } ] };
check('合法 PatchSpec 0 err', TemplateValidator.validate(good).length === 0);
function m(mut) { var p = JSON.parse(JSON.stringify(good)); mut(p); return p; }
check('白名单外 op（set_cell_style）拒 + 证据', hasE(TemplateValidator.validate(m(function (p) { p.ops = [{ op: 'set_cell_style' }]; })), 'v1 不做'));
check('set_report_title 明确不做', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [{ op: 'set_report_title' }]; })), 'UNSUPPORTED_CAPABILITY', 'ops[0].op'));
check('未知 op 拒', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [{ op: 'frobnicate' }]; })), 'INVALID_ENUM', 'ops[0].op'));
check('负坐标拒', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [{ op: 'replace_cell_value', sheet: 0, cell: { c: -1, r: 0 }, value: { kind: 'text', text: 'x' } }]; })), 'INVALID_SHAPE', 'cell'));
check('formula 缺 = 拒', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [{ op: 'replace_cell_value', sheet: 0, cell: { c: 0, r: 0 }, value: { kind: 'formula', text: 'SUM(A1)' } }]; })), 'INVALID_TYPE', 'value.text'));
check('基线件 demo_api.cpt 禁作 source', codeAt(TemplateValidator.validate(m(function (p) { p.sourceCpt = 'demo_api.cpt'; })), 'FORBIDDEN_TARGET', 'sourceCpt'));
check('source 路径穿越拒', codeAt(TemplateValidator.validate(m(function (p) { p.sourceCpt = '../../etc/x.cpt'; })), 'INVALID_PATH', 'sourceCpt'));
check('outName 带路径拒', codeAt(TemplateValidator.validate(m(function (p) { p.outName = 'a/b.cpt'; })), 'INVALID_PATH', 'outName'));
check('缺 ops 拒', codeAt(TemplateValidator.validate(m(function (p) { delete p.ops; })), 'REQUIRED', 'ops'));
check('dataset 行宽≠列拒', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [{ op: 'replace_dataset', name: 'ds1', columns: [{ name: 'a', type: 'integer' }], rows: [[1, 2]] }]; })), 'INVALID_SHAPE', 'rows[0]'));
check('validator 抗炸不抛', threw(function () { TemplateValidator.validate(null); TemplateValidator.validate(42); TemplateValidator.validate({ ops: [null, 3] }); }) === false);
check('validator 确定序 + 不改输入', (function () { var s = JSON.stringify(good); return JSON.stringify(TemplateValidator.validate(good)) === JSON.stringify(TemplateValidator.validate(good)) && JSON.stringify(good) === s; })());
check('validator 错误形状 {code,path,message}', TemplateValidator.validate({ ops: [{ op: 'set_cell_style' }] }).every(function (e) { return e && typeof e.code === 'string' && typeof e.path === 'string' && typeof e.message === 'string'; }));

// ===== locator =====
var desc = { sheetCount: 1, sheets: [{ rows: 5, cols: 4 }], datasetNames: ['ds1'] };
check('locator 格在网格内→ok', TemplateLocator.exists({ op: 'replace_cell_value', sheet: 0, cell: { c: 3, r: 4 } }, desc).ok === true);
check('locator 越界→拒', TemplateLocator.exists({ op: 'replace_cell_value', sheet: 0, cell: { c: 9, r: 0 } }, desc).ok === false);
check('locator 数据集不存在→拒（不静默新建）', TemplateLocator.exists({ op: 'replace_dataset', name: 'ghost' }, desc).ok === false);
// I6.1-A：真实 describe() 形态（hasDataset 活断言）必须被 Locator 消费，否则 replace_dataset 在真实链永拒
var realDesc = { sheetCount: 1, sheets: [{ rows: 5, cols: 4 }], datasetNames: [], hasDataset: function (n) { return n === 'ds1'; } };
check('I6.1-A describe 形态(hasDataset) ds1→ok', TemplateLocator.exists({ op: 'replace_dataset', name: 'ds1' }, realDesc).ok === true);
check('I6.1-A describe 形态(hasDataset) ghost→拒', TemplateLocator.exists({ op: 'replace_dataset', name: 'ghost' }, realDesc).ok === false);
check('I6.1-A hasDataset 优先于空 datasetNames（不回退误拒）', TemplateLocator.exists({ op: 'replace_dataset', name: 'ds1' }, realDesc).ok === true);
check('locator sheet 越界→拒', TemplateLocator.exists({ op: 'replace_cell_value', sheet: 7, cell: { c: 0, r: 0 } }, desc).ok === false);
check('r7 描述符读取失败(ok:false)→拒（不在未知网格上放行修改）', (function () {
  var bad = { ok: false, error: { operation: 'getRowCount', message: 'boom' } };
  return TemplateLocator.exists({ op: 'replace_cell_value', sheet: 0, cell: { c: 0, r: 0 } }, bad).ok === false;
})());
check('r7 sheet 维度读取失败(ok:false)→拒', TemplateLocator.exists({ op: 'replace_cell_value', sheet: 0, cell: { c: 0, r: 0 } }, { ok: true, sheetCount: 1, sheets: [{ ok: false, error: { operation: 'sheetDims', message: 'x' } }] }).ok === false);

// ===== diff（未改部分不变的判据）=====
var beforeXml = '<Report><O c="0" r="0"><![CDATA[旧标题]]></O><O c="1" r="0"><![CDATA[保持]]></O><ColumnDefinition num="288"/></Report>';
var afterXml = '<Report><O c="0" r="0"><![CDATA[新标题]]></O><O c="1" r="0"><![CDATA[保持]]></O><ColumnDefinition num="288"/></Report>';
var d = TemplateDiff.diff(beforeXml, afterXml, { added: ['新标题'], removed: ['旧标题'] });
check('diff 仅预期改动→clean', d.clean === true);
check('diff 结构计数守恒（colDefs/cells 不变）', !d.structDelta.colDefs && !d.structDelta.cells);
var afterBad = afterXml.replace('保持', '被误改');
var d2 = TemplateDiff.diff(beforeXml, afterBad, { added: ['新标题'], removed: ['旧标题'] });
check('diff 有未预期改动→不 clean + 列出', d2.clean === false && d2.unintended.removed.indexOf('保持') >= 0 && d2.unintended.added.indexOf('被误改') >= 0);
check('diff namedStyles 命中', TemplateDiff.namedStyles('<a style_name="s1"/><b style_name="s2"/>') === 2);
check('diff profile 计数', TemplateDiff.profile(beforeXml).colDefs === 1 && TemplateDiff.profile(beforeXml).cells === 2);
// I6.1-B 红→绿：结构变化 / 属性变化必须让 clean=false（此前只比 CDATA，会假 clean）
var afterStruct = afterXml.replace('<ColumnDefinition num="288"/>', '');   // 少一个 ColumnDefinition
var d3 = TemplateDiff.diff(beforeXml, afterStruct, { added: ['新标题'], removed: ['旧标题'] });
check('I6.1-B 结构计数变化→clean=false + unintended.struct 列出', d3.clean === false && d3.unintended.struct.length >= 1 && !!d3.structDelta.colDefs);
var afterAttr = afterXml.replace('<![CDATA[保持]]>', '<![CDATA[保持]]><O c="2" r="0" name="注入格"><![CDATA[保持2]]></O>');
// 通过新增一个带语义属性 name= 的节点，制造属性签名变化
var d4 = TemplateDiff.diff(beforeXml, afterAttr, { added: ['新标题', '保持2'], removed: ['旧标题'] });
check('I6.1-B 属性签名变化→clean=false', d4.clean === false && (d4.unintended.attrAdded.length > 0 || d4.unintended.struct.length > 0));
// replace_dataset：数据集相关结构(dataCols)变化允许，其余(cells/styles)不许
var beforeDs = '<Report><TableData name="ds1"><ColumnDescriptor name="a"/><ColumnDescriptor name="b"/></TableData></Report>';
var afterDs = '<Report><TableData name="ds1"><ColumnDescriptor name="x"/></TableData></Report>';
var d5 = TemplateDiff.diff(beforeDs, afterDs, { added: [], removed: [], ops: [{ op: 'replace_dataset', name: 'ds1' }] });
check('I6.1-B 引擎属性标记(Theme/Fork/TemplateId)作噪声过滤', (function () {
  var x = '<Report><O c="0"><![CDATA[k]]></O></Report>';
  var y = '<Report class="com.fr.base.iofile.attr.TemplateThemeAttrMark" name="兼容主题"><O c="0"><![CDATA[k]]></O></Report>';
  return TemplateDiff.diff(x, y, {}).clean === true;
})());
check('I6.1-B dataset op 允许 dataCols 结构变化（不进 unintended.struct）',
  d5.structDelta.dataCols === '2→1' && d5.unintended.struct.every(function (x) { return x.indexOf('dataCols') < 0; }));
var d6 = TemplateDiff.diff(beforeDs + '<O c="0"><![CDATA[k]]></O>', afterDs, { added: [], removed: ['k'], ops: [{ op: 'replace_dataset', name: 'ds1' }] });
check('I6.1-B dataset op 仍禁止 cells 等非数据集结构变化', d6.clean === false && d6.unintended.struct.some(function (x) { return x.indexOf('cells') >= 0; }));
check('I6.1-B dataset op 放行 SQL/列名 CSV 等数据集本体变化', (function () {
  var b = '<R><TableData><![CDATA[SELECT a FROM t]]></TableData><O><![CDATA[标题]]></O></R>';
  var a = '<R><TableData><![CDATA[SELECT x FROM y]]></TableData><O><![CDATA[标题]]></O></R>';
  return TemplateDiff.diff(b, a, { ops: [{ op: 'replace_dataset' }] }).clean === true;
})());
check('I6.1-B dataset op 仍拒"单元格文本"未预期改动（非数据集本体）', (function () {
  var b = '<R><TableData><![CDATA[SELECT a FROM t]]></TableData><O><![CDATA[标题]]></O></R>';
  var a = '<R><TableData><![CDATA[SELECT x FROM y]]></TableData><O><![CDATA[被偷偷改的标题]]></O></R>';
  return TemplateDiff.diff(b, a, { ops: [{ op: 'replace_dataset' }] }).clean === false;
})());
// 阶段3 反例（任务二真跑发现）：EmbeddedTableData 的行值序列化串是【含换行】的多行 token，
//   isDatasetToken 的 /^[\x20-\x7E]{10,}$/ 不匹配 \n（<0x20）→ 合法 replace_dataset 被 diff 误杀 diffClean=false。
//   I6.1-B 豁免意图本就声明"行值/序列化属性"属数据集本体——修则扩字符集，且中文偷改仍必须拒（豁免不扩大化）。
check('阶段3 dataset op 放行多行内嵌序列化串（含换行的行值 token）', (function () {
  var b = '<R><TableData><![CDATA[SELECT a FROM t]]></TableData><O><![CDATA[标题]]></O></R>';
  var a = '<R><TableData><![CDATA[9o_4H"a,.c^2%s,WQW>n"5qO+rF8D\nnPFc3*]A@OAMb!_oT--5?@$!m0WeK\n]]></TableData><O><![CDATA[标题]]></O></R>';
  return TemplateDiff.diff(b, a, { ops: [{ op: 'replace_dataset' }] }).clean === true;
})());
check('阶段3 dataset op 多行串豁免后仍拒中文文本偷改（豁免不扩大化）', (function () {
  var b = '<R><TableData><![CDATA[SELECT a FROM t]]></TableData><O><![CDATA[标题]]></O></R>';
  var a = '<R><TableData><![CDATA[9o_4H"a,.c^2%s,WQW>n"5qO+rF8D\nnPFc3*]A@OAMb!_oT--5?@$!m0WeK\n]]></TableData><O><![CDATA[被偷改标题]]></O></R>';
  return TemplateDiff.diff(b, a, { ops: [{ op: 'replace_dataset' }] }).clean === false;
})());

// ===== I6.1-C/r5 执行/渲染回归裁决（纯函数，禁假 PASS） =====
var BAD = { ok: false, rows: null, error: 'boom' };
check('C 两边都执行失败且错误串相同→FAIL（非假 PASS）', TemplateRegression.execution(BAD, { ok: false, rows: null, error: 'boom' }, {}).pass === false);
check('C 单边执行失败→FAIL', TemplateRegression.execution({ ok: true, rows: [['a']], error: null }, BAD, {}).pass === false);
check('r5 指定坐标屏蔽后其余不变→PASS（标题改 (0,0)）', (function () {
  var b = { ok: true, rows: [['旧标题', '表头'], ['d', '1']], error: null };
  var a = { ok: true, rows: [['新标题', '表头'], ['d', '1']], error: null };
  return TemplateRegression.execution(b, a, { changedCells: [{ c: 0, r: 0 }] }).pass === true;
})());
check('r5 合并标题格的重复列同变→PASS（同旧值→同新值）', (function () {
  var b = { ok: true, rows: [['旧标题', '旧标题'], ['d', '1']], error: null };
  var a = { ok: true, rows: [['新标题', '新标题'], ['d', '1']], error: null };
  return TemplateRegression.execution(b, a, { changedCells: [{ c: 0, r: 0, oldText: '旧标题', newText: '新标题' }] }).pass === true;
})());
check('r5 同值重复但非合并语义（别的格改成同新值）→仍 FAIL', (function () {
  var b = { ok: true, rows: [['旧标题', 'x'], ['d', '1']], error: null };
  var a = { ok: true, rows: [['新标题', '新标题'], ['d', '1']], error: null };
  return TemplateRegression.execution(b, a, { changedCells: [{ c: 0, r: 0, oldText: '旧标题', newText: '新标题' }] }).pass === false;
})());
check('r5 第 5 行未指定坐标变化→FAIL（不再固定跳前两行）', (function () {
  var b = { ok: true, rows: [['h', 'h'], ['h', 'h'], ['h', 'h'], ['h', 'h'], ['h', 'h'], ['d', '1']], error: null };
  var a = { ok: true, rows: [['h', 'h'], ['h', 'h'], ['h', 'h'], ['h', 'h'], ['h', 'h'], ['d', '999']], error: null };
  return TemplateRegression.execution(b, a, { changedCells: [{ c: 0, r: 0 }] }).pass === false;
})());
check('r5 前两行非指定格意外变化→FAIL（旧实现会整体跳过）', (function () {
  var b = { ok: true, rows: [['h', 'x'], ['hh', 'y']], error: null };
  var a = { ok: true, rows: [['h', 'CHANGED'], ['hh', 'y']], error: null };
  return TemplateRegression.execution(b, a, { changedCells: [{ c: 0, r: 0 }] }).pass === false;
})());
check('r5 dataset op：执行差异交 dataset 回归（不在这里误判）', TemplateRegression.execution({ ok: true, rows: [['a']], error: null }, { ok: true, rows: [['b']], error: null }, { hasDatasetOp: true }).pass === true);
// r5 渲染：像素 diff 必须真的执行（尺寸/比例/bbox）
var POK = { ok: true, bytes: 40000, error: null };
check('C 渲染失败→FAIL', TemplateRegression.render({ ok: false, bytes: -1, error: 'e' }, POK, null, {}).pass === false);
check('r5 像素 diff 未执行（stats 缺失）→FAIL', TemplateRegression.render(POK, POK, null, {}).pass === false);
check('r5 渲染尺寸变化→FAIL', TemplateRegression.render(POK, POK, { width: 100, height: 50, widthAfter: 120, heightAfter: 50, diffPixels: 0, ratio: 0 }, {}).pass === false);
check('r5 像素差异超阈值→FAIL', TemplateRegression.render(POK, POK, { width: 100, height: 50, widthAfter: 100, heightAfter: 50, diffPixels: 500, ratio: 0.10 }, {}).pass === false);
check('r5 像素差异在阈值内→PASS + bbox', (function () { var r = TemplateRegression.render(POK, POK, { width: 100, height: 50, widthAfter: 100, heightAfter: 50, diffPixels: 84, ratio: 0.0168, bbox: '1,2 - 5,6' }, {}); return r.pass === true && r.reason.indexOf('1,2') >= 0; })());
check('r6 关键单元格内容断言：结果仍是旧值→FAIL', (function () {
  var b = { ok: true, rows: [['旧标题', 'x']], error: null };
  var a = { ok: true, rows: [['旧标题', 'x']], error: null };   // 对象改了但出表没变
  return TemplateRegression.execution(b, a, { changedCells: [{ c: 0, r: 0, oldText: '旧标题', newText: '新标题' }], keyCells: [{ c: 0, r: 0, expect: '新标题' }] }).pass === false;
})());
check('r6 关键单元格内容断言：结果为新值→PASS', (function () {
  var b = { ok: true, rows: [['旧标题', 'x']], error: null };
  var a = { ok: true, rows: [['新标题', 'x']], error: null };
  return TemplateRegression.execution(b, a, { changedCells: [{ c: 0, r: 0, oldText: '旧标题', newText: '新标题' }], keyCells: [{ c: 0, r: 0, expect: '新标题' }] }).pass === true;
})());
check('r6 渲染零像素差但期望变化→FAIL', TemplateRegression.render(POK, POK, { width: 100, height: 50, widthAfter: 100, heightAfter: 50, diffPixels: 0, ratio: 0 }, { expectPixelChange: true }).pass === false);
check('r6 渲染零像素差且未要求变化→PASS（例如无 op）', TemplateRegression.render(POK, POK, { width: 100, height: 50, widthAfter: 100, heightAfter: 50, diffPixels: 0, ratio: 0 }, {}).pass === true);

// ===== r5 数据集替换回归（列名/列型/行数/逐格；快照缺失=失败）=====
var DS_EXP = { columns: [{ name: 'a', type: 'integer' }, { name: 'b', type: 'text' }], rows: [[7, 'I61'], [8, 'OK']] };
function dsAct(mut) {
  var a = { ok: true, columns: [{ name: 'a', type: 'integer' }, { name: 'b', type: 'text' }], rows: [['7', 'I61'], ['8', 'OK']] };
  if (mut) mut(a);
  return a;
}
check('r5 dataset 逐格一致（数值归一 7≡"7"）→PASS', TemplateRegression.dataset(DS_EXP, dsAct()).pass === true);
check('r5 dataset 列名不符→FAIL', TemplateRegression.dataset(DS_EXP, dsAct(function (a) { a.columns[1].name = 'zz'; })).pass === false);
check('r5 dataset 列型不符→FAIL', TemplateRegression.dataset(DS_EXP, dsAct(function (a) { a.columns[0].type = 'text'; })).pass === false);
check('r5 dataset 行数不符→FAIL', TemplateRegression.dataset(DS_EXP, dsAct(function (a) { a.rows = [['7', 'I61']]; })).pass === false);
check('r5 dataset 值不符→FAIL', TemplateRegression.dataset(DS_EXP, dsAct(function (a) { a.rows[1][1] = 'WRONG'; })).pass === false);
check('r5 dataset 快照缺失→FAIL', TemplateRegression.dataset(DS_EXP, null).pass === false);
check('r5 dataset 复合列型 number⊃integer 等价', TemplateRegression.dataset({ columns: [{ name: 'a', type: 'number' }], rows: [[]] }, { ok: true, columns: [{ name: 'a', type: 'integer' }], rows: [[]] }).pass === true);
// r6-B：严格读回语义（反射失败≠空值）+ 精确数值比较（不走 IEEE-754）
check('r6 快照 ok=false→FAIL 且带反射错误（不把读失败当空值）', (function () {
  var r = TemplateRegression.dataset(DS_EXP, { ok: false, error: 'getValueAt 失败 row=1 col=0: boom' });
  return r.pass === false && r.reason.indexOf('getValueAt') >= 0;
})());
check('r6 大整数相邻值不丢精度（2^53 / 2^53+1 必须可区分）', (function () {
  var e = { columns: [{ name: 'a', type: 'long' }], rows: [[9007199254740992]] };
  var a = { ok: true, columns: [{ name: 'a', type: 'long' }], rows: [['9007199254740993']] };
  return TemplateRegression.dataset(e, a).pass === false;
})());
check('r6 大整数相同值（精确字符串）→PASS', (function () {
  var e = { columns: [{ name: 'a', type: 'long' }], rows: [['9007199254740993']] };
  var a = { ok: true, columns: [{ name: 'a', type: 'long' }], rows: [['9007199254740993']] };
  return TemplateRegression.dataset(e, a).pass === true;
})());
check('r6 大整数精确字符串相邻值→FAIL', (function () {
  var e = { columns: [{ name: 'a', type: 'long' }], rows: [['9007199254740993']] };
  var a = { ok: true, columns: [{ name: 'a', type: 'long' }], rows: [['9007199254740992']] };
  return TemplateRegression.dataset(e, a).pass === false;
})());
check('r6 Decimal 尾零归一（1.50≡1.5）但精度不丢（1.5000000000000001≠1.5）', (function () {
  var mk = function (v) { return { ok: true, columns: [{ name: 'a', type: 'decimal' }], rows: [[v]] }; };
  var e = { columns: [{ name: 'a', type: 'decimal' }], rows: [[1.5]] };
  return TemplateRegression.dataset(e, mk('1.50')).pass === true && TemplateRegression.dataset(e, mk('1.5000000000000001')).pass === false;
})());
check('r6 前导零归一（007≡7）', TemplateRegression.dataset({ columns: [{ name: 'a', type: 'integer' }], rows: [[7]] }, { ok: true, columns: [{ name: 'a', type: 'integer' }], rows: [['007']] }).pass === true);

// ===== r5 diff：数字噪声按节点上下文；属性签名带节点 =====
check('r5 数字型业务单元格变化→不 clean（旧实现全局过滤数字=漏检）', (function () {
  var b = '<R><O c="0"><![CDATA[123]]></O></R>', a = '<R><O c="0"><![CDATA[456]]></O></R>';
  return TemplateDiff.diff(b, a, {}).clean === false;
})());
check('r5 RowHeight 数字数组变化→仍 clean（节点级噪声不误报）', (function () {
  var b = '<R><RowHeight defaultValue="1"><![CDATA[1,2,3]]></RowHeight></R>';
  var a = '<R><RowHeight defaultValue="1"><![CDATA[1,4,3]]></RowHeight></R>';
  return TemplateDiff.diff(b, a, {}).clean === true;
})());
check('r5 属性跨节点移动（总量不变）→不 clean', (function () {
  var b = '<R><O name="x"><![CDATA[k]]></O><P><![CDATA[k]]></P></R>';
  var a = '<R><O><![CDATA[k]]></O><P name="x"><![CDATA[k]]></P></R>';
  return TemplateDiff.diff(b, a, {}).clean === false;
})());

// ===== r5 PatchSpec 列/值类型严格校验（boolean 不再静默 truthy）=====
function dsOp(cols, rows) { return { op: 'replace_dataset', name: 'ds1', columns: cols, rows: rows }; }
check('r5 未知列型→INVALID_ENUM', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [dsOp([{ name: 'a', type: 'blob' }], [[1]])]; })), 'INVALID_ENUM', 'columns[0].type'));
check('r5 列名重复→INVALID_SHAPE', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [dsOp([{ name: 'a', type: 'integer' }, { name: 'a', type: 'text' }], [[1, 'x']])]; })), 'INVALID_SHAPE', 'columns[1].name'));
check('r5 boolean 列传字符串 "false"→INVALID_TYPE（防 truthy 翻转）', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [dsOp([{ name: 'a', type: 'boolean' }], [['false']])]; })), 'INVALID_TYPE', 'rows[0][0]'));
check('r6 integer 列拒绝非数值字符串', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [dsOp([{ name: 'a', type: 'integer' }], [['abc']])]; })), 'INVALID_TYPE', 'rows[0][0]'));
check('r6 数值列允许精确字符串（大整数/Decimal 不丢精度）', TemplateValidator.validate(m(function (p) { p.ops = [dsOp([{ name: 'a', type: 'long' }, { name: 'b', type: 'decimal' }], [['9007199254740993', '1.5000000000000001']])]; })).length === 0);
check('r5 date 列非法月份→INVALID_TYPE', codeAt(TemplateValidator.validate(m(function (p) { p.ops = [dsOp([{ name: 'a', type: 'date' }], [['2026-13-01']])]; })), 'INVALID_TYPE', 'rows[0][0]'));
check('r5 合法类型值零误报（integer/text/boolean）', TemplateValidator.validate(m(function (p) { p.ops = [dsOp([{ name: 'a', type: 'integer' }, { name: 'b', type: 'text' }, { name: 'c', type: 'boolean' }], [[7, 'x', false]])]; })).length === 0);

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
