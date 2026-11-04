// template/inspector.js — I6 薄壳：读回 WorkBook → 纯描述符（供 locator 定位；FR 方法防御式取，取不到留空不臆造）
var TemplateInspector = (function () {
  var J = function (n) { return Java.type(n); };
  function safeNum(o, fn) { try { return typeof o[fn] === 'function' ? +o[fn]() : null; } catch (e) { return null; } }
  function sheetDims(sh) {
    return { rows: safeNum(sh, 'getRowCount') || 0, cols: safeNum(sh, 'getColumnCount') || 0 };
  }
  // I6.1-A：描述符必须带数据集存在性判定（此前 describe 只返 sheetCount/sheets，导致 replace_dataset 在真实链必被拒）。
  //   FR WorkBook 无可靠"枚举全部数据集名"接口 → 给一个绑定 wb 的活断言函数 datasetExists(name)；
  //   Locator（纯函数）只消费这个描述符，不接 wb，保持零 java/离线可测。
  function describe(wb) {
    var n = safeNum(wb, 'getReportCount') || 0;
    var sheets = [];
    for (var i = 0; i < n; i++) { try { sheets.push(sheetDims(wb.getReport(i))); } catch (e) { sheets.push({ rows: 0, cols: 0 }); } }
    return {
      sheetCount: n,
      sheets: sheets,
      datasetNames: [],                                  // 枚举不可得（FR 无公开列名 API），保留字段供离线测
      hasDataset: function (name) { return datasetExists(wb, name); }
    };
  }
  // 数据集存在性：getTableData(name) 非空（枚举名不支持，只验点名者）
  function datasetExists(wb, name) { try { return !!wb.getTableData(name); } catch (e) { return false; } }
  function cellExists(wb, sheet, c, r) {
    try { var sh = wb.getReport(sheet); return !!(sh && sh.getCellElement(c, r)); } catch (e) { return false; }
  }
  function cellText(wb, sheet, c, r) {
    try { var ce = wb.getReport(sheet).getCellElement(c, r); var v = ce && ce.getValue(); return v == null ? '' : String(v); } catch (e) { return ''; }
  }
  // r5 P1 / r6-B：数据集只读快照（列名/列型/逐格值）——供 replace_dataset 结果回归。
  //   r6 严格失败语义：任何反射调用失败都返回 {ok:false,error,...}，绝不降级成 'text'/null——
  //   "读不到"与"读到空值"是两种状态，降级会让数据回归误通过。
  var CLASS_TYPE = {
    'java.lang.Integer': 'integer', 'java.lang.Long': 'long', 'java.lang.Double': 'float', 'java.lang.Float': 'float',
    'java.math.BigDecimal': 'decimal', 'java.lang.Boolean': 'boolean', 'java.sql.Date': 'date',
    'java.sql.Timestamp': 'datetime', 'java.lang.String': 'text'
  };
  function datasetSnapshot(wb, name) {
    var td = null;
    try { td = wb.getTableData(name); } catch (e0) { return { ok: false, error: 'getTableData 失败: ' + e0 }; }
    if (!td) return { ok: false, error: '数据集不存在: ' + name };
    var nc = 0, nr = 0;
    try { nc = +td.getColumnCount(); } catch (e1) { return { ok: false, error: 'getColumnCount 失败: ' + e1 }; }
    try { nr = +td.getRowCount(); } catch (e2) { return { ok: false, error: 'getRowCount 失败: ' + e2 }; }
    var cols = [], rows = [];
    for (var c = 0; c < nc; c++) {
      var nm, ty, cn;
      try { nm = String(td.getColumnName(c)); } catch (eN) { return { ok: false, error: 'getColumnName 失败 col=' + c + ': ' + eN }; }
      try { cn = String(td.getColumnClass(c).getName()); } catch (eC) { return { ok: false, error: 'getColumnClass 失败 col=' + c + ': ' + eC }; }
      if (!CLASS_TYPE[cn]) return { ok: false, error: '未知列类型 col=' + c + ' class=' + cn };
      cols.push({ name: nm, type: CLASS_TYPE[cn] });
    }
    for (var r = 0; r < nr; r++) {
      var row = [];
      for (var c2 = 0; c2 < nc; c2++) {
        var v;
        try { v = td.getValueAt(r, c2); } catch (eV) { return { ok: false, error: 'getValueAt 失败 row=' + r + ' col=' + c2 + ': ' + eV }; }
        row.push(v == null ? '' : String(v));
      }
      rows.push(row);
    }
    return { ok: true, columns: cols, rows: rows };
  }
  return { describe: describe, datasetExists: datasetExists, cellExists: cellExists, cellText: cellText, datasetSnapshot: datasetSnapshot };
})();
