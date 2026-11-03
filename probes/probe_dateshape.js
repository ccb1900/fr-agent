// probe_dateshape.js — 真实 biz_date/Date 字符串形态抽样：长度/分隔符/空白/样例
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
function rows(sql) {
  var rs = st.executeQuery(sql), out = [], n = rs.getMetaData().getColumnCount();
  while (rs.next()) {
    var a = [];
    for (var i = 1; i <= n; i++) a.push(rs.getString(i));
    out.push(a.join(' | '));
  }
  rs.close();
  return out;
}
var tables = [['laser_aaa', 'biz_date'], ['laser_twin_scale_dsp', 'Date'], ['laser_zaxis', 'biz_date'], ['laser_length', 'biz_date']];
try {
  for (var t = 0; t < tables.length; t++) {
    var tb = tables[t][0], dc = tables[t][1];
    print('=== ' + tb + '.' + dc + ' ===');
    var s = rows("SELECT TOP 6 '[' + [" + dc + "] + ']' AS v, LEN([" + dc + "]) AS ln, DATALENGTH([" + dc + "]) AS dl FROM [" + tb + "] WHERE [" + dc + "] IS NOT NULL");
    for (var i = 0; i < s.length; i++) print('  ' + s[i]);
    var shapes = rows("SELECT " +
      "SUM(CASE WHEN [" + dc + "] LIKE '%[^0-9-]%' THEN 1 ELSE 0 END) AS nonDigitDash, " +
      "SUM(CASE WHEN [" + dc + "] LIKE '%[ ]%' THEN 1 ELSE 0 END) AS hasSpace, " +
      "SUM(CASE WHEN [" + dc + "] LIKE '%/%' THEN 1 ELSE 0 END) AS hasSlash, " +
      "SUM(CASE WHEN [" + dc + "] LIKE '%[.]%' THEN 1 ELSE 0 END) AS hasDot, " +
      "COUNT(*) AS total FROM [" + tb + "]");
    print('  nonDigitDash/spaces/slash/dot/total = ' + shapes[0]);
    var lens = rows("SELECT LEN([" + dc + "]) AS ln, COUNT(*) AS n FROM [" + tb + "] GROUP BY LEN([" + dc + "]) ORDER BY ln");
    print('  长度分布: ' + lens.join(' ; '));
  }
} finally { st.close(); con.close(); }
print('DONE');
