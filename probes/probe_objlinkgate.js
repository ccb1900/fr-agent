// probes/probe_objlinkgate.js — I0-03 object 层超链闸反证（引擎级，runraw.ps1 跑法=不杀 java）
// 语义：Obj.build 绕过 ir.js 直喂坏超链 IR 时，object.js 必须当场拒（纵深防御；
//   管线正常路径 ir 层已先拦 EXIT 9，本探针证的是"即便 Agent 只调 build 也拦得住"）。
//   正控=合法形态零误伤。跑法：powershell -File runraw.ps1 -Script probes/probe_objlinkgate.js
var J = function (n) { return Java.type(n); };
load('D:/fineagent/runtime/paths.js');
load(Paths.runtime('bootstrap.js'));
Runtime.initialize();
load(Paths.lib('object.js'));

var FAILS = 0;
var COLS = [{ name: 'a', type: 'text', widthPt: 100, label: 'A' }, { name: 'b', type: 'number', widthPt: 100, label: 'B' }];
function irWithDetailLink(link) {
  return {
    irVersion: '1',
    sheets: [{ name: 's1', widthsPt: [100, 100], blocks: [
      { type: 'title', text: 't', span: 2, heightPt: 30 },
      { type: 'header', columns: COLS, heightPt: 20 },
      { type: 'detail', dataset: 'ds1', columns: COLS, heightPt: 20, link: link },
      { type: 'total', label: 'T', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 20 }
    ] }],
    datasets: [{ name: 'ds1', columns: [{ name: 'a', type: 'text' }, { name: 'b', type: 'number' }], rows: [['x', 1]] }]
  };
}
function irWithCellsLinkTo(linkTo) {
  return {
    irVersion: '1',
    sheets: [{ name: 's1', widthsPt: [100], blocks: [
      { type: 'cells', items: [{ c: 0, text: 'a', linkTo: linkTo }] }
    ] }],
    datasets: [{ name: 'ds1', columns: [{ name: 'a', type: 'text' }], rows: [['x']] }]
  };
}
function expectThrow(name, irFn) {
  try { Obj.build(irFn()); FAILS++; print('GATE MISS (should throw): ' + name); }
  catch (e) { print('GATE OK: ' + name + ' -> ' + String(e).slice(0, 120)); }
}
function expectOk(name, irFn) {
  try { Obj.build(irFn()); print('PASS-THROUGH OK: ' + name); }
  catch (e) { FAILS++; print('FALSE POSITIVE: ' + name + ' -> ' + String(e).slice(0, 160)); }
}

expectThrow('detail.link.reportlet 绝对 scheme', function () { return irWithDetailLink({ by: 'a', reportlet: 'http://evil/x.cpt' }); });
expectThrow('detail.link.reportlet .. 穿越', function () { return irWithDetailLink({ by: 'a', reportlet: '../../windows/win.ini' }); });
expectThrow('detail.link.targetFrame 坏字符', function () { return irWithDetailLink({ by: 'a', reportlet: 'sub.cpt', targetFrame: 'bad< frame>' }); });
expectThrow('cells.linkTo.web 绝对 scheme', function () { return irWithCellsLinkTo({ web: { url: 'javascript:alert(1)' } }); });
expectThrow('cells.linkTo.reportlet 引号注入', function () { return irWithCellsLinkTo({ reportlet: "x.cpt'; drop" }); });
expectOk('正控 detail.link 相对子目录+_self', function () { return irWithDetailLink({ by: 'a', name: '钻取', reportlet: 'fineagent/sub_api.cpt', targetFrame: '_self' }); });
expectOk('正控 cells.linkTo.web 相对路由', function () { return irWithCellsLinkTo({ web: { url: '/webroot/decision/view/report?viewlet=a.cpt' } }); });

print('GATE PROBE END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
