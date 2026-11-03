// _probe_db7.js — 列出环境里已存在的数据连接名（getConnectionNameIterator）
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
var dm = J('com.fr.file.DatasourceManager').getInstance();
var it = dm.getConnectionNameIterator();
var names = [];
while (it.hasNext()) names.push(String(it.next()));
print('EXISTING CONNECTIONS n=' + names.length + ' :: ' + names.join(' | '));
names.forEach(function (n) {
  var c = dm.getConnection(n);
  if (!c) { print('  ' + n + ' => (null)'); return; }
  var line = '  ' + n + ' => ' + c.getClass().getSimpleName();
  try { if (c.getURL) line += ' url=' + c.getURL(); } catch (e) { }
  try { if (c.getUser) line += ' user=' + c.getUser(); } catch (e) { }
  print(line);
});
print('PROBE END');
J('java.lang.System').exit(0);
