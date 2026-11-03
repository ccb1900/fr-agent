// probe_vanchart30.js — 用 make_api 真实块几何复刻：widths[150,250,260,310] 全 span4、单行、行高阶梯
//   A=vbar h160（真实 spec 同款：MoreName+NoneFunction+axisY 0/250+custom+空标题）预期复现病
//   B/C/D=vbar h240/320/480 —— 找 auto 刻度退化阈
//   E=vline h160（真实 spec vline 同款：无 axisY 纯 auto）F=vline h240
// 隔离变量 = 行高；类/绑定/函数/标题全部与 object.js v4.2 路径逐字同。
// ★ v4.2 事故修正（hs_err_pid41536）：j2v8 PainterFactory 池线程连续渲染会原生崩——
//   一次 JVM 只渲一案：env VAN_CASE=(A160|B240|C320|D480|E160|F240)，run.ps1 每案单独一把。
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

var FU = J('com.fr.stable.unit.FU');
function fuPt(pt) { return FU.getInstance(Math.round(pt * 12700)); }
var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');

function dsVanOf(wb) {
  var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
  etd.addColumn('机型', Class.forName('java.lang.String'));
  etd.addColumn('产量', Class.forName('java.lang.Integer'));
  etd.addColumn('良率', Class.forName('java.lang.Integer'));
  etd.addRow(J('java.util.Arrays').asList(['A线', J('java.lang.Integer').valueOf(120), J('java.lang.Integer').valueOf(98)]));
  etd.addRow(J('java.util.Arrays').asList(['B线', J('java.lang.Integer').valueOf(150), J('java.lang.Integer').valueOf(95)]));
  etd.addRow(J('java.util.Arrays').asList(['C线', J('java.lang.Integer').valueOf(90), J('java.lang.Integer').valueOf(99)]));
  etd.addRow(J('java.util.Arrays').asList(['D线', J('java.lang.Integer').valueOf(200), J('java.lang.Integer').valueOf(93)]));
  wb.putTableData('dsVan', etd);
}

// 与 object.js putChartCell vbar 路径（applyChartAttrs(van=true)）同装配
function collection(kind, withAxis, colSpan) {
  var plotCls = { vbar: 'com.fr.plugin.chart.column.VanChartColumnPlot', vline: 'com.fr.plugin.chart.line.VanChartLinePlot' };
  var plot = new (J(plotCls[kind]))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  var cols = J('java.lang.reflect.Array').newInstance(CSCS.class, 2);
  cols[0] = new (CSCS)('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
  cols[1] = new (CSCS)('良率', '良率', new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
  if (withAxis) { // 真实 spec vbar 块 axisY:{min:0,max:250} → Formula + setCustom（object.js:335-345）
    var ya = plot.getyAxis();
    ya.setMaxValue(new (J('com.fr.base.Formula'))('=250'));
    ya.setMinValue(new (J('com.fr.base.Formula'))('=0'));
    ya.setCustomMaxValue(true);
    ya.setCustomMinValue(true);
  }
  var cc = new (J('com.fr.chart.chartattr.ChartCollection'))();
  cc.addChart(chart);
  return cc;
}

function render(tag, kind, withAxis, h) {
  var wb = new (J('com.fr.main.impl.WorkBook'))();
  var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
  wb.addReport('sheet1', sheet);
  var W = [150, 250, 260, 310]; // test_vanchart.js widthsPt 原值
  for (var c = 0; c < 4; c++) sheet.setColumnWidth(c, fuPt(W[c]));
  sheet.setRowHeight(0, fuPt(h)); // 单行 = 真实 chart 块（object.js:426 setRowHeight,heightPt）
  dsVanOf(wb);
  var ce = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, collection(kind, withAxis));
  ce.setColumnSpan(4);
  sheet.addCellElement(ce);
  var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  var os = new (J('java.io.FileOutputStream'))('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent/_probe_van_true_' + tag + '.png');
  new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb);
  os.close();
  print('render ' + tag + ' OK');
}

var CASE = {
  A160: { kind: 'vbar', axis: true, h: 160 },
  B240: { kind: 'vbar', axis: true, h: 240 },
  C320: { kind: 'vbar', axis: true, h: 320 },
  D480: { kind: 'vbar', axis: true, h: 480 },
  E160: { kind: 'vline', axis: false, h: 160 },
  F240: { kind: 'vline', axis: false, h: 240 }
};
var tag = String(J('java.lang.System').getenv('VAN_CASE') || 'A160');
if (!CASE[tag]) { print('UNKNOWN VAN_CASE ' + tag); J('java.lang.System').exit(2); }
render(tag, CASE[tag].kind, CASE[tag].axis, CASE[tag].h);
print('PROBE_VANCHART30_DONE ' + tag);
J('java.lang.System').exit(0);
