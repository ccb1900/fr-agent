// probe_tryconvert.js — TRY_CAST 非确定性实证 + TRY_CONVERT(date,x,23) 保 Persisted 与数据对拍
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
function one(sql) {
  var rs = st.executeQuery(sql);
  var vals = [];
  while (rs.next()) vals.push(rs.getString(1));
  rs.close();
  return vals;
}
function exec(sql) {
  var rs = null;
  try { rs = st.executeQuery(sql); rs.close(); } catch (e0) { /* DDL 批无结果集, 忽略 */ }
}
try {
  exec("DROP TABLE IF EXISTS tempdb..#t");
  exec("CREATE TABLE #t (a nvarchar(4000) NULL)");
  var r1 = 'OK';
  try { exec("ALTER TABLE #t ADD d AS TRY_CONVERT(date, a, 23) PERSISTED"); }
  catch (e) { r1 = 'FAIL: ' + e; }
  print('style23 PERSISTED = ' + r1);
  var r2 = one("SELECT CAST(TRY_CONVERT(date,'2026-9-13',23) AS varchar) + '/' + CAST(CONVERT(date,'2026-9-13') AS varchar) + '/' + CAST(TRY_CAST('2026-9-13' AS date) AS varchar) + '/' + CAST(TRY_CONVERT(date,'2026-10-28',23) AS varchar)");
  print("单数字月(style23/无style/TRY_CAST/双数字月style23) = " + r2[0]);
  var r5 = one("SELECT COUNT(*) FROM laser_aaa"); 
  var r3 = one("SELECT COUNT(*) FROM laser_aaa WHERE TRY_CAST(biz_date AS date) IS NULL");
  var r4 = one("SELECT COUNT(*) FROM laser_aaa WHERE TRY_CONVERT(date, biz_date, 23) IS NULL");
  var r6 = one("SELECT COUNT(*) FROM laser_aaa WHERE CONVERT(date, TRY_CAST(biz_date AS date)) <> TRY_CONVERT(date, biz_date, 23)");
  print('laser_aaa rows=' + r5[0] + ' TRY_CAST失败=' + r3[0] + ' TRYC23失败=' + r4[0] + ' 两式不同行=' + r6[0]);
  var dateCols = { laser_zaxis: 'biz_date', laser_length: 'biz_date', laser_pwrmulti: 'biz_date' };
  for (var k in dateCols) {
    var tb = k, dc = dateCols[k];
    var nn = one("SELECT COUNT(*) FROM [" + tb + "]");
    var n2 = one("SELECT COUNT(*) FROM [" + tb + "] WHERE CONVERT(date, TRY_CAST(" + dc + " AS date)) <> TRY_CONVERT(date," + dc + ",23)");
    print(tb + ' rows=' + nn[0] + ' 两式不同行=' + n2[0]);
  }
  print('laser_files: collection_date 原生 date, 无需对拍');
} finally {
  st.close(); con.close();
}
print('DONE');
