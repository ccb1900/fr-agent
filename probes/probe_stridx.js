// probe_stridx.js — NVARCHAR(4000) 列能否直接建索引（键长上限实证）+ 展开清单查询验证
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
function exec(sql) { try { st.execute(sql); } catch (e) { print('ERR: ' + e.message.split('\n')[0]); } }
function one(sql) {
  var rs = st.executeQuery(sql), v = [];
  while (rs.next()) v.push(rs.getString(1));
  rs.close();
  return v;
}
try {
  exec("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_probe_bd' AND object_id=OBJECT_ID('laser_aaa')) DROP INDEX ix_probe_bd ON laser_aaa");
  exec("CREATE NONCLUSTERED INDEX ix_probe_bd ON laser_aaa(biz_date)");
  print('索引可建 = ' + one("SELECT COUNT(*) FROM sys.indexes WHERE name='ix_probe_bd' AND object_id=OBJECT_ID('laser_aaa')")[0]);
  // 展开清单: 2026-09-17..2026-09-22, 两种分隔符 x 补零/不补零 = 24 个值；与旧版日期表达式对拍
  var q = "WITH days AS (" +
    " SELECT 0 AS n, COALESCE(TRY_CAST('2026-09-17' AS date), DATEADD(day,-6,CONVERT(date,GETDATE()))) AS d, COALESCE(TRY_CAST('2026-09-22' AS date), CONVERT(date,GETDATE())) AS d2" +
    " UNION ALL SELECT n+1, DATEADD(day,1,d), d2 FROM days WHERE d < d2" +
    "), pats AS (" +
    " SELECT DISTINCT n, p FROM (" +
    "  SELECT n, CONVERT(varchar(10),d,23) AS p FROM days" +
    "  UNION ALL SELECT n, REPLACE(CONVERT(varchar(10),d,23),'-','/') FROM days" +
    "  UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4))+'-'+CAST(MONTH(d) AS varchar(2))+'-'+CAST(DAY(d) AS varchar(2)) FROM days" +
    "  UNION ALL SELECT n, CAST(YEAR(d) AS varchar(4))+'/'+CAST(MONTH(d) AS varchar(2))+'/'+CAST(DAY(d) AS varchar(2)) FROM days" +
    " ) x)" +
    " SELECT COUNT(*) FROM laser_aaa T INNER JOIN pats P ON P.p = T.[biz_date] OPTION (MAXRECURSION 0)";
  print('展开清单命中行数 = ' + one(q)[0]);
  print('清单条目数 = ' + one("WITH days AS (SELECT 0 AS n, COALESCE(TRY_CAST('2026-09-17' AS date), GETDATE()) AS d, COALESCE(TRY_CAST('2026-09-22' AS date), GETDATE()) AS d2 UNION ALL SELECT n+1, DATEADD(day,1,d), d2 FROM days WHERE d < d2) SELECT COUNT(*) FROM days OPTION (MAXRECURSION 0)")[0]);
  // 旧口径对拍: 同窗口按字符串日期解析出日期的行数（用 TRY_CAST 做基准）
  print('旧口径(TRY_CAST 范围)行数 = ' + one("SELECT COUNT(*) FROM laser_aaa WHERE TRY_CAST(biz_date AS date) >= '2026-09-17' AND TRY_CAST(biz_date AS date) <= '2026-09-22'")[0]);
  exec("DROP INDEX ix_probe_bd ON laser_aaa");
} finally { st.close(); con.close(); }
print('DONE');
