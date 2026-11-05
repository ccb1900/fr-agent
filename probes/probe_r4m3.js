// probe_r4m3.js — M3 决定性变异：setVanChartPlotType(STACK) + 原 stack 接线 → 渲染 stackCols
//   已证：isStackChart() 只认 plot.vanChartPlotType==STACK（或 customType=STACK_COLUMN_LINE）；我们此前是 NORMAL。
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
  // 先求饱和像素 bbox，再在 bbox 内每列判 ≥2 种饱和色（堆叠签名）——全页扫描会被小格子骗
  var w = p.getWidth(), h = p.getHeight();
  var x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (var x = 0; x < w; x += 4) for (var y = 0; y < h; y += 4) {
    var c = p.getRGB(x, y);
    var r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
    if (Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255) <= 60) continue;
    if (r > x0) 0; // noop
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return 0;
  var cols = 0;
  for (var x2 = x0; x2 <= x1; x2 += 2) {
    var seen = {}, uniq = 0;
    for (var y2 = y0; y2 <= y1; y2 += 1) {
      var c2 = p.getRGB(x2, y2);
      var r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
      if (Math.abs(r2 - 255) + Math.abs(g2 - 255) + Math.abs(b2 - 255) <= 60) continue;
      var q = ((r2 >> 4) << 8) | ((g2 >> 4) << 4) | (b2 >> 4);
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

function newCase() {
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
  var plot = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  var CSC = Class.forName('com.fr.chart.chartdata.ChartSummaryColumn');
  var cols = J('java.lang.reflect.Array').newInstance(CSC, 2);
  cols[0] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
  cols[1] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('良率', '良率', new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
  var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, new (J('com.fr.chart.chartattr.ChartCollection'))());
  cell.getValue().addChart(chart);
  sheet.addCellElement(cell);
  sheet.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(260 * 12700)));
  sheet.setColumnWidth(0, J('com.fr.stable.unit.FU').getInstance(Math.round(700 * 12700)));   // 图表要大格子才会展开画
  wb.addReport('sheet1', sheet);
  return wb;
}
var STACK_ENUM = J('com.fr.plugin.chart.type.VanChartPlotType').STACK;
var STACK_PCT = J('com.fr.plugin.chart.type.VanChartPlotType').STACK_BY_PERCENT;
var CC = 'com.fr.chart.chartglyph.ConditionCollection';
var CA = 'com.fr.chart.chartglyph.ConditionAttr';
function wireStack(plot) {
  var scc = new (J(CC))();
  var d0 = new (J(CA))(); d0.setName('');
  scc.setDefaultAttr(d0);
  var sd = new (J(CA))(); sd.setName('堆积和坐标轴1');
  sd.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
  var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
  sa.setStacked(true); sa.setStackID('堆积和坐标轴1'); sa.setXAxisIndex(0); sa.setYAxisIndex(0);
  sd.addDataSeriesCondition(sa);
  scc.addConditionAttr(sd);
  plot.setStackAndAxisCondition(scc);
}
function render(id, mut) {
  var wb = newCase();
  var plot = wb.getReport('sheet1').getCellElement(0, 0).getValue().getChart(0).getPlot();
  mut(plot);
  print('isStackChart=' + plot.isStackChart() + ' isPercentStackChart=' + plot.isPercentStackChart());
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  if (!rb) { print('!! ' + id + ' execute null'); return; }
  var pngP = 'D:/fineagent/logs/_r4m3_' + id + '.png';
  var osP = new (J('java.io.FileOutputStream'))(pngP);
  new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
  osP.close();
  var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(pngP));
  print('== M3 ' + id + ' stackCols=' + barScore(img) + ' dark=' + darkPix(img) + ' size=' + img.getWidth() + 'x' + img.getHeight());
}
render('off', function (p) { });
render('stack', function (p) { wireStack(p); p.setVanChartPlotType(STACK_ENUM); });
render('stackPct', function (p) { wireStack(p); p.setVanChartPlotType(STACK_PCT); });
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
