// probe_chartdeco4.js — 批B 定案微探针：一个 JVM 三案（vline 装饰 / vbar 堆叠官方形 / vbar label 活引用）
//   每案 cpt 只 export 不渲染（无 j2v8 风险）；导出后读回文本自证节点在不在。
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

function newSheetCase(kind, decorate, twoSeries) {
  var wb = new (J('com.fr.main.impl.WorkBook'))();
  var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
  etd.addColumn('机型', Class.forName('java.lang.String'));
  etd.addColumn('产量', Class.forName('java.lang.Integer'));
  etd.addColumn('良率', Class.forName('java.lang.Integer'));
  etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120), J('java.lang.Integer').valueOf(98)]));
  etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(200), J('java.lang.Integer').valueOf(93)]));
  wb.putTableData('dsVan', etd);
  var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
  var VK = { vline: 'com.fr.plugin.chart.line.VanChartLinePlot', vbar: 'com.fr.plugin.chart.column.VanChartColumnPlot' };
  var plot = new (J(VK[kind]))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  var CSC = Class.forName('com.fr.chart.chartdata.ChartSummaryColumn');
  var nSeries = twoSeries ? 2 : 1;
  var cols = J('java.lang.reflect.Array').newInstance(CSC, nSeries);
  cols[0] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
  if (twoSeries) cols[1] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('良率', '良率', new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
  decorate(plot);
  var cc2 = new (J('com.fr.chart.chartattr.ChartCollection'))();
  cc2.addChart(chart);
  var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, cc2);
  sheet.addCellElement(cell);
  sheet.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(240 * 12700)));
  wb.addReport('sheet1', sheet);
  return wb;
}

var CC = 'com.fr.chart.chartglyph.ConditionCollection';
var CA = 'com.fr.chart.chartglyph.ConditionAttr';
function defaultTag() {
  var cc = new (J(CC))();
  var d = new (J(CA))();
  d.setName('');
  return { cc: cc, d: d };
}

// 案1：vline + DefaultAttr(line/marker/trend)；w1b=管线同序（marker, line, trend）+双系列
function makeW1(orderTwoSeries, firstMarker) {
  return newSheetCase('vline', function (plot) {
    var t = defaultTag();
    function addLine() {
      var ln = new (J('com.fr.plugin.chart.base.VanChartAttrLine'))();
      ln.setLineType(J('com.fr.plugin.chart.type.LineType').valueOf('SOLID'));
      ln.setLineStyle(J('com.fr.plugin.chart.type.LineStyle').valueOf('CURVE'));
      ln.setLineWidth(3);
      t.d.addDataSeriesCondition(ln);
    }
    function addMarker() {
      var mk = new (J('com.fr.plugin.chart.base.VanChartAttrMarker'))();
      mk.setMarkerType(J('com.fr.plugin.chart.marker.type.MarkerType').valueOf('MARKER_CIRCLE'));
      mk.setRadius(6);
      t.d.addDataSeriesCondition(mk);
    }
    function addTrend() {
      var tl = new (J('com.fr.plugin.chart.base.VanChartAttrTrendLine'))();
      tl.setTrendLineName('T');
      var TCS = java.lang.Class.forName('com.fr.plugin.chart.base.TrendLineType').getEnumConstants();
      for (var i = 0; i < TCS.length; i++) if (String(TCS[i]).indexOf('Linear') >= 0) tl.setTrendLineType(TCS[i]);
      t.d.addDataSeriesCondition(tl);
    }
    if (firstMarker) { addMarker(); addLine(); addTrend(); } else { addLine(); addMarker(); addTrend(); }
    t.cc.setDefaultAttr(t.d);
    plot.setConditionCollection(t.cc);
  }, orderTwoSeries);
}
var wb1 = makeW1(false, false);
var wb1b = makeW1(true, true);

// 案2：vbar 堆叠（官方形：addConditionAttr+命名 ConditionAttr+空 ListCondition+stackID=attr 名）
var wb2 = newSheetCase('vbar', function (plot) {
  var scc = new (J(CC))();
  var sd = new (J(CA))();
  sd.setName('堆积和坐标轴1');
  sd.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
  var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
  sa.setStacked(true);
  sa.setStackID('堆积和坐标轴1');
  sd.addDataSeriesCondition(sa);
  scc.addConditionAttr(sd);
  plot.setStackAndAxisCondition(scc);
});

// 案3：vbar label（活引用 detail.setPosition）
var wb3 = newSheetCase('vbar', function (plot) {
  var t = defaultTag();
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
  lab.setEnable(true);
  var det = lab.getAttrLabelDetail();
  if (det && det.setPosition) det.setPosition(2);
  print('case3 det=' + det);
  t.d.addDataSeriesCondition(lab);
  t.cc.setDefaultAttr(t.d);
  plot.setConditionCollection(t.cc);
});

var wbs = { w1: wb1, w1b: wb1b, w2: wb2, w3: wb3 };
Object.keys(wbs).forEach(function (k) {
  var fos = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_deco_' + k + '.cpt');
  wbs[k].export(fos);
  fos.close();
  var txt = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get('D:/fineagent/logs/_deco_' + k + '.cpt')), 'UTF-8');
  function c(s) { var n = 0, i = 0; while ((i = txt.indexOf(s, i)) >= 0) { n++; i += s.length; } return n; }
  print('== ' + k + ' VanChartAttrLine=' + c('VanChartAttrLine') + ' Marker=' + c('VanChartAttrMarker') + ' TrendLine=' + c('TrendLine') +
    ' stackAndAxis=' + c('stackAndAxisCondition') + ' labelAttr=' + c('labelAttr') + ' position="2"=' + c('position="2"') +
    ' LineWidth3=' + c('lineWidth="3.0"') + ' CURVE=' + c('CURVE') + ' CIRCLE=' + c('MARKER_CIRCLE'));
});
print('DONE');
