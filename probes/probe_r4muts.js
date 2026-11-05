// probe_r4muts.js — 反射 dump + 带守卫变异实验（stack/label 官方形字段补齐）
//   对照已决：官方 Demo.cpt 在本管线 stackCols=168/dark=3575；我们库形 stackCols=0/dark=0。
//   本探针：① dump AttrSeriesStackAndAxis/AttrLabel/AttrLabelDetail/AttrColor 全方法；
//           ② stack 变异 S1=官方形+setXAxisIndex(0)+setYAxisIndex(0)（方法存在才设）→ 渲染量 stackCols；
//           ③ label 变异 L1=enable+position+(detail 内容 enable 位，方法存在才调)→ 渲染量 dark；
//           ④ condc 变异 M2=CommonCondition(产量>150)+AttrColor → 渲染量 red；
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

function dumpMethods(fq) {
  var c = Class.forName(fq), m = c.getMethods(), out = [];
  for (var i = 0; i < m.length; i++) {
    var mn = String(m[i].getName());
    if (mn.indexOf('set') === 0 || mn.indexOf('get') === 0 || mn.indexOf('is') === 0 || mn.indexOf('enable') >= 0 || mn.indexOf('Enable') >= 0) {
      var sig = mn + String(m[i].getParameterTypes()).replace(/class /g, '').replace(/;/g, '').replace(/interface |java\.lang\.|com\.fr\.|\[L/g, '');
      if (out.indexOf(sig) < 0) out.push(sig);
    }
  }
  print('== ' + fq + ' {' + out.join(' ') + '}');
}
dumpMethods('com.fr.plugin.chart.base.AttrSeriesStackAndAxis');
dumpMethods('com.fr.plugin.chart.base.AttrLabel');
dumpMethods('com.fr.plugin.chart.base.AttrLabelDetail');
dumpMethods('com.fr.chart.base.AttrColor');
dumpMethods('com.fr.plugin.chart.base.AttrTooltipContent');
dumpMethods('com.fr.plugin.chart.base.format.AttrTooltipValueFormat');

function barScore(p) {
  var w = p.getWidth(), h = p.getHeight(), cols = 0;
  for (var x = 0; x < w; x += 2) {
    var seen = {}, uniq = 0;
    for (var y = Math.round(h * 0.08); y < Math.round(h * 0.92); y += 1) {
      var c = p.getRGB(x, y);
      var r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      var mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b));
      if (mx - mn < 45) continue;
      var q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      if (!seen[q]) { seen[q] = 1; uniq++; if (uniq >= 2) { cols++; break; } }
    }
  }
  return cols;
}
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

var CC = 'com.fr.chart.chartglyph.ConditionCollection';
var CA = 'com.fr.chart.chartglyph.ConditionAttr';
function newSheetCase(plotFq, decorate) {
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
  var plot = new (J(plotFq))();
  var chart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(plot);
  chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
  var CSC = Class.forName('com.fr.chart.chartdata.ChartSummaryColumn');
  var cols = J('java.lang.reflect.Array').newInstance(CSC, 2);
  cols[0] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('产量', '产量', new (J('com.fr.data.util.function.NoneFunction'))());
  cols[1] = new (J('com.fr.chart.chartdata.ChartSummaryColumn'))('良率', '良率', new (J('com.fr.data.util.function.NoneFunction'))());
  chart.setFilterDefinition(new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))('dsVan'), '机型', cols));
  decorate(plot);
  var cc2 = new (J('com.fr.chart.chartattr.ChartCollection'))();
  cc2.addChart(chart);
  var cell = new (J('com.fr.report.cell.DefaultTemplateCellElement'))(0, 0, cc2);
  sheet.addCellElement(cell);
  sheet.setRowHeight(0, J('com.fr.stable.unit.FU').getInstance(Math.round(260 * 12700)));
  wb.addReport('sheet1', sheet);
  return wb;
}
function emptyListCondition() { return new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()); }
function emptyDefaultTag() { var cc = new (J(CC))(); var d = new (J(CA))(); d.setName(''); return { cc: cc, d: d }; }
function awtColor(v) { return new (J('java.awt.Color'))((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }

var VBAR = 'com.fr.plugin.chart.column.VanChartColumnPlot';
var IO = J('javax.imageio.ImageIO');
var Paths = J('java.nio.file.Paths');

function render(id, decorate) {
  try {
    var wb = newSheetCase(VBAR, decorate);
    var pngP = 'D:/fineagent/logs/_r4m_' + id + '.png';
    var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
    if (!rb) { print('!! ' + id + ' execute null'); return null; }
    var osP = new (J('java.io.FileOutputStream'))(pngP);
    new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
    osP.close();
    var img = IO.read(Paths.get(pngP).toFile());
    var at = { stack: barScore(img), dark: darkPix(img), red: redPix(img) };
    print('== MUT ' + id + ' stack=' + at.stack + ' dark=' + at.dark + ' red=' + at.red);
    return at;
  } catch (e) {
    print('!! MUT ' + id + ' FAIL: ' + e);
    return null;
  }
}

// S1 = 官方形 + 轴索引（方法存在才设）
function decoStackS1(plot) {
  var scc = new (J(CC))();
  var d0 = new (J(CA))(); d0.setName(''); scc.setDefaultAttr(d0);
  var sd = new (J(CA))(); sd.setName('堆积和坐标轴1'); sd.setCondition(emptyListCondition());
  var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
  sa.setStacked(true); sa.setStackID('堆积和坐标轴1');
  if (sa.setXAxisIndex) sa.setXAxisIndex(0);
  if (sa.setYAxisIndex) sa.setYAxisIndex(0);
  sd.addDataSeriesCondition(sa);
  scc.addConditionAttr(sd);
  plot.setStackAndAxisCondition(scc);
}
// L1 = label enable + position + 内容位（API 存在才调）
function decoLabelL1(plot) {
  var t = emptyDefaultTag();
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
  lab.setEnable(true);
  var det = lab.getAttrLabelDetail();
  if (det.setPosition) det.setPosition(2);
  try {
    var content = det.getAttrTooltipContent ? det.getAttrTooltipContent() : (lab.getAttrTooltipContent ? lab.getAttrTooltipContent() : null);
    print('  label content=' + content);
    if (content) {
      var vf = content.getValueFormat ? content.getValueFormat() : null;
      print('  valueFormat=' + vf);
      if (vf && vf.setEnable) vf.setEnable(true);
      else if (content.setValueFormat) { /* enable 位另寻 */ }
    }
  } catch (eLC) { print('  label content walk fail: ' + eLC); }
  t.d.addDataSeriesCondition(lab);
  t.cc.setDefaultAttr(t.d);
  plot.setConditionCollection(t.cc);
}
// M2 = 条件系列色：CommonCondition(产量>150)
function decoCondM2(plot) {
  var t = emptyDefaultTag();
  t.cc.setDefaultAttr(t.d);
  var ca = new (J(CA))();
  ca.setName('产超150标红');
  var cnd = new (J('com.fr.data.condition.CommonCondition'))('产量', '>', J('java.lang.Integer').valueOf(150));
  ca.setCondition(cnd);
  ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrColor'))(awtColor(0xD0392E)));
  t.cc.addConditionAttr(ca);
  plot.setConditionCollection(t.cc);
}
render('S1', decoStackS1);
render('L1', decoLabelL1);
render('M2', decoCondM2);
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
