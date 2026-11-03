// probe_pats_exec.js — 展开清单版查询真执行验证：行数与 TRY_CAST 口径对拍 / 日期升序 / 长窗口 / 机台过滤
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName:atom_live_demo;encrypt=false'.replace('databaseName:', 'databaseName='), 'sa', load('D:/fineagent/lib/dbpass.js'));
function run(sql, p) {
  sql = sql.split('${d1}').join(p.d1).split('${d2}').join(p.d2)
           .split('${machine}').join(p.machine || '').split('${stage}').join('')
           .split('${page}').join(String(p.page || 1)).split('${size}').join(String(p.size || 5));
  var st = con.createStatement(), rs = st.executeQuery(sql), md = rs.getMetaData();
  var out = [], cols = [];
  for (var i = 1; i <= md.getColumnCount(); i++) cols.push(md.getColumnName(i));
  while (rs.next()) { var r = []; for (var j = 1; j <= md.getColumnCount(); j++) r.push(rs.getString(j)); out.push(r); }
  rs.close(); st.close();
  return { cols: cols, rows: out };
}
var cfg = {
  table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true,
  cols: [{ name: 'file_key' }, { name: 'row_number' }, { name: 'biz_date' }, { name: 'biz_time' }, { name: 'stage' }]
};
try {
  var paged = BROWSER.pagedSql(cfg), meta = BROWSER.metaSql(cfg);
  var v = run(meta, { d1: '2026-09-17', d2: '2026-09-22' });
  print('窗口 9/17-9/22 总数(新) = ' + v.rows[0][0]);
  var old = run("SELECT COUNT(*) FROM laser_aaa WHERE TRY_CAST(biz_date AS date) >= '2026-09-17' AND TRY_CAST(biz_date AS date) <= '2026-09-22'", { d1: '', d2: '', size: 1 });
  print('  旧口径(TRY_CAST) = ' + old.rows[0][0] + ' 一致=' + (v.rows[0][0] === old.rows[0][0]));
  var pg = run(paged, { d1: '2026-09-17', d2: '2026-09-22', page: 1, size: 10 });
  print('  首行机台=' + pg.rows[0][0] + ' 日期=' + pg.rows[0][3]);
  var asc = true, prev = -1;
  for (var i = 0; i < pg.rows.length; i++) {
    var s = String(pg.rows[i][3]).replace(/\//g, '-');
    var p = s.split('-');
    var key = (+p[0]) * 10000 + (+p[1]) * 100 + (+p[2]);
    if (key < prev) asc = false;
    prev = key;
  }
  print('  首页日期升序=' + asc + ' 行数=' + pg.rows.length + ' 首尾=' + pg.rows[0][3] + '→' + pg.rows[pg.rows.length - 1][3]);
  var m1 = run(meta, { d1: '2026-09-17', d2: '2026-09-22', machine: 'laser5' });
  print('机台 laser5 总数=' + m1.rows[0][0]);
  var one = run(meta, { d1: '2026-09-22', d2: '2026-09-22' });
  print('单日窗口 9/22 总数=' + one.rows[0][0]);
  var lng = run(meta, { d1: '2026-08-01', d2: '2026-09-30' });
  var lngOld = run("SELECT COUNT(*) FROM laser_aaa WHERE TRY_CAST(biz_date AS date) >= '2026-08-01' AND TRY_CAST(biz_date AS date) <= '2026-09-30'", { d1: '', d2: '', size: 1 });
  print('长窗口 8/1-9/30: 新=' + lng.rows[0][0] + ' 旧=' + lngOld.rows[0][0] + ' 一致=' + (lng.rows[0][0] === lngOld.rows[0][0]));
  var empty = run(meta, { d1: '2026-01-01', d2: '2026-01-02' });
  print('空窗口 1/1-1/2 总数=' + empty.rows[0][0]);
} finally { con.close(); }
print('DONE');
