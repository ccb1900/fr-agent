// probe_open_sql.js — 打印打开页面真正执行的两条 SQL（ds1 分页 / dsm 计数）+ TOP50 对照版
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
function writeUtf8(p, s) {
  var pf = J('java.nio.file.Paths').get(p).toAbsolutePath().getParent();
  Files.createDirectories(pf);
  var w = new (J('java.io.OutputStreamWriter'))(new (J('java.io.FileOutputStream'))(p), 'UTF-8');
  w.write(s); w.close();
}
var j = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables_prod.json'));
var t = null;
for (var i = 0; i < j.length; i++) if (j[i].table === 'laser_aaa') t = j[i];
var cols = [];
for (var c = 0; c < t.cols.length; c++) cols.push({ name: t.cols[c].name });
var cfg = { table: 'laser_aaa', dateCol: t.dateCol, timeCol: t.timeCol, filterCol: 'stage', sqlPaging: true, cols: cols };
var d1 = '2026-10-23', d2 = '2026-10-29', size = 50, page = 1;
function sub(sql) {
  return sql.split('${d1}').join(d1).split('${d2}').join(d2)
    .split('${machine}').join('').split('${stage}').join('')
    .split('${page}').join(String(page)).split('${size}').join(String(size));
}
var out = [];
out.push('-- ===== A) ds1 分页查询（打开即执行，取第 1 页 50 行）=====');
out.push(sub(BROWSER.pagedSql(cfg)));
out.push('');
out.push('-- ===== B) dsm 计数查询（打开即执行，表底「共 N 条」）=====');
out.push(sub(BROWSER.metaSql(cfg)));
out.push('');
// 对照: TOP 50 直取（不做 ROW_NUMBER 全窗口编号）
var orderKeys = 'P.n, T.[biz_time], T.[file_key]';
var full = sub(BROWSER.pagedSql(cfg));
var cte = full.substring(0, full.indexOf('SELECT machine_name'));   // 只取 WITH days…, pats AS (…) 段
var selCols = cols.map(function (c2) { return 'T.[' + c2.name + ']'; }).join(', ');
out.push('-- ===== C) 对照：TOP 50 直取（不编号，只验证瓶颈是否在「全窗口排序编号」）=====');
out.push(cte + 'SELECT TOP ' + size + ' ' + selCols + ' FROM [t_collector_laser_aaa] T ' +
  'INNER JOIN pats P ON P.p = T.[biz_date] ' +
  'LEFT JOIN [t_collector_laser_files] LF ON LF.[file_key] = T.[file_key] ' +
  "WHERE ('' = '' OR LF.[source_id] LIKE '%') AND ('' = '' OR T.[stage] = '') " +
  'ORDER BY ' + orderKeys + ' OPTION (MAXRECURSION 0)');
var txt = out.join('\n') + '\n';
writeUtf8('D:/fineagent/build_prod/open_queries_aaa.sql', txt);
print('WROTE build_prod/open_queries_aaa.sql lines=' + txt.split('\n').length);
