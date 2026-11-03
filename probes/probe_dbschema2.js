// probe_dbschema2.js — laser_aaa 列清单 + 每个文本列的基数画像（找可用的分组列，拒绝臆造列名）
var J = function (n) { return Java.type(n); };
var URL = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false';
var conn = J('java.sql.DriverManager').getConnection(URL, 'sa', load('D:/fineagent/lib/dbpass.js'));

function q(sql) {
  var st = conn.createStatement();
  var rs = st.executeQuery(sql);
  var md = rs.getMetaData();
  var n = md.getColumnCount();
  var rows = [];
  while (rs.next()) {
    var r = [];
    for (var k = 1; k <= n; k++) r.push(String(rs.getObject(k)));
    rows.push(r);
  }
  rs.close(); st.close();
  return rows;
}

var cols = q("select c.name, ty.name, c.max_length from sys.columns c join sys.types ty on ty.user_type_id=c.user_type_id" +
  " where c.object_id=object_id('laser_aaa') order by c.column_id");
var out = 'COLUMNS laser_aaa\n';
cols.forEach(function (r) { out += r.join('|') + '\n'; });

out += '\nCARDINALITY (text/short columns)\n';
cols.forEach(function (r) {
  var name = r[0], ty = r[1];
  if (/^(nvarchar|varchar|char|nchar|int|tinyint|smallint|bit)$/.test(ty)) {
    var c = q('select count(distinct [' + name + ']) from laser_aaa')[0][0];
    out += name + ' (' + ty + ') distinct=' + c + '\n';
  }
});

out += '\nSAMPLE values of low-cardinality columns\n';
cols.forEach(function (r) {
  var name = r[0], ty = r[1];
  if (/^(nvarchar|varchar)$/.test(ty)) {
    var c = parseInt(q('select count(distinct [' + name + ']) from laser_aaa')[0][0], 10);
    if (c > 0 && c <= 30) {
      out += '## ' + name + '\n';
      q('select top 30 [' + name + '], count(*) from laser_aaa group by [' + name + '] order by 2 desc')
        .forEach(function (x) { out += '   ' + x.join(' = ') + '\n'; });
    }
  }
});

conn.close();
J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/laser_aaa_profile.txt'),
  J('java.lang.String').valueOf(out).getBytes('UTF-8'));
print(out);
