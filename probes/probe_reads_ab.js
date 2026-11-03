// probe_reads_ab.js — 读页 A/B：新按天TOP vs 旧全窗口排序（同数据同索引）
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName' + String.fromCharCode(61) + 'atom_live_demo;encrypt' + String.fromCharCode(61) + 'false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
var SYS = J('java.lang.System');
function val(sql) {
  var rs = st.executeQuery(sql);
  var v = rs.next() ? rs.getString(1) : 'n/a';
  rs.close(); return v;
}
function lastReads() {
  return val("SELECT TOP 1 CAST(qs.last_logical_reads AS varchar(20)) FROM sys.dm_exec_query_stats qs " +
    "CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t " +
    "WHERE t.text LIKE '%laser_aaa%' AND t.text NOT LIKE '%dm_exec%' " +
    "ORDER BY qs.last_execution_time DESC");
}
function run(sql, tag) {
  st.execute("DBCC FREEPROCCACHE");
  var t0 = SYS.nanoTime();
  var rs = st.executeQuery(sql), n = 0;
  while (rs.next()) n++;
  rs.close();
  var ms = Math.round((SYS.nanoTime() - t0) / 1000000);
  var reads = lastReads();
  print(tag + ': 行=' + n + ' 耗时=' + ms + 'ms 逻辑读=' + reads);
}
var j = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables.json'));
var t = null; for (var i = 0; i < j.length; i++) if (j[i].table === 'laser_aaa') t = j[i];
var cols = []; for (var c = 0; c < t.cols.length; c++) cols.push({ name: t.cols[c].name });
var cfg = { table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true, cols: cols };
var NAMES = cols.map(function (x) { return x.name; });
var newSql = BROWSER.pagedSql(cfg)
  .split('${d1}').join('2026-09-17').split('${d2}').join('2026-09-22')
  .split('${machine}').join('').split('${stage}').join('')
  .split('${page}').join('1').split('${size}').join('50');
var ties = 'T.[biz_time], T.[file_key], T.[row_number], T.[main_prog_no], T.[main_prog_seq], T.[sub_prog_no], T.[sub_prog_seq]';
var sel = NAMES.map(function (n) { return 'T.[' + n + ']'; }).join(', ');
var oldSql = 'SELECT * FROM (SELECT ' + sel + ', ROW_NUMBER() OVER (ORDER BY TRY_CAST(T.biz_date AS date), ' + ties + ') AS _ord ' +
  "FROM laser_aaa T WHERE TRY_CAST(T.biz_date AS date) >= '2026-09-17' AND TRY_CAST(T.biz_date AS date) <= '2026-09-22') X " +
  'WHERE _ord > 0 AND _ord <= 50 ORDER BY _ord';
try {
  st.execute("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_date ON laser_aaa(biz_date)");
  st.execute("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_fk' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_fk ON laser_aaa(file_key)");
  print('--- 只有单列日期索引 ---');
  run(oldSql, '旧全窗口排序');
  run(newSql, 'CROSS APPLY');
  st.execute("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date_ord' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_date_ord ON laser_aaa(biz_date, biz_time, file_key)");
  print('--- 加复合索引 (biz_date,biz_time,file_key) ---');
  run(oldSql, '旧全窗口排序');
  run(newSql, 'CROSS APPLY');
  run(newSql, 'CROSS APPLY');
} finally { st.close(); con.close(); }
print('DONE');
