// semantic/schema/inspector.js — I2 唯一触库薄壳：DatabaseMetaData 游标 → 纯 JS 行对象（typed getter，边界一次抽）
//   java.sql 只出现在本文件（R7 允许 java.sql、禁 com.fr/FR 激活链；见 check-boundaries）。抽出的行对象交
//   零-java 核心（metadata/relation/serializer）处理——脏库返回也只产诊断，本壳不做业务推断。
//   实测依据（W0 truth）：getPrimaryKeys 有值、getImportedKeys 全库空、getIndexInfo 含 INDEX_NAME=null 统计伪行须滤、
//   getColumns COLUMN_SIZE=字符长、IS_NULLABLE YES/NO。列标签为 DatabaseMetaData 规范大写名。
var SchemaInspector = (function () {
  var J = function (n) { return Java.type(n); };

  // 按列标签+类型抽行：intNull 走 getInt+wasNull 保 null 语义；boolStr 取 'true'/'false'/'1'/'0' 原样串
  function readRows(rs, spec) {
    var rows = [];
    while (rs.next()) {
      var r = {};
      for (var i = 0; i < spec.length; i++) {
        var s = spec[i], v;
        if (s.kind === 'int') v = rs.getInt(s.name);
        else if (s.kind === 'intNull') { v = rs.getInt(s.name); if (rs.wasNull()) v = null; }
        else v = rs.getString(s.name);
        r[s.name] = v;
      }
      rows.push(r);
    }
    return rows;
  }
  var COL_SPEC = [
    { name: 'COLUMN_NAME', kind: 'str' }, { name: 'TYPE_NAME', kind: 'str' },
    { name: 'DATA_TYPE', kind: 'int' }, { name: 'COLUMN_SIZE', kind: 'intNull' },
    { name: 'DECIMAL_DIGITS', kind: 'intNull' }, { name: 'NULLABLE', kind: 'int' },
    { name: 'IS_NULLABLE', kind: 'str' }, { name: 'ORDINAL_POSITION', kind: 'int' },
    { name: 'COLUMN_DEF', kind: 'str' }
  ];
  var TBL_SPEC = [{ name: 'TABLE_NAME', kind: 'str' }, { name: 'TABLE_SCHEM', kind: 'str' }, { name: 'TABLE_TYPE', kind: 'str' }];
  var PK_SPEC = [{ name: 'COLUMN_NAME', kind: 'str' }, { name: 'KEY_SEQ', kind: 'int' }, { name: 'PK_NAME', kind: 'str' }];
  var FK_SPEC = [
    { name: 'PKTABLE_NAME', kind: 'str' }, { name: 'PKCOLUMN_NAME', kind: 'str' },
    { name: 'FKTABLE_NAME', kind: 'str' }, { name: 'FKCOLUMN_NAME', kind: 'str' }, { name: 'FK_NAME', kind: 'str' }
  ];
  var IDX_SPEC = [{ name: 'INDEX_NAME', kind: 'str' }, { name: 'NON_UNIQUE', kind: 'str' }, { name: 'COLUMN_NAME', kind: 'str' }, { name: 'ORDINAL_POSITION', kind: 'int' }];

  function indexesOf(rs) {
    var rows = readRows(rs, IDX_SPEC), byName = {};
    rows.forEach(function (r) {
      if (!r.INDEX_NAME) return;                 // 滤 (stat) 统计伪行（W0 实测）
      var u = /^(true|1)$/.test(String(r.NON_UNIQUE)) === false;
      var e = byName[r.INDEX_NAME] || (byName[r.INDEX_NAME] = { name: r.INDEX_NAME, unique: u, columns: [] });
      if (r.COLUMN_NAME) e.columns.push({ name: r.COLUMN_NAME, seq: r.ORDINAL_POSITION });
    });
    Object.keys(byName).forEach(function (k) { byName[k].columns.sort(function (a, b) { return a.seq - b.seq; }); });
    return Object.keys(byName).sort().map(function (k) { return byName[k]; });
  }

  function inspect(opts) {
    var errors = [];
    var conn = J('java.sql.DriverManager').getConnection(opts.url, opts.user, opts.password);
    try {
      var md = conn.getMetaData();
      var dialect = { product: md.getDatabaseProductName(), productVersion: md.getDatabaseProductVersion(), driver: md.getDriverName(), driverVersion: md.getDriverVersion() };
      var tblRows = readRows(md.getTables(null, null, opts.like, ['TABLE', 'VIEW']), TBL_SPEC);
      var allFk = [];
      tblRows.forEach(function (t) {
        var fk; try { fk = readRows(md.getImportedKeys(null, null, t.TABLE_NAME), FK_SPEC); } catch (e) { fk = []; }
        allFk = allFk.concat(fk);
      });
      var tables = tblRows.map(function (t) {
        var cols = SchemaMeta.normalizeColumns(readRows(md.getColumns(null, null, t.TABLE_NAME, null), COL_SPEC), 'tables.' + t.TABLE_NAME + '.columns', errors);
        var pk = SchemaMeta.primaryKeyColumns(readRows(md.getPrimaryKeys(null, null, t.TABLE_NAME), PK_SPEC), t.TABLE_NAME, 'tables.' + t.TABLE_NAME + '.pk', errors);
        var idx = [];
        try { idx = indexesOf(readRows(md.getIndexInfo(null, null, t.TABLE_NAME, false, true), IDX_SPEC)); } catch (eIdx) { /* 索引面可选，失败不阻断结构 */ }
        var tObj = { name: t.TABLE_NAME, schema: t.TABLE_SCHEM || null, type: (t.TABLE_TYPE === 'VIEW' ? 'VIEW' : 'TABLE'), columns: cols, primaryKey: pk, indexes: idx };
        return tObj;
      });
      var relations = {
        structural: SchemaRelation.bucketStructural(tables),
        fk: SchemaRelation.bucketFk(allFk),
        unconfirmedNaming: SchemaRelation.bucketNaming(tables)
      };
      return { source: opts.source, dialect: dialect, tables: tables, relations: relations, errors: errors };
    } finally {
      try { conn.close(); } catch (eC) { }
    }
  }

  return { inspect: inspect };
})();
