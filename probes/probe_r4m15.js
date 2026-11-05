// probe_r4m15.js — 批B后继扩容词汇序列化实证：五臂一簿（stack+richText+seriesBorder / areaFill /
//   scatter x|y|size / marker.alpha+effect+hotTooltip / seriesImage）→ wb.export → XML 逐类断言。
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

var FAILS = 0;
function check(name, cond) { print((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) FAILS++; }

var wb = new (J('com.fr.main.impl.WorkBook'))();
var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
etd.addColumn('机型', Class.forName('java.lang.String'));
etd.addColumn('产量', Class.forName('java.lang.Integer'));
etd.addColumn('良率', Class.forName('java.lang.Integer'));
etd.addColumn('库存', Class.forName('java.lang.Integer'));
etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120), J('java.lang.Integer').valueOf(98), J('java.lang.Integer').valueOf(30)]));
etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(200), J('java.lang.Integer').valueOf(93), J('java.lang.Integer').valueOf(45)]));
etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(160), J('java.lang.Integer').valueOf(85), J('java.lang.Integer').valueOf(20)]));
wb.putTableData('dsVan', etd);
var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
var CSC = Class.forName('com.fr.chart.chartdata.ChartSummaryColumn');
function newVan(kind) {
  var cls = { vbar: 'com.fr.plugin.chart.column.VanChartColumnPlot', varea: 'com.fr.plugin.chart.area.VanChartAreaPlot',
    vscatter: 'com.fr.plugin.chart.scatter.VanChartScatterPlot', vline: 'com.fr.plugin.chart.line.VanChartLinePlot' }[kind];
  var plot = new (J(cls))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  return { chart: chart, plot: plot };
}
function bind(chart, def) {
  var CSC2 = Class.forName('com.fr.chart.chartdata.ChartSummaryColumn');
  var cols = J('java.lang.reflect.Array').newInstance(CSC2, def.length);
  for (var i = 0; i < def.length; i++) cols[i] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))(def[i], def[i], new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
}
function putCell(c, r, chart) {
  var cc = new (J('com.fr.chart.chartattr.ChartCollection'))();
  cc.addChart(chart);
  var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(c, r, cc);
  sheet.addCellElement(cell);
  sheet.setRowHeight(r, J('com.fr.stable.unit.FU').getInstance(Math.round(300 * 12700)));
  sheet.setColumnWidth(c, J('com.fr.stable.unit.FU').getInstance(Math.round(680 * 12700)));
}
var CC = 'com.fr.chart.chartglyph.ConditionCollection';
var CA = 'com.fr.chart.chartglyph.ConditionAttr';
function defaultCC() { var cc = new (J(CC))(); var d = new (J(CA))(); d.setName(''); cc.setDefaultAttr(d); return { cc: cc, d: d }; }
function emptyCond() { return new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()); }

// 臂1 vbar：stack+richText tooltip+seriesBorder(BorderWithAlpha)+alpha
var t1 = newVan('vbar'); bind(t1.chart, ['产量', '良率']);
var p1 = t1.plot;
(function () {
  var s = defaultCC();
  var tip = new (J('com.fr.plugin.chart.base.AttrTooltip'))(); tip.setEnable(true);
  var ctt = tip.getContent();
  var rt = new (J('com.fr.plugin.chart.base.AttrTooltipRichText'))();
  rt.setContent('系列 ${SERIES} 值 ${VALUE}'); rt.setAuto(true); rt.setInitParamsContent('系列 ${SERIES} 值 ${VALUE}');
  ctt.setRichText(true); ctt.setRichTextAttr(rt);
  s.d.addDataSeriesCondition(tip);
  p1.setConditionCollection(s.cc);
  var scc = new (J(CC))(); var sd = new (J(CA))(); sd.setName('S1'); sd.setCondition(emptyCond());
  var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
  sa.setStacked(true); sa.setStackID('S1'); sa.setXAxisIndex(0); sa.setYAxisIndex(0);
  sd.addDataSeriesCondition(sa); scc.addConditionAttr(sd);
  p1.setStackAndAxisCondition(scc);
  p1.setVanChartPlotType(J('com.fr.plugin.chart.type.VanChartPlotType').STACK);
  s.d.addDataSeriesCondition(new (J('com.fr.plugin.chart.base.AttrBorderWithAlpha'))(new (J('java.awt.Color'))(0x33, 0x55, 0xAA), 1, 0.9));
  p1.setAlpha(0.9);
})();
putCell(0, 0, t1.chart);

// 臂2 varea：areaFill
var t2 = newVan('varea'); bind(t2.chart, ['产量', '良率']);
(function () {
  var s = defaultCC();
  var af = new (J('com.fr.plugin.chart.base.AttrAreaSeriesFillColorBackground'))();
  af.setColorBackground(J('com.fr.base.background.ColorBackground').getInstance(new (J('java.awt.Color'))(0x77, 0xBB, 0xFF)));
  af.setAlpha(0.45);
  s.d.addDataSeriesCondition(af);
  t2.plot.setConditionCollection(s.cc);
})();
putCell(1, 0, t2.chart);

// 臂3 vscatter：ScatterAttrTooltip + x/y/size
var t3 = newVan('vscatter');
t3.chart.setFilterDefinition(new (J('com.fr.chart.chartdata.BubbleTableDefinition'))());
(function () {
  var btd = t3.chart.getFilterDefinition();
  btd.setTableData(new (J('com.fr.data.impl.NameTableData'))('dsVan'));
  btd.setSeriesName('机型线'); btd.setBubbleX('产量'); btd.setBubbleY('良率'); btd.setBubbleSize('库存');
  var s = defaultCC();
  var tip = new (J('com.fr.plugin.chart.scatter.attr.ScatterAttrTooltip'))(); tip.setEnable(true);
  var ctt = tip.getContent();
  function fmt(cls) { var f = new (J('com.fr.plugin.chart.base.format.' + cls))(); f.setEnable(true); f.setFormat(new (J('com.fr.base.CoreDecimalFormat'))('#,##0')); return f; }
  ctt.setXFormat(fmt('AttrTooltipXFormat'));
  ctt.setYFormat(fmt('AttrTooltipYFormat'));
  ctt.setSizeFormat(fmt('AttrTooltipSizeFormat'));
  s.d.addDataSeriesCondition(tip);
  t3.plot.setConditionCollection(s.cc);
})();
putCell(2, 0, t3.chart);

// 臂4 vline：marker.alpha+effect+hotTooltip
var t4 = newVan('vline'); bind(t4.chart, ['产量', '良率']);
(function () {
  var s = defaultCC();
  var mkA = new (J('com.fr.plugin.chart.base.AttrMarkerAlpha'))(); mkA.setAlpha(0.8);
  s.d.addDataSeriesCondition(mkA);
  var ef = new (J('com.fr.plugin.chart.base.AttrEffect'))(); ef.setEnabled(true); ef.setPeriod(1);
  s.d.addDataSeriesCondition(ef);
  t4.plot.setConditionCollection(s.cc);
  var hc = new (J('com.fr.chart.base.AttrContents'))();
  hc.setPosition(1); hc.setShowMutiSeries(false); hc.setWhiteBackground(true); hc.setSeriesLabel('${SERIES}');
  hc.setFormat(new (J('com.fr.base.CoreDecimalFormat'))('#,##0'));
  hc.setPercentFormat(new (J('com.fr.base.CoreDecimalFormat'))('#0.##%'));
  t4.plot.setHotTooltipStyle(hc);
})();
putCell(3, 0, t4.chart);

// 臂5 vbar：seriesImage（logs/_r4m9_off.png 现成小图）
var t5 = newVan('vbar'); bind(t5.chart, ['产量']);
(function () {
  var s = defaultCC();
  var Paths2 = J('java.nio.file.Paths');
  var Files2 = J('java.nio.file.Files');
  var bytes = Files2.readAllBytes(Paths2.get('D:/fineagent/logs/_r4m9_off.png'));
  var iws = J('com.fr.general.ImageWithSuffix').build(bytes);
  var sib = new (J('com.fr.plugin.chart.base.AttrSeriesImageBackground'))();
  sib.setSeriesBackground(new (J('com.fr.base.background.ImageBackground'))(iws));
  s.d.addDataSeriesCondition(sib);
  t5.plot.setConditionCollection(s.cc);
})();
putCell(4, 0, t5.chart);

wb.addReport('sheet1', sheet);
var outP = 'D:/fineagent/logs/_m15_vocab.cpt';
var osP = new (J('java.io.FileOutputStream'))(outP);
wb.export(osP); osP.close();
var xml = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(outP)), 'UTF-8');
print('XML bytes=' + xml.length());
['AttrTooltipRichText', 'ScatterAttrTooltip', 'AttrTooltipXFormat', 'AttrTooltipYFormat', 'AttrTooltipSizeFormat',
 'AttrMarkerAlpha', 'AttrEffect', 'AttrContents', 'AttrBorderWithAlpha', 'AttrAreaSeriesFillColorBackground',
 'AttrSeriesImageBackground', 'ImageBackground', 'vanChartPlotType="stack"'
].forEach(function (tok) { check(tok + ' serialized', xml.indexOf(tok) >= 0); });
check('NO FAILS', FAILS === 0);
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(FAILS === 0 ? 0 : 1);
