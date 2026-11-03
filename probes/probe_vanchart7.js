// probe_vanchart7.js — VanChartOneValueCDDefinition / VanChartDataDefinition API 面 + demo pie 绑定值反读
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

var defs = ['com.fr.plugin.chart.data.VanChartOneValueCDDefinition', 'com.fr.plugin.chart.data.VanChartDataDefinition', 'com.fr.plugin.chart.data.MultiCategoryTableDefinition'];
for (var i = 0; i < defs.length; i++) {
  try {
    var c = Class.forName(defs[i]);
    var cs = c.getConstructors(), o = [];
    for (var k = 0; k < cs.length; k++) o.push(String(cs[k]));
    var ms = c.getMethods(), u = {};
    for (var k = 0; k < ms.length; k++) { var n = ms[k].getName(); if (/^(set|get)/.test(n)) u[n] = 1; }
    print('== ' + defs[i] + ' chain=' + c.getSuperclass().getName() + '\n   ctors: ' + o.join(' | ') + '\n   M ' + Object.keys(u).sort().join(','));
  } catch (e) { print('== ' + defs[i] + ' ERR ' + e); }
}

// demo pie 绑定值反读
var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var wb = TWBIO.readTemplateWorkBook('demo/chart/basic/环形图.cpt');
var ws = wb.getReport(0);
var ce = ws.getCellElement(0, 0);
var ch = ce.getValue().getSelectedChart();
var def = ch.getFilterDefinition();
var dm = def.getClass().getMethods();
for (var i = 0; i < dm.length; i++) {
  var n = dm[i].getName();
  if (/^get/.test(n) && dm[i].getParameterTypes().length === 0) {
    try { var v = dm[i].invoke(def); if (v != null) print('DEMOdef ' + n + ' = ' + String(v).substring(0, 100)); } catch (e2) { }
  }
}
print('PROBE_VANCHART7_DONE');
J('java.lang.System').exit(0);
