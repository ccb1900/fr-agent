// probe_order.js — 排序分歧定位：同一条取页 SQL 的三种写法，看谁改了行序
// 跑法：runraw.ps1 -Script "D:/fineagent/probes/probe_order.js"
var J = function (n) { return Java.type(n); };
var conn = J('java.sql.DriverManager')
  .getConnection('jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));

function first6(tag, sql) {
  var st = conn.createStatement();
  var rs = st.executeQuery(sql);
  var s = '## ' + tag + '\n';
  for (var i = 0; i < 6 && rs.next(); i++) s += rs.getObject(1) + '|' + rs.getObject(2) + '|' + rs.getObject(3) + '|' + rs.getObject(4) + '\n';
  rs.close(); st.close();
  return s + '\n';
}

var COLS = '[file_key], [row_number], [biz_date], [biz_time]';
var W = " WHERE TRY_CAST([biz_date] AS date) >= '2026-09-13' AND TRY_CAST([biz_date] AS date) <= '2026-09-22'";
var OF = ' OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY';

var out = '';
// V1b：带空格的别名写法（FR 存进 cpt 的 [x]A 若还原成 [x] A 是这个形态），仍走序号排序
var FR_COLS = ['file_key', 'row_number', 'biz_date', 'biz_time', 'stage', 'result_x', 'result_y', 'workpiece_x',
  'workpiece_y', 'main_prog_no', 'main_prog_seq', 'main_prog_block', 'sub_prog_no', 'sub_prog_seq',
  'sub_prog_block', 'machine_x', 'machine_y', 'size', 'score'].map(function (c) { return '[' + c + '] A'; }).join(', ');
out += first6('V1b_spaced_alias_ordinal', 'SELECT ' + FR_COLS + ', TRY_CAST([biz_date] AS date) AS ord_day' +
  ' FROM [laser_aaa]' + W + ' ORDER BY 20, 4, 2' + OF);
// V5：完全不排序（OFFSET 需要一个 ORDER BY，用常量表达式占位）→ 物理/索引自然序长什么样
out += first6('V5_no_order', 'SELECT ' + COLS + ' FROM [laser_aaa]' + W +
  ' ORDER BY (SELECT NULL)' + OF);
// V1：FR 存进 cpt 的原样（每列都被补了表别名 A，ORDER BY 走序号）
out += '(skipped V1: [x]A 无空格写法直接语法错)\n\n';
// V2：干净写法 + ORDER BY 序号（多带一列 ord_day 占第 4 位，让序号指向 date/time/rn）
out += first6('V2_clean_ordinal', 'SELECT ' + COLS + ', TRY_CAST([biz_date] AS date) AS ord_day' +
  ' FROM [laser_aaa]' + W + ' ORDER BY 5, 3, 2' + OF);
// V3：干净写法 + ORDER BY 表达式（= db_br_truth.txt 的口径）
out += first6('V3_clean_expression', 'SELECT ' + COLS + ' FROM [laser_aaa]' + W +
  ' ORDER BY TRY_CAST([biz_date] AS date), [biz_time], [row_number]' + OF);
// V4：干净写法 + ORDER BY 序号，但 biz_time 是 nvarchar，检查同日期同时刻并列时的稳定性
out += first6('V4_ordinal_only_date_time', 'SELECT ' + COLS + ', TRY_CAST([biz_date] AS date) AS ord_day' +
  ' FROM [laser_aaa]' + W + ' ORDER BY 5, 3' + OF);

conn.close();
J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/db_order_probe.txt'),
  J('java.lang.String').valueOf(out).getBytes('UTF-8'));
print(out);
