// semantic/schema/metadata.js — I2 纯函数核心：DatabaseMetaData 行对象 → 标准化列/键（零 java、零 FR，可离线单测）
//   边界纪律（ub-mode）：inspector.js 在库边界把 ResultSet 抽成本文件定义的"原始行对象"，本文件只信任该形态、
//   做结构校验+归一；对任意脏行只产诊断（{code,path,message}，沿用 lib/ir.js I0-01 契约）、绝不抛。
//   刻意不越界：不做 num/cent 之类"业务 kind"推断（那是派生语义，属 I3 语义模型），只忠实反映结构事实。
var SchemaMeta = (function () {
  function E(errs, code, path, message) { errs.push({ code: code, path: path, message: message }); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isStr(v) { return typeof v === 'string'; }
  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function numOrNull(v) { return (v == null || v === '') ? null : (typeof v === 'number' ? v : (isFinite(+v) ? +v : null)); }

  // java.sql 可空三态：columnNoNulls=0 / columnNullable=1 / columnNullableUnknown=2
  function resolveNullable(row) {
    if (isStr(row.IS_NULLABLE)) return row.IS_NULLABLE.toUpperCase() === 'YES';
    if (isInt(row.NULLABLE)) return row.NULLABLE === 1;   // 0=>false(不可空),1=>true(可空),2=>下面 unknown
    return null;                                          // 未知（不臆断）
  }

  // 单列归一（DatabaseMetaData.getColumns 行）→ {name,jdbcType,typeName,length,decimalDigits,nullable,ordinal,defaultValue}
  function normalizeColumn(raw, path, errs) {
    if (!isObj(raw)) { E(errs, 'INVALID_TYPE', path, 'column row must be an object'); return null; }
    var name = raw.COLUMN_NAME != null ? raw.COLUMN_NAME : raw.name;
    if (!isStr(name) || name === '') { E(errs, 'REQUIRED', path + '.name', 'COLUMN_NAME required'); return null; }
    var jdbcType = numOrNull(raw.DATA_TYPE);
    if (jdbcType == null) E(errs, 'INVALID_NUMBER', path + '.jdbcType', 'DATA_TYPE must be a finite int (java.sql.Types code)');
    var ordinal = numOrNull(raw.ORDINAL_POSITION);
    if (ordinal != null && ordinal < 1) E(errs, 'INVALID_NUMBER', path + '.ordinal', 'ORDINAL_POSITION must be >=1');
    var nullable = resolveNullable(raw);
    var col = {
      name: String(name),
      jdbcType: jdbcType,
      typeName: isStr(raw.TYPE_NAME) ? raw.TYPE_NAME : (raw.TYPE_NAME == null ? null : String(raw.TYPE_NAME)),
      length: numOrNull(raw.COLUMN_SIZE),                 // 字符长度口径（nvarchar=4000，非 sys.max_length 字节 8000；见 W0 truth）
      decimalDigits: numOrNull(raw.DECIMAL_DIGITS),
      nullable: nullable,
      ordinal: ordinal,
      defaultValue: (raw.COLUMN_DEF == null || String(raw.COLUMN_DEF) === 'null') ? null : String(raw.COLUMN_DEF)
    };
    return col;
  }

  function normalizeColumns(rawCols, path, errs) {
    var outArr = [];
    if (!Array.isArray(rawCols)) { E(errs, 'INVALID_ARRAY', path, 'columns must be an array'); return outArr; }
    rawCols.forEach(function (r, i) {
      var c = normalizeColumn(r, path + '[' + i + ']', errs);
      if (c) outArr.push(c);
    });
    outArr.sort(function (a, b) { return (a.ordinal == null ? 0 : a.ordinal) - (b.ordinal == null ? 0 : b.ordinal); });
    return outArr;
  }

  // getPrimaryKeys 行集 → 有序 PK 列数组（按 KEY_SEQ）；KEY_NAME 尽力取（W0 实测 mssql 驱动 PKEY_NAME 可能空，不阻断）
  function primaryKeyColumns(pkRows, table, path, errs) {
    var mine = [];
    (Array.isArray(pkRows) ? pkRows : []).forEach(function (r, i) {
      if (!isObj(r)) { E(errs, 'INVALID_TYPE', path + '[' + i + ']', 'pk row must be an object'); return; }
      var tn = r.TABLE_NAME != null ? String(r.TABLE_NAME) : (table != null ? String(table) : null);
      var cn = r.COLUMN_NAME != null ? String(r.COLUMN_NAME) : null;
      if (!cn) { E(errs, 'REQUIRED', path + '[' + i + '].COLUMN_NAME', 'pk row needs COLUMN_NAME'); return; }
      mine.push({ column: cn, seq: numOrNull(r.KEY_SEQ), name: r.PK_NAME != null && String(r.PK_NAME) !== 'undefined' ? String(r.PK_NAME) : null, table: tn });
    });
    mine.sort(function (a, b) { return (a.seq == null ? 0 : a.seq) - (b.seq == null ? 0 : b.seq); });
    return mine;
  }

  return {
    normalizeColumn: normalizeColumn,
    normalizeColumns: normalizeColumns,
    primaryKeyColumns: primaryKeyColumns,
    numOrNull: numOrNull,
    isStr: isStr, isInt: isInt, isObj: isObj
  };
})();
