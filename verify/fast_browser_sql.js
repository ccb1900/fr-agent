// verify/fast_browser_sql.js — I0-04（r2.md）SQL 最小加固离线行为测
//   浏览器族构造器 = Agent 产出 SQL 的主通道：入口白名单闸（表/列/日期列/排序键）+ page/size 数值闸
//   + 正控零误伤（合法 cfg 端到端：browserSpec → Ir.compile → Ir.validate 全绿）。
//   跑法同 fast 层：纯 nashorn.jar，不碰 FR/FineDB/产物字节。
var J = function (n) { return Java.type(n); };
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function threw(fn) { try { fn(); return false; } catch (e) { return true; } }
function srcOf(p) { var S = J('java.lang.String'); var F = J('java.nio.file.Files'); var P = J('java.nio.file.Paths'); return String(new S(F.readAllBytes(P.get(ROOT + '/' + p)), 'UTF-8')); }
check('PARSE features/data_browser/browser.js', (function () { try { new Function(srcOf('features/data_browser/browser.js')); return true; } catch (e) { print('PARSE: ' + e); return false; } })());

load(ROOT + '/runtime/paths.js');
load(ROOT + '/features/data_browser/browser.js');
load(ROOT + '/lib/ir.js');

// 实形 base：形态照抄 reports/br_laser_aaa_gosa.js（去 connections/outName env 面）
var base = {
  outName: 'br_gate_test', title: '闸测 · GOSA laser_aaa_gosa',
  table: 'laser_aaa_gosa', selfCpt: 'fineagent/x_api.cpt', modules: BROWSER.MODULES,
  dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true,
  defaults: {},
  cols: [{ name: 'file_key', len: 9, type: 'code' }, { name: 'score', len: 8, type: 'num', fmt: '0.000' }]
};
function mk(f) { var c = JSON.parse(JSON.stringify(base)); f(c); return c; }

// 正控：合法 cfg 端到端 = browserSpec 不炸 + 产物 IR 过全量校验（闸升级后浏览器族零误伤的铁证）
check('browserSpec 合法生成 → IR validate 全绿', (function () {
  try {
    var s = BROWSER.spec(mk(function () { }));
    var ir = Ir.compile(s);
    var e = Ir.validate(ir);
    if (e.length) { print('IR ERRS: ' + JSON.stringify(e).slice(0, 400)); return false; }
    return true;
  } catch (x) { print('THREW: ' + x); return false; }
})());

// 反控：标识符形态闸——坏名直进即拒（[] 闭合逃逸面 = colRef/tq 拼接点）
check('拒表名 ] 闭合注入', threw(function () { BROWSER.spec(mk(function (c) { c.table = 't] DROP TABLE x;--'; })); }));
check('拒列名分号注入', threw(function () { BROWSER.spec(mk(function (c) { c.cols[1].name = 'sc;ore'; })); }));
check('拒 dateCol 引号逃逸', threw(function () { BROWSER.spec(mk(function (c) { c.dateCol = "biz'; --"; })); }));
check('拒 sortKeys 注释逃逸', threw(function () { BROWSER.spec(mk(function (c) { c.sortKeys = ['ok; --']; })); }));
check('拒 timeCol 空格', threw(function () { BROWSER.spec(mk(function (c) { c.timeCol = 'a b'; })); }));
check('拒 filterCol 括号', threw(function () { BROWSER.spec(mk(function (c) { c.filterCol = 'f(1)'; })); }));
// 数值闸：page/size 进 TRY_CAST 未加引号位前的形态收口（坏值不再漂成 NaN/负数进 SQL 文本）
check('拒 size 非数（defaults.size=abc）', threw(function () { BROWSER.spec(mk(function (c) { c.defaults = { size: 'abc' }; })); }));
check('拒 page 负数', threw(function () { BROWSER.spec(mk(function (c) { c.defaults = { page: '-3' }; })); }));
check('拒 size 小数', threw(function () { BROWSER.spec(mk(function (c) { c.defaults = { size: '12.5' }; })); }));
check('合法 size/page 数字仍过', threw(function () { BROWSER.spec(mk(function (c) { c.defaults = { size: 20, page: 2 }; })); }) === false);

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
