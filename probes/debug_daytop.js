// debug_daytop.js — 逐层计数，定位 CROSS APPLY 去行点
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName' + String.fromCharCode(61) + 'atom_live_demo;encrypt' + String.fromCharCode(61) + 'false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
function one(sql) { var rs = st.executeQuery(sql); rs.next(); var v = rs.getString(1); rs.close(); return v; }
var CTE = "WITH days AS (SELECT 0 AS n, CAST('2026-09-17' AS date) AS d, CAST('2026-09-22' AS date) AS d2 " +
  "UNION ALL SELECT n+1, DATEADD(day,1,d), d2 FROM days WHERE d < d2), pats AS (" +
  "SELECT DISTINCT n,p FROM (SELECT n, CONVERT(varchar(10),d,23) AS p FROM days " +
  "UNION ALL SELECT n, REPLACE(CONVERT(varchar(10),d,23),'-','/') FROM days " +
  "UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4))+'-'+CAST(MONTH(d) AS varchar(2))+'-'+CAST(DAY(d) AS varchar(2)) FROM days " +
  "UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4))+'/'+CAST(MONTH(d) AS varchar(2))+'/'+CAST(DAY(d) AS varchar(2)) FROM days) x) ";
try {
  print('pats 行数 = ' + one(CTE + 'SELECT COUNT(*) FROM pats OPTION (MAXRECURSION 0)'));
  print('pats 前 5 个 p = ' + one(CTE + "SELECT TOP 1 STUFF((SELECT ',' + p FROM pats ORDER BY n,p FOR XML PATH('')),1,1,'') FROM pats OPTION (MAXRECURSION 0)"));
  print('单日匹配(无apply, 直接 IN) = ' + one(CTE + "SELECT COUNT(*) FROM laser_aaa T WHERE T.biz_date IN (SELECT p FROM pats) OPTION (MAXRECURSION 0)"));
  print('cross apply 计数(仅file_key) = ' + one(CTE + 'SELECT COUNT(*) FROM pats P CROSS APPLY (SELECT TOP (50) T.[file_key] FROM laser_aaa T WHERE T.[biz_date] = P.p) M OPTION (MAXRECURSION 0)'));
  print('cross apply 计数(带LF join) = ' + one(CTE + 'SELECT COUNT(*) FROM pats P CROSS APPLY (SELECT TOP (50) T.[file_key] FROM laser_aaa T LEFT JOIN laser_files LF ON LF.[file_key]=T.[file_key] WHERE T.[biz_date] = P.p) M OPTION (MAXRECURSION 0)'));
  print('day join 计数(原样 INNER JOIN) = ' + one(CTE + 'SELECT COUNT(*) FROM laser_aaa T INNER JOIN pats P ON P.p = T.[biz_date] OPTION (MAXRECURSION 0)'));
} finally { st.close(); con.close(); }
print('DONE');
