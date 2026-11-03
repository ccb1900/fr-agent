// probe_findtcollector.js — 全库扫描定位 t_collector_laser_aaa 所在数据库
var J = function (n) { return Java.type(n); };
var c = J('java.sql.DriverManager').getConnection('jdbc:sqlserver://127.0.0.1:1433;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var r = c.createStatement().executeQuery("SELECT name FROM sys.databases WHERE state_desc='ONLINE' AND name NOT IN ('master','tempdb','model','msdb')");
var dbs = [];
while (r.next()) dbs.push(r.getString(1));
for (var i = 0; i < dbs.length; i++) {
  try {
    var s = c.createStatement().executeQuery("SELECT COUNT(*) AS n FROM [" + dbs[i] + "].sys.tables WHERE name IN ('t_collector_laser_aaa','laser_aaa')");
    s.next();
    print(dbs[i] + ' -> t_collector_laser_aaa=' + (s.getString(1).indexOf('1') >= 0 ? 'HIT' : 'no') );
  } catch (e) { print(dbs[i] + ' -> skip: ' + String(e.message).substring(0, 60)); }
}
c.close();
print('DONE');
