// verify/verify_sql_data.js — I5.1-T6 SQL 结果数据回归哨兵（纯 JS 无引擎；r3 任务6，防"表面合法结果错"复发）
//   读 I5 端到端产出的 RESULT_DUMP 栅格（列序 date|plan|done|rate）↔ data/db_laser_sub_truth.txt：
//     逐日 plan/done 对 ## subtotal_by_day、合计对 ## grand_total(33531|26531)、完成率≈grand done*100/plan。
//   grid 文件不存在 → SKIP（exit 0 提示）不假绿（AGENTS §1 交付核对面）。存在即逐格硬核对，失败 exit 1。
//   跑法：java -cp nashorn.jar jdk.nashorn.tools.Shell verify/verify_sql_data.js  [GRID=logs/i5_auto_grid.txt]
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var GRID = System.getenv('GRID') || (ROOT + '/logs/i5_auto_grid.txt');
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }

if (!Files.exists(Pth.get(GRID))) { print('SQL DATA REGRESSION: SKIP（无 ' + GRID + '，先跑 I5 端到端 + RESULT_DUMP 再对拍）'); J('java.lang.System').exit(0); }
var truth = readUtf(ROOT + '/data/db_laser_sub_truth.txt');
function section(name) { var m = new RegExp('## ' + name + '\\n([^]*?)(\\n## |$)').exec(truth); return m ? m[1].trim().split(/\r?\n/) : []; }
var sub = {}; section('subtotal_by_day').forEach(function (ln) { var p = ln.split('|'); if (p.length >= 3) sub[p[0]] = { plan: +p[1], done: +p[2] }; });
var gt = (section('grand_total')[0] || '').split('|');
var grandPlan = +gt[0], grandDone = +gt[1];

// 解析 grid：取 date 行（col0 形如 2026-09-xx）+ 总计行
var grid = readUtf(GRID), rows = grid.split(/\r?\n/), gDays = {}, gTotal = null;
rows.forEach(function (ln) {
  var p = ln.split('|');
  if (p.length >= 4 && /^20\d\d-\d\d-\d\d$/.test(p[0])) gDays[p[0]] = { plan: +p[1], done: +p[2], rate: +p[3] };
  else if (p.length >= 4 && /^总计/.test(p[0])) gTotal = { plan: +p[1], done: +p[2], rate: +p[3] };
});
check('grid 解析出逐日 + 总计', Object.keys(gDays).length >= 1 && !!gTotal);
// 逐日 plan/done 与独立真值一致
var dayMismatch = [];
Object.keys(gDays).forEach(function (d) {
  var t = sub[d];
  if (!t || t.plan !== gDays[d].plan || t.done !== gDays[d].done) dayMismatch.push(d + ' grid=' + JSON.stringify(gDays[d]) + ' truth=' + JSON.stringify(t));
});
check('逐日 plan/done 逐格 == db_laser_sub_truth subtotal_by_day（不符 ' + dayMismatch.length + '）', dayMismatch.length === 0);
if (dayMismatch.length) dayMismatch.slice(0, 4).forEach(function (x) { print('   ' + x); });
check('合计 plan==grand_total(' + grandPlan + ')', gTotal && gTotal.plan === grandPlan);
check('合计 done==grand_total(' + grandDone + ')', gTotal && gTotal.done === grandDone);
check('完成率 == done*100/plan（±0.01）', gTotal && Math.abs(gTotal.rate - grandDone * 100 / grandPlan) < 0.01);
print('SQL DATA REGRESSION END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
