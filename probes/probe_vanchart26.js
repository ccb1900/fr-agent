// probe_vanchart26.js — axisY 变桂林：B(Formula不开custom) C(Formula+custom) D(Object数字) E(仅max)
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
try { J('com.fr.general.I18nResource').getInstance(); } catch (e) { }
try { J('com.fr.general.GeneralContext').setLocale(new (J('java.util.Locale'))('zh', 'CN')); } catch (e) { }

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wb = TWBIO.readTemplateWorkBook('demo/chart/ColumnChart/国旗柱形图.cpt');
var ws = wb.getReport(0);
var cell = null;
for (var r = 0; r < 40 && cell == null; r++) for (var c = 0; c < 20; c++) {
  var ce = ws.getCellElement(c, r);
  if (ce != null && ce.getValue() != null && String(ce.getValue().getClass().getName()).indexOf('ChartCollection') >= 0) { cell = ce; break; }
}
// dsMy
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('机型', Class.forName('java.lang.String'));
etd.addColumn('产量', Class.forName('java.lang.Integer'));
etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120)]));
etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(150)]));
etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(90)]));
etd.addRow(J('java.util.Arrays').asList(['D线', J('java.lang.Integer').valueOf(200)]));
wb.putTableData('dsMy', etd);

var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');
function build(tag) {
  var plot = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  var cols = J('java.lang.reflect.Array').newInstance(CSCS.class, 1);
  cols[0] = new (CSCS)('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsMy'), '机型', cols));
  var ya = plot.getyAxis();
  if (tag === 'B') { // Formula 不开 custom
    ya.setMaxValue(new (J('com.fr.base.Formula'))('=250'));
    ya.setMinValue(new (J('com.fr.base.Formula'))('=0'));
  } else if (tag === 'C') { // Formula + custom（make_api 现行路径）
    ya.setMaxValue(new (J('com.fr.base.Formula'))('=250'));
    ya.setMinValue(new (J('com.fr.base.Formula'))('=0'));
    ya.setCustomMaxValue(true);
    ya.setCustomMinValue(true);
  } else if (tag === 'D') { // Object 数字
    ya.setMaxValue(J('java.lang.Integer').valueOf(250));
    ya.setMinValue(J('java.lang.Integer').valueOf(0));
  } else if (tag === 'E') { // 仅 Formula max，不动 min
    ya.setMaxValue(new (J('com.fr.base.Formula'))('=250'));
  }
  // 回读
  print(tag + ' max=' + ya.getMaxValue() + ' min=' + ya.getMinValue() + ' customMax=' + ya.isCustomMaxValue() + ' customMin=' + ya.isCustomMinValue());
  var cc = new (J('com.fr.chart.chartattr.ChartCollection'))();
  cc.addChart(chart);
  return cc;
}
function render(tag) {
  cell.setValue(build(tag));
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_axis_' + tag + '.png');
  new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
  os.close();
  print('render ' + tag + ' OK');
}
for (var t in { B: 1, C: 1, D: 1, E: 1 }) render(t);
print('PROBE_VANCHART26_DONE');
J('java.lang.System').exit(0);
