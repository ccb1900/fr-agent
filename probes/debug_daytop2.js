// debug_daytop2.js — 每个 p 的匹配行数 / TOP 是否生效
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName' + String.fromCharCode(61) + 'atom_live_demo;encrypt' + String.fromCharCode(61) + 'false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
function rows(sql) {
  var rs = st.executeQuery(sql), out = [];
  while (rs.next()) out.push(rs.getString(1) + ' = ' + rs.getString(2));
  rs.close(); return out;
}
function one(sql) { var rs = st.executeQuery(sql); rs.next(); var v = rs.getString(1); rs.close(); return v; }
var CTE = "WITH days AS (SELECT 0 AS n, CAST('2026-09-17' AS date) AS d, CAST('2026-09-22' AS date) AS d2 " +
  "UNION ALL SELECT n+1, DATEADD(day,1,d), d2 FROM days WHERE d < d2), pats AS (" +
  "SELECT DISTINCT n,p FROM (SELECT n, CONVERT(varchar(10),d,23) AS p FROM days " +
  "UNION ALL SELECT n, REPLACE(CONVERT(varchar(10),d,23),'-','/') FROM days " +
  "UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4))+'-'+CAST(MONTH(d) AS varchar(2))+'-'+CAST(DAY(d) AS varchar(2)) FROM days " +
  "UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4))+'/'+CAST(MONTH(d) AS varchar(2))+'/'+CAST(DAY(d) AS varchar(2)) FROM days) x) ";
try {
  var per = rows(CTE + "SELECT P.p, COUNT(*) FROM pats P INNER JOIN laser_aaa T ON T.biz_date = P.p GROUP BY P.p ORDER BY MIN(P.n), P.p OPTION (MAXRECURSION 0)");
  print('每 p 匹配数: ' + per.join(' | '));
  print('单 p TOP50 行数 = ' + one(CTE + "SELECT COUNT(*) FROM (SELECT TOP (50) T.[file_key] FROM laser_aaa T INNER JOIN pats P ON P.p = T.biz_date WHERE P.p = '2026-9-17') x OPTION (MAXRECURSION 0)"));
  print('apply 单 p 行数 = ' + one(CTE + "SELECT COUNT(*) FROM pats P CROSS APPLY (SELECT TOP (50) T.[file_key] FROM laser_aaa T WHERE T.[biz_date] = P.p AND P.p = '2026-9-17') M OPTION (MAXRECURSION 0)"));
  print('表内 2026-9-17 直查 = ' + one("SELECT COUNT(*) FROM laser_aaa WHERE biz_date = '2026-9-17'"));
  print('表内 2026/09/17 直查 = ' + one("SELECT COUNT(*) FROM laser_aaa WHERE biz_date = '2026/09/17'"));
} finally { st.close(); con.close(); }
print('DONE');
