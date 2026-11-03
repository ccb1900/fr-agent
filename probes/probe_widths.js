// probe_widths.js — 数据浏览器列宽实测：每列在最常用参数区间内的最长文本长度
// 为什么要它：FR 这套引擎的字宽 ≈ 1.1×字号（10.5pt 黑体数字实测 ~11-12pt/字，见 README #33 字号实测），
//   列宽拍脑袋必换行，一换行行高翻倍、一页装不下 SQL 的一页 → 必须先量再排。
// 跑法：runraw.ps1 -Script "D:/fineagent/probes/probe_widths.js"
var J = function (n) { return Java.type(n); };
var conn = J('java.sql.DriverManager')
  .getConnection('jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));

function q1(sql) {
  var st = conn.createStatement();
  var rs = st.executeQuery(sql);
  rs.next();
  var v = rs.getObject(1);
  rs.close(); st.close();
  return v;
}

var TABLES = ['laser_aaa', 'laser_aaa_gosa', 'laser_pwr'];
var W = " WHERE TRY_CAST([biz_date] AS date) BETWEEN '2026-09-13' AND '2026-09-22'";
var out = '';
TABLES.forEach(function (t) {
  var cs = q1("SELECT STRING_AGG(c.name, ',') FROM (SELECT TOP 200 name FROM sys.columns WHERE object_id=object_id('" + t + "') ORDER BY column_id) c");
  out += '### ' + t + '\n';
  cs.split(',').forEach(function (c) {
    // 长度用 LEN(转 nvarchar)：bigint 也走这条路，得到的是实际显示字符数
    var mx = q1('SELECT MAX(LEN(CONVERT(nvarchar(4000), [' + c + ']))) FROM [' + t + ']' + W);
    out += c + '|maxlen=' + mx + '\n';
  });
  out += '\n';
});
conn.close();
J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/db_br_widths.txt'),
  J('java.lang.String').valueOf(out).getBytes('UTF-8'));
print('WROTE db_br_widths.txt chars=' + out.length);
