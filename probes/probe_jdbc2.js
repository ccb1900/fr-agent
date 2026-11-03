// probe_jdbc2.js — JDBCDatabaseConnection ctor 参数序实证（FRDemo HSQL 打靶）+ 内联定义直查路径
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

// 猜序 1: (driver, url, user, password)
try {
  var jd = new (J('com.fr.data.impl.JDBCDatabaseConnection'))(
    'com.fr.third.org.hsqldb.jdbcDriver',
    'jdbc:hsqldb:file://D:/software/FineReport_11.0/webapps/webroot/WEB-INF/embed/finedb',
    'sa', '');
  jd.testConnection();
  print('ORDER-1 (driver,url,user,pwd) TEST PASS');
} catch (e1) { print('ORDER-1 FAIL: ' + e1); }

// 内联定义 → NameDatabaseConnection → DBTableData → createDataModel（不注册名字）
try {
  var jd2 = new (J('com.fr.data.impl.JDBCDatabaseConnection'))(
    'com.fr.third.org.hsqldb.jdbcDriver',
    'jdbc:hsqldb:file://D:/software/FineReport_11.0/webapps/webroot/WEB-INF/embed/finedb',
    'sa', '');
  var ndc = new (J('com.fr.data.impl.NameDatabaseConnection'))('ProbeInline');
  // 探 setConnection / getConnection 面
  var setters = [];
  var c2 = ndc.getClass();
  while (c2) {
    var ms = c2.getDeclaredMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]);
      if (/setConnection|setDefination|setDefinition/.test(s)) setters.push(String(ms[i]).replace('public ', ''));
    }
    c2 = c2.getSuperclass();
  }
  print('NDC connection-setters: ' + setters.join(' ; '));
} catch (e2) { print('INLINE FAIL: ' + e2); }
print('PROBE END');
J('java.lang.System').exit(0);
