// probe_charmax.js — 定案 nvarchar 列的 (max) vs 定长：INFORMATION_SCHEMA.CHARACTER_MAXIMUM_LENGTH=-1 即 MAX
var J = function (n) { return Java.type(n); };
var con = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load('D:/fineagent/lib/dbpass.js'));
var st = con.createStatement();
var sql = [
  "SELECT t.name AS tbl, c.name AS col, ty.name AS dtype, c.max_length AS ml,",
  "       i.CHARACTER_MAXIMUM_LENGTH AS charmax, i.NUMERIC_PRECISION AS np, i.NUMERIC_SCALE AS ns",
  "FROM sys.columns c",
  "JOIN sys.types ty ON ty.user_type_id = c.user_type_id",
  "JOIN sys.tables t ON t.object_id = c.object_id",
  "LEFT JOIN INFORMATION_SCHEMA.COLUMNS i ON i.TABLE_NAME = t.name AND i.COLUMN_NAME = c.name",
  "WHERE t.name IN ('laser_aaa','laser_files','laser_pwrmulti','laser_zaxis')",
  "ORDER BY t.name, c.column_id"
].join('\n');
var rs = st.executeQuery(sql);
while (rs.next()) {
  print(rs.getString(1) + '\t' + rs.getString(2) + '\t' + rs.getString(3) +
    '\tml=' + rs.getInt(4) + '\tchars=' + rs.getString(5) + '\tnp=' + rs.getString(6) + '\tns=' + rs.getString(7));
}
rs.close(); st.close(); con.close();
print('DONE');
