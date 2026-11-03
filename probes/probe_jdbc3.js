// probe_jdbc3.js — 连接注册闭环：putConnection → NDC 按 XML readXML 解析 → DBTableData 真查
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

var HSQL_URL = 'jdbc:hsqldb:file://D:/software/FineReport_11.0/webapps/webroot/WEB-INF/embed/finedb';

// 1) 定义：无参 ctor + setters
var jd = new (J('com.fr.data.impl.JDBCDatabaseConnection'))();
jd.setDriver('com.fr.third.org.hsqldb.jdbcDriver');
jd.setURL(HSQL_URL);
jd.setUser('sa');
jd.setPassword('');
try { jd.testConnection(); print('TEST PASS (after?)'); } catch (eT) { print('testConnection: ' + eT); }

// 2) 注册
var dm = J('com.fr.file.DatasourceManager').getInstance();
dm.putConnection('SQLPROBE', jd);
var got = dm.getConnection('SQLPROBE');
print('REGISTRY: got=' + (got ? got.getClass().getName() + ' driver=' + got.getDriver() : 'null'));

// 3) 按 XML readXML 得到“已解析”的 NameDatabaseConnection（模板读取路径同构）
var XMLReader = new (J('org.xml.sax.InputSource'))(
  new (J('java.io.StringReader'))('<Connection class="com.fr.data.impl.NameDatabaseConnection"><DatabaseName>\n<![CDATA[SQLPROBE]]></DatabaseName></Connection>'));
var xr = J('com.fr.stable.xml.XMLableReader').getInstance(XMLReader); // 探实例化方式
print('XMLReader: ' + xr.getClass().getName());
try {
  var ndc = new (J('com.fr.data.impl.NameDatabaseConnection'))();
  ndc.readXML(xr);
  print('NDC resolved: name=' + ndc.getName() + ' connection=' + (ndc.getConnection() ? 'YES' : 'null'));
} catch (eR) { print('NDC readXML FAIL: ' + eR); }
print('PROBE END');
J('java.lang.System').exit(0);
