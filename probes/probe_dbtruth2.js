// probe_dbtruth2.js — 第二刀真值：day×stage 明细 / 逐日小计 / 全表总计（三段，UTF-8 落盘）
var J = function (n) { return Java.type(n); };
var conn = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));

function dump(title, sql, ncol) {
  var st = conn.createStatement();
  var rs = st.executeQuery(sql);
  var out = '## ' + title + '\n';
  var n = 0;
  while (rs.next()) {
    var r = [];
    for (var i = 1; i <= ncol; i++) r.push(String(rs.getObject(i)));
    out += r.join('|') + '\n';
    n++;
  }
  rs.close(); st.close();
  print(title + ' ROWS=' + n);
  return out;
}

var detail = dump('detail',
  "SELECT convert(varchar(10), TRY_CAST(biz_date AS date), 23) AS biz_day, stage," +
  " COUNT(*) AS row_cnt," +
  " SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1 ELSE 0 END) AS pass_cnt," +
  " ROUND(SUM(TRY_CAST(score AS decimal(18,6))), 6) AS score_sum," +
  " ROUND(MIN(TRY_CAST(score AS decimal(10,4))), 4) AS min_score," +
  " ROUND(MAX(TRY_CAST(score AS decimal(10,4))), 4) AS max_score" +
  " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
  " GROUP BY TRY_CAST(biz_date AS date), stage ORDER BY 1, 2", 7);

// 逐日小计（报表里由 =SUM(明细格) 算出，这里同口径直查）
var subtotal = dump('subtotal_by_day',
  "SELECT convert(varchar(10), TRY_CAST(biz_date AS date), 23) AS biz_day," +
  " COUNT(*) AS row_cnt," +
  " SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1 ELSE 0 END) AS pass_cnt," +
  " ROUND(SUM(TRY_CAST(score AS decimal(18,6))), 6) AS score_sum," +
  " ROUND(SUM(TRY_CAST(score AS decimal(18,6))) / COUNT(*), 6) AS wavg_score," +
  " ROUND(MIN(TRY_CAST(score AS decimal(10,4))), 4) AS min_score," +
  " ROUND(MAX(TRY_CAST(score AS decimal(10,4))), 4) AS max_score" +
  " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
  " GROUP BY TRY_CAST(biz_date AS date) ORDER BY 1", 7);

// 全表总计
var grand = dump('grand_total',
  "SELECT COUNT(*) AS row_cnt," +
  " SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1 ELSE 0 END) AS pass_cnt," +
  " ROUND(SUM(TRY_CAST(score AS decimal(18,6))), 6) AS score_sum," +
  " ROUND(SUM(TRY_CAST(score AS decimal(18,6))) / COUNT(*), 6) AS wavg_score," +
  " ROUND(MIN(TRY_CAST(score AS decimal(10,4))), 4) AS min_score," +
  " ROUND(MAX(TRY_CAST(score AS decimal(10,4))), 4) AS max_score" +
  " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL", 6);

// 钻取子报表真值：单日逐小时（biz_time 前 2 位小时）
var drill = dump('drill_2026-09-13_hourly',
  "SELECT left(biz_time, 2) AS hh," +
  " COUNT(*) AS row_cnt," +
  " SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1 ELSE 0 END) AS pass_cnt," +
  " ROUND(SUM(TRY_CAST(score AS decimal(18,6))), 6) AS score_sum," +
  " ROUND(SUM(TRY_CAST(score AS decimal(18,6))) / COUNT(*), 6) AS wavg_score" +
  " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
  " AND TRY_CAST(biz_date AS date) = '2026-09-13' GROUP BY left(biz_time, 2) ORDER BY 1", 5);

conn.close();
var all = detail + '\n' + subtotal + '\n' + grand + '\n' + drill;
J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/db_laser_sub_truth.txt'),
  J('java.lang.String').valueOf(all).getBytes('UTF-8'));
print('WROTE D:/fineagent/data/db_laser_sub_truth.txt bytes=' + all.length);
