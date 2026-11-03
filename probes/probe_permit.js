// probe_permit.js — 官方 FRDemo 定义 vs 我们的 URL：许可白名单实载对比
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
print('REGISTRY NAMES:');
while (it.hasNext()) print('  ' + it.next());

var fr = dm.getConnection('FRDemo');
if (fr) {
  print('FRDEMO CLASS = ' + fr.getClass().getName());
  print('FRDEMO toString = ' + fr);
  ['getDriver', 'getURL', 'getUser', 'getPassword', 'getDatabase'].forEach(function (m) {
    try { print('  ' + m + ' = ' + fr[m]()); } catch (eG) { print('  ' + m + ' FAIL ' + eG); }
  });
}

var cfg = J('com.fr.data.core.db.JDBCSecurityConfiguration').getInstance();
print('WHITE = ' + java.util.Arrays.toString(cfg.getUrlWhiteKeywords()));
print('BLACK = ' + java.util.Arrays.toString(cfg.getUrlBlackKeywords()));

var HSQL_URL = 'jdbc:hsqldb:file://D:/software/FineReport_11.0/webapps/webroot/WEB-INF/embed/finedb';
var SQLSERVER_URL = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=test';
try { J('com.fr.data.core.db.JDBCSecurityChecker').checkURL(HSQL_URL); print('CHECK hsql PASS'); } catch (e1) { print('CHECK hsql: ' + e1); }
try { J('com.fr.data.core.db.JDBCSecurityChecker').checkURL(SQLSERVER_URL); print('CHECK sqlserver PASS'); } catch (e2) { print('CHECK sqlserver: ' + e2); }
print('PROBE END');
J('java.lang.System').exit(0);
