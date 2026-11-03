// probe_caseexpr.js v2 — 版本无关确定性日期表达式：CASE 格式守卫 + CONVERT(date, col, 23)
// 验证: ① PERSISTED 可建(含 plain CONVERT 备选); ② 与 TRY_CAST 全列 0 差异(ISNULL 归一)
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
function exec(sql) { try { st.execute(sql); } catch (e) { /* 无结果集正常 */ } }
// $C$ 占位, 拼列名时统一替换
var CASE_T = "CASE " +
  "WHEN LEN($C$)=10 AND $C$ LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND CAST(SUBSTRING($C$,6,2) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,9,2) AS int) BETWEEN 1 AND 31 THEN CONVERT(date,$C$,23) " +
  "WHEN LEN($C$)=9 AND $C$ LIKE '[0-9][0-9][0-9][0-9]-[0-9]-[0-9][0-9]' AND CAST(SUBSTRING($C$,6,1) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,8,2) AS int) BETWEEN 1 AND 31 THEN CONVERT(date,$C$,23) " +
  "WHEN LEN($C$)=9 AND $C$ LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9]' AND CAST(SUBSTRING($C$,6,2) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,9,1) AS int) BETWEEN 1 AND 31 THEN CONVERT(date,$C$,23) " +
  "WHEN LEN($C$)=8 AND $C$ LIKE '[0-9][0-9][0-9][0-9]-[0-9]-[0-9]' AND CAST(SUBSTRING($C$,6,1) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,8,1) AS int) BETWEEN 1 AND 31 THEN CONVERT(date,$C$,23) " +
  "END";
function mk(col) {
  var c = '[' + col + ']';
  return CASE_T.split('$C$').join(c);
}
try {
  exec("DROP TABLE IF EXISTS tempdb..#t");
  exec("CREATE TABLE #t (a nvarchar(4000) NULL)");
  var r1 = 'OK';
  try { exec("ALTER TABLE #t ADD d1 AS " + mk('a') + " PERSISTED"); } catch (e) { r1 = 'FAIL: ' + e; }
  print('CASE+CONVERT PERSISTED = ' + r1);
  var r2 = 'OK';
  try { exec("ALTER TABLE #t ADD d2 AS CONVERT(date, a, 23) PERSISTED"); } catch (e) { r2 = 'FAIL: ' + e; }
  print('plain CONVERT PERSISTED = ' + r2);
  var tables = [
    ['laser_aaa', 'biz_date'], ['laser_zaxis', 'biz_date'], ['laser_length', 'biz_date'],
    ['laser_sinsyuku', 'biz_date'], ['laser_cnd_selct', 'biz_date'], ['laser_pwr', 'biz_date'],
    ['laser_table', 'biz_date'], ['laser_twin_scale_dsp', 'Date'], ['laser_pwrmulti', 'biz_date']
  ];
  for (var i = 0; i < tables.length; i++) {
    var tb = tables[i][0], dc = tables[i][1];
    var sql = "SELECT SUM(CASE WHEN ISNULL(CONVERT(date, TRY_CAST([" + dc + "] AS date)), '1900-01-01') = ISNULL(" + mk(dc) + ", '1900-01-01') THEN 0 ELSE 1 END) FROM [" + tb + "]";
    var row = one(sql);
    print(tb + ' 差异行=' + row[0]);
  }
} finally {
  st.close(); con.close();
}
print('DONE');
