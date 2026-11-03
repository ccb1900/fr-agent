// probe_tcol_profile.js — 本机 atom_live_demo 的 t_collector_* 镜像画像：列型/最大长度/日期范围/行数
var J = function (n) { return Java.type(n); };
var c = J('java.sql.DriverManager').getConnection('jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));

// 1) 全部 t_collector_laser_* 表清单
var r = c.createStatement().executeQuery("SELECT name FROM sys.tables WHERE name LIKE 't_collector_laser%' ORDER BY name");
var tabs = [];
while (r.next()) tabs.push(r.getString(1));
print('TABLES ' + tabs.length);
tabs.forEach(function (t) { print('T ' + t); });

// 2) 每表列清单（名+型）
for (var i = 0; i < tabs.length; i++) {
  var s = c.createStatement().executeQuery("SELECT c.name, ty.name AS typ, c.max_length, c.precision, c.scale FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('" + tabs[i] + "') ORDER BY c.column_id");
  var cols = [];
  while (s.next()) cols.push(s.getString(1) + ':' + s.getString(2));
  print('C ' + tabs[i] + ' | ' + cols.join(','));
}

// 3) sensor 表：stage 在不在？prg/block_no 长什么样？
var s2 = c.createStatement().executeQuery("SELECT TOP 3 [prg],[block_no],[file_key],[biz_date] FROM [t_collector_laser_sensor] ORDER BY 1");
while (s2.next()) print('SAMPLE sensor prg=[' + s2.getString(1) + '] block_no=[' + s2.getString(2) + '] file_key=[' + s2.getString(3) + '] date=' + s2.getString(4));
var s3 = c.createStatement().executeQuery("SELECT COUNT(*) AS n, MIN(TRY_CAST([biz_date] AS date)) AS dmin, MAX(TRY_CAST([biz_date] AS date)) AS dmax FROM [t_collector_laser_sensor]");
s3.next(); print('STAT sensor rows=' + s3.getString(1) + ' dmin=' + s3.getString(2) + ' dmax=' + s3.getString(3));

// 4) 全部 t_collector 表行数（一次拼 UNION ALL 不行就逐表）
for (var i = 0; i < tabs.length; i++) {
  try {
    var s4 = c.createStatement().executeQuery('SELECT COUNT(*) FROM [' + tabs[i] + ']');
    s4.next(); print('N ' + tabs[i] + '=' + s4.getString(1));
  } catch (e) { print('N ' + tabs[i] + ' ERR ' + String(e.message).substring(0, 50)); }
}
c.close();
print('DONE');
