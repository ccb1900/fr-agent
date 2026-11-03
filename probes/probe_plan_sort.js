// probe_plan_sort.js — 4列复合索引下：读页/耗时 + 计划里是否还有 Sort 算子
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName' + String.fromCharCode(61) + 'atom_live_demo;encrypt' + String.fromCharCode(61) + 'false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
var SYS = J('java.lang.System');
function val(sql) { var rs = st.executeQuery(sql); var v = rs.next() ? rs.getString(1) : 'n/a'; rs.close(); return v; }
function ex(sql) { try { st.execute(sql); } catch (e) { print('ERR ' + e.message.split('\n')[0]); } }
function readsOf() {
  return val("SELECT TOP 1 CAST(qs.last_logical_reads AS varchar(20)) FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t WHERE t.text LIKE '%CROSS APPLY%' AND t.text LIKE '%laser_aaa%' ORDER BY qs.last_execution_time DESC");
}
function planSorts() {
  var x = val("SELECT TOP 1 CAST(qp.query_plan AS nvarchar(max)) FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t WHERE t.text LIKE '%CROSS APPLY%' AND t.text LIKE '%laser_aaa%' ORDER BY qs.last_execution_time DESC");
  var sorts = (String(x).match(/PhysicalOp="Sort"/g) || []).length;
  return sorts;
}
var j = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables.json'));
var t = null; for (var i = 0; i < j.length; i++) if (j[i].table === 'laser_aaa') t = j[i];
var cols = []; for (var c = 0; c < t.cols.length; c++) cols.push({ name: t.cols[c].name });
var cfg = { table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true, cols: cols };
var sql = BROWSER.pagedSql(cfg)
  .split('${d1}').join('2026-09-17').split('${d2}').join('2026-09-22')
  .split('${machine}').join('').split('${stage}').join('')
  .split('${page}').join('1').split('${size}').join('50');
function run(label) {
  ex("DBCC FREEPROCCACHE");
  var t0 = SYS.nanoTime();
  var rs = st.executeQuery(sql), n = 0;
  while (rs.next()) n++;
  rs.close();
  var ms = Math.round((SYS.nanoTime() - t0) / 1000000);
  print(label + ': 行=' + n + ' 耗时=' + ms + 'ms 逻辑读=' + readsOf() + ' Sort算子=' + planSorts());
}
try {
  ex("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date_ord' AND object_id=OBJECT_ID('laser_aaa')) DROP INDEX IX_aaa_date_ord ON laser_aaa");
  ex("CREATE INDEX IX_aaa_date_ord ON laser_aaa(biz_date, biz_time, file_key, row_number)");
  ex("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_fk' AND object_id=OBJECT_ID('laser_aaa')) DROP INDEX IX_aaa_fk ON laser_aaa");
  ex("CREATE INDEX IX_aaa_fk ON laser_aaa(file_key)");
  run('4列复合');
  run('4列复合(第二遍)');
} finally { st.close(); con.close(); }
print('DONE');
