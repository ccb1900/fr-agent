// _probe_db2.js — 名称解析闭环验证 + atom_live_demo 表结构/行数摸底
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

var URL = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false';
var jd = new (J('com.fr.data.impl.JDBCDatabaseConnection'))();
jd.setDriver('com.microsoft.sqlserver.jdbc.SQLServerDriver');
jd.setURL(URL);
jd.setUser('sa');
jd.setPassword(load('D:/fineagent/lib/dbpass.js'));
var dm = J('com.fr.file.DatasourceManager').getInstance();
dm.putConnection('ATOM_LIVE', jd);

// 1) 名称解析闭环：NameDatabaseConnection(String) -> 注册表
var ndc = new (J('com.fr.data.impl.NameDatabaseConnection'))('ATOM_LIVE');
print('NDC: name=' + ndc.getName() + ' resolved=' + (ndc.getConnection() ? ndc.getConnection().getClass().getName() : 'NULL'));

// 2) 经 NDC 拿真实 java.sql.Connection
var conn = ndc.createConnection();
print('CONN: ' + (conn ? conn.getClass().getName() : 'NULL') + ' meta=' + conn.getMetaData().getDatabaseProductVersion());

function q(sql) {
  var st = conn.createStatement();
  var rs = st.executeQuery(sql);
  var md = rs.getMetaData();
  var n = md.getColumnCount();
  var cols = [];
  for (var i = 1; i <= n; i++) cols.push(md.getColumnName(i));
  var rows = [];
  while (rs.next()) {
    var r = [];
    for (var k = 1; k <= n; k++) r.push(rs.getObject(k));
    rows.push(r);
  }
  rs.close(); st.close();
  return { cols: cols, rows: rows };
}

var tables = q("select t.name, p.[rows] from sys.tables t join sys.partitions p on p.object_id=t.object_id and p.index_id in (0,1) order by p.[rows] desc");
print('TABLES=' + tables.rows.length);
var names = [];
for (var i = 0; i < tables.rows.length; i++) { print('T| ' + tables.rows[i][0] + ' | rows=' + tables.rows[i][1]); names.push(String(tables.rows[i][0])); }

var want = names.filter(function (n) { return /^laser_/.test(n); }).slice(0, 4);
for (var w = 0; w < want.length; w++) {
  try {
    var c = q("select c.name, ty.name, c.max_length from sys.columns c join sys.types ty on ty.user_type_id=c.user_type_id where c.object_id=object_id('" + want[w] + "') order by c.column_id");
    print('COLS ' + want[w] + ' => ' + c.rows.map(function (r) { return r[0] + ':' + r[1] + '(' + r[2] + ')'; }).join(', '));
    var top = q("select top 3 * from " + want[w]);
    for (var r = 0; r < top.rows.length; r++) print('ROW ' + want[w] + ' | ' + top.cols.join(',') + ' || ' + top.rows[r].join('|'));
  } catch (e) { print('ERR ' + want[w] + ': ' + e); }
}
conn.close();
print('PROBE END');
J('java.lang.System').exit(0);
