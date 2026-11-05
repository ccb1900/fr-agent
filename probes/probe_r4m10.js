// probe_r4m10.js — 组合臂定案:与 lib/object.js applyChartDeco 完全同构的
//   tooltip(dTag 默认) + label(命名 ConditionAttr 恒真) + stack(plotType=STACK) 三件同图,
//   验证互不压制;off 参照 + 单 label 臂对照。
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
function bigCell(w2) {   // m3 教案:图表要大格子才会展开画——组合臂再加宽高,拾 label 小字
  var t = newCase();
  var wb = t.wb;
  var sh = wb.getReport('sheet1');
  sh.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(420 * 12700)));
  sh.setColumnWidth(0, J('com.fr.stable.unit.FU').getInstance(Math.round(1100 * 12700)));
  return wb;
}
function render(id, mut) {
  try {
    var wb = bigCell();
    var plot = wb.getReport('sheet1').getCellElement(0, 0).getValue().getChart(0).getPlot();
    mut(plot);
    var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
    if (!rb) { print('!! ' + id + ' execute null'); return; }
    var pngP = 'D:/fineagent/logs/_r4m10_' + id + '.png';
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    print('== M10 ' + id + ' PNG ' + pngP);
  } catch (e) { print('!! M10 ' + id + ' FAIL ' + e); }
}
function emptyCond() { return new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()); }
render('off', function (p) { });
render('L_solo', function (p) {   // 单 label 臂(m9 n1 を widen 格复测)
  var cc = new (J(CC))(); var d = new (J(CA))(); d.setName('');
  var lt = new (J(CA))(); lt.setName('数值标签'); lt.setCondition(emptyCond());
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))(); lab.setEnable(true);
  lt.addDataSeriesCondition(lab);
  cc.addConditionAttr(lt); cc.setDefaultAttr(d);
  p.setConditionCollection(cc);
});
render('L_combo', function (p) {  // 载体同构:tooltip(dTag) + label(lTag) + stack(plotType)
  var cc = new (J(CC))(); var d = new (J(CA))(); d.setName('');
  var tip = new (J('com.fr.plugin.chart.base.AttrTooltip'))(); tip.setEnable(true);
  d.addDataSeriesCondition(tip);
  var lt = new (J(CA))(); lt.setName('数值标签'); lt.setCondition(emptyCond());
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))(); lab.setEnable(true);
  lt.addDataSeriesCondition(lab);
  cc.addConditionAttr(lt); cc.setDefaultAttr(d);
  p.setConditionCollection(cc);
  var scc = new (J(CC))();
  var sd = new (J(CA))(); sd.setName('S1');
  sd.setCondition(emptyCond());
  var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
  sa.setStacked(true); sa.setStackID('S1'); sa.setXAxisIndex(0); sa.setYAxisIndex(0);
  sd.addDataSeriesCondition(sa);
  scc.addConditionAttr(sd);
  p.setStackAndAxisCondition(scc);
  p.setVanChartPlotType(J('com.fr.plugin.chart.type.VanChartPlotType').STACK);
});
render('C_combo', function (p) {  // 条件色+label+tooltip 三件同图(dTag tf)
  var cc = new (J(CC))(); var d = new (J(CA))(); d.setName('');
  var tip = new (J('com.fr.plugin.chart.base.AttrTooltip'))(); tip.setEnable(true);
  d.addDataSeriesCondition(tip);
  var lt = new (J(CA))(); lt.setName('数值标签'); lt.setCondition(emptyCond());
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))(); lab.setEnable(true);
  lt.addDataSeriesCondition(lab);
  cc.addConditionAttr(lt);
  var ca = new (J(CA))(); ca.setName('四染红'); ca.setCondition(emptyCond());
  ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrBackground'))(J('com.fr.base.background.ColorBackground').getInstance(new (J('java.awt.Color'))(0xD0, 0x39, 0x2E))));
  cc.addConditionAttr(ca);
  cc.setDefaultAttr(d);
  p.setConditionCollection(cc);
});
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
