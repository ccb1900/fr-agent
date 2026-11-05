// probe_r4m11.js — vpie 图例 4 见 3 定位:armOFF=官方现金流量分析.cpt 经 readTemplateWorkBook 渲染(引擎基线);
//   armV0=我们同构构造(PiePlot4VanChart+OneValueCD 系列名'');armV1=同构但系列名非空。
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

function shot(rb, id) {
  var pngP = 'D:/fineagent/logs/_r4m11_' + id + '.png';
  var osP = new (J('java.io.FileOutputStream'))(pngP);
  new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
  osP.close();
  print('== M11 ' + id + ' PNG ' + pngP);
}
renderOFF = function () {
  try {
    var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('demo/analytics/financial/现金流量分析.cpt');
    var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
    if (!rb) { print('!! OFF execute null'); return; }
    shot(rb, 'OFF');
  } catch (e) { print('!! OFF FAIL ' + e); }
};
function ourVpie(id, seriesName) {
  try {
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
      new (J('com.fr.data.impl.NameTableData'))('dsVan'), seriesName, '机型', '产量',
      new (J('com.fr.data.util.function.SumFunction'))()));
    var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, new (J('com.fr.chart.chartattr.ChartCollection'))());
    cell.getValue().addChart(chart);
    sheet.addCellElement(cell);
    sheet.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(300 * 12700)));
    sheet.setColumnWidth(0, J('com.fr.stable.unit.FU').getInstance(Math.round(600 * 12700)));
    wb.addReport('sheet1', sheet);
    var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
    if (!rb) { print('!! ' + id + ' execute null'); return; }
    shot(rb, id);
  } catch (e) { print('!! ' + id + ' FAIL ' + e); }
}
renderOFF();
ourVpie('V0', '');
ourVpie('V1', '库存');
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
