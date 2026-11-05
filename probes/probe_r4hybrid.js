// probe_r4hybrid.js — 决定性杂交实验：官方 Demo.cpt 的 plot 对象偷梁换柱绑我们的数据
//   已知事实：官方 Demo.cpt 在本管线 stackCols=168 真渲染；我们 fresh plot + 同形 XML 接线 = PNG 逐字节无变化。
//   armA: 官方堆叠 plot + 我们 dsVan 数据 → 若堆起来，锅在 plot 对象内部字段（继续 XML diff 定位）；若不堆 → 锅在数据绑定面
//   armB: 官方 label enable=true 的 chart + 我们 dsVan 数据 → dark 指标（官方 label 真渲染的形状）
//   armC: 我们 fresh plot + L2 label 变异（det.getContent() → value format enable）
// 每臂 export cpt（供后续 XML diff）+ png + 像素三指标。
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
var GC = J('com.fr.general.GeneralContext');
var loc0 = GC.getLocale();
GC.setLocale(new (J('java.util.Locale'))('zh', 'CN'));
J('com.fr.general.I18nResource').getInstance();

function barScore(p) {
  var w = p.getWidth(), h = p.getHeight(), cols = 0;
  for (var x = 0; x < w; x += 2) {
    var seen = {}, uniq = 0;
    for (var y = Math.round(h * 0.08); y < Math.round(h * 0.92); y += 1) {
      var c = p.getRGB(x, y);
      var r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      var mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b));
      if (mx - mn < 45) continue;
      var q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      if (!seen[q]) { seen[q] = 1; uniq++; if (uniq >= 2) { cols++; break; } }
    }
  }
  return cols;
}
function countIf(p, fn) {
  var w = p.getWidth(), h = p.getHeight(), n = 0;
  for (var y = 0; y < h; y += 1) for (var x = 0; x < w; x += 2) {
    var c = p.getRGB(x, y);
    if (fn((c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff)) n++;
  }
  return n;
}
function darkPix(p) { return countIf(p, function (r, g, b) { return (r * 299 + g * 587 + b * 114) / 1000 < 100; }); }
function redPix(p) { return countIf(p, function (r, g, b) { return r > 140 && g < 90 && b < 90; }); }

// —— 我们的数据工作簿（与 probe_render4 同形）——
function ourWb() {
  var wb = new (J('com.fr.main.impl.WorkBook'))();
  var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
  etd.addColumn('机型', Class.forName('java.lang.String'));
  etd.addColumn('产量', Class.forName('java.lang.Integer'));
  etd.addColumn('良率', Class.forName('java.lang.Integer'));
  etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120), J('java.lang.Integer').valueOf(98)]));
  etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(200), J('java.lang.Integer').valueOf(93)]));
  etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(160), J('java.lang.Integer').valueOf(85)]));
  wb.putTableData('dsVan', etd);
  var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
  wb.addReport('sheet1', sheet);
  return wb;
}
function bindVan(chart) {
  var CSC = Class.forName('com.fr.chart.chartdata.ChartSummaryColumn');
  var cols = J('java.lang.reflect.Array').newInstance(CSC, 2);
  cols[0] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
  cols[1] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('良率', '良率', new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
}
function putChart(wb, cc) {
  var sheet = wb.getReport('sheet1');
  var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, cc);
  sheet.addCellElement(cell);
  sheet.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(260 * 12700)));
}
var IO = J('javax.imageio.ImageIO');
var Paths = J('java.nio.file.Paths');
function renderArm(id, chart, keepOwnData) {
  try {
    var wb = ourWb();
    if (!keepOwnData) bindVan(chart);
    var cc2 = new (J('com.fr.chart.chartattr.ChartCollection'))();
    cc2.addChart(chart);
    putChart(wb, cc2);
    var cptP = 'D:/fineagent/logs/_r4hy_' + id + '.cpt';
    var fos = new (J('java.io.FileOutputStream'))(cptP); wb.export(fos); fos.close();
    var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
    if (!rb) { print('!! arm ' + id + ' execute null'); return; }
    var pngP = 'D:/fineagent/logs/_r4hy_' + id + '.png';
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    var img = IO.read(Paths.get(pngP).toFile());
    print('== ARM ' + id + ' stack=' + barScore(img) + ' dark=' + darkPix(img) + ' red=' + redPix(img) + ' (' + img.getWidth() + 'x' + img.getHeight() + ')');
  } catch (e) {
    print('!! ARM ' + id + ' FAIL: ' + e);
  }
}

// —— 定位官方图（WorkSheet 用 getCellElement 网格扫描，probe_r4disc 实证 // iteratorOfElementCase 风险高）——
var wbOfficial = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('demo/analytics/Demo.cpt');
var stackPlot = null, labelChart = null;
function walkOfficialCharts(fn) {
  for (var r = 0; r < 40; r++) for (var c = 0; c < 40; c++) {
    var v = null;
    try { var el = wbOfficial.getReport(0).getCellElement(c, r); if (el != null) v = el.getValue(); } catch (e0) { }
    if (v == null || !v.getClass) continue;
    if (String(v.getClass().getName()).indexOf('ChartCollection') < 0) continue;
    for (var ci = 0; ci < v.getChartCount(); ci++) fn(v.getChart(ci), c, r, ci);
  }
}
walkOfficialCharts(function (ch, c, r, ci) {
  var pl = ch.getPlot();
  var sc = null; try { sc = pl.getStackAndAxisCondition(); } catch (e3) { }
  var hasLabel = false;
  try {
    var ccL = pl.getConditionCollection();
    if (ccL != null) {
      var dafL = null; var msL0 = ccL.getClass().getMethods();
      for (var q0 = 0; q0 < msL0.length; q0++) if (String(msL0[q0].getName()) === 'getDefaultAttr') dafL = msL0[q0].invoke(ccL, []);
      if (dafL != null) {
        var alL = null; var msL1 = dafL.getClass().getMethods();
        for (var q1 = 0; q1 < msL1.length; q1++) if (String(msL1[q1].getName()) === 'getAttrList') alL = msL1[q1].invoke(dafL, []);
        if (alL != null) for (var aL = 0; aL < alL.size(); aL++) {
          var obL = alL.get(aL);
          if (String(obL.getClass().getName()).indexOf('AttrLabel') >= 0) {
            var enL = null; var msL2 = obL.getClass().getMethods();
            for (var q2 = 0; q2 < msL2.length; q2++) if (String(msL2[q2].getName()) === 'isEnable') enL = msL2[q2].invoke(obL, []);
            if (enL == true) hasLabel = true;
          }
        }
      }
    }
  } catch (eLC) { }
  print('chart(' + c + ',' + r + ')[' + ci + '] plot=' + pl.getClass().getName() + ' stack=' + (sc != null) + ' labelEnable=' + hasLabel);
  if (sc != null && stackPlot == null) { stackPlot = pl; print('  -> stackplot adopted'); }
  if (hasLabel && labelChart == null) { labelChart = ch; print('  -> labelchart adopted'); }
});
if (!stackPlot) { print('!! stack plot not found'); }

// 官方 stack CC 内容 dump（找到 ConditionAttr 的 name / attr 类型）
for (var dumpIdx = 0; dumpIdx < 1; dumpIdx++) try {
  var sc = stackPlot.getStackAndAxisCondition();
  var attrs = null;
  var ms = sc.getClass().getMethods();
  for (var mi = 0; mi < ms.length; mi++) if (String(ms[mi].getName()).indexOf('ConditionAttrList') >= 0) attrs = ms[mi].invoke(sc, []);
  print('official stack CC=' + sc + ' attrsList=' + attrs);
  if (attrs) {
    for (var ai = 0; ai < attrs.size(); ai++) {
      var ca = attrs.get(ai);
      print('  CA name=' + ca.getName() + ' conds=' + ca.getCondition());
      var al = ca.getAttrList ? null : null;
      var m2 = ca.getClass().getMethods();
      for (var m2i = 0; m2i < m2.length; m2i++) if (String(m2[m2i].getName()) === 'getAttrList') { al = m2[m2i].invoke(ca, []); }
      if (al) for (var li = 0; li < al.size(); li++) {
        var a = al.get(li);
        print('    Attr ' + a.getClass().getName() + ' toString=' + String(a).substring(0, Math.min(160, String(a).length)));
      }
    }
  }
  // 我们 fresh 形同参打印
  var scc = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
  var d0 = new (J('com.fr.chart.chartglyph.ConditionAttr'))(); d0.setName('');
  scc.setDefaultAttr(d0);
  var sd = new (J('com.fr.chart.chartglyph.ConditionAttr'))(); sd.setName('堆积和坐标轴1'); sd.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
  var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
  sa.setStacked(true); sa.setStackID('堆积和坐标轴1'); sa.setXAxisIndex(0); sa.setYAxisIndex(0);
  sd.addDataSeriesCondition(sa);
  scc.addConditionAttr(sd);
  print('ours stack CC=' + scc + ' size-ish=' + String(scc).length);
} catch (eDump) { print('!! dump failed: ' + eDump); }

// armA: 官方堆叠 plot + 我们的数据
if (stackPlot) {
  var chartA = new (J('com.fr.plugin.chart.vanchart.VanChart'))(stackPlot);
  chartA.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  renderArm('stackA', chartA, false);
}
// armB: 官方 label 图 + 我们的数据（dark 指标）
var labelPlot = null;
if (labelChart != null) labelPlot = labelChart.getPlot();
if (labelPlot) {
  var chartB = new (J('com.fr.plugin.chart.vanchart.VanChart'))(labelPlot);
  chartB.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  renderArm('labelB', chartB, false);
}
// armC: 我们 fresh plot + L2 label（det.getContent() 路径）
function armC() {
  var wb = ourWb();
  var plot = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  bindVan(chart);
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
  lab.setEnable(true);
  var det = lab.getAttrLabelDetail();
  var msDet = det.getClass().getMethods(); var content = null;
  for (var i = 0; i < msDet.length; i++) if (String(msDet[i].getName()) === 'getContent') content = msDet[i].invoke(det, []);
  print('armC det content=' + content + (content ? ' class=' + content.getClass().getName() : ''));
  if (content != null) {
    var msCo = content.getClass().getMethods(); var vf = null;
    for (var i2 = 0; i2 < msCo.length; i2++) if (String(msCo[i2].getName()) === 'getValueFormat') vf = msCo[i2].invoke(content, []);
    print('armC valueFormat=' + vf);
    if (vf != null) { var msV = vf.getClass().getMethods(); for (var i3 = 0; i3 < msV.length; i3++) if (String(msV[i3].getName()) === 'setEnable') msV[i3].invoke(vf, [true]); }
  }
  var cc3 = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
  var d3 = new (J('com.fr.chart.chartglyph.ConditionAttr'))(); d3.setName('');
  cc3.setDefaultAttr(d3);
  lab.setPosition ? null : null;
  d3.addDataSeriesCondition(lab);
  cc3.addConditionAttr ? null : null;
  plot.setConditionCollection(cc3);
  var cc2 = new (J('com.fr.chart.chartattr.ChartCollection'))();
  cc2.addChart(chart);
  putChart(wb, cc2);
  var cptP = 'D:/fineagent/logs/_r4hy_labelC2.cpt';
  var fos = new (J('java.io.FileOutputStream'))(cptP); wb.export(fos); fos.close();
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  if (!rb) { print('!! armC execute null'); return; }
  var pngP = 'D:/fineagent/logs/_r4hy_labelC2.png';
  var osP = new (J('java.io.FileOutputStream'))(pngP);
  new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
  osP.close();
  var img = IO.read(Paths.get(pngP).toFile());
  print('== ARM labelC2 stack=' + barScore(img) + ' dark=' + darkPix(img) + ' red=' + redPix(img));
}
armC();
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
