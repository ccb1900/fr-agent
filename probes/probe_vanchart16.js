// probe_vanchart16.js — VanChartValueAxis setting surface: custom flag / list identity / read-back
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

var p = new (J('com.fr.plugin.chart.column.VanChartColumnPlot'))();
var ya = p.getyAxis();
var yl = p.getValueAxisList();
print('yAxis identity = YAxisList[0]? ' + (ya === yl.get(0)) + ' (list size=' + yl.size() + ')');

// All setters related to set*C*ustom / maxValue
var ms = Class.forName('com.fr.plugin.chart.attr.axis.VanChartValueAxis').getMethods();
var names = [];
for (var i = 0; i < ms.length; i++) { var n = ms[i].getName(); if (/ustom/i.test(n) || /MaxValue/.test(n) || /MinValue/.test(n)) names.push(n + '(' + ms[i].getParameterTypes().length + ')'); }
print('AXIS custom/max/min methods: ' + names.sort().join(', '));

// After setMaxValue, read back custom flag
ya.setMaxValue(new (J('com.fr.base.Formula'))('=1000'));
print('after setMaxValue: isCustomMaxValue=' + ya.isCustomMaxValue() + ' max=' + ya.getMaxValue());
if (yl.size() > 0) print('YAxisList[0] max after set = ' + yl.get(0).getMaxValue() + ' custom=' + yl.get(0).isCustomMaxValue());

// Attempt setCustomMaxValue(true) (if it exists)
try { ya.setCustomMaxValue(true); print('setCustomMaxValue(true) OK, isCustomMaxValue=' + ya.isCustomMaxValue()); } catch (e) { print('setCustomMaxValue ERR ' + e); }
try { ya.setCustomMaxValue(false); } catch (e) { }
try { ya.setCustomMinValue(true); print('setCustomMinValue OK'); } catch (e) { print('setCustomMinValue ERR ' + e); }
print('PROBE_VANCHART16_DONE');
J('java.lang.System').exit(0);
