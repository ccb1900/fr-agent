// probe_tables.js — atom_live_demo 全表清单（表名/行数/列数）+ 目标三表的列画像（日期列、可过滤低基数列）
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

var out = '## TABLES\n';
q("select t.name, (select count(*) from sys.columns c where c.object_id=t.object_id) as col_cnt" +
  " from sys.tables t order by 1").forEach(function (r) { out += r[0] + '|cols=' + r[1] + '\n'; });

var tables = q("select t.name from sys.tables t order by 1").map(function (r) { return r[0]; });
out += '\n## ROWCOUNTS + DATE RANGES\n';
tables.forEach(function (t) {
  var rc = q('select count(*) from [' + t + ']')[0][0];
  var dcols = q("select c.name, ty.name from sys.columns c join sys.types ty on ty.user_type_id=c.user_type_id" +
    " where c.object_id=object_id('" + t + "') and ty.name in ('date','datetime','datetime2','nvarchar','varchar') order by c.column_id");
  var line = t + '|rows=' + rc + '|textcols=';
  dcols.forEach(function (d) {
    if (!/date|time|day/i.test(d[0])) return;
    var mn = q("select min(cast([" + d[0] + "] as nvarchar)), max(cast([" + d[0] + "] as nvarchar)) from [" + t + "] where [" + d[0] + "] is not null")[0];
    line += d[0] + '(' + d[1] + ')[' + mn[0] + '..' + mn[1] + '] ';
  });
  out += line + '\n';
});

out += '\n## COLUMNS PER TABLE\n';
tables.forEach(function (t) {
  out += '### ' + t + '\n';
  q("select c.column_id, c.name, ty.name, c.max_length, c.is_nullable from sys.columns c" +
    " join sys.types ty on ty.user_type_id=c.user_type_id where c.object_id=object_id('" + t + "') order by c.column_id")
    .forEach(function (r) { out += r.join('|') + '\n'; });
});

out += '\n## LOW-CARDINALITY FILTER CANDIDATES (distinct<=30, non-date)\n';
tables.forEach(function (t) {
  var cols = q("select c.name, ty.name from sys.columns c join sys.types ty on ty.user_type_id=c.user_type_id" +
    " where c.object_id=object_id('" + t + "') and ty.name in ('nvarchar','varchar','int','tinyint','smallint') order by c.column_id");
  cols.forEach(function (c) {
    if (/date|time|_id$|key$/i.test(c[0])) return;
    var d = parseInt(q('select count(distinct [' + c[0] + ']) from [' + t + ']')[0][0], 10);
    if (d > 0 && d <= 30) {
      var vals = q('select top 12 [' + c[0] + '] from [' + t + '] where [' + c[0] + '] is not null group by [' + c[0] + '] order by 1')
        .map(function (v) { return v[0]; }).join(',');
      out += t + '.' + c[0] + ' (' + c[1] + ') distinct=' + d + ' vals=' + vals + '\n';
    }
  });
});

conn.close();
J('java.nio.file.Files').write(J('java.nio.file.Paths').get('D:/fineagent/data/db_tables_profile.txt'),
  J('java.lang.String').valueOf(out).getBytes('UTF-8'));
print('WROTE data/db_tables_profile.txt chars=' + out.length);
