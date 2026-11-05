// verify/verify_sql_data.js — I5.1-T6 SQL 结果数据回归哨兵（纯 JS 无引擎；r3 任务6，防"表面合法结果错"复发）
//   读 I5 端到端产出的 RESULT_DUMP 栅格（列序 date|plan|done|rate）↔ data/db_laser_sub_truth.txt：
//     逐日 plan/done 对 ## subtotal_by_day、合计对 ## grand_total(33531|26531)、完成率≈grand done*100/plan。
//   r22b-golden-readiness.md：新增复合键模式（env TRUTH_DAY_MACHINE=1）——
//     读 data/db_laser_machine_daily_truth.txt（detail: day|machine|plan|done|rate|... 9列；grand: plan|done|rate|...），
//     grid 预期 v1 5列形态 day|machine|plan|done|rate（总计行 p0='总计'，p1=plan/p2=done/p3=rate），
//     逐行 day@machine 对 detail 段 plan/done 逐格 + rate 容差 ±0.01；总计行对 grand 段三值。
//     未设 env → 旧日期级路径原语义原输出（默认零漂移）。缺真值/grid → SKIP 不假绿；失败 exit 1。
//   grid 文件不存在 → SKIP（exit 0 提示）不假绿（AGENTS §1 交付核对面）。存在即逐格硬核对，失败 exit 1。
//   跑法：java -cp nashorn.jar jdk.nashorn.tools.Shell verify/verify_sql_data.js  [GRID=logs/i5_auto_grid.txt]
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var GRID = System.getenv('GRID') || (ROOT + '/logs/i5_auto_grid.txt');
var MACH = System.getenv('TRUTH_DAY_MACHINE') === '1';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }

if (!Files.exists(Pth.get(GRID))) { print('SQL DATA REGRESSION: SKIP（无 ' + GRID + '，先跑 I5 端到端 + RESULT_DUMP 再对拍）'); J('java.lang.System').exit(0); }
var grid = readUtf(GRID), rows = grid.split(/\r?\n/);

if (MACH) {
  // ===== 复合键模式（day@machine，r22b-golden-readiness.md）=====
  var truthPath = ROOT + '/data/db_laser_machine_daily_truth.txt';
  if (!Files.exists(Pth.get(truthPath))) { print('SQL DATA REGRESSION: SKIP（无 ' + truthPath + '）'); J('java.lang.System').exit(0); }
  var truth2 = readUtf(truthPath);
  function section2(name) { var m = new RegExp('## ' + name + '\\n([^]*?)(\\n## |$)').exec(truth2); return m ? m[1].trim().split(/\r?\n/) : []; }
  var det = {};   // key day@machine -> {plan, done, rate}
  section2('detail_day_machine').forEach(function (ln) {
    var p = ln.split('|'); if (p.length >= 5) det[p[0] + '@' + p[1]] = { plan: +p[2], done: +p[3], rate: +p[4] };
  });
  var g2 = (section2('grand_total')[0] || '').split('|');
  var gPlan = +g2[0], gDone = +g2[1], gRate = +g2[2];
  var gMach = {}, gTotalM = null;
  rows.forEach(function (ln) {
    var p = ln.split('|');
    if (p.length >= 5 && /^20\d\d-\d\d-\d\d$/.test(p[0])) gMach[p[0] + '@' + p[1]] = { plan: +p[2], done: +p[3], rate: +p[4] };
    else if (p.length >= 4 && /^总计/.test(p[0]) && p[0].indexOf('@') < 0) gTotalM = { plan: +p[1], done: +p[2], rate: +p[3] };
  });
  check('grid(复合键) day@machine 明细行数=' + Object.keys(gMach).length + '（>=1）+ 总计', Object.keys(gMach).length >= 1 && !!gTotalM);
  var mm = [];
  Object.keys(gMach).forEach(function (k) {
    var t = det[k];
    if (!t || t.plan !== gMach[k].plan || t.done !== gMach[k].done || Math.abs(t.rate - gMach[k].rate) >= 0.01) {
      mm.push(k + ' grid=' + JSON.stringify(gMach[k]) + ' truth=' + JSON.stringify(t));
    }
  });
  check('day@machine 逐行 plan/done/rate 逐格 == detail_day_machine（不符 ' + mm.length + '）', mm.length === 0);
  if (mm.length) mm.slice(0, 4).forEach(function (x) { print('   ' + x); });
  check('总计 plan==' + gPlan, gTotalM && gTotalM.plan === gPlan);
  check('总计 done==' + gDone, gTotalM && gTotalM.done === gDone);
  check('总计 rate≈' + gRate + '(±0.01)', gTotalM && Math.abs(gTotalM.rate - gRate) < 0.01);
  print('SQL DATA REGRESSION END (machine-composite), failures=' + FAILS);
  J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
}

var truth = readUtf(ROOT + '/data/db_laser_sub_truth.txt');
function section(name) { var m = new RegExp('## ' + name + '\\n([^]*?)(\\n## |$)').exec(truth); return m ? m[1].trim().split(/\r?\n/) : []; }
var sub = {}; section('subtotal_by_day').forEach(function (ln) { var p = ln.split('|'); if (p.length >= 3) sub[p[0]] = { plan: +p[1], done: +p[2] }; });
var gt = (section('grand_total')[0] || '').split('|');
var grandPlan = +gt[0], grandDone = +gt[1];

// 解析 grid：取 date 行（col0 形如 2026-09-xx）+ 总计行
var gDays = {}, gTotal = null;
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
