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
load(ROOT + '/template/ops.js'); load(ROOT + '/template/validator.js'); load(ROOT + '/template/locator.js'); load(ROOT + '/template/diff.js');
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
check('locator 数据集存在→ok', TemplateLocator.exists({ op: 'replace_dataset', name: 'ds1' }, desc).ok === true);
check('locator 数据集不存在→拒（不静默新建）', TemplateLocator.exists({ op: 'replace_dataset', name: 'ghost' }, desc).ok === false);
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

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
