// verify_sub_grid.js — 母版结果栅格 vs 直查真值：逐格穷举核对（node，不碰 FR）
// 用法：node verify_sub_grid.js [grid文件] [真值文件]
var fs = require('fs');
var gridPath = process.argv[2] || 'D:/fineagent/logs/_sub_grid.txt';
var truthPath = process.argv[3] || 'D:/fineagent/data/db_laser_sub_truth.txt';

function sections(txt) {
  var cur = null, out = {};
  txt.split('\n').forEach(function (line) {
    if (/^## /.test(line)) { cur = line.slice(3).trim(); out[cur] = []; return; }
    if (cur && line.trim()) out[cur].push(line.split('|'));
  });
  return out;
}
var T = sections(fs.readFileSync(truthPath, 'utf8'));
var grid = fs.readFileSync(gridPath, 'utf8').split('\n').filter(function (l) { return l && !/^(RB_CLASS|## REPORT)/.test(l); })
  .map(function (l) { return l.split('|'); });

var fails = 0, checks = 0;
function near(a, b, tol, where) {
  checks++;
  var x = parseFloat(a), y = parseFloat(b);
  if (isNaN(x) || isNaN(y) || Math.abs(x - y) > tol) {
    fails++; console.log('FAIL ' + where + ': report=' + a + ' truth=' + b);
  }
}
function eq(a, b, where) { checks++; if (String(a) !== String(b)) { fails++; console.log('FAIL ' + where + ': report="' + a + '" truth="' + b + '"'); } }

// 栅格分类：明细行（日期非空）/ 小计行 / 总计行
var dRows = grid.filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(r[0] || ''); });
var sRows = grid.filter(function (r) { return (r[1] || '').trim() === '小计'; });
var gRows = grid.filter(function (r) { return (r[1] || '').trim() === '总计'; });
console.log('counts: detail=' + dRows.length + ' subtotal=' + sRows.length + ' grand=' + gRows.length);
eq(dRows.length, T.detail.length, 'detail row count');
eq(sRows.length, T.subtotal_by_day.length, 'subtotal row count');
eq(gRows.length, T.grand_total.length, 'grand row count');

// 明细逐格（真值列：day|stage|row_cnt|pass_cnt|score_sum|min|max → 报表列 0,1,2,3,4,-,7）
dRows.forEach(function (r, i) {
  var t = T.detail[i], w = 'detail[' + i + ' ' + t[0] + '/' + t[1] + ']';
  eq(r[0], t[0], w + ' day'); eq((r[1] || '').trim(), t[1], w + ' stage');
  near(r[2], t[2], 0, w + ' row_cnt'); near(r[3], t[3], 0, w + ' pass_cnt');
  near(r[4], t[4], 1e-6, w + ' score_sum'); near(r[7], t[6], 1e-6, w + ' max');
  near(r[5], parseFloat(t[4]) / parseFloat(t[2]), 1e-9, w + ' avg=score_sum/row_cnt');
  near(r[6], parseFloat(t[3]) * 100 / parseFloat(t[2]), 1e-9, w + ' pass_rate');
});

// 小计逐格（真值列：day|row_cnt|pass_cnt|score_sum|wavg|min|max）
sRows.forEach(function (r, i) {
  var t = T.subtotal_by_day[i], w = 'subtotal[' + i + ' ' + t[0] + ']';
  near(r[2], t[1], 0, w + ' row_cnt'); near(r[3], t[2], 0, w + ' pass_cnt');
  near(r[4], t[3], 1e-6, w + ' score_sum'); near(r[5], t[4], 1e-6, w + ' wavg');
  near(r[6], parseFloat(t[2]) * 100 / parseFloat(t[1]), 1e-6, w + ' pass_rate');
  near(r[7], t[6], 1e-6, w + ' max');
});

// 总计
var g = gRows[0], t = T.grand_total[0], w = 'grand';
near(g[2], t[0], 0, w + ' row_cnt'); near(g[3], t[1], 0, w + ' pass_cnt');
near(g[4], t[2], 1e-6, w + ' score_sum'); near(g[5], t[3], 1e-6, w + ' wavg');
near(g[7], t[5], 1e-6, w + ' max');

// 加权口径反证：报表"总计平均分"必须 ≠ 各日平均分的简单平均（若相等说明口径退化成平均值的平均）
var simple = T.subtotal_by_day.reduce(function (a, r) { return a + parseFloat(r[4]); }, 0) / T.subtotal_by_day.length;
checks++;
if (Math.abs(parseFloat(g[5]) - simple) < 1e-6) { fails++; console.log('FAIL 加权口径: 总计平均分退化为简单平均 ' + simple); }
else console.log('OK 加权口径: 总计平均分=' + g[5] + ' ≠ 各日简单平均=' + simple.toFixed(6));

console.log((fails === 0 ? 'PASS' : 'FAIL') + ' checks=' + checks + ' fails=' + fails);
process.exit(fails === 0 ? 0 : 1);
