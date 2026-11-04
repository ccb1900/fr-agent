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

// ===== I6.1-C 执行/渲染回归裁决（纯函数，禁假 PASS） =====
check('C 两边都执行失败且错误串相同→FAIL（非假 PASS）', (function () {
  var f = { ok: false, grid: '', error: 'boom' };
  return TemplateRegression.execution(f, { ok: false, grid: '', error: 'boom' }, false).pass === false;
})());
check('C 单边执行失败→FAIL', TemplateRegression.execution({ ok: true, grid: 'a|b\n', error: null }, { ok: false, grid: '', error: 'x' }, false).pass === false);
check('C 标题行变化但数据区不变→PASS', (function () {
  var b = { ok: true, grid: '旧标题|旧标题\n表头|表头\nd|1\n', error: null };
  var a = { ok: true, grid: '新标题|新标题\n表头|表头\nd|1\n', error: null };
  return TemplateRegression.execution(b, a, false).pass === true;
})());
check('C 数据区变化→FAIL', (function () {
  var b = { ok: true, grid: 'h|h\n表头|表头\nd|1\n', error: null };
  var a = { ok: true, grid: 'h|h\n表头|表头\nd|999\n', error: null };
  return TemplateRegression.execution(b, a, false).pass === false;
})());
check('C 渲染 -1/失败→FAIL', TemplateRegression.render({ ok: false, bytes: -1, error: 'e' }, { ok: true, bytes: 40000, error: null }).pass === false);

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
