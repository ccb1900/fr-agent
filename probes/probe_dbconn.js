// probe_dbconn.js — SQL Server 连接注册 API 面全探
var Class = Java.type('java.lang.Class');
function dump(name, pat) {
  print('== ' + name);
  try {
    var c = Class.forName(name);
    var ms = c.getMethods();
    for (var i = 0; i < ms.length; i++) {
      var s = String(ms[i]).replace('public ', '');
      if (pat.test(s)) print('  ' + s);
    }
    var cs = c.getConstructors();
    for (var k = 0; k < cs.length; k++) print('  CTOR ' + String(cs[k]).replace('public ', ''));
  } catch (e) { print('  FAIL ' + e); }
}
dump('com.fr.data.impl.NameDatabaseConnection', /set|get|ctor|Connection/, 'X');
dump('com.fr.data.impl.JDBCDatabaseConnection', /.+/, 'X');
print('== search datasource manager classes');
['com.fr.config.DatasourceManager', 'com.fr.data.impl.ConnectionList', 'com.fr.datasource.DatasourceManager',
 'com.fr.report.module.impl.DatasourceManager', 'com.fr.config.impl.DatasourceManagerImpl',
 'com.fr.data.impl.ConnectionManager', 'com.fr.env.impl.DatasourceManager'].forEach(function (n) {
  try { print('  FOUND ' + n); } catch (e2) { print('  miss ' + n); }
  try { Class.forName(n); print('  EXISTS ' + n); } catch (e3) { }
});
print('PROBE END');
