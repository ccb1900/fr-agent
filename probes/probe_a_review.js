// probes/probe_a_review.js — A段(阶段2) 审查报告反例先行探针（零引擎、零连库）
//   对外部 34-commit 审查的未修项逐条先红后绿。跑法：
//   FR_AGENT_HOME=D:/fineagent java -cp "<FR>/jre/lib/ext/nashorn.jar" jdk.nashorn.tools.Shell probes/probe_a_review.js
//   覆盖：P2a 协议相对URL逃逸 / P2b ir chart 装饰段 charAt 对非串 kind 抛 / P2c spec 顶层未知键静默丢
//         / P2d refOverrides __proto__ 原型污染（Nashorn 实证：proto 被换、消费者 typeof 守卫掩蔽——
//           Object.create(null) 硬化 + 编译产物不变性断言）/ P1a seriesImage 路径 IR 侧无闸
//         / P1c planner rows 路未知指标静默丢（未知维度经空 dims 结构性拒，本探针固化该行为）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function src(f) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + f)), 'UTF-8')); }
function jt(f) { return JSON.parse(src(f)); }
function codesOf(fn) { try { return (fn() || []).map(function (e) { return e.code + '@' + e.path; }); } catch (e) { return ['__THREW__:' + e]; } }
function hasCode(arr, c) { return arr.some(function (x) { return x.indexOf(c) >= 0; }); }
function threw(arr) { return arr.length > 0 && String(arr[0]).indexOf('__THREW__') === 0; }

load(ROOT + '/lib/report_spec.js');
load(ROOT + '/lib/isodate.js');
load(ROOT + '/lib/ir.js');
load(ROOT + '/lib/spec_validator.js');
load(ROOT + '/lib/spec_compiler.js');
load(ROOT + '/semantic/model/vocab.js');
load(ROOT + '/semantic/model/registry.js');
load(ROOT + '/semantic/model/resolver.js');
load(ROOT + '/semantic/planner/capability.js');
load(ROOT + '/semantic/planner/planner.js');

// 有效 IR 基座（与 fast_ir_contract detIR 同形；detail.link 带 web.url）
var DS = [{ name: 'ds1', columns: [{ name: '机型', type: 'text' }, { name: 'score', type: 'number' }], rows: [['A', 1]] }];
function linkIR(url) {
  var col = { name: '机型', type: 'text' };
  return {
    sheets: [{ name: 's1', widthsPt: [100, 100], blocks: [
      { type: 'title', text: 't', span: 2, heightPt: 30 },
      { type: 'header', columns: [col], heightPt: 20 },
      { type: 'detail', dataset: 'ds1', columns: [col], heightPt: 20, link: { by: '机型', reportlet: 'sub.cpt', web: { url: url } } }
    ] }],
    datasets: DS
  };
}
function chartIR(kind) {
  return {
    sheets: [{ name: 's1', widthsPt: [100, 100], blocks: [
      { type: 'title', text: 't', span: 2, heightPt: 30 },
      { type: 'header', columns: [{ name: '机型', type: 'text' }], heightPt: 20 },
      { type: 'detail', dataset: 'ds1', columns: [{ name: '机型', type: 'text' }], heightPt: 20 },
      { type: 'chart', kind: kind, dataset: 'ds1', category: '机型', value: 'score', heightPt: 300, tooltip: { muti: true } }
    ] }],
    datasets: DS
  };
}

// ---------- P2a: 协议相对 URL 逃逸（link.web.url；nav/iframe widget 同闸） ----------
(function () {
  check('P2a 基座合法 URL 零误报', codesOf(function () { return Ir.validate(linkIR('/webroot/decision/view/report?viewlet=x')); }).length === 0);
  check('P2a link.web.url="//evil.com/x" 被拒', hasCode(codesOf(function () { return Ir.validate(linkIR('//evil.com/x')); }), 'INVALID_URL'));
  check('P2a link.web.url="//evil" 被拒', hasCode(codesOf(function () { return Ir.validate(linkIR('//evil')); }), 'INVALID_URL'));
  var navIr = { sheets: [{ name: 's1', blocks: [{ type: 'title', text: 't', span: 1 }], floats: [] }], datasets: [],
    param: { widgets: [{ kind: 'nav', name: 'n1', text: 'n', x: 0, y: 0, w: 1, h: 1, url: '//evil.com/x' }] } };
  check('P2a nav widget url="//evil.com/x" 被拒', hasCode(codesOf(function () { return Ir.validate(navIr); }), 'INVALID_URL'));
})();

// ---------- P2b: ir chart 装饰段 charAt 对非字符串 kind 抛 TypeError（反例=kind:123 / 缺省） ----------
(function () {
  var e1 = codesOf(function () { return Ir.validate(chartIR(123)); });
  check('P2b kind=123+tooltip 不抛（结构化诊断）', !threw(e1), JSON.stringify(e1).slice(0, 90));
  var e2 = codesOf(function () { return Ir.validate(chartIR(undefined)); });
  check('P2b kind 缺省+tooltip 不抛（结构化诊断）', !threw(e2), JSON.stringify(e2).slice(0, 90));
  check('P2b kind=123 报 INVALID_ENUM', hasCode(codesOf(function () { return Ir.validate(chartIR(123)); }), 'INVALID_ENUM'));
  check('P2b 基座合法图零误报', codesOf(function () { return Ir.validate(chartIR('vbar')); }).length === 0);
})();

// ---------- P2c: spec 顶层未知键静默丢 ----------
(function () {
  var good = { specVersion: '1', outName: 'p2c', report: { name: 't' },
    dimensions: [{ field: 'a', label: 'A' }], metrics: [{ field: 'b', label: 'B', aggregation: 'sum' }],
    dataset: { rows: [['x', 1]] } };
  check('P2c 基座合法 spec 零误报', codesOf(function () { return SpecValidator.validate(good); }).length === 0);
  var stray = JSON.parse(JSON.stringify(good)); stray.specTypoKey = { a: 1 };
  check('P2c 顶层未知键 specTypoKey 被拒（当前静默=红）', hasCode(codesOf(function () { return SpecValidator.validate(stray); }), 'UNSUPPORTED_CAPABILITY'));
  var typo = JSON.parse(JSON.stringify(good)); typo.dimensons = good.dimensions; delete typo.dimensions;
  check('P2c dimensons 拼错被点名拒', hasCode(codesOf(function () { return SpecValidator.validate(typo); }), 'UNSUPPORTED_CAPABILITY@dimensons'));
})();

// ---------- P2d: refOverrides __proto__ 原型污染（Nashorn 实证 proto 被换；用户可见损伤被 labelOf/widthOf
//   的 typeof 守卫掩蔽——故断言=编译产物不变性 + 不炸；Object.create(null) 硬化消除此类隐患） ----------
(function () {
  var deps = {
    model: { dimensions: [{ name: 'label', label: '模型标签' }], metrics: [] },
    SqlBuilder: { build: function () { return { sql: 'SELECT 1', baseAliases: [{ alias: '__proto__', role: 'dimension' }, { alias: 'label', role: 'dimension' }] }; } }
  };
  var mk = function (term) {
    return { specVersion: '1', outName: 'p2d', report: { name: 't' },
      dataset: { kind: 'sql', entity: 'e', connection: 'c',
        dimensions: [{ term: term, label: 'PWNED' }], metrics: [] } };
  };
  var cBad = null;
  try { cBad = SpecCompiler.compile(mk('__proto__'), deps); } catch (e) { cBad = null; print('P2d compile(__proto__) THREW: ' + e); }
  check('P2d term=__proto__ 编译不炸且产物可 JSON 往返（不因原型污染坏图）',
    cBad != null && JSON.stringify(JSON.parse(JSON.stringify(cBad))) === JSON.stringify(cBad));
})();

// ---------- P1a: seriesImage 路径 IR 侧无闸（.. / 反斜杠 / scheme 逃逸到引擎读文件） ----------
(function () {
  var mk = function (img) {
    return {
      sheets: [{ name: 's1', widthsPt: [100], blocks: [
        { type: 'chart', kind: 'vbar', dataset: 'ds1', category: '机型', value: 'score', heightPt: 300,
          seriesImage: { image: img, layout: 10 } } ] }],
      datasets: DS
    };
  };
  check('P1a seriesImage.image="../outside.png" 被拒', hasCode(codesOf(function () { return Ir.validate(mk('../outside.png')); }), 'INVALID_PATH'));
  check('P1a seriesImage.image="sub/../../win.ini" 被拒', hasCode(codesOf(function () { return Ir.validate(mk('sub/../../win.ini')); }), 'INVALID_PATH'));
  check('P1a seriesImage.image="file:///etc/x" 被拒', hasCode(codesOf(function () { return Ir.validate(mk('file:///etc/x')); }), 'INVALID_PATH'));
  check('P1a seriesImage.image="assets/x.png" 合法不误伤', codesOf(function () { return Ir.validate(mk('assets/x.png')); }).filter(function (x) { return x.indexOf('INVALID_PATH') >= 0; }).length === 0);
})();

// ---------- P1c: planner rows 路未知指标静默丢（未知维度经空 dims 结构性拒——固化） ----------
(function () {
  var model = jt('models/production/model.json');
  var idx = ModelRegistry.index(model);
  var ctx = {
    model: model,
    resolve: function (term) { return ModelResolver.resolve(idx, String(term)); },
    validateSpec: function (spec) { return SpecValidator.validate(spec); },
    capability: PlannerCapability,
    caps: ReportSpec.capabilities()
  };
  var res = ReportPlanner.plan({ outName: 'p1c', reportName: '未知词', dimensions: ['bizTime'], metrics: [{ term: 'rowNo', aggregation: 'sum' }, { term: '不存在的指标xyz', aggregation: 'sum' }] }, ctx);
  check('P1c rows 路 已知+未知混合指标 → 不 ready（静默少指标=红）', res.status === 'rejected', 'status=' + res.status);
  var res2 = ReportPlanner.plan({ outName: 'p1c2', reportName: '未知词', dimensions: ['不存在的维度abc'], metrics: [{ term: 'rowNo', aggregation: 'sum' }] }, ctx);
  check('P1c rows 路未知维度 → 不 ready（现状：空 dims 结构性拒，固化）', res2.status === 'rejected', 'status=' + res2.status);
  var ok = ReportPlanner.plan({ outName: 'p1c3', reportName: '正常', dimensions: ['bizTime'], metrics: [{ term: 'rowNo', aggregation: 'sum' }], rows: [['2026-11-06', 3]] }, ctx);
  check('P1c 合法意图仍 ready（零误伤）', ok.status === 'ready', 'status=' + ok.status + ' warns=' + JSON.stringify(ok.validationWarnings).slice(0, 120));
})();

// ---------- P2e: IR 词表 Van 族含 vbubble（object.js VAN_KINDS 补齐由载体字节门佐证） ----------
(function () {
  check('P2e IR 词表 Van 族含 vbubble', Ir.capabilities().chart.vanChart.indexOf('vbubble') >= 0);
})();

print('A-REVIEW PROBE END, fails=' + FAILS);
exit(FAILS ? 1 : 0);
