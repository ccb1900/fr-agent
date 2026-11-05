// probe_machine_daily_truth.js — GOLDEN v1 机台级真值（docs/golden-e2e-case.md §6.3，r22-golden-scope.md §4 要求；
//   r22b-golden-readiness.md 收尾：主段与生产生成 SQL 同用 INNER JOIN；join_sanity 用 LEFT 语义补 match 证明）
//   三段：detail=日期×机台（day, machine）/ subtotal_by_day / grand_total，全部 INNER JOIN（生产 sqlbuilder 关系语义一致）。
//   口径与 v1 输入完全一致：固定区间 2026-09-13~2026-09-22（字面，受控日期安全）；
//   关联=recordToFile 安全 JOIN（laser_aaa.file_key=laser_files.file_key，I5.1 唯一性证据 538/538 绑定指纹）；
//   机台=laser_files.source_id（machine 维度，r22-golden-scope.md §3 记档 source_id 非单列唯一、仅作维度不作行键）；
//   计划=COUNT(*)；完成=score>=0.9 计数（与 db_laser_sub_truth 同口径）；附 score_sum/wavg/min/max 与完成率参考列
//   （比率=完成/计划*100，展示层口径，SQL 内不参与过滤/分组运算，遵守 I5"ratio 不进 SQL"契约）。
//   join_sanity（r22b P1-2）：LEFT 语义三计数——matched/unmatched/fanout；unmatched=0 且 fanout=0 才证明 INNER==LEFT
//   （分支页调查：单条 LEFT 未匹配行会保留左表行数，仅行数相等不证明全部匹配）。
//   只读连接（单语句 SELECT/WITH 行规），不启 FineReport、不触 FineDB，与 probe_dbtruth2.js 惯例一致。
//   落 data/db_laser_machine_daily_truth.txt（UTF-8）；凭据经 lib/dbpass.js 本机节点（入库文件不含凭据）。
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

var WINDOW = "TRY_CAST(a.biz_date AS date) >= '2026-09-13' AND TRY_CAST(a.biz_date AS date) <= '2026-09-22'";
var INNER_FROM = " FROM laser_aaa a INNER JOIN laser_files f ON a.file_key = f.file_key";

// detail: 日期 × 机台（day|machine|plan|done|rate|score_sum|wavg|min/max 与旧真值保持可比）
var detail = dump('detail_day_machine',
  "SELECT convert(varchar(10), TRY_CAST(a.biz_date AS date), 23) AS biz_day," +
  " CAST(f.source_id AS varchar(64)) AS machine," +
  " COUNT(*) AS plan_cnt," +
  " SUM(CASE WHEN TRY_CAST(a.score AS float) >= 0.9 THEN 1 ELSE 0 END) AS done_cnt," +
  " ROUND(100.0 * SUM(CASE WHEN TRY_CAST(a.score AS float) >= 0.9 THEN 1 ELSE 0 END) / COUNT(*), 4) AS rate_pct," +
  " ROUND(SUM(TRY_CAST(a.score AS decimal(18,6))), 6) AS score_sum," +
  " ROUND(SUM(TRY_CAST(a.score AS decimal(18,6))) / COUNT(*), 6) AS wavg_score," +
  " ROUND(MIN(TRY_CAST(a.score AS decimal(10,4))), 4) AS min_score," +
  " ROUND(MAX(TRY_CAST(a.score AS decimal(10,4))), 4) AS max_score" +
  INNER_FROM +
  " WHERE " + WINDOW + " AND TRY_CAST(a.score AS float) IS NOT NULL" +
  " GROUP BY TRY_CAST(a.biz_date AS date), CAST(f.source_id AS varchar(64)) ORDER BY 1, 2", 9);

// 逐日小计（detail 求和粗检用；machine_cnt 由 DISTINCT 保证）
var subtotal = dump('subtotal_by_day',
  "SELECT convert(varchar(10), TRY_CAST(a.biz_date AS date), 23) AS biz_day," +
  " COUNT(*) AS plan_cnt," +
  " SUM(CASE WHEN TRY_CAST(a.score AS float) >= 0.9 THEN 1 ELSE 0 END) AS done_cnt," +
  " ROUND(100.0 * SUM(CASE WHEN TRY_CAST(a.score AS float) >= 0.9 THEN 1 ELSE 0 END) / COUNT(*), 4) AS rate_pct," +
  " ROUND(SUM(TRY_CAST(a.score AS decimal(18,6))), 6) AS score_sum," +
  " ROUND(SUM(TRY_CAST(a.score AS decimal(18,6))) / COUNT(*), 6) AS wavg_score," +
  " COUNT(DISTINCT CAST(f.source_id AS varchar(64))) AS machine_cnt" +
  INNER_FROM +
  " WHERE " + WINDOW + " AND TRY_CAST(a.score AS float) IS NOT NULL" +
  " GROUP BY TRY_CAST(a.biz_date AS date) ORDER BY 1", 7);

// 区间总计
var grand = dump('grand_total',
  "SELECT COUNT(*) AS plan_cnt," +
  " SUM(CASE WHEN TRY_CAST(a.score AS float) >= 0.9 THEN 1 ELSE 0 END) AS done_cnt," +
  " ROUND(100.0 * SUM(CASE WHEN TRY_CAST(a.score AS float) >= 0.9 THEN 1 ELSE 0 END) / COUNT(*), 4) AS rate_pct," +
  " ROUND(SUM(TRY_CAST(a.score AS decimal(18,6))), 6) AS score_sum," +
  " ROUND(SUM(TRY_CAST(a.score AS decimal(18,6))) / COUNT(*), 6) AS wavg_score," +
  " COUNT(DISTINCT CAST(f.source_id AS varchar(64))) AS machine_cnt," +
  " COUNT(DISTINCT TRY_CAST(a.biz_date AS date)) AS day_cnt" +
  INNER_FROM +
  " WHERE " + WINDOW + " AND TRY_CAST(a.score AS float) IS NOT NULL", 7);

// 自证（r22b P1-2）：LEFT 语义的匹配性证明 —— 主数据段是 INNER；这段证明 INNER 与 LEFT 行数、涉键都一致：
//   base=单人总数 / joined=LEFT 总行 / matched=LEFT 中 f.file_key 命中数 / unmatched=未匹配（f.file_key IS NULL）/
//   fanout=laser_files 侧同键出多条记录的键数（JOIN 放大源只可能在 f 侧重复——用独立 f 表子查询严证，
//   不能用左键在 join 后的组行数（q.file_key 重复属正常业务：多检测记录共用一个文件键——实跑取证教训））。
//   unmatched=0 且 joined=base 且 fanout=0 => INNER==LEFT。
var joinCheck = dump('join_sanity',
  "SELECT" +
  " (SELECT COUNT(*) FROM laser_aaa q WHERE TRY_CAST(q.biz_date AS date) >= '2026-09-13' AND TRY_CAST(q.biz_date AS date) <= '2026-09-22' AND TRY_CAST(q.score AS float) IS NOT NULL) AS base_cnt," +
  " (SELECT COUNT(*) FROM laser_aaa q LEFT JOIN laser_files f ON q.file_key = f.file_key WHERE TRY_CAST(q.biz_date AS date) >= '2026-09-13' AND TRY_CAST(q.biz_date AS date) <= '2026-09-22' AND TRY_CAST(q.score AS float) IS NOT NULL) AS joined_cnt," +
  " (SELECT COUNT(*) FROM laser_aaa q LEFT JOIN laser_files f ON q.file_key = f.file_key WHERE TRY_CAST(q.biz_date AS date) >= '2026-09-13' AND TRY_CAST(q.biz_date AS date) <= '2026-09-22' AND TRY_CAST(q.score AS float) IS NOT NULL AND f.file_key IS NOT NULL) AS matched_cnt," +
  " (SELECT COUNT(*) FROM laser_aaa q LEFT JOIN laser_files f ON q.file_key = f.file_key WHERE TRY_CAST(q.biz_date AS date) >= '2026-09-13' AND TRY_CAST(q.biz_date AS date) <= '2026-09-22' AND TRY_CAST(q.score AS float) IS NOT NULL AND f.file_key IS NULL) AS unmatched_cnt," +
  " (SELECT COUNT(*) FROM (SELECT f2.file_key FROM laser_files f2 GROUP BY f2.file_key HAVING COUNT(*) > 1) t) AS fanout_cnt" +
  " FROM (SELECT 1 AS anchor) x", 5);

conn.close();
var all = detail + '\n' + subtotal + '\n' + grand + '\n' + joinCheck;
J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/db_laser_machine_daily_truth.txt'),
  J('java.lang.String').valueOf(all).getBytes('UTF-8'));
print('WROTE D:/fineagent/data/db_laser_machine_daily_truth.txt bytes=' + all.length);

