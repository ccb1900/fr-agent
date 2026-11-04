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
  // r5 P1：数据集只读快照（列名/列型/逐格值）——供 replace_dataset 结果回归（不靠"能执行"担保）
  //   API 已由 probes/probe_tabledata_api.js 实证：getColumnCount/getColumnName(i)/getColumnClass(i)/getRowCount/getValueAt(r,c)
  var CLASS_TYPE = {
    'java.lang.Integer': 'integer', 'java.lang.Long': 'long', 'java.lang.Double': 'float', 'java.lang.Float': 'float',
    'java.math.BigDecimal': 'decimal', 'java.lang.Boolean': 'boolean', 'java.sql.Date': 'date',
    'java.sql.Timestamp': 'datetime', 'java.lang.String': 'text'
  };
  function datasetSnapshot(wb, name) {
    var td = null;
    try { td = wb.getTableData(name); } catch (e) { return null; }
    if (!td) return null;
    var nc = 0, nr = 0;
    try { nc = +td.getColumnCount(); } catch (e1) { nc = 0; }
    try { nr = +td.getRowCount(); } catch (e2) { nr = 0; }
    var cols = [], rows = [];
    for (var c = 0; c < nc; c++) {
      var nm = '', ty = 'text';
      try { nm = String(td.getColumnName(c)); } catch (eN) { nm = ''; }
      try { var cn = String(td.getColumnClass(c).getName()); ty = CLASS_TYPE[cn] || 'text'; } catch (eC) { ty = 'text'; }
      cols.push({ name: nm, type: ty });
    }
    for (var r = 0; r < nr; r++) {
      var row = [];
      for (var c2 = 0; c2 < nc; c2++) {
        var v = null;
        try { v = td.getValueAt(r, c2); } catch (eV) { v = null; }
        row.push(v == null ? '' : String(v));
      }
      rows.push(row);
    }
    return { columns: cols, rows: rows };
  }
  return { describe: describe, datasetExists: datasetExists, cellExists: cellExists, cellText: cellText, datasetSnapshot: datasetSnapshot };
})();
