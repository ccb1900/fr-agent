// verify_aaa_grid.js — 第一份真库报表（日聚合 10 行 + 合计行）逐格核对
// 真值：db_laser_aaa_truth.txt（probe 直查同一条 SQL，列序与报表一致）
// 栅格：RESULT_DUMP 产物 _aaa_grid.txt（make_api.js 4.5 段）
var fs = require('fs');
var truth = fs.readFileSync('D:/fineagent/data/db_laser_aaa_truth.txt', 'utf8').trim().split(/\r?\n/)
  .map(function (l) { return l.split('|'); });
var grid = fs.readFileSync('D:/fineagent/logs/_aaa_grid.txt', 'utf8').split(/\r?\n/);
var rows = grid.filter(function (l) { return /^2026-\d\d-\d\d\|/.test(l); }).map(function (l) { return l.split('|'); });
var tot = grid.filter(function (l) { return /^合计\/日均\|/.test(l); })[0].split('|');
var checks = 0, fails = 0;
function eq(a, b, tag) {
  checks++;
  if (a !== b) { fails++; console.log('FAIL ' + tag + ': report=' + a + ' truth=' + b); }
}
eq(String(rows.length), String(truth.length), 'detail rowcount');
truth.forEach(function (t, i) {
  var r = rows[i] || [];
  for (var c = 0; c < t.length; c++) eq(r[c], t[c], 'cell ' + t[0] + ' col' + c);
});
eq(tot[1], '33531', 'grand row_cnt');
eq(tot[3], '0.95011', 'grand wavg');
console.log((fails === 0 ? 'PASS' : 'FAIL') + ' checks=' + checks + ' fails=' + fails + ' rows=' + rows.length);
