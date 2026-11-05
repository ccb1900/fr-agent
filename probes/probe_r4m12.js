// probe_r4m12.js — vpie 4 见 3 根因反射:m11 V0(300pt)图例 4 条全出;载体=170pt 只见 3。
//   假设=Legend4VanChart maxHeight=30 空间上限。臂:H0 高170 镜像 / H2 高300 同镜像 / H4 高170+maxHeight 调大。
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
    var pngP = 'D:/fineagent/logs/_r4m12_' + id + '.png';
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    var lg = null;
    try { lg = wb.getReport('sheet1').getCellElement(0, 0).getValue().getChart(0).getPlot().getLegend(); } catch (e) { }
    print('== M12 ' + id + ' legendClass=' + (lg ? String(lg.getClass().getName()).split('.').pop() : 'n/a') + ' PNG ' + pngP);
  } catch (e) { print('!! M12 ' + id + ' FAIL ' + e); }
}
render('H0_170_default', 170, null);
render('H2_300_default', 300, null);
render('H4_170_maxH120', 170, function (lg) {
  var ms = lg.getClass().getMethods();
  var hits = [];
  for (var i = 0; i < ms.length; i++) { var n = String(ms[i].getName()); if (/axHeight|More|egendView|Delaide/i.test(n)) hits.push(n + ms[i].getParameterTypes().length); }
  print('   legend methods(max/*): ' + hits.join(' '));
  try { lg.setMaxObjectHeight ? null : null; } catch (e) { }
  var set4 = null;
  for (var k = 0; k < ms.length; k++) if (String(ms[k].getName()) === 'setMaxHeight') set4 = ms[k];
  if (set4) { try { set4.invoke(lg, J('java.lang.Float').valueOf(120.0)); print('   setMaxHeight(120) OK'); } catch (e2) { print('   invoke fail ' + e2); } }
  else print('   setMaxHeight ABSENT');
});
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
