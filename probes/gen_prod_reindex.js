// gen_prod_reindex.js — 生产索引 SQL 生成器 v2（读 db_laser_tables_prod.json → build_prod/build_prod_reindex.sql）
// 分型阈值（2026-10-28 用户口径）：>100 万行走"空表重建+改名"组；<=100 万行直接在线加索引（秒级锁，不碍事）。
// 类型/列名/日期列全部照抄生产画像；nvarchar 按 maxlen/2（probe_charmax 实证 =4000 非 MAX）。
// 引号纪律：含撇号的 SQL 片段一律用 JS 双引号串写，不给单引号嵌套留活路（前两版翻车实证）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
function writeUtf8(p, s) {
  var pf = J('java.nio.file.Paths').get(p).toAbsolutePath().getParent();
  Files.createDirectories(pf);
  var w = new (J('java.io.OutputStreamWriter'))(new (J('java.io.FileOutputStream'))(p), 'UTF-8');
  w.write(s); w.close();
}

var data = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables_prod.json'));
// 日期表达式唯一来源：lib/browser.js 的 BROWSER.dateExpr（查询侧同一函数，保证与计算列定义逐字一致 → SEEK 匹配）
load('D:/fineagent/lib/browser.js');
var dateExpr = BROWSER.dateExpr;
var TPFX = 't_collector_';
var REBUILD_ROWS = 1000000;

function typeText(c) {
  var d = String(c.dtype || '').toUpperCase();
  if (d.indexOf('NVARCHAR') === 0) return 'NVARCHAR(' + Math.max(1, Math.floor((c.maxlen || 8000) / 2)) + ')';
  return d;
}
function isNativeDate(t) {
  var dc = t.dateCol;
  if (!dc) return false;
  for (var k = 0; k < t.cols.length; k++) if (t.cols[k].name === dc) {
    var d = String(t.cols[k].dtype || '').toLowerCase();
    return d === 'date' || d === 'datetime' || d === 'datetime2';
  }
  return false;
}
function fmt(n) {
  var s = String(n), r = '';
  while (s.length > 3) { r = ',' + s.slice(-3) + r; s = s.slice(0, -3); }
  return s + r;
}
function q(name) { return "N'[dbo]." + name + "'"; }   // N'[dbo].xxx'
var want = function (t) { return t.rows > REBUILD_ROWS; };
var idxShort = function (t) { return String(t.table).replace(/^laser_/, '').replace(/[^A-Za-z0-9_]/g, ''); };

var out = [];
out.push('-- ============================================================');
out.push('-- build_prod_reindex.sql — 激光库索引方案 v2（2026-10-28 生成）');
out.push('-- 生成源：data/db_laser_tables_prod.json（生产 SSMS 贴回画像，25 表）');
out.push('-- 分型：B 组（<=100 万行：在线升级成日期聚簇 + file_key 索引，不重建）＋ A 组（>100 万行：重建表换骨，避免长锁）。');
out.push('-- 全程均为表级锁，不锁库；每组各表独立批次（GO 分隔），可单段重跑。');
out.push('-- 使用：先手工把下行库名填上并启用（去掉注释）：');
out.push('-- USE [<激光数据库名>];');
out.push('SET NOCOUNT ON;');
out.push('GO');
out.push('');
out.push('-- ########## 段 0：兼容探路（只影响 A 组；B 组可直接先跑） ##########');
out.push('-- 打印 SQL Server 版本 + 四种候选表达式各自能否 PERSISTED（TRY/CATCH 逐项吞错）。');
out.push('-- 只有 d1（yyyymmdd 整数规范形，本文件正式使用的那个）PRINT 出 PASS 才继续；');
out.push('-- 若 d1 也 FAIL，把整段输出发回（说明不是表达式层面问题）。');
out.push("DECLARE @ver nvarchar(256) = CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(256)) + N' / ' + CAST(SERVERPROPERTY('Edition') AS nvarchar(256));");
out.push("PRINT N'SQL Server 版本 = ' + @ver;");
out.push('CREATE TABLE #pc (a nvarchar(4000) NULL);');
out.push("BEGIN TRY ALTER TABLE #pc ADD d1 AS " + dateExpr('a') + " PERSISTED; PRINT N'PASS d1  yyyymmdd整数规范形(正式使用)'; END TRY BEGIN CATCH PRINT N'FAIL d1  yyyymmdd整数规范形: ' + ERROR_MESSAGE(); END CATCH");
out.push("BEGIN TRY ALTER TABLE #pc ADD d2 AS CONVERT(date, a, 23) PERSISTED; PRINT N'PASS d2  CONVERT(date,x,23)'; END TRY BEGIN CATCH PRINT N'FAIL d2  CONVERT(date,x,23): ' + ERROR_MESSAGE(); END CATCH");
out.push("BEGIN TRY ALTER TABLE #pc ADD d3 AS TRY_CONVERT(date, a, 23) PERSISTED; PRINT N'PASS d3  TRY_CONVERT(date,x,23)'; END TRY BEGIN CATCH PRINT N'FAIL d3  TRY_CONVERT(date,x,23): ' + ERROR_MESSAGE(); END CATCH");
out.push("DROP TABLE #pc;");
out.push('GO');
out.push('');
out.push('-- ################ A 组：大表重建（>100 万行，6 张）################');
out.push('-- 方法：建空表 → 空表上建聚簇（毫秒级）→ 按聚簇键序灌数 → 行数对拍 → 改名切换。');
out.push('-- 要求：避开每日 09:01 采集窗、一次只做一张、单独时段；');
out.push('--   盘余量 >= 该表 2 倍；构建期间日志会长大（FULL 模式下自动增长用固定 MB 一档）。');
out.push('--   建议顺序：laser_aaa → sensor → cnd_selct → glv_cnd_send → length → sinsyuku。');
out.push('--   验证一个采集周期后（FR 端 24 张 cpt 全开过一遍），再启用段尾 DROP TABLE ..._old。');
out.push('');

for (var i = 0; i < data.length; i++) {
  var t = data[i];
  if (!want(t)) continue;
  var base = TPFX + t.table;
  var nbase = '[' + base + ']';
  var nnew = '[' + base + '_new]';
  var nold = '[' + base + '_old]';
  var short = idxShort(t);
  var m = String(i);
  var cols = t.cols;
  var colList = [];
  for (var k = 0; k < cols.length; k++) colList.push('[' + cols[k].name + ']');

  var dateCol = t.dateCol, timeCol = t.timeCol;
  var nativeDate = isNativeDate(t);
  var dateD = dateCol ? dateCol + '_d' : null;
  var hasFK = false;
  for (var k2 = 0; k2 < cols.length; k2++) if (cols[k2].name === 'file_key') hasFK = true;
  var dKey = nativeDate ? '[' + dateCol + ']' : '[' + dateD + ']';
  var dExpr = nativeDate ? '[' + dateCol + ']' : dateExpr(dateCol);
  var clusterKeys = dKey + (timeCol ? ', [' + timeCol + ']' : '') + (hasFK ? ', [file_key]' : '');
  var orderExpr = dExpr + (timeCol ? ', [' + timeCol + ']' : '') + (hasFK ? ', [file_key]' : '');
  var idxName = 'CX_' + short + '_date';

  out.push('-- ============================================================');
  out.push('-- ' + base + '  行数 ' + fmt(t.rows) + '  ★放单独时段执行');
  out.push('-- ============================================================');
  out.push("IF OBJECT_ID(" + q(base + '_old') + ", 'U') IS NOT NULL AND OBJECT_ID(" + q(base) + ", 'U') IS NULL");
  out.push('BEGIN');
  out.push("  PRINT N'>>> " + base + ": 已完成切换（_old 在、原名不在），跳过本段；如需重做请手工恢复命名。';");
  out.push('  RETURN;');
  out.push('END;');
  out.push('IF OBJECT_ID(' + q(base + '_new') + ", 'U') IS NOT NULL DROP TABLE " + nnew + ';   -- 上次失败残留');
  out.push('');
  out.push('CREATE TABLE ' + nnew + ' (');
  var dlines = [];
  for (var k3 = 0; k3 < cols.length; k3++) dlines.push('  [' + cols[k3].name + '] ' + typeText(cols[k3]) + ' NULL');
  out.push(dlines.join(',\n'));
  out.push(');');
  if (!nativeDate) {
    out.push('ALTER TABLE ' + nnew + ' ADD [' + dateD + '] AS ' + dateExpr(dateCol) + ' PERSISTED;   -- 确定性 CASE 守卫表达式(TRY_CAST/TRY_CONVERT 均被版本判非确定性, 生产 4936 实证)');
  }
  out.push('');
  out.push('CREATE CLUSTERED INDEX [' + idxName + '] ON ' + nnew + ' (' + clusterKeys + ');   -- 采集按日期递增追加: 插入永远落索引尾, 无页拆分');
  out.push('');
  out.push('INSERT INTO ' + nnew + ' WITH (TABLOCK) (' + colList.join(', ') + ')');
  out.push('SELECT ' + colList.join(', ') + ' FROM ' + nbase);
  if (orderExpr) out.push('ORDER BY ' + orderExpr + ';   -- 按聚簇键序灌数=页页连续零碎片');
  out.push('');
  out.push('DECLARE @o_' + m + ' bigint = (SELECT COUNT(*) FROM ' + nbase + ');');
  out.push('DECLARE @n_' + m + ' bigint = (SELECT COUNT(*) FROM ' + nnew + ');');
  out.push("PRINT N'>>> " + base + " old=' + CAST(@o_" + m + " AS varchar(20)) + N' new=' + CAST(@n_" + m + " AS varchar(20));");
  out.push('IF @n_' + m + ' <> @o_' + m + ' BEGIN');
  out.push("  RAISERROR(N'*** 对拍不等 " + base + ": old=%I64d new=%I64d — 改名已跳过, 修正后重跑本段', 16, 1, @o_" + m + ", @n_" + m + ');');
  out.push('END ELSE BEGIN');
  out.push('  EXEC sp_rename ' + q(base) + ", N'" + base + "_old';");
  out.push('  EXEC sp_rename ' + q(base + '_new') + ", N'" + base + "';");
  out.push("  PRINT N'>>> " + base + ": 切换完成（_old=原表, 原名=新聚簇表）。下一采集周期新数据自然写入新表。';");
  out.push("  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(" + q(base) + ") AND name = N'IX_" + short + "_fk')");
  out.push('    CREATE NONCLUSTERED INDEX [IX_' + short + '_fk] ON [' + base + '] ([file_key]);   -- 机台列/筛选接头');
  out.push('END;');
  out.push('-- 验证一个采集周期后回收 _old（默认不执行，验证通过再启用）:');
  out.push('-- DROP TABLE ' + nold + ';');
  out.push('GO');
  out.push('');
}

out.push('-- ################ B 组：小表直接升级（<=100 万行，在线建，不重建） ################');
out.push('-- 目标结构与大表一致：日期聚簇索引（采集按日期递增追加，破百万也无需再动）+ file_key 非聚簇。');
out.push('-- 小表行数少：Sch-M/构建都是秒级~分钟级，挑 09:01 采集窗外随时跑；幂等可重跑。');
out.push('-- 日期计算列需段 0 PASS d1；不通则本组只落 file_key 索引（删掉 CX_ 几句即可）。');
out.push('');

for (var i = 0; i < data.length; i++) {
  var t2 = data[i];
  if (want(t2)) continue;
  var base2 = TPFX + t2.table;
  var nbase2 = '[' + base2 + ']';
  var short2 = idxShort(t2);
  var cols2 = t2.cols;
  var dateCol2 = t2.dateCol, timeCol2 = t2.timeCol;
  var nativeDate2 = isNativeDate(t2);
  var dateD2 = dateCol2 ? dateCol2 + '_d' : null;
  var hasFK2 = false;
  for (var k4 = 0; k4 < cols2.length; k4++) if (cols2[k4].name === 'file_key') hasFK2 = true;
  var isFiles = String(t2.table) === 'laser_files';
  var isSeq = String(t2.table) === 'laser_files_file_key_seq';

  out.push('-- ---------- ' + base2 + '  行数 ' + fmt(t2.rows) + ' ----------');
  if (isSeq) {
    out.push('-- 键序技术表（1 行，导航外），不加索引。');
    out.push('GO');
    out.push('');
    continue;
  }
  if (dateCol2 && !nativeDate2) {
    out.push("IF COL_LENGTH(" + q(base2) + ", N'" + dateD2 + "') IS NULL");
    out.push('  ALTER TABLE ' + nbase2 + ' ADD [' + dateD2 + '] AS ' + dateExpr(dateCol2) + ' PERSISTED;   -- 日期规范列（需段0 PASS d1）');
  }
  if (dateCol2) {
    var dk2 = nativeDate2 ? '[' + dateCol2 + ']' : '[' + dateD2 + ']';
    var cx2 = 'CX_' + short2 + '_date';
    out.push("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(" + q(base2) + ") AND name = N'" + cx2 + "')");
    out.push('  CREATE CLUSTERED INDEX [' + cx2 + '] ON ' + nbase2 + ' (' + dk2 + (timeCol2 ? ', [' + timeCol2 + ']' : '') + (hasFK2 ? ', [file_key]' : '') + ');   -- 日期聚簇：小表现在建好，破百万也不用重建');
  }
  if (hasFK2) {
    var fkIx = 'IX_' + short2 + '_fk';
    out.push("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(" + q(base2) + ") AND name = N'" + fkIx + "')");
    out.push('  CREATE NONCLUSTERED INDEX [' + fkIx + '] ON ' + nbase2 + ' ([file_key]);   -- 机台列/机台筛选的 join 接头');
  }
  if (isFiles) {
    out.push("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(" + q(base2) + ") AND name = N'IX_laser_files_source')");
    out.push('  CREATE NONCLUSTERED INDEX [IX_laser_files_source] ON ' + nbase2 + ' ([source_id]) INCLUDE ([file_key]);   -- 机台子查询接头: 前缀模糊 LIKE');
    out.push("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(" + q(base2) + ") AND name = N'IX_laser_files_fkey')");
    out.push('  CREATE NONCLUSTERED INDEX [IX_laser_files_fkey] ON ' + nbase2 + ' ([file_key]);');
  }
  out.push("PRINT N'>>> " + base2 + ": 索引就绪。';");
  out.push('GO');
  out.push('');
}

out.push('-- ============================ 全部完成后 ============================');
out.push('-- B 组即时生效；A 组切换完成后用浏览器 24 张 cpt 逐张打开核对（连机台筛选一并测: 输入 1# 看行为）。');
out.push('-- A 组各表一个采集周期无异常再启用段尾 DROP TABLE ..._old。');
out.push('-- FR 侧零改动：表名未变，浏览器 SQL 不用动（CASE 守卫表达式与 *_d 计算列逐字一致，优化器自动匹配 SEEK）。');

var OUT = 'D:/fineagent/build_prod/build_prod_reindex.sql';
writeUtf8(OUT, out.join('\n') + '\n');
var a = 0, b = 0;
for (var i3 = 0; i3 < data.length; i3++) { if (want(data[i3])) a++; else b++; }
print('GENERATED ' + OUT + ' rebuild=' + a + ' direct=' + b);
