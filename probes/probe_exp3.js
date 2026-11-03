// probe_exp3.js — 最终确定性日期表达式: CASE 守卫(兼容 - 和 /, 月日单双位) + CONVERT(date,REPLACE(...,'/','-'),23)
// 验证: ① PERSISTED 可建; ② 全库 24 张日期列 vs TRY_CAST 差异 0
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

var T = "CASE " +
  "WHEN LEN($C$)=10 AND $C$ LIKE '[0-9][0-9][0-9][0-9][-/][0-9][0-9][-/][0-9][0-9]' AND CAST(SUBSTRING($C$,6,2) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,9,2) AS int) BETWEEN 1 AND 31 THEN CONVERT(date,REPLACE($C$,'/','-'),23) " +
  "WHEN LEN($C$)=9 AND $C$ LIKE '[0-9][0-9][0-9][0-9][-/][0-9][-/][0-9][0-9]' AND CAST(SUBSTRING($C$,6,1) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,8,2) AS int) BETWEEN 1 AND 31 THEN CONVERT(date,REPLACE($C$,'/','-'),23) " +
  "WHEN LEN($C$)=9 AND $C$ LIKE '[0-9][0-9][0-9][0-9][-/][0-9][0-9][-/][0-9]' AND CAST(SUBSTRING($C$,6,2) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,9,1) AS int) BETWEEN 1 AND 31 THEN CONVERT(date,REPLACE($C$,'/','-'),23) " +
  "WHEN LEN($C$)=8 AND $C$ LIKE '[0-9][0-9][0-9][0-9][-/][0-9][-/][0-9]' AND CAST(SUBSTRING($C$,6,1) AS int) BETWEEN 1 AND 12 AND CAST(SUBSTRING($C$,8,1) AS int) BETWEEN 1 AND 31 THEN CONVERT(date,REPLACE($C$,'/','-'),23) " +
  "END";
function mk(col) { return T.split('$C$').join('[' + col + ']'); }

try {
  exec("DROP TABLE IF EXISTS tempdb..#t");
  exec("CREATE TABLE #t (a nvarchar(4000) NULL)");
  var r = 'OK';
  try { exec("ALTER TABLE #t ADD d AS " + mk('a') + " PERSISTED"); } catch (e) { r = 'FAIL: ' + e; }
  print('PERSISTED(CASE+CONVERT/REPLACE) = ' + r);

  var data = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables.json'));
  var total = 0, badTables = [];
  for (var t = 0; t < data.length; t++) {
    var tb = data[t].table, dc = data[t].dateCol;
    if (!dc) continue;
    var dcType = null;
    for (var ci = 0; ci < data[t].cols.length; ci++) if (data[t].cols[ci].name === dc) dcType = String(data[t].cols[ci].dtype || '').toLowerCase();
    if (dcType === 'date') { print(tb + '.' + dc + ' 原生 date, 跳过'); continue; }
    var diff = one("SELECT SUM(CASE WHEN ISNULL(CONVERT(date, TRY_CAST([" + dc + "] AS date)), '1900-01-01') = ISNULL(" + mk(dc) + ", '1900-01-01') THEN 0 ELSE 1 END) FROM [" + tb + "]");
    var n = one("SELECT COUNT(*) FROM [" + tb + "]");
    total++;
    print(tb + '.' + dc + ' rows=' + n[0] + ' 差异行=' + diff[0]);
    if (String(diff[0]) !== '0') badTables.push(tb);
  }
  print('对拍表数=' + total + ' 非零差异表=' + (badTables.length ? badTables.join(',') : '无'));
} finally { st.close(); con.close(); }
print('DONE');
