// probes/probe_metadate.js — I2-W0 实机定性探针：DatabaseMetaData 在 mssql-jdbc 9.4.1 + 演示库上的真实能力面
//   动机（AGENTS §5：证据=探针，不是"文档说应该"；本仓 DatabaseMetaData 零先例）：
//     ① 演示库到底有没有声明 PK/FK 约束——决定 r2 三分桶（结构事实/FK推导/未确认业务关系）的真实填充；
//     ② getTables/getColumns/getPrimaryKeys/getImportedKeys/getIndexInfo/getSchemas 各方法可用性与返回列形态
//        → 决定 inspector 薄壳怎么写"边界一次 extract"；
//     ③ COLUMN_SIZE/IS_NULLABLE/DATA_TYPE 的确切语义（避开现画像 maxlen 字节-vs-字符陷阱）。
//   只读元数据、零建表零写库；凭据走 dbpass 单源；truth 落 data/schema_probe_truth.txt（不含任何凭据）。
//   跑法：powershell -File runraw.ps1 -Script probes/probe_metadate.js   （不杀 java、不启 FR；classpath 已含 mssql-jdbc）
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
function genev(k, d) { var v = System.getenv(k); return (v == null || String(v) === '') ? d : String(v); }

var url = genev('SCHEMA_URL', genev('BR_PURL', 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false'));
var user = genev('SCHEMA_USER', genev('BR_PUSER', 'sa'));
var pass = genev('SCHEMA_PASS', load('D:/fineagent/lib/dbpass.js'));
var like = genev('SCHEMA_LIKE', 'laser_%');
var OUT = genev('SCHEMA_TRUTH', 'D:/fineagent/data/schema_probe_truth.txt');

var out = [];
function p(s) { out.push(s); print(s); }

// 通用：ResultSet → 纯 JS 行对象数组（列名一次取全，之后每行落对象；这就是 inspector 要提炼的 extract 面）
function rs2rows(rs) {
  var md = rs.getMetaData();
  var n = md.getColumnCount();
  var names = [];
  for (var i = 1; i <= n; i++) names.push(md.getColumnLabel(i));
  var rows = [];
  while (rs.next()) {
    var r = {};
    for (var j = 1; j <= n; j++) {
      var v = rs.getObject(j);
      r[names[j - 1]] = (v == null ? null : String(v));
    }
    rows.push(r);
  }
  return rows;
}
function tryCall(name, fn) {
  try { var v = fn(); return { ok: true, value: v }; }
  catch (e) { p('  METHOD-FAIL ' + name + ': ' + e); return { ok: false, error: String(e) }; }
}

var conn = null;
try {
  conn = J('java.sql.DriverManager').getConnection(url, user, pass);
  var dbmd = conn.getMetaData();
  p('## CONNECTION (sanitized)');
  p('  product=' + dbmd.getDatabaseProductName() + ' ' + dbmd.getDatabaseProductVersion());
  p('  driver=' + dbmd.getDriverName() + ' ' + dbmd.getDriverVersion());
  p('  urlCatalog=' + (typeof dbmd.getCatalog === 'function' ? dbmd.getCatalog() : '(n/a)'));

  p('## TABLE-TYPES supported');
  tryCall('getTableTypes', function () {
    var t = rs2rows(dbmd.getTableTypes());
    p('  ' + t.map(function (x) { return x.TABLE_TYPE; }).join(','));
    return t;
  });

  p('## SCHEMAS');
  tryCall('getSchemas', function () {
    var s = rs2rows(dbmd.getSchemas());
    p('  count=' + s.length + ' names=' + s.slice(0, 8).map(function (x) { return x.TABLE_SCHEM; }).join(','));
    return s;
  });

  p('## TABLES like ' + like + ' (types TABLE|VIEW)');
  var tables = [];
  tryCall('getTables', function () {
    tables = rs2rows(dbmd.getTables(null, null, like, ['TABLE', 'VIEW']));
    p('  count=' + tables.length);
    tables.slice(0, 40).forEach(function (t) { p('  ' + t.TABLE_NAME + ' | ' + t.TABLE_TYPE + ' | schema=' + t.TABLE_SCHEM); });
    return tables.length;
  });

  // 单表全元数据深测（laser_aaa 是 19 列、画像最完备的靶表）
  var probeTable = 'laser_aaa';
  if (tables.some(function (t) { return t.TABLE_NAME === probeTable; }) === false && tables.length) probeTable = tables[0].TABLE_NAME;
  p('## DEEP PROBE on ' + probeTable);

  tryCall('getColumns', function () {
    var cols = rs2rows(dbmd.getColumns(null, null, probeTable, null));
    p('  count=' + cols.length);
    cols.slice(0, 60).forEach(function (c) {
      p('  ' + c.ORDINAL_POSITION + '|' + c.COLUMN_NAME + '|TYPE_NAME=' + c.TYPE_NAME + '|DATA_TYPE=' + c.DATA_TYPE +
        '|COLUMN_SIZE=' + c.COLUMN_SIZE + '|DECIMAL_DIGITS=' + c.DECIMAL_DIGITS + '|NULLABLE=' + c.NULLABLE +
        '|IS_NULLABLE=' + c.IS_NULLABLE + '|COLUMN_DEF=' + c.COLUMN_DEF);
    });
    return cols.length;
  });

  // 三分桶之"结构事实"面：对每张 laser 表扫 PK
  p('## PRIMARY KEYS (scan all ' + tables.length + ' tables)');
  tryCall('getPrimaryKeys-scan', function () {
    var pkTables = 0, rowsTotal = 0, sample = [];
    tables.forEach(function (t) {
      if (t.TABLE_TYPE !== 'TABLE') return;
      var pk = rs2rows(dbmd.getPrimaryKeys(null, null, t.TABLE_NAME));
      if (pk.length) { pkTables++; rowsTotal += pk.length; if (sample.length < 8) pk.forEach(function (r) { if (sample.length < 8) sample.push(t.TABLE_NAME + '.' + r.COLUMN_NAME + ' key=' + r.PKEY_NAME); }); }
    });
    p('  tables-with-PK=' + pkTables + ' pkRows=' + rowsTotal);
    sample.forEach(function (s) { p('  PK ' + s); });
    return pkTables;
  });

  // 三分桶之"FK 推导"面：getImportedKeys 扫全表（关键未知数，实测定性）
  p('## IMPORTED KEYS / FK (scan all tables)');
  tryCall('getImportedKeys-scan', function () {
    var fkTables = 0, fkRows = 0, sample = [];
    tables.forEach(function (t) {
      if (t.TABLE_TYPE !== 'TABLE') return;
      var fk = rs2rows(dbmd.getImportedKeys(null, null, t.TABLE_NAME));
      if (fk.length) { fkTables++; fkRows += fk.length; if (sample.length < 8) fk.forEach(function (r) { if (sample.length < 8) sample.push(r.FK_TABLE_NAME + '.' + r.FK_COLUMN_NAME + ' -> ' + r.PK_TABLE_NAME + '.' + r.PK_COLUMN_NAME + ' key=' + r.FK_NAME); }); }
    });
    p('  tables-with-FK=' + fkTables + ' fkRows=' + fkRows);
    sample.forEach(function (s) { p('  FK ' + s); });
    return fkRows;
  });

  // 索引面（结构事实的一部分）
  p('## INDEX INFO on ' + probeTable);
  tryCall('getIndexInfo', function () {
    var idx = rs2rows(dbmd.getIndexInfo(null, null, probeTable, false, true));
    p('  rows=' + idx.length);
    idx.slice(0, 15).forEach(function (r) {
      p('  ' + (r.INDEX_NAME == null ? '(stat)' : r.INDEX_NAME) + ' nonUnique=' + r.NON_UNIQUE + ' col=' + r.COLUMN_NAME + ' seq=' + r.ORDINAL_POSITION);
    });
    return idx.length;
  });

  p('## END (sanitized: no url/credentials in this file)');
} catch (eTop) {
  p('FATAL: ' + eTop);
} finally {
  if (conn) { try { conn.close(); } catch (eC) { } }
}
try {
  var F = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
  F.write(P.get(OUT), J('java.lang.String').valueOf(out.join('\n')).getBytes('UTF-8'));
  print('TRUTH WRITTEN -> ' + OUT);
} catch (eW) { print('TRUTH WRITE FAIL: ' + eW); }
System.exit(0);
