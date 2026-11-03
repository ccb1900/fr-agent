// probe_paged_ref.js — 新分页(按天TOP) vs 旧语义(TRY_CAST 全窗口排序) 逐行对拍：页1/2/3 + 机台过滤
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName' + String.fromCharCode(61) + 'atom_live_demo;encrypt' + String.fromCharCode(61) + 'false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
var j = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables.json'));
var t = null; for (var i = 0; i < j.length; i++) if (j[i].table === 'laser_aaa') t = j[i];
var cols = []; for (var c = 0; c < t.cols.length; c++) cols.push({ name: t.cols[c].name });
var cfg = { table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true, cols: cols };
var NAMES = cols.map(function (x) { return x.name; });
function sub(sql, p) {
  return sql.split('${d1}').join('2026-09-17').split('${d2}').join('2026-09-22')
    .split('${machine}').join(p.machine || '').split('${stage}').join('')
    .split('${page}').join(String(p.page)).split('${size}').join(String(p.size));
}
function run(sql) {
  var rs = st.executeQuery(sql), out = [], md = rs.getMetaData(), nc = md.getColumnCount();
  while (rs.next()) { var r = []; for (var k = 1; k <= nc; k++) r.push(rs.getString(k)); out.push(r); }
  rs.close(); return { rows: out, cols: nc };
}
// 旧语义参照：全窗口 ROW_NUMBER(TRY_CAST 日期序) 后取区间
function refSql(page, size, machine) {
  var mach = machine ? " AND EXISTS (SELECT 1 FROM laser_files F WHERE F.file_key=T.file_key AND F.source_id LIKE '" + machine + "%')" : '';
  var ties = 'T.[biz_time], T.[file_key], T.[row_number], T.[main_prog_no], T.[main_prog_seq], T.[sub_prog_no], T.[sub_prog_seq]';
  var sel = NAMES.map(function (n) { return 'T.[' + n + ']'; }).join(', ');
  return 'SELECT * FROM (SELECT ' + sel + ', ROW_NUMBER() OVER (ORDER BY TRY_CAST(T.biz_date AS date), ' + ties + ') AS _ord ' +
    "FROM laser_aaa T WHERE TRY_CAST(T.biz_date AS date) >= '2026-09-17' AND TRY_CAST(T.biz_date AS date) <= '2026-09-22'" + mach + ') X ' +
    'WHERE _ord > (' + page + '-1)*' + size + ' AND _ord <= ' + page + '*' + size + ' ORDER BY _ord';
}
try {
  var newSql = BROWSER.pagedSql(cfg);
  for (var p = 1; p <= 3; p++) {
    var a = run(sub(newSql, { page: p, size: 50 }));           // 新：第3列是 machine_name，需错位
    var b = run(refSql(p, 50, ''));                            // 旧语义：无 machine_name
    // 新结果列: machine_name + cols... + _ord ；去掉第1列再比
    var an = a.rows.map(function (r) { return r.slice(1).join('|'); });
    var bn = b.rows.map(function (r) { return r.join('|'); });
    var same = an.length === bn.length;
    if (same) for (var q = 0; q < an.length; q++) if (an[q] !== bn[q]) { same = false; break; }
    print('第' + p + '页 新=' + an.length + ' 旧语义=' + bn.length + ' 逐行一致=' + same);
  }
  var m = run(sub(newSql, { page: 1, size: 50, machine: 'laser5' }));
  print('机台 laser5 新第1页行数=' + m.rows.length + ' 首行机台=' + m.rows[0][0]);
} finally { st.close(); con.close(); }
print('DONE');
