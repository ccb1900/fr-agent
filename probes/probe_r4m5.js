// probe_r4m5.js — 宽格子下 label(M5) / 条件系列色(M6) 变异矩阵（mixin 卡尺同款环境）
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
function redPix(p) { return countIf(p, function (r, g, b) { return r > 140 && g < 90 && b < 90; }); }
function mixin(p) {
  var w = p.getWidth(), h = p.getHeight(), m = 0;
  for (var x = 0; x < w; x += 2) {
    var nb = 0, ng = 0;
    for (var y = 0; y < h; y += 2) {
      var c = p.getRGB(x, y);
      var r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      if (Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255) <= 60) continue;
      if (b > r && b > g) nb++;
      else if (g > r && g > b) ng++;
    }
    if (nb >= 3 && ng >= 3) m++;
  }
  return m;
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
    var pngP = 'D:/fineagent/logs/_r4m5_' + id + '.png';
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(pngP));
    print('== M5 ' + id + ' dark=' + darkPix(img) + ' red=' + redPix(img) + ' mixin=' + mixin(img));
  } catch (e) { print('!! M5 ' + id + ' FAIL ' + e); }
}
function awtColor(v) { return new (J('java.awt.Color'))((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }
function emptyCond() { return new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()); }
function newCC() {
  var cc = new (J(CC))();
  var d = new (J(CA))(); d.setName('');
  cc.setDefaultAttr(d);
  return { cc: cc, d: d };
}

// —— LABEL 变体 ——
function labBase() {
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
  lab.setEnable(true);
  var det = lab.getAttrLabelDetail();
  det.setPosition(2);
  return lab;
}
render('L_a', function (p) {                       // 仅 enable+position
  var t = newCC(); t.d.addDataSeriesCondition(labBase()); p.setConditionCollection(t.cc);
});
render('L_b', function (p) {                       // + content value enable
  var t = newCC(); var lab = labBase();
  var det = lab.getAttrLabelDetail(); var co = det.getContent();
  co.getValueFormat ? null : null;
  det.getContent().getValueFormat().setEnable(true);
  t.d.addDataSeriesCondition(lab); p.setConditionCollection(t.cc);
});
render('L_c', function (p) {                       // + content value+category+series enable（官方组合语料同款）
  var t = newCC(); var lab = labBase();
  var det = lab.getAttrLabelDetail(); var co = det.getContent();
  if (co.getCategoryFormat) { var cf = co.getCategoryFormat(); if (cf) cf.setEnable(true); }
  var sf = co.getSeriesFormat(); if (sf) sf.setEnable(true);
  var vf = co.getValueFormat(); if (vf) vf.setEnable(true);
  t.d.addDataSeriesCondition(lab); p.setConditionCollection(t.cc);
});
render('L_d_textattr', function (p) {              // + TextAttr 大字号（防小字被均化成灰）
  var t = newCC(); var lab = labBase();
  var det = lab.getAttrLabelDetail(); var co = det.getContent();
  var vf = co.getValueFormat(); if (vf) vf.setEnable(true);
  var TA = co.getTextAttr ? co.getTextAttr() : null;
  if (TA) { try { TA.setFRFont(new (J('com.fr.general.FRFont'))()); TA.getFRFont().setSize2D(24); } catch (eT) { print('  TA fail ' + eT); } }
  t.d.addDataSeriesCondition(lab); p.setConditionCollection(t.cc);
});

// —— 条件系列色变体 ——
render('C_a_empty', function (p) {
  var t = newCC();
  var ca = new (J(CA))(); ca.setName('恒真'); ca.setCondition(emptyCond());
  ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrColor'))(awtColor(0xD0392E)));
  t.cc.addConditionAttr(ca); p.setConditionCollection(t.cc);
});
render('C_b_common', function (p) {
  var t = newCC();
  var ca = new (J(CA))(); ca.setName('产超150');
  var cnd = new (J('com.fr.data.condition.CommonCondition'))('产量', '>', J('java.lang.Integer').valueOf(150));
  ca.setCondition(cnd);
  ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrColor'))(awtColor(0xD0392E)));
  t.cc.addConditionAttr(ca); p.setConditionCollection(t.cc);
});
render('C_c_defaultColor', function (p) {
  var t = newCC();
  t.d.addDataSeriesCondition(new (J('com.fr.chart.base.AttrColor'))(awtColor(0xD0392E)));
  p.setConditionCollection(t.cc);
});
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
