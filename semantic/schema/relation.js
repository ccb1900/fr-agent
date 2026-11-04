// semantic/schema/relation.js — I2 纯函数核心：r2 §2.2 三分桶关系（零 java，可离线单测）
//   structural：库里真实声明的约束事实（PK / 唯一索引）——证据级，可直接依赖
//   fk：getImportedKeys 返回的外键——W0 实测本演示库全库 0 行，故常空；非空即约束级事实
//   unconfirmedNaming：仅凭列名/表名模式推导的"疑似关联"（如 file_key 跨表），显式 requires_confirmation，
//     永不进 structural/fk（桶间硬隔离）。置信度只作排序，不替代业务确认（r2 §3.3）。
var SchemaRelation = (function () {
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // 结构事实桶：来自 PK（getPrimaryKeys）
  function bucketStructural(tablesWithPk) {
    var outArr = [];
    (tablesWithPk || []).forEach(function (t) {
      if (!isObj(t) || !Array.isArray(t.primaryKey) || !t.primaryKey.length) return;
      outArr.push({ table: t.name, kind: 'PRIMARY_KEY', columns: t.primaryKey.map(function (k) { return k.column; }) });
    });
    return outArr;
  }

  // FK 桶：来自 getImportedKeys 行（列标签 PKTABLE_NAME/PKCOLUMN_NAME/FKTABLE_NAME/FKCOLUMN_NAME/FK_NAME）
  function bucketFk(fkRows) {
    var outArr = [];
    (Array.isArray(fkRows) ? fkRows : []).forEach(function (r) {
      if (!isObj(r)) return;
      var from = r.FKTABLE_NAME != null ? String(r.FKTABLE_NAME) : null;
      var fromCol = r.FKCOLUMN_NAME != null ? String(r.FKCOLUMN_NAME) : null;
      var to = r.PKTABLE_NAME != null ? String(r.PKTABLE_NAME) : null;
      var toCol = r.PKCOLUMN_NAME != null ? String(r.PKCOLUMN_NAME) : null;
      // 非法态写不出来：四要素缺一不进桶（FK 语义必须两端列齐）
      if (!from || !fromCol || !to || !toCol) return;
      outArr.push({ from: from, fromColumn: fromCol, to: to, toColumn: toCol, name: r.FK_NAME != null ? String(r.FK_NAME) : null });
    });
    return outArr;
  }

  // 未确认命名推导桶：某列 <base>_key / <base>_id 且存在名为 <base>s / <base> 的另一表 → 候选关联，requires_confirmation
  //   （file_key + 存在 laser_files 表 → file_key → laser_files.file_key 的疑似外键，但库里没声明，绝不进 FK 桶）
  function bucketNaming(tables) {
    var names = {};
    (tables || []).forEach(function (t) { if (t && t.name) names[t.name.toLowerCase()] = t.name; });
    var hints = [];
    (tables || []).forEach(function (t) {
      if (!t || !Array.isArray(t.columns)) return;
      t.columns.forEach(function (c) {
        var m = /^(.+)_(key|id)$/i.exec(c.name || '');
        if (!m) return;
        var base = m[1].toLowerCase();
        var cand = [];
        Object.keys(names).forEach(function (tn) {
          if (tn === t.name.toLowerCase()) return;
          if (tn === base || tn === base + 's' || tn.indexOf(base) >= 0) cand.push(names[tn]);
        });
        if (cand.length) {
          hints.push({
            table: t.name, column: c.name,
            candidates: cand.sort(), status: 'ambiguous', requires_confirmation: true,
            reason: '列名 ' + c.name + ' 命名推导，非库内声明约束'
          });
        }
      });
    });
    return hints;
  }

  return { bucketStructural: bucketStructural, bucketFk: bucketFk, bucketNaming: bucketNaming };
})();
