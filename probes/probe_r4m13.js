// probe_r4m13.js — vpie 图例 position 扫描:m12 证实"图例区随图表高度分享,不够则静默截条"
//   (170pt→2 条,300pt→4 条;setMaxHeight(120) 无效)。m13 扫 position 1..4 找横向布局位,
//   并加 P3_260 参考臂。臂产物 logs/_r4m13_*.png 目检条数。
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

function build(heightPt, legendMut) {
  var wb = new (J('com.fr.main.impl.WorkBook'))();
  var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
  etd.addColumn('机型', Class.forName('java.lang.String'));
  etd.addColumn('产量', Class.forName('java.lang.Integer'));
  etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120)]));
  etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(200)]));
  etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(160)]));
  etd.addRow(J('java.util.Arrays').asList(['D线', J('java.lang.Integer').valueOf(90)]));
  wb.putTableData('dsVan', etd);
  var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
  var plot = new (J('com.fr.plugin.chart.PiePlot4VanChart'))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  chart.setFilterDefinition(new (J('com.fr.plugin.chart.data.VanChartOneValueCDDefinition'))(
    new (J('com.fr.data.impl.NameTableData'))('dsVan'), '', '机型', '产量',
    new (J('com.fr.data.util.function.SumFunction'))()));
  if (legendMut && plot.getLegend()) legendMut(plot.getLegend());
  var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, new (J('com.fr.chart.chartattr.ChartCollection'))());
  cell.getValue().addChart(chart);
  sheet.addCellElement(cell);
  sheet.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(heightPt * 12700)));
  sheet.setColumnWidth(0, J('com.fr.stable.unit.FU').getInstance(Math.round(600 * 12700)));
  wb.addReport('sheet1', sheet);
  return wb;
}
function render(id, heightPt, legendMut) {
  try {
    var wb = build(heightPt, legendMut);
    var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
    if (!rb) { print('!! ' + id + ' execute null'); return; }
    var pngP = 'D:/fineagent/logs/_r4m13_' + id + '.png';
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    print('== M13 ' + id + ' PNG ' + pngP);
  } catch (e) { print('!! M13 ' + id + ' FAIL ' + e); }
}
render('P1', 170, function (lg) { lg.setPosition(1); });
render('P2', 170, function (lg) { lg.setPosition(2); });
render('P3', 170, function (lg) { lg.setPosition(3); });
render('P4', 170, function (lg) { lg.setPosition(4); });
render('P3_260', 260, function (lg) { lg.setPosition(3); });
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
