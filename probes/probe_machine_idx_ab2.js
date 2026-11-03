// probe_machine_idx_ab2.js — 用最冷门机台复测：高选择性下复合索引是否有收益
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
var SYS = J('java.lang.System');
function ex(sql) { try { st.execute(sql); } catch (e) { print('ERR ' + e.message.split('\n')[0]); } }
function rows(sql) {
  var rs = st.executeQuery(sql), out = [];
  while (rs.next()) out.push([rs.getString(1), rs.getString(2)]);
  rs.close(); return out;
}
function val(sql) { var rs = st.executeQuery(sql); rs.next(); var v = rs.getString(1); rs.close(); return v; }
var cfg = { table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true,
  cols: [{ name: 'file_key' }, { name: 'row_number' }, { name: 'biz_date' }, { name: 'biz_time' }] };
var paged = BROWSER.pagedSql(cfg);
function runOnce(machine) {
  var sql = paged.split('${d1}').join('2026-09-17').split('${d2}').join('2026-09-22')
    .split('${machine}').join(machine).split('${stage}').join('')
    .split('${page}').join('1').split('${size}').join('50');
  var t0 = SYS.nanoTime();
  var rs = st.executeQuery(sql), n = 0;
  while (rs.next()) n++;
  rs.close();
  var ms = Math.round((SYS.nanoTime() - t0) / 1000000);
  var reads = val("SELECT TOP 1 CAST(qs.last_logical_reads AS varchar(20)) FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t WHERE t.text LIKE '%INNER JOIN pats P%' ORDER BY qs.last_execution_time DESC");
  return { n: n, ms: ms, reads: reads };
}
try {
  ex("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_date ON laser_aaa(biz_date)");
  ex("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_fk' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_fk ON laser_aaa(file_key)");
  // 找窗口内行数最少的机台前缀
  var dist = rows("SELECT TOP 5 LEFT(LF.source_id, 7) AS pfx, COUNT(*) AS n FROM laser_aaa T LEFT JOIN laser_files LF ON LF.file_key=T.file_key WHERE T.biz_date IN ('2026-09-17','2026/09/17','2026-9-17','2026/9/17','2026-09-18','2026/09/18','2026-9-18','2026/9/18','2026-09-19','2026/09/19','2026-9-19','2026/9/19','2026-09-20','2026/09/20','2026-9-20','2026/9/20','2026-09-21','2026/09/21','2026-9-21','2026/9/21','2026-09-22','2026/09/22','2026-9-22','2026/9/22') GROUP BY LEFT(LF.source_id,7) ORDER BY COUNT(*) ASC");
  print('窗口内机台分布(最冷 5): ' + dist.map(function (r) { return r[0] + '=' + r[1]; }).join(', '));
  var rare = dist[0][0];
  ex("DBCC FREEPROCCACHE");
  var b = runOnce(rare);
  print('【两条单列】冷门机台[' + rare + '] 行=' + b.n + ' 耗时=' + b.ms + 'ms 逻辑读=' + b.reads);
  ex("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_fk_date' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_fk_date ON laser_aaa(file_key, biz_date)");
  ex("DBCC FREEPROCCACHE");
  var c = runOnce(rare);
  print('【加复合】  冷门机台[' + rare + '] 行=' + c.n + ' 耗时=' + c.ms + 'ms 逻辑读=' + c.reads);
  ex("DROP INDEX IX_aaa_fk_date ON laser_aaa");
} finally { st.close(); con.close(); }
print('DONE');
