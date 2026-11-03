// probe_richtext.js — 从官方 套打.cpt 反读 RichText 真实类名 + API 面
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

var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wb = TWBIO.readTemplateWorkBook('demo/analytics/套打.cpt');
var ws = wb.getReport(0);
var found = 0;
for (var r = 0; r < 30 && found < 3; r++) {
  for (var c = 0; c < 12; c++) {
    var ce = ws.getCellElement(c, r);
    if (!ce) continue;
    var v = ce.getValue();
    if (v == null) continue;
    var cn = v.getClass().getName();
    if (cn.indexOf('Rich') >= 0) {
      print('CELL(' + c + ',' + r + ') valueClass=' + cn);
      print('  CELLGUI=' + ce.getCellGUIAttr());
      var ms = v.getClass().getMethods(), keep = [];
      for (var i = 0; i < ms.length; i++) if (/^(set|get|add|new|create)/.test(ms[i].getName())) keep.push(ms[i].getName());
      var u = {}; keep.forEach(function (x) { u[x] = 1; });
      print('  M ' + Object.keys(u).sort().join(','));
      found++;
    }
  }
}
print('PROBE_RICHTEXT_DONE ' + found);
