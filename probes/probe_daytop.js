// probe_daytop.js v2 — 按天 TOP 取页（CROSS APPLY）与现行全窗口版逐行对拍
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName' + String.fromCharCode(61) + 'atom_live_demo;encrypt' + String.fromCharCode(61) + 'false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
var t = (function () { var j = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables.json')); for (var i = 0; i < j.length; i++) if (j[i].table === 'laser_aaa') return j[i]; })();
var cols = []; for (var c = 0; c < t.cols.length; c++) cols.push({ name: t.cols[c].name });
var cfg = { table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true, cols: cols };
var NAMES = cols.map(function (x) { return x.name; });
var COLSEL = NAMES.map(function (n) { return 'T.[' + n + ']'; }).join(', ');
var TIES = ['[biz_time]', '[file_key]', '[row_number]', '[main_prog_no]', '[main_prog_seq]', '[sub_prog_no]', '[sub_prog_seq]'];
function cte() { var s = BROWSER.pagedSql(cfg); return s.substring(0, s.indexOf('SELECT machine_name')); }
function dayTop(page, size, machine) {
  var take = page * size;
  var mach = machine ? ("LF.[source_id] LIKE '" + machine + "%'") : "'' = ''";
  var inner = 'SELECT TOP (' + take + ') LF.[source_id] AS machine_name, ' + COLSEL + ', P.n AS n' +
    ' FROM [laser_aaa] T LEFT JOIN [laser_files] LF ON LF.[file_key] = T.[file_key]' +
    ' WHERE T.[biz_date] = P.p AND (' + mach + ') AND (T.[stage] = T.[stage])' +
    ' ORDER BY ' + TIES.join(', ');
  var mid = 'SELECT M.*, ROW_NUMBER() OVER (ORDER BY M.n, ' + TIES.map(function (x) { return 'M.' + x; }).join(', ') + ') AS _ord' +
    ' FROM ( SELECT M0.* FROM pats P CROSS APPLY ( ' + inner + ' ) M0 ) M';
  return cte() + 'SELECT machine_name, ' + NAMES.map(function (n) { return '[' + n + ']'; }).join(', ') + ', _ord' +
    ' FROM (' + mid + ') PGT WHERE _ord > (' + page + ' - 1) * ' + size + ' AND _ord <= ' + page + ' * ' + size + ' ORDER BY _ord OPTION (MAXRECURSION 0)';
}
function sub(sql, d1, d2) {
  return sql.split('${d1}').join(d1).split('${d2}').join(d2)
    .split('${machine}').join('').split('${stage}').join('')
    .split('${page}').join('1').split('${size}').join('50');
}
function run(sql) {
  var rs = st.executeQuery(sql), out = [];
  var md = rs.getMetaData(), nc = md.getColumnCount();
  while (rs.next()) { var r = []; for (var i = 1; i <= nc; i++) r.push(rs.getString(i)); out.push(r); }
  rs.close(); return out;
}
try {
  var paged = BROWSER.pagedSql(cfg);
  for (var p = 1; p <= 3; p++) {
    var curSql = sub(paged, '2026-09-17', '2026-09-22')
      .replace('(TRY_CAST(1 AS int) - 1)', '(' + p + ' - 1)')
      .replace('TRY_CAST(1 AS int) * TRY_CAST(50 AS int)', p + ' * 50');
    var a = run(curSql), d = run(sub(dayTop(p, 50, ''), '2026-09-17', '2026-09-22'));
    var same = a.length === d.length;
    if (same) for (var i = 0; i < a.length; i++) if (a[i].join('|') !== d[i].join('|')) { same = false; break; }
    print('第' + p + '页 现行=' + a.length + '行 按天TOP=' + d.length + '行 逐行一致=' + same);
  }
  var dm = run(sub(dayTop(1, 50, 'laser5'), '2026-09-17', '2026-09-22'));
  var bad = 0; for (var k = 0; k < dm.length; k++) if (String(dm[k][0]).indexOf('laser5') !== 0) bad++;
  print('机台 laser5 第1页 行数=' + dm.length + ' 前缀违例=' + bad + ' 首行=' + dm[0][0]);
  var curM = run(sub(paged, '2026-09-17', '2026-09-22').split("'' = '' OR LF.[source_id] LIKE '%'").join("LF.[source_id] LIKE 'laser5%'"));
  print('机台 laser5 现行第1页 行数=' + curM.length + ' 首行机台=' + curM[0][0] + ' 一致=' + (curM.length === dm.length && curM[0].join('|') === dm[0].join('|')));
} finally { st.close(); con.close(); }
print('DONE');
