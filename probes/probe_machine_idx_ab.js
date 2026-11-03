// probe_machine_idx_ab.js — 机台过滤索引 A/B：单列两条 vs 再加复合 (file_key,biz_date)，看逻辑读与耗时
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
var SYS = J('java.lang.System');
function ex(sql) { try { st.execute(sql); } catch (e) { print('ERR ' + e.message.split('\n')[0]); } }
function val(sql) { var rs = st.executeQuery(sql); rs.next(); var v = rs.getString(1); rs.close(); return v; }
function cfgOf() {
  return { table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true,
    cols: [{ name: 'file_key' }, { name: 'row_number' }, { name: 'biz_date' }, { name: 'biz_time' }] };
}
function runOnce(sql, machine) {
  sql = sql.split('${d1}').join('2026-09-17').split('${d2}').join('2026-09-22')
    .split('${machine}').join(machine).split('${stage}').join('')
    .split('${page}').join('1').split('${size}').join('50');
  var t0 = SYS.nanoTime();
  var rs = st.executeQuery(sql), n = 0;
  while (rs.next()) n++;
  rs.close();
  var ms = Math.round((SYS.nanoTime() - t0) / 1000000);
  // 从 DMV 取最近一次同文本查询的逻辑读
  var dmv = val("SELECT TOP 1 CAST(qs.last_logical_reads AS varchar(20)) FROM sys.dm_exec_query_stats qs " +
    "CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t WHERE t.text LIKE '%INNER JOIN pats P%' " +
    "ORDER BY qs.last_execution_time DESC");
  return { n: n, ms: ms, reads: dmv };
}
try {
  // 基线索引：日期 + file_key（演示库上确保存在）
  ex("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_date ON laser_aaa(biz_date)");
  ex("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_fk' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_fk ON laser_aaa(file_key)");
  var cfg = cfgOf(), paged = BROWSER.pagedSql(cfg);
  ex("DBCC FREEPROCCACHE");   // 清计划缓存，避免旧计划干扰
  var b1 = runOnce(paged, '');
  print('【两条单列】全机台  行=' + b1.n + ' 耗时=' + b1.ms + 'ms 逻辑读=' + b1.reads);
  var b2 = runOnce(paged, 'laser5');
  print('【两条单列】机台laser5 行=' + b2.n + ' 耗时=' + b2.ms + 'ms 逻辑读=' + b2.reads);
  // 加复合索引
  ex("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_fk_date' AND object_id=OBJECT_ID('laser_aaa')) CREATE INDEX IX_aaa_fk_date ON laser_aaa(file_key, biz_date)");
  ex("DBCC FREEPROCCACHE");
  var c1 = runOnce(paged, '');
  print('【加复合】  全机台  行=' + c1.n + ' 耗时=' + c1.ms + 'ms 逻辑读=' + c1.reads);
  var c2 = runOnce(paged, 'laser5');
  print('【加复合】  机台laser5 行=' + c2.n + ' 耗时=' + c2.ms + 'ms 逻辑读=' + c2.reads);
  // 清理演示库临时复合索引
  ex("DROP INDEX IX_aaa_fk_date ON laser_aaa");
} finally { st.close(); con.close(); }
print('DONE');
