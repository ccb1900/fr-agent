// _probe_db1.js — SQL Server 真连 + 名称解析路径探查（NDC / DBTableData API 面）
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

function dump(name, pat) {
  print('== DUMP ' + name);
  try {
    var c = Class.forName(name);
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]).replace('public ', '');
      if (pat.test(s)) print('   M ' + s);
    }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) print('   CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { print('   FAIL ' + e); }
}

var URL = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false';
var DRV = 'com.microsoft.sqlserver.jdbc.SQLServerDriver';

// 1) 定义连接
var jd = new (J('com.fr.data.impl.JDBCDatabaseConnection'))();
jd.setDriver(DRV);
jd.setURL(URL);
jd.setUser('sa');
jd.setPassword(load('D:/fineagent/lib/dbpass.js'));
try { jd.testConnection(); print('TESTCONN: PASS'); } catch (e) { print('TESTCONN: FAIL ' + e); }

// 2) 注册 + 取回
var dm = J('com.fr.file.DatasourceManager').getInstance();
dm.putConnection('ATOM_LIVE', jd);
var got = dm.getConnection('ATOM_LIVE');
print('REGISTRY: ' + (got ? got.getClass().getName() : 'null'));

// 3) DatabaseConnection -> java.sql.Connection
try {
  var jc = got.getConnection();
  print('RAWCONN: ' + (jc ? jc.getClass().getName() + ' autoCommit=' + jc.getAutoCommit() : 'null'));
  if (jc) {
    var st = jc.createStatement();
    var rs = st.executeQuery("select name from sys.databases order by name");
    var dbs = [];
    while (rs.next()) dbs.push(rs.getString(1));
    print('DBS: ' + dbs.join(','));
    rs.close(); st.close(); jc.close();
  }
} catch (e2) { print('RAWCONN: FAIL ' + e2); }

// 4) 名称解析路径
dump('com.fr.data.impl.NameDatabaseConnection', /(Name|Connection|readXML|accept)/i);
dump('com.fr.data.DBTableData', /(TableData|Query|Connection|Column|Row|setDatasource|execute)/i);
dump('com.fr.data.impl.DBTableData', /(TableData|Query|Connection|Column|Row|setDatasource|execute|create)/i);
dump('com.fr.file.DatasourceManager', /(Connection|Instance|put|get)/i);
print('PROBE END');
J('java.lang.System').exit(0);
