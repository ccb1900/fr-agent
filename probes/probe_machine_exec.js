// probe_machine_exec.js — 真执行验证：机台列取值 + 机台前缀过滤（直接跑浏览器生成的两条 SQL）
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
function run(sql, machine, d1, d2, page, size) {
  sql = sql.split('${d1}').join(d1).split('${d2}').join(d2)
           .split('${machine}').join(machine).split('${stage}').join('')
           .split('${page}').join(String(page)).split('${size}').join(String(size));
  var st = con.createStatement(), rs = st.executeQuery(sql), meta = rs.getMetaData();
  var out = { cols: [], rows: [] };
  for (var i = 1; i <= meta.getColumnCount(); i++) out.cols.push(meta.getColumnName(i));
  while (rs.next()) {
    var r = [];
    for (var i2 = 1; i2 <= meta.getColumnCount(); i2++) r.push(rs.getString(i2));
    out.rows.push(r);
  }
  rs.close(); st.close();
  return out;
}
var cfg = {
  table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true,
  cols: [{ name: 'file_key' }, { name: 'row_number' }, { name: 'biz_date' }, { name: 'biz_time' }, { name: 'stage' }]
};
try {
  var paged = BROWSER.pagedSql(cfg);
  var meta = BROWSER.metaSql(cfg);
  var rAll = run(paged, '', '2026-09-17', '2026-09-22', 1, 5);
  print('全机台 第1页 cols=' + rAll.cols.join(','));
  print('  行数=' + rAll.rows.length + ' 首行机台=' + rAll.rows[0][0] + ' file_key=' + rAll.rows[0][1]);
  var cntAll = run(meta, '', '2026-09-17', '2026-09-22', 1, 5);
  print('全机台 总数=' + cntAll.rows[0][0] + ' 总页=' + cntAll.rows[0][3]);
  var r1 = run(paged, '1#', '2026-09-17', '2026-09-22', 1, 5);
  print('机台1# 行数=' + r1.rows.length + ' 机台值=' + (r1.rows.length ? r1.rows[0][0] : '-') + '（演示库机台命名 laserN-xxx，1# 为 0 属预期）');
  var cnt1 = run(meta, '1#', '2026-09-17', '2026-09-22', 1, 5);
  print('机台1# 总数=' + cnt1.rows[0][0]);
  var pre = String(rAll.rows[0][0]).split('-')[0];   // 取真实前缀，如 laser5
  var r2 = run(paged, pre, '2026-09-17', '2026-09-22', 1, 20);
  var bad2 = 0;
  for (var i3 = 0; i3 < r2.rows.length; i3++) if (String(r2.rows[i3][0]).indexOf(pre) !== 0) bad2++;
  var cnt2 = run(meta, pre, '2026-09-17', '2026-09-22', 1, 5);
  print('真实前缀[' + pre + '] 第1页行数=' + r2.rows.length + ' 违例行=' + bad2 + ' 总数=' + cnt2.rows[0][0]);
} finally { con.close(); }
print('DONE');
