// probe_machine_sqlshape.js — 机台过滤三种 SQL 形状对拍（同索引、同数据）
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName' + String.fromCharCode(61) + 'atom_live_demo;encrypt' + String.fromCharCode(61) + 'false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
var SYS = J('java.lang.System');
function val(sql) { var rs = st.executeQuery(sql); rs.next(); var v = rs.getString(1); rs.close(); return v; }
// 日期展开清单（与 browser.js 同款，6 天窗口）
var PATS = "WITH days AS (SELECT 0 AS n, CAST('2026-09-17' AS date) AS d, CAST('2026-09-22' AS date) AS d2 " +
  "UNION ALL SELECT n+1, DATEADD(day,1,d), d2 FROM days WHERE d < d2), pats AS (" +
  "SELECT DISTINCT n,p FROM (SELECT n, CONVERT(varchar(10),d,23) AS p FROM days " +
  "UNION ALL SELECT n, REPLACE(CONVERT(varchar(10),d,23),'-','/') FROM days " +
  "UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4))+'-'+CAST(MONTH(d) AS varchar(2))+'-'+CAST(DAY(d) AS varchar(2)) FROM days " +
  "UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4))+'/'+CAST(MONTH(d) AS varchar(2))+'/'+CAST(DAY(d) AS varchar(2)) FROM days) x) ";
var SELECTC = "SELECT machine_name, file_key, biz_date, biz_time, _ord FROM (";
var INNER = "SELECT LF.source_id AS machine_name, T.[file_key], T.[biz_date], T.[biz_time], ROW_NUMBER() OVER (ORDER BY P.n, T.[biz_time], T.[file_key]) AS _ord ";
var TAIL = " PGT WHERE _ord > 0 AND _ord <= 50 ORDER BY _ord OPTION (MAXRECURSION 0)";
// V1 现状: LEFT JOIN + WHERE LIKE
var V1 = PATS + SELECTC + INNER +
  "FROM laser_aaa T INNER JOIN pats P ON P.p=T.[biz_date] " +
  "LEFT JOIN laser_files LF ON LF.[file_key]=T.[file_key] " +
  "WHERE ('laser3-' = '' OR LF.[source_id] LIKE 'laser3-%')) " + TAIL;
// V2 files 先过滤成派生表再 INNER JOIN
var V2 = PATS + SELECTC + INNER +
  "FROM laser_aaa T INNER JOIN pats P ON P.p=T.[biz_date] " +
  "INNER JOIN (SELECT file_key, source_id FROM laser_files WHERE source_id LIKE 'laser3-%') LF ON LF.file_key=T.[file_key]) " + TAIL;
// V3 半连接 EXISTS 过滤 + LEFT JOIN 取显示值
var V3 = PATS + SELECTC + INNER +
  "FROM laser_aaa T INNER JOIN pats P ON P.p=T.[biz_date] " +
  "LEFT JOIN laser_files LF ON LF.[file_key]=T.[file_key] " +
  "WHERE EXISTS (SELECT 1 FROM laser_files F WHERE F.file_key=T.[file_key] AND F.[source_id] LIKE 'laser3-%')) " + TAIL;
// V4 单条机台: 先找 file_key 列表再 IN
var V4 = PATS + SELECTC + INNER +
  "FROM laser_aaa T INNER JOIN pats P ON P.p=T.[biz_date] " +
  "LEFT JOIN laser_files LF ON LF.[file_key]=T.[file_key] " +
  "WHERE T.[file_key] IN (SELECT file_key FROM laser_files WHERE source_id LIKE 'laser3-%')) " + TAIL;
function measure(name, sql) {
  st.execute("DBCC FREEPROCCACHE");
  var t0 = SYS.nanoTime();
  var rs = st.executeQuery(sql), n = 0;
  while (rs.next()) n++;
  rs.close();
  var ms = Math.round((SYS.nanoTime() - t0) / 1000000);
  var reads = val("SELECT TOP 1 CAST(qs.last_logical_reads AS varchar(20)) FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t WHERE t.text LIKE '%ROW_NUMBER() OVER (ORDER BY P.n%' ORDER BY qs.last_execution_time DESC");
  print(name + ': 行=' + n + ' 耗时=' + ms + 'ms 逻辑读=' + reads);
}
try {
  st.execute("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_date ON laser_aaa(biz_date)");
  st.execute("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_fk' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_fk ON laser_aaa(file_key)");
  st.execute("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_files_source' AND object_id=OBJECT_ID('laser_files')) CREATE INDEX IX_files_source ON laser_files(source_id) INCLUDE(file_key)");
  measure('V1 LEFT JOIN+LIKE(现状)', V1);
  measure('V2 files先过滤派生表    ', V2);
  measure('V3 EXISTS 半连接        ', V3);
  measure('V4 file_key IN 子查询   ', V4);
} finally { st.close(); con.close(); }
print('DONE');
