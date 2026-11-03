// verify_drill_grid.js — 子模板栅格 vs 逐小时真值 + 与母版当日小计交叉核对
var fs = require('fs');
function sections(txt) {
  var cur = null, out = {};
  txt.split('\n').forEach(function (line) {
    if (/^## /.test(line)) { cur = line.slice(3).trim(); out[cur] = []; return; }
    if (cur && line.trim()) out[cur].push(line.split('|'));
  });
  return out;
}
var T = sections(fs.readFileSync('D:/fineagent/data/db_laser_sub_truth.txt', 'utf8'));
var drillKey = Object.keys(T).filter(function (k) { return /^drill_/.test(k); })[0];
var truth = T[drillKey];
var rows = fs.readFileSync('D:/fineagent/_drill_grid.txt', 'utf8').split('\n')
  .filter(function (l) { return /^\d{4}-\d{2}-\d{2}\|\d\d\|/.test(l); })
  .map(function (l) { return l.split('|'); });

var fails = 0, checks = 0;
function near(a, b, tol, w) {
  checks++;
  var x = parseFloat(a), y = parseFloat(b);
  if (isNaN(x) || isNaN(y) || Math.abs(x - y) > tol) { fails++; console.log('FAIL ' + w + ': report=' + a + ' truth=' + b); }
}
if (rows.length !== truth.length) { fails++; console.log('FAIL row count: report=' + rows.length + ' truth=' + truth.length); }
var sumCnt = 0, sumPass = 0, sumScore = 0;
rows.forEach(function (r, i) {
  var t = truth[i], w = 'hour[' + t[0] + ']';
  near(r[2], t[1], 0, w + ' row_cnt');
  near(r[3], t[2], 0, w + ' pass_cnt');
  near(r[5], t[4], 1e-6, w + ' wavg');
  near(r[4], t[3], 1e-6, w + ' score_sum');
  sumCnt += parseFloat(r[2]); sumPass += parseFloat(r[3]); sumScore += parseFloat(t[3]);
});
// 合计行（与母版当日小计必须同数）
var gLine = fs.readFileSync('D:/fineagent/_drill_grid.txt', 'utf8').split('\n').filter(function (l) { return /^当日合计/.test(l); })[0].split('|');
near(gLine[2], sumCnt, 0, '合计 row_cnt');
near(gLine[3], sumPass, 0, '合计 pass_cnt');
near(gLine[4], sumScore, 1e-3, '合计 score_sum');
near(gLine[5], sumScore / sumCnt, 1e-6, '合计 wavg');
var master = fs.readFileSync('D:/fineagent/_sub_grid.txt', 'utf8').split('\n')
  .filter(function (l) { return /^\|小计\|2121|^\|小计\|2117|^\|小计\|4238\|/.test(l); })[0].split('|');
near(gLine[2], master[2], 0, '子表合计 == 母版当日小计 row_cnt');
near(gLine[3], master[3], 0, '子表合计 == 母版当日小计 pass_cnt');
near(gLine[4], master[4], 1e-6, '子表合计 == 母版当日小计 score_sum');
console.log((fails === 0 ? 'PASS' : 'FAIL') + ' checks=' + checks + ' fails=' + fails + ' (drill rows=' + rows.length + ')');
process.exit(fails === 0 ? 0 : 1);
