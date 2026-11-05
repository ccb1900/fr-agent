// probe_render4.js — 批B 渲染端三案 A/B 渲染红灯探针（r17 后继·渲染打通批第一单元）
//   动机：README #72 渲染端待达三项（stack 堆叠渲染/label 数值显示/条件系列色）——序列化全绿但渲染端
//   无任何自动化红绿门（chartdeco4 只测序列化读回、test_vanchart 只比 MD5、PNG 靠目视）。
//   本探针每案出"挂/不挂"两张 PNG + JVM 内像素分析，方向性断言：
//     stack  = 某些 x 列内出现 ≥2 种饱和色（堆叠分段同列）→ 分组则每列至多 1 色
//     label  = ON 图比 OFF 图多出的暗像素（数字标注文字）
//     condColor = redRGB 像素计数（0xD0392E 系）
//   同时保留 XML 读回计数（序列化面不变性自证）。
// 跑法：.\runraw.ps1 -Script probes/probe_render4.js
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

// Van 图服务端出图暖机（make_api 同款，probe_vanchart15 教训：缺 I18nResource → PNG 0 字节）
var GC = J('com.fr.general.GeneralContext');
var loc0 = GC.getLocale();
GC.setLocale(new (J('java.util.Locale'))('zh', 'CN'));
J('com.fr.general.I18nResource').getInstance();

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

var CC = 'com.fr.chart.chartglyph.ConditionCollection';
var CA = 'com.fr.chart.chartglyph.ConditionAttr';
var StackAxis = 'com.fr.plugin.chart.base.AttrSeriesStackAndAxis';
function emptyListCondition() {
  return new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))());
}
function emptyDefaultTag() {
  var cc = new (J(CC))(); var d = new (J(CA))(); d.setName('');
  return { cc: cc, d: d };
}
function awtColor(v) {
  return new (J('java.awt.Color'))((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
}

// —— 三案装饰组装（object.js L394-540 同源形态；stack 抄官方 Demo.cpt 形=含空 DefaultAttr）——
function decoStack(plot) {
  var scc = new (J(CC))();                 // 官方形：stack collection 也带空 DefaultAttr
  var d0 = new (J(CA))(); d0.setName('');
  scc.setDefaultAttr(d0);
  var sd = new (J(CA))();
  sd.setName('堆积和坐标轴1');
  sd.setCondition(emptyListCondition());
  var sa = new (J(StackAxis))();
  sa.setStacked(true);
  sa.setStackID('堆积和坐标轴1');
  sd.addDataSeriesCondition(sa);
  scc.addConditionAttr(sd);
  plot.setStackAndAxisCondition(scc);
}
function decoLabel(plot) {
  var t = emptyDefaultTag();
  var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
  lab.setEnable(true);
  var det = lab.getAttrLabelDetail();
  if (det && det.setPosition) det.setPosition(2);
  t.d.addDataSeriesCondition(lab);
  t.cc.setDefaultAttr(t.d);
  plot.setConditionCollection(t.cc);
}
function decoCondColor(plot) {
  var t = emptyDefaultTag();
  t.cc.setDefaultAttr(t.d);
  var ca = new (J(CA))();
  ca.setName('恒真标红');
  ca.setCondition(emptyListCondition());
  ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrColor'))(awtColor(0xD0392E)));
  t.cc.addConditionAttr(ca);
  plot.setConditionCollection(t.cc);
}

var VBAR = 'com.fr.plugin.chart.column.VanChartColumnPlot';
var CASES = [
  { id: 'stack', key: 'stackAndAxisCondition', deco: decoStack },
  { id: 'label', key: 'labelAttr', deco: decoLabel },
  { id: 'condc', key: 'ConditionAttrList', deco: decoCondColor }
];

function xmlCount(txt, s) { var n = 0, i = 0; while ((i = txt.indexOf(s, i)) >= 0) { n++; i += s.length; } return n; }

// —— 像素分析（javax.imageio）——
var IO = J('javax.imageio.ImageIO');
function barScore(p) {   // 有多少 x 列内出现 ≥2 种饱和色（堆叠签名）
  var w = p.getWidth(), h = p.getHeight(), cols = 0;
  for (var x = 0; x < w; x += 2) {
    var seen = {}, uniq = 0;
    for (var y = Math.round(h * 0.12); y < Math.round(h * 0.88); y += 1) {
      var c = p.getRGB(x, y);
      var r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      var mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b));
      if (mx - mn < 45) continue;                       // 饱和色才算柱体（排除白底/灰网格）
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

var files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var RESULTS = [];
CASES.forEach(function (cs) {
  ['off', 'on'].forEach(function (mode) {
    var id = cs.id + '_' + mode;
    var wb = newSheetCase(VBAR, mode === 'off' ? function () { } : cs.deco);
    var cptP = 'D:/fineagent/logs/_r4_' + id + '.cpt';
    var fos = new (J('java.io.FileOutputStream'))(cptP); wb.export(fos); fos.close();
    var pngP = 'D:/fineagent/logs/_r4_' + id + '.png';
    try {
      var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
      if (!rb) throw 'execute null';
      var osP = new (J('java.io.FileOutputStream'))(pngP);
      new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
      osP.close();
    } catch (e) {
      print('!! ' + id + ' RENDER FAIL: ' + e);
      RESULTS.push({ id: id, fail: String(e) });
      return;
    }
    var img = IO.read(Paths.get(pngP).toFile());
    if (!img) { print('!! ' + id + ' PNG unreadable'); RESULTS.push({ id: id, fail: 'png unreadable' }); return; }
    var txt = new (J('java.lang.String'))(files.readAllBytes(Paths.get(cptP)), 'UTF-8');
    RESULTS.push({ id: id, xml: xmlCount(txt, cs.key), stack: barScore(img), dark: darkPix(img), red: redPix(img), w: img.getWidth(), h: img.getHeight() });
  });
});

// —— 红绿裁决（方向性断言）——
print('== RED-GREEN base (UTC-safe)');
var get = function (id) { for (var i = 0; i < RESULTS.length; i++) if (RESULTS[i].id === id) return RESULTS[i]; return null; };
function sign(v, th) { return v >= th ? 'GREEN' : 'RED'; }
var s = get('stack_on'), s0 = get('stack_off');
print('STACK  off.stackCols=' + (s0 ? s0.stack : '?') + ' on.stackCols=' + (s ? s.stack : '?') + ' xml=' + (s ? s.xml : '?') + ' -> ' + (s && s0 ? sign(s.stack - s0.stack, 5) + ' (需 on-off>=5)' : '#'));
var l = get('label_on'), l0 = get('label_off');
print('LABEL  off.dark=' + (l0 ? l0.dark : '?') + ' on.dark=' + (l ? l.dark : '?') + ' xml=' + (l ? l.xml : '?') + ' -> ' + (l && l0 ? sign(l.dark - l0.dark, 300) + ' (需 on-off>=300)' : '#'));
var c = get('condc_on'), c0 = get('condc_off');
print('CONDC  off.red=' + (c0 ? c0.red : '?') + ' on.red=' + (c ? c.red : '?') + ' xml=' + (c ? c.xml : '?') + ' -> ' + (c && c0 ? sign(c.red - c0.red, 800) + ' (需 on-off>=800)' : '#'));
print('== per-case detail');
RESULTS.forEach(function (r) { print('  ' + r.id + ' ' + JSON.stringify(r)); });
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);   // 渲染探针必须显式退：V8 chart painter 留非守护线程（make_api finishRun 同款纪律）
