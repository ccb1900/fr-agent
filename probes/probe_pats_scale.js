// probe_pats_scale.js — 展开清单随窗口长度的耗时曲线（vs 旧 TRY_CAST 口径）
load('D:/fineagent/lib/browser.js');
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var cfg = {
  table: 'laser_aaa', dateCol: 'biz_date', timeCol: 'biz_time', filterCol: 'stage', sqlPaging: true,
  cols: [{ name: 'file_key' }, { name: 'row_number' }, { name: 'biz_date' }, { name: 'biz_time' }]
};
function timeIt(sql, d1, d2) {
  sql = sql.split('${d1}').join(d1).split('${d2}').join(d2)
           .split('${machine}').join('').split('${stage}').join('')
           .split('${page}').join('1').split('${size}').join('50');
  var SYS = J('java.lang.System');
  var st = con.createStatement();
  var t0 = SYS.nanoTime();
  var rs = st.executeQuery(sql);
  var v = rs.next() ? rs.getString(1) : '?';
  var ms = Math.round((SYS.nanoTime() - t0) / 1000000);
  rs.close(); st.close();
  return { v: v, ms: ms };
}
try {
  var meta = BROWSER.metaSql(cfg);
  var windows = [
    ['7 天', '2026-09-16', '2026-09-22'],
    ['1 个月', '2026-08-23', '2026-09-22'],
    ['3 个月', '2026-06-24', '2026-09-22'],
    ['1 年', '2025-09-23', '2026-09-22'],
    ['5 年', '2021-09-23', '2026-09-22']
  ];
  for (var i = 0; i < windows.length; i++) {
    var w = windows[i];
    var nw = timeIt(meta, w[1], w[2]);
    var old = timeIt("SELECT COUNT(*) FROM laser_aaa WHERE TRY_CAST(biz_date AS date) >= '" + w[1] + "' AND TRY_CAST(biz_date AS date) <= '" + w[2] + "'", w[1], w[2]);
    print(w[0] + ' 新=' + nw.ms + 'ms(行' + nw.v + ')  旧=' + old.ms + 'ms(行' + old.v + ') 一致=' + (nw.v === old.v));
  }
  // 极端: 10 年、100 年(看递归与计划退化)
  var e1 = timeIt(meta, '2016-09-23', '2026-09-22');
  print('10 年 新=' + e1.ms + 'ms 行=' + e1.v);
  var e2 = timeIt(meta, '1926-09-23', '2026-09-22');
  print('100 年 新=' + e2.ms + 'ms 行=' + e2.v);
} finally { con.close(); }
print('DONE');
