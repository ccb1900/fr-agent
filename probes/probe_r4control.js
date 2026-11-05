// probe_r4control.js — 决定性对照：官方 Demo.cpt（stack 接线与其渲染正确性为官方定案）走我们的
//   execute+ImageExporter 管线，量 stack 像素签名。若官方图在本管线堆不起来 → 锅在调用面（渲染环境/时序）；
//   若堆起来 → 锅在库接线的字段缺失（逐字段 diff 官方 XML）。
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

var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('demo/analytics/Demo.cpt');
print('demo loaded: ' + wb + ' class=' + wb.getClass().getName());
var rb = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
if (!rb) { print('EXEC null'); J('java.lang.System').exit(1); }
var osP = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_r4_official.png');
new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
osP.close();
var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))('D:/fineagent/logs/_r4_official.png'));
print('official png ' + img.getWidth() + 'x' + img.getHeight() +
  ' stackCols=' + barScore(img) + ' dark=' + darkPix(img) + ' red=' + redPix(img));
if (loc0 != null) GC.setLocale(loc0);
print('DONE');
J('java.lang.System').exit(0);
