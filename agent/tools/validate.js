// agent/tools/validate.js — fr-agent 工具层 verb: validate（零引擎）；r10-A runId 化
//   输入 runDir/compile.json（compile verb 产物）；可选 RESULT_DUMP 栅格做数据自洽核验：
//     ① RunResult success=true 且 11 阶段全 passed；② CPT/PNG 产物存在且 PNG 非空；
//     ③ 栅格：合计行 = 明细行之和（planned/done），完成率 = done/planned*100（±0.01）；
//     ④ 若 env AGENT_EXPECT_TOTALS="33531:26531" 再与外部真值对拍。
//   输出 runDir/validate.json：{runId, tool, ok, checks:[{name,pass,detail}]}。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');

var runId = runIdOf();
var runDir = runDirOf(runId);

var checks = [];
function ck(name, pass, detail) { checks.push({ name: name, pass: !!pass, detail: detail == null ? null : String(detail) }); }
function num(s) { var t = String(s).replace(/[,%\s]/g, ''); if (!/^-?\d+(\.\d+)?$/.test(t)) return null; return parseFloat(t); }
var compPath = System.getenv('AGENT_COMPILE') || (runDir + '/compile.json');
var comp = null;
try { comp = JSON.parse(readUtf(compPath)); } catch (e) { comp = null; }
ck('compile.json 可读', !!comp, compPath);
if (!comp) { ck('validate 前置失败', false, 'compile verb 未先跑'); }
else {
  var rr = null;
  try { rr = JSON.parse(readUtf(absOf(comp.runResult))); } catch (e2) { rr = null; }
  ck('RunResult 可读', !!rr, comp.runResult || '');
  if (rr) {
    ck('run success=true', rr.success === true, 'exit=' + rr.exit);
    var stages = rr.stages || {};
    var bad = Object.keys(stages).filter(function (k) { return stages[k] !== 'passed'; });
    ck('11 阶段全 passed', bad.length === 0, bad.join(','));
  }
  var cptAbs = absOf(comp.cptPath);
  var pngAbs = absOf(comp.pngPath);
  ck('CPT 产物存在', exists(cptAbs), cptAbs);
  var pngOk = exists(pngAbs) && Files.size(Pth.get(pngAbs)) > 1000;
  ck('PNG 产物非空(>1KB)', pngOk, exists(pngAbs) ? Files.size(Pth.get(pngAbs)) : 'missing');

  // ---- 栅格数据自洽 ----
  var gridPath = comp.gridPath ? absOf(comp.gridPath) : null;
  if (gridPath && exists(gridPath)) {
    var lines = readUtf(gridPath).split('\n').filter(function (l) { return l.indexOf('|') >= 0 && l.indexOf('## REPORT') !== 0 && l.indexOf('RB_CLASS=') !== 0; });
    var rows = lines.map(function (l) { return l.split('|'); });
    ck('栅格行数>0', rows.length > 0, rows.length);
    if (rows.length >= 2) {
      var total = rows[rows.length - 1];
      var numsOf = function (r) { return r.map(num); };
      var tn = numsOf(total).filter(function (x) { return x != null; });
      var sumPlan = 0, sumDone = 0;
      for (var i = 0; i < rows.length - 1; i++) {
        var dn = numsOf(rows[i]).filter(function (x) { return x != null; });
        if (dn.length >= 2) { sumPlan += dn[0]; sumDone += dn[1]; }
      }
      var t3 = tn.slice(-3);
      var tPlan = t3[0], tDone = t3[1], tRate = t3[2];
      ck('合计行含 [计划,完成,完成率]', t3.length >= 3, JSON.stringify(tn));
      if (t3.length >= 3) {
        ck('计划合计 = 明细之和', Math.abs(tPlan - sumPlan) < 0.5, 'total=' + tPlan + ' sum=' + sumPlan);
        ck('完成合计 = 明细之和', Math.abs(tDone - sumDone) < 0.5, 'total=' + tDone + ' sum=' + sumDone);
        ck('完成率 = done/planned*100（±0.01）', tPlan > 0 && Math.abs(tRate - tDone * 100 / tPlan) <= 0.01, 'rate=' + tRate + ' calc=' + (tPlan ? (tDone * 100 / tPlan).toFixed(2) : 'n/a'));
      }
      var expect = System.getenv('AGENT_EXPECT_TOTALS');
      if (expect) {
        var ep = String(expect).split(':');
        ck('合计对拍外部真值(' + expect + ')', Math.abs(tPlan - parseFloat(ep[0])) < 0.5 && Math.abs(tDone - parseFloat(ep[1])) < 0.5, 'total=' + tPlan + '/' + tDone);
      }
    }
  } else ck('栅格可用（缺省跳过，不假绿）', true, 'no grid (RESULT_DUMP 未开启)');
}
var ok = checks.every(function (c) { return c.pass; });
writeJson(runDir + '/validate.json', { runId: runId, tool: 'validate', ok: ok, checks: checks });
print('{"ok":' + ok + ',"runId":"' + runId + '","result":"logs/agent/runs/' + runId + '/validate.json"}');
System.exit(ok ? 0 : 1);
