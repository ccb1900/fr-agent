// probe_dateshape2.js — 演示库全部日期列表的形态全景：长度分布 / 斜杠 / 非法字符 / 样例
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
var data = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables.json'));
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
function rows(sql) {
  var rs = st.executeQuery(sql), out = [], n = rs.getMetaData().getColumnCount();
  while (rs.next()) {
    var a = [];
    for (var i = 1; i <= n; i++) a.push(rs.getString(i));
    out.push(a.join(' / '));
  }
  rs.close();
  return out;
}
try {
  for (var t = 0; t < data.length; t++) {
    var tb = data[t].table, dc = data[t].dateCol;
    if (!dc) continue;
    var dist = rows("SELECT LEN([" + dc + "]) AS ln, SUM(CASE WHEN [" + dc + "] LIKE '%/%' THEN 1 ELSE 0 END) AS slash, COUNT(*) AS n FROM [" + tb + "] WHERE [" + dc + "] IS NOT NULL GROUP BY LEN([" + dc + "]) ORDER BY ln");
    var odd = rows("SELECT SUM(CASE WHEN [" + dc + "] LIKE '%[^0-9/-]%' THEN 1 ELSE 0 END) AS odd FROM [" + tb + "]");
    var fail = rows("SELECT SUM(CASE WHEN TRY_CAST([" + dc + "] AS date) IS NULL THEN 1 ELSE 0 END) AS f FROM [" + tb + "]");
    print(tb + '.' + dc + ' | 长度(斜杠/总数): ' + dist.join(' ; ') + ' | 怪字符=' + odd[0] + ' | TRY_CAST失败=' + fail[0]);
  }
} finally { st.close(); con.close(); }
print('DONE');
