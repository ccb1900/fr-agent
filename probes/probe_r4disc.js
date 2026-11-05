// probe_r4disc.js — Demo.cpt 结构发现：报表数/名、单元格枚举 API、图表收集器位置
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

var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('demo/analytics/Demo.cpt');
print('wb class=' + wb.getClass().getName());
try { print('reportCount=' + wb.getReportCount()); } catch (e) { print('!! getReportCount: ' + e); }
try {
  var names = wb.getReportNameList ? String(wb.getReportNameList()) : '(no API)';
  print('nameList=' + names);
} catch (e) { print('!! nameList: ' + e); }
var msW = wb.getClass().getMethods(); var mnames = [];
for (var i = 0; i < msW.length; i++) { var n = String(msW[i].getName()); if ((n.indexOf('Report') >= 0 || n.indexOf('Element') >= 0) && mnames.indexOf(n) < 0) mnames.push(n); }
print('wb APIs: ' + mnames.join(' '));

var rep = wb.getReport(0);
print('rep class=' + rep.getClass().getName());
var msR = rep.getClass().getMethods(); var rn = [];
for (var i2 = 0; i2 < msR.length; i2++) { var n2 = String(msR[i2].getName()); if (n2.indexOf('Element') >= 0 && rn.indexOf(n2) < 0) rn.push(n2); }
print('rep cell APIs: ' + rn.join(' '));
try { var ce = rep.getCellElements(); print('getCellElements()=' + ce + ' class=' + (ce != null ? ce.getClass().getName() : 'null')); } catch (e3) { print('!! getCellElements: ' + e3); }
// 网格兜底扫描
var found = 0;
for (var r = 0; r < 40 && found < 8; r++) for (var c = 0; c < 40 && found < 8; c++) {
  var el = null; try { el = rep.getCellElement(c, r); } catch (e4) { }
  if (el == null) continue;
  var v = null; try { v = el.getValue(); } catch (e5) { }
  if (v != null) {
    var cn = String(v.getClass().getName());
    if (cn.indexOf('Chart') >= 0 || cn.indexOf('chart') >= 0) { print('cell(' + c + ',' + r + ')=' + cn); found++; }
  }
}
print('scan done found=' + found);
print('DONE');
J('java.lang.System').exit(0);
