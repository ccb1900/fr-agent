// probe_richtext2.js — RichText 内容元素类 + 构造面
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

var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('demo/analytics/套打.cpt');
var ws = wb.getReport(0);
var rt = ws.getCellElement(8, 13).getValue();
print('RichText class = ' + rt.getClass().getName());
var arr = rt.getContent();
print('content class = ' + arr.getClass().getName() + ' len=' + arr.length);
for (var i = 0; i < Math.min(3, arr.length); i++) {
  var e = arr[i];
  print('  item[' + i + '] class = ' + e.getClass().getName() + ' toString=' + String(e));
  var ms = e.getClass().getMethods(), keep = [];
  for (var k = 0; k < ms.length; k++) if (/^(set|get)/.test(ms[k].getName())) keep.push(ms[k].getName());
  var u = {}; keep.forEach(function (x) { u[x] = 1; });
  print('    M ' + Object.keys(u).sort().join(','));
}
var ct = rt.getClass().getConstructors(), lines = [];
for (var i = 0; i < ct.length; i++) {
  var ps = ct[i].getParameterTypes(), a = [];
  for (var k = 0; k < ps.length; k++) a.push(ps[k].getSimpleName());
  lines.push('(' + a.join(',') + ')');
}
print('RichText CTOR ' + lines.join(' | '));
var am = rt.getClass().getMethods();
for (var i = 0; i < am.length; i++) if (/add|Content|Char/.test(am[i].getName())) {
  var ps2 = am[i].getParameterTypes(), a2 = [];
  for (var k = 0; k < ps2.length; k++) a2.push(ps2[k].getSimpleName());
  print('RTM ' + am[i].getName() + '(' + a2.join(',') + ')');
}
print('PROBE_RT2_DONE');
System.exit(0);
