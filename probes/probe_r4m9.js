// probe_r4m9.js — label 决定性变异：官方 Demo.cpt 一手形态 label 挂"命名 ConditionAttr/AttrList"（非 DefaultAttr）
//   m5 L_a 实测：enable+position 挂 DefaultAttr → PNG 无 label。官方=ConditionAttrList→List→命名ConditionAttr→AttrList→AttrLabel(enable=true,content.category enable=true)。
//   臂：n1 命名+恒真空 ListCondition+最小 label；n2 命名+恒真+官方 content(category enable)；n3 DefaultAttr+官方 content（隔离"命名"变量）；off=参照。
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

function countIf(p, fn) {
  var w = p.getWidth(), h = p.getHeight(), n = 0;
  for (var y = 0; y < h; y += 1) for (var x = 0; x < w; x += 2) {
    var c = p.getRGB(x, y);
    if (fn((c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff)) n++;
  }
  return n;
}
function darkPix(p) { return countIf(p, function (r, g, b) { return (r * 299 + g * 587 + b * 114) / 1000 < 100; }); }

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
    var pngP = 'D:/fineagent/logs/_r4m9_' + id + '.png';
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(pngP));
    print('== M9 ' + id + ' dark=' + darkPix(img));
  } catch (e) { print('!! M9 ' + id + ' FAIL ' + e); }
}
function emptyCond() { return new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()); }
// 官方一手形态 label（demo/analytics/Demo.cpt 条件属性4 同款：detail position=0 + content.category enable=true）
function officialLabel() {
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
  lab.setEnable(true);
  var det = lab.getAttrLabelDetail();
  if (det.setPosition) det.setPosition(0);
  var co = det.getContent();
  if (co.getCategoryFormat) { var cf = co.getCategoryFormat(); if (cf) cf.setEnable(true); }
  return lab;
}
render('off', function (p) { });
render('n1_named_empty_minLabel', function (p) {   // 命名条件attr + 恒真 + 最小 label（官方位置要素：命名 attr）
  var cc = new (J(CC))();
  var d = new (J(CA))(); d.setName('');
  cc.setDefaultAttr(d);
  var ca = new (J(CA))(); ca.setName('labelCond'); ca.setCondition(emptyCond());
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))(); lab.setEnable(true);
  ca.addDataSeriesCondition(lab);
  cc.addConditionAttr(ca);
  p.setConditionCollection(cc);
});
render('n2_named_empty_official', function (p) {   // 官方全要素：命名+恒真+position0+category enable
  var cc = new (J(CC))();
  var d = new (J(CA))(); d.setName('');
  cc.setDefaultAttr(d);
  var ca = new (J(CA))(); ca.setName('labelCond'); ca.setCondition(emptyCond());
  ca.addDataSeriesCondition(officialLabel());
  cc.addConditionAttr(ca);
  p.setConditionCollection(cc);
});
render('n3_default_official', function (p) {       // 隔离变量：default attr + 官方要素 label
  var cc = new (J(CC))();
  var d = new (J(CA))(); d.setName('');
  d.addDataSeriesCondition(officialLabel());
  cc.setDefaultAttr(d);
  p.setConditionCollection(cc);
});
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
