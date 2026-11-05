// probe_r4m7.js — 系列-条件色正确类变异：AttrBackground+ColorBackground（DataProcessor4SeriesColorCondition 同款）
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

function redPix(p) {
  var w = p.getWidth(), h = p.getHeight(), n = 0;
  for (var y = 0; y < h; y += 1) for (var x = 0; x < w; x += 2) {
    var c = p.getRGB(x, y);
    var r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
    if (r > 140 && g < 90 && b < 90) n++;
  }
  return n;
}
var CC = 'com.fr.chart.chartglyph.ConditionCollection';
var CA = 'com.fr.chart.chartglyph.ConditionAttr';
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
  sheet.setColumnWidth(0, J('com.fr.stable.unit.FU').getInstance(Math.round(700 * 12700)));
  wb.addReport('sheet1', sheet);
  return { wb: wb, plot: plot };
}
function render(id, mut) {
  try {
    var t = newCase();
    mut(t.plot);
    var rb = t.wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
    if (!rb) { print('!! ' + id + ' execute null'); return; }
    var pngP = 'D:/fineagent/logs/_r4m7_' + id + '.png';
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(pngP));
    print('== M7 ' + id + ' red=' + redPix(img));
  } catch (e) { print('!! M7 ' + id + ' FAIL ' + e); }
}
function awtColor(v) { return new (J('java.awt.Color'))((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }
function redBg() { return new (J('com.fr.chart.base.AttrBackground'))(J('com.fr.base.background.ColorBackground').getInstance(awtColor(0xD0392E))); }
function emptyCond() { return new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()); }
function newCC() {
  var cc = new (J(CC))();
  var d = new (J(CA))(); d.setName('');
  cc.setDefaultAttr(d);
  return { cc: cc, d: d };
}
render('base', function (p) { });
render('D_a_condEmpty', function (p) {
  var t = newCC();
  var ca = new (J(CA))(); ca.setName('恒真红'); ca.setCondition(emptyCond());
  ca.addDataSeriesCondition(redBg());
  t.cc.addConditionAttr(ca); p.setConditionCollection(t.cc);
});
render('D_b_default', function (p) {
  var t = newCC();
  t.d.addDataSeriesCondition(redBg());
  p.setConditionCollection(t.cc);
});
render('D_c_common', function (p) {
  var t = newCC();
  var ca = new (J(CA))(); ca.setName('产超150红');
  ca.setCondition(new (J('com.fr.data.condition.CommonCondition'))('产量', '>', J('java.lang.Integer').valueOf(150)));
  ca.addDataSeriesCondition(redBg());
  t.cc.addConditionAttr(ca); p.setConditionCollection(t.cc);
});
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
