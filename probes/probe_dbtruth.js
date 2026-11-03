// _probe_db4.js — 出数真值：跑 db_laser_aaa spec 里那条 SQL，UTF-8 落盘供逐格核对
var J = function (n) { return Java.type(n); };
var conn = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var sql = "SELECT convert(varchar(10), TRY_CAST(biz_date AS date), 23) AS biz_day," +
  " COUNT(*) AS row_cnt, COUNT(DISTINCT file_key) AS file_cnt," +
  " ROUND(AVG(TRY_CAST(score AS decimal(10,4))), 4) AS avg_score," +
  " ROUND(MIN(TRY_CAST(score AS decimal(10,4))), 4) AS min_score," +
  " ROUND(MAX(TRY_CAST(score AS decimal(10,4))), 4) AS max_score," +
  " ROUND(AVG(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1.0 ELSE 0.0 END) * 100, 2) AS pass_rate" +
  " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
  " GROUP BY TRY_CAST(biz_date AS date) ORDER BY 1";
var st = conn.createStatement();
var rs = st.executeQuery(sql);
var out = '';
while (rs.next()) {
  var r = [];
  for (var i = 1; i <= 7; i++) r.push(String(rs.getObject(i)));
  out += r.join('|') + '\n';
}
rs.close(); st.close(); conn.close();
print('ROWS=' + out.split('\n').length);
J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/db_laser_aaa_truth.txt'),
  J('java.lang.String').valueOf(out).getBytes('UTF-8'));
