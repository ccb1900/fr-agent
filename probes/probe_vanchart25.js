// probe_vanchart25.js — demo wb 骨架 + 裸构造图 cell 替换：A(裸) vs B(补齐 diff 项) 渲染二分
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
try { J('com.fr.general.I18nResource').getInstance(); } catch (e) { print('I18nResource init WARN ' + e); }
try { J('com.fr.general.GeneralContext').setLocale(new (J('java.util.Locale'))('zh', 'CN')); } catch (e) { }

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wbDemo = TWBIO.readTemplateWorkBook('demo/chart/ColumnChart/国旗柱形图.cpt');

// 裸构造图工厂（与 make_api 同路径）
function buildVan(withFix) {
  var plot = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');
  var cols = J('java.lang.reflect.Array').newInstance(CSCS.class, 1);
  cols[0] = new (CSCS)('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsMy'), '机型', cols));
  if (withFix) {
    // demo 差异项全补
    try { chart.setChartName('ds_chart'); } catch (e) { print('chartName ERR'); }
    try { chart.setSwitchTitle(new (J('com.fr.chart.chartattr.SwitchTitle'))()); print('setSwitchTitle OK'); } catch (e) { print('setSwitchTitle ERR ' + e); }
    try { plot.setColumnWidth(80); } catch (e) { print('colW ERR ' + e); }
    try { plot.setSeriesOverlapPercent(0); } catch (e) { print('overlap ERR ' + e); }
  }
  var cc = new (J('com.fr.chart.chartattr.ChartCollection'))();
  cc.addChart(chart);
  return cc;
}

// 找 demo cell（持 ChartCollection 的格）
var wb = TWBIO.readTemplateWorkBook('demo/chart/ColumnChart/国旗柱形图.cpt');
var ws = wb.getReport(0);
var cell = null;
for (var r = 0; r < 40 && cell == null; r++) for (var c = 0; c < 20; c++) {
  var ce = ws.getCellElement(c, r);
  if (ce != null && ce.getValue() != null && String(ce.getValue().getClass().getName()).indexOf('ChartCollection') >= 0) { cell = ce; break; }
}
print('demo cell=(' + cell.getColumn() + ',' + cell.getRow() + ')');

// dsMy：我们的数据
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('机型', Class.forName('java.lang.String'));
etd.addColumn('产量', Class.forName('java.lang.Integer'));
etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120)]));
etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(150)]));
etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(90)]));
etd.addRow(J('java.util.Arrays').asList(['D线', J('java.lang.Integer').valueOf(200)]));
wb.putTableData('dsMy', etd);
print('dsMy rows=' + etd.getRowCount());

var OUT = J('com.fr.io.exporter.ImageExporter');
function render(name) {
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_' + name + '.png');
  new (OUT)().export(os, rb);
  os.close();
  print('render ' + name + ' OK');
}

// A：裸构造替换 demo 图
cell.setValue(buildVan(false));
render('bare_in_demo');
// B：补齐差异项
cell.setValue(buildVan(true));
render('fixed_in_demo');
print('PROBE_VANCHART25_DONE');
J('java.lang.System').exit(0);
