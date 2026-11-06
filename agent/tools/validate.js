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
    // C段断点修复（2026-11-07）：datasource_connect=skipped 是 rows 路内嵌数据集的合法终态
    //   （无 SQL 数据集可连，管线按设计 skip）——此前被当失败，任何非 demo 的 rows 报表 validate 都过不去。
    //   其余阶段仍必须 passed（skipped 不再被容忍于其它阶段）。
    var bad = Object.keys(stages).filter(function (k) { return stages[k] !== 'passed' && !(k === 'datasource_connect' && stages[k] === 'skipped'); });
    ck('11 阶段全 passed（datasource_connect 允许 rows 路 skipped）', bad.length === 0, bad.join(','));
  }
  var cptAbs = absOf(comp.cptPath);
  var pngAbs = absOf(comp.pngPath);
  ck('CPT 产物存在', exists(cptAbs), cptAbs);
  var pngOk = exists(pngAbs) && Files.size(Pth.get(pngAbs)) > 1000;
  ck('PNG 产物非空(>1KB)', pngOk, exists(pngAbs) ? Files.size(Pth.get(pngAbs)) : 'missing');

  // ---- 栅格数据自洽 ----
  // A段 P1b（2026-11-07）：合计自洽从"假设列序（第一二数值列=计划/完成，合计行末三数值列）"改为
  //   "表头签名识别"——只当表头行点名 计划/完成/完成率 时才跑逐列自洽；其他形状（多 Sheet 合并表头、
  //   图表页、任意业务列序）不再误算误报（此前会把任意报表的第一二数值列硬当 planned/done）。
  //   外部真值对拍（AGENT_EXPECT_TOTALS）仍可用：签名命中时用识别列；未命中时直接拒（明示没有可对拍口径）。
  var gridPath = comp.gridPath ? absOf(comp.gridPath) : null;
  if (gridPath && exists(gridPath)) {
    var lines = readUtf(gridPath).split('\n').filter(function (l) { return l.indexOf('|') >= 0 && l.indexOf('## REPORT') !== 0 && l.indexOf('RB_CLASS=') !== 0; });
    var rows = lines.map(function (l) { return l.split('|'); });
    ck('栅格行数>0', rows.length > 0, rows.length);
    if (rows.length >= 2) {
      // night-shift：总计行按"合计|总计"判定（与 compare_paths totalsOf 一致化），不再假设最后一行——
      //   报表带脚注行（presentation.footnote）时"最后一行"会取到脚注导致合计自洽误报。
      function isTotalRow(r) { return /合计|总计/.test(String(r && r[0])); }
      var header = rows[0];
      var idxPlan = -1, idxDone = -1, idxRate = -1;
      for (var hi = 0; hi < header.length; hi++) {
        var h = String(header[hi]);
        if (idxPlan < 0 && h.indexOf('计划') >= 0 && h.indexOf('率') < 0) { idxPlan = hi; continue; }
        if (idxRate < 0 && h.indexOf('完成率') >= 0) { idxRate = hi; continue; }
        if (idxDone < 0 && h.indexOf('完成') >= 0) { idxDone = hi; }
      }
      if (idxPlan >= 0 && idxDone >= 0 && idxRate >= 0) {
        var total = null, sumPlan = 0, sumDone = 0;
        for (var i = 0; i < rows.length; i++) {
          if (isTotalRow(rows[i])) { total = rows[i]; continue; }
          var pv = num(rows[i][idxPlan]), dv = num(rows[i][idxDone]);
          if (pv != null) sumPlan += pv;
          if (dv != null) sumDone += dv;
        }
        var tPlan = total ? num(total[idxPlan]) : null;
        var tDone = total ? num(total[idxDone]) : null;
        var tRate = total ? num(total[idxRate]) : null;
        ck('合计行存在且含 [计划,完成,完成率]（表头列 ' + idxPlan + '/' + idxDone + '/' + idxRate + '）', tPlan != null && tDone != null && tRate != null, total ? JSON.stringify(total) : 'no total row');
        if (tPlan != null && tDone != null && tRate != null) {
          ck('计划合计 = 明细之和', Math.abs(tPlan - sumPlan) < 0.5, 'total=' + tPlan + ' sum=' + sumPlan);
          ck('完成合计 = 明细之和', Math.abs(tDone - sumDone) < 0.5, 'total=' + tDone + ' sum=' + sumDone);
          ck('完成率 = done/planned*100（±0.01）', tPlan > 0 && Math.abs(tRate - tDone * 100 / tPlan) <= 0.01, 'rate=' + tRate + ' calc=' + (tPlan ? (tDone * 100 / tPlan).toFixed(2) : 'n/a'));
        }
        var expect = System.getenv('AGENT_EXPECT_TOTALS');
        if (expect) {
          var ep = String(expect).split(':');
          ck('合计对拍外部真值(' + expect + ')', tPlan != null && tDone != null && Math.abs(tPlan - parseFloat(ep[0])) < 0.5 && Math.abs(tDone - parseFloat(ep[1])) < 0.5, 'total=' + tPlan + '/' + tDone);
        }
      } else {
        var expect2 = System.getenv('AGENT_EXPECT_TOTALS');
        if (expect2) ck('合计对拍外部真值(' + expect2 + ')', false, '栅格表头无 计划/完成/完成率 签名，无对拍口径: ' + header.join('|'));
        else ck('合计自洽（非 demo 表头签名，按形状跳过，不假绿不误报）', true, 'header=' + header.join('|').slice(0, 120));
      }
    }
  } else ck('栅格可用（缺省跳过，不假绿）', true, 'no grid (RESULT_DUMP 未开启)');
}
var ok = checks.every(function (c) { return c.pass; });
writeJson(runDir + '/validate.json', { runId: runId, tool: 'validate', ok: ok, checks: checks });
print('{"ok":' + ok + ',"runId":"' + runId + '","result":"logs/agent/runs/' + runId + '/validate.json"}');
System.exit(ok ? 0 : 1);
