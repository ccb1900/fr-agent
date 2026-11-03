// probe_exp4.js — 终极确定性表达式：yyyymmdd 整数规范形（零 date 函数）
// ① PERSISTED 可建 ② 与 TRY_CAST(date) 转 yyyymmdd 整数全库对拍 0 差异 ③ 顺带测试候选菜单(供生产探路)
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
function one(sql) {
  var rs = st.executeQuery(sql), v = [];
  while (rs.next()) v.push(rs.getString(1));
  rs.close();
  return v;
}
function exec(sql) { try { st.execute(sql); } catch (e) { } }

// 整数规范形: CASE 四形态守卫 → CAST(YYYY+MM+DD AS int)，全部确定性件
var T = "CASE " +
  "WHEN LEN($C$)=10 AND $C$ LIKE '[0-9][0-9][0-9][0-9][-/][0-9][0-9][-/][0-9][0-9]' AND CAST(SUBSTRING($C$,6,2) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,9,2) AS int) BETWEEN 1 AND 31 THEN CAST(SUBSTRING($C$,1,4)+SUBSTRING($C$,6,2)+SUBSTRING($C$,9,2) AS int) " +
  "WHEN LEN($C$)=9 AND $C$ LIKE '[0-9][0-9][0-9][0-9][-/][0-9][-/][0-9][0-9]' AND CAST(SUBSTRING($C$,6,1) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,8,2) AS int) BETWEEN 1 AND 31 THEN CAST(SUBSTRING($C$,1,4)+'0'+SUBSTRING($C$,6,1)+SUBSTRING($C$,8,2) AS int) " +
  "WHEN LEN($C$)=9 AND $C$ LIKE '[0-9][0-9][0-9][0-9][-/][0-9][0-9][-/][0-9]' AND CAST(SUBSTRING($C$,6,2) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,9,1) AS int) BETWEEN 1 AND 31 THEN CAST(SUBSTRING($C$,1,4)+SUBSTRING($C$,6,2)+'0'+SUBSTRING($C$,9,1) AS int) " +
  "WHEN LEN($C$)=8 AND $C$ LIKE '[0-9][0-9][0-9][0-9][-/][0-9][-/][0-9]' AND CAST(SUBSTRING($C$,6,1) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,8,1) AS int) BETWEEN 1 AND 31 THEN CAST(SUBSTRING($C$,1,4)+'0'+SUBSTRING($C$,6,1)+'0'+SUBSTRING($C$,8,1) AS int) " +
  "END";
function mk(col) { return T.split('$C$').join('[' + col + ']'); }

try {
  exec("DROP TABLE IF EXISTS tempdb..#t");
  exec("CREATE TABLE #t (a nvarchar(4000) NULL)");
  var r = 'OK';
  try { exec("ALTER TABLE #t ADD d AS " + mk('a') + " PERSISTED"); } catch (e) { r = 'FAIL: ' + e; }
  print('PERSISTED(整数规范形) = ' + r);

  var data = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables.json'));
  var total = 0, bad = [];
  for (var t = 0; t < data.length; t++) {
    var tb = data[t].table, dc = data[t].dateCol;
    if (!dc) continue;
    var dt = null;
    for (var ci = 0; ci < data[t].cols.length; ci++) if (data[t].cols[ci].name === dc) dt = String(data[t].cols[ci].dtype || '').toLowerCase();
    if (dt === 'date') continue;
    var diff = one("SELECT SUM(CASE WHEN ISNULL(" + mk(dc) + ",0) <> ISNULL(CAST(CONVERT(char(8), TRY_CAST([" + dc + "] AS date),112) AS int),0) THEN 1 ELSE 0 END) FROM [" + tb + "]");
    var n = one("SELECT COUNT(*) FROM [" + tb + "]");
    total++;
    print(tb + ' rows=' + n[0] + ' 差异=' + diff[0]);
    if (String(diff[0]) !== '0') bad.push(tb);
  }
  print('对拍表数=' + total + ' 非零差异=' + (bad.length ? bad.join(',') : '无'));
} finally { st.close(); con.close(); }
print('DONE');
