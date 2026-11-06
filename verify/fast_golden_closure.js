// verify/fast_golden_closure.js - Golden closure offline verifier (no engine, no FineDB)
//   Proves the two gaps the external reviewer named, using REAL prior-run artifacts:
//   (1) day@machine full-grid truth: load logs/agent/runs/ge20261106123412/grid.txt (or GRID env)
//       and assert 10 detail rows + double-key closure + plan/done/rate per row + totals 33531/26531/79.1238,
//       exactly what verify_sql_data.js TRUTH_DAY_MACHINE=1 checks (re-implemented inline as pure JS assertions).
//   (2) modify closure: read logs/agent/runs/g1/patch.json -> ok / diffClean / execution.pass / render.pass,
//       and confirm the original .orig.cpt is kept in staging.
//   This is the machine-checkable acceptance the e2e script calls between create and preview; running it
//   standalone against existing golden artifacts makes the assertions reproducible even without a fresh engine run.
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Paths = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function read(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Paths.get(p)), 'UTF-8')); }
function exists(p) { return Files.exists(Paths.get(p)); }

// ---- (1) day@machine full-grid truth ----
var truthPath = ROOT + '/data/db_laser_machine_daily_truth.txt';
var gridPath = J('java.lang.System').getenv('GRID') || (ROOT + '/logs/agent/runs/ge20261106123412/grid.txt');
if (!exists(gridPath) || !exists(truthPath)) {
  print('CHECK FAIL: grid/truth missing -> ' + gridPath + ' / ' + truthPath); FAILS++;
} else {
  var truth = read(truthPath);
  function sec(name) { var m = new RegExp('## ' + name + '\\n([^]*?)(\\n## |$)').exec(truth); return m ? m[1].trim().split(/\r?\n/) : []; }
  var det = {}, dupT = 0;
  sec('detail_day_machine').forEach(function (ln) { var p = ln.split('|'); if (p.length >= 5) {
    var k = p[0] + '@' + p[1]; if (det[k]) dupT++; else det[k] = { plan: +p[2], done: +p[3], rate: +p[4] };
  } });
  var g2 = (sec('grand_total')[0] || '').split('|');
  var gPlan = +g2[0], gDone = +g2[1], gRate = +g2[2];
  var grid = read(gridPath).split(/\r?\n/);
  var gm = {}, dupG = 0, gTot = null;
  grid.forEach(function (ln) { var p = ln.split('|');
    if (p.length >= 5 && /^20\d\d-\d\d-\d\d$/.test(p[0])) { var k = p[0] + '@' + p[1]; if (gm[k]) dupG++; else gm[k] = { plan: +p[2], done: +p[3], rate: +p[4] }; }
    else if (p.length >= 5 && /^总计/.test(p[0]) && p[0].indexOf('@') < 0) gTot = { plan: +p[2], done: +p[3], rate: +p[4] };
  });
  var onlyT = Object.keys(det).filter(function (k) { return !gm[k]; });
  var onlyG = Object.keys(gm).filter(function (k) { return !det[k]; });
  var mm = [];
  Object.keys(gm).forEach(function (k) { var t = det[k];
    if (!t || t.plan !== gm[k].plan || t.done !== gm[k].done || Math.abs(t.rate - gm[k].rate) >= 0.01) mm.push(k);
  });
  check('truth 复合键无重复（' + dupT + '）', dupT === 0);
  check('grid 复合键无重复（' + dupG + '）', dupG === 0);
  check('双向完整键集合（truth 独有 ' + onlyT.length + ' / grid 独有 ' + onlyG.length + '）', onlyT.length === 0 && onlyG.length === 0);
  check('明细行数一致（grid=' + Object.keys(gm).length + ' truth=' + Object.keys(det).length + '）', Object.keys(gm).length === Object.keys(det).length && Object.keys(gm).length === 10);
  check('day@machine 逐行 plan/done/rate 逐格（不符 ' + mm.length + '）', mm.length === 0);
  if (mm.length) mm.slice(0,4).forEach(function (x) { print('   ' + x); });
  check('总计 plan==33531', gTot && gTot.plan === gPlan && gPlan === 33531);
  check('总计 done==26531', gTot && gTot.done === gDone && gDone === 26531);
  check('总计 rate≈79.1238(±0.01)', gTot && Math.abs(gTot.rate - gRate) < 0.01 && Math.abs(gTot.rate - 79.1238) < 0.01);
}

// ---- (2) modify closure (g1 real patch artifacts) ----
var pj = ROOT + '/logs/agent/runs/g1/patch.json';
if (!exists(pj)) { print('CHECK FAIL: patch.json missing -> ' + pj); FAILS++; }
else {
  var d = JSON.parse(read(pj));
  var m = d.manifest || {};
  check('modify ok=true', d.ok === true);
  check('modify diffClean=true（未改部分不变）', m.diffClean === true);
  check('modify execution.pass=true（栅格逐格不变）', m.execution && m.execution.pass === true);
  check('modify render.pass=true（像素差异有改动且≤阈值）', m.render && m.render.pass === true);
  var staging = ROOT + '/logs/agent/runs/g1/staging';
  var orig = false;
  try { var fs = new (J('java.io.File'))(staging).listFiles();
    for (var i = 0; fs && i < fs.length; i++) if (String(fs[i].getName()).indexOf('.orig.cpt') >= 0) orig = true;
  } catch (e) { }
  check('原件 .orig.cpt 保留在 staging', orig);
}
print('GOLDEN CLOSURE OFFLINE END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
