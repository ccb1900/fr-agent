// template/inspector.js — I6 薄壳：读回 WorkBook → 纯描述符（供 locator 定位；FR 方法防御式取，取不到留空不臆造）
//   r7-A：参与 Patch 安全裁决的读取一律**严格失败语义** {ok:false,error:{operation,message}}——
//   "读失败"绝不伪装成 0 行列/空文本（否则越界/空白判断会误放行）。
var TemplateInspector = (function () {
  var J = function (n) { return Java.type(n); };
  function err(operation, message) { return { ok: false, error: { operation: operation, message: String(message) } }; }
  function sheetDims(sh) {
    try {
      var rows = +sh.getRowCount(), cols = +sh.getColumnCount();
      if (!isFinite(rows) || !isFinite(cols) || rows < 0 || cols < 0) return err('sheetDims', 'row/col 非有限非负: ' + rows + 'x' + cols);
      return { ok: true, rows: rows, cols: cols };
    } catch (e) { return err('getRowCount/getColumnCount', e); }
  }
  // I6.1-A/r7：描述符必须带数据集存在性判定（真实 WorkBook 活断言）；读取失败→显式 ok:false
  function describe(wb) {
    var n;
    try { n = +wb.getReportCount(); } catch (e0) { return err('getReportCount', e0); }
    if (!isFinite(n) || n < 0) return err('getReportCount', '非有限非负数: ' + n);
    var sheets = [];
    for (var i = 0; i < n; i++) {
      var sh;
      try { sh = wb.getReport(i); } catch (e1) { return err('getReport', 'sheet ' + i + ': ' + e1); }
      if (!sh) return err('getReport', 'sheet ' + i + ' 为空');
      var d = sheetDims(sh);
      if (d.ok === false) { d.error.message = 'sheet ' + i + ': ' + d.error.message; return d; }
      sheets.push(d);
    }
    return {
      ok: true,
      sheetCount: n,
      sheets: sheets,
      datasetNames: [],                                  // 枚举不可得（FR 无公开列名 API），保留字段供离线测
      hasDataset: function (name) { return datasetExists(wb, name); }
    };
  }
  // 数据集存在性：getTableData(name) 非空（枚举名不支持，只验点名者）；异常按"不存在"处理=安全方向（宁拒不改）
  function datasetExists(wb, name) { try { return !!wb.getTableData(name); } catch (e) { return false; } }
  // r7-A：格存在性/文本读取也走严格语义（调用方必须消费 ok，不得把失败当"空格"）
  function cellExists(wb, sheet, c, r) {
    try { var sh = wb.getReport(sheet); return { ok: true, exists: !!(sh && sh.getCellElement(c, r)) }; } catch (e) { return err('getCellElement', 'sheet=' + sheet + ' c=' + c + ' r=' + r + ': ' + e); }
  }
  function cellText(wb, sheet, c, r) {
    try {
      var ce = wb.getReport(sheet).getCellElement(c, r);
      var v = ce && ce.getValue();
      return { ok: true, text: v == null ? '' : String(v) };
    } catch (e) { return err('getValue', 'sheet=' + sheet + ' c=' + c + ' r=' + r + ': ' + e); }
  }
  // 2026-11-07 inspect 深度：单元格元信息（公式/合并/数据集绑定/图表）——Agent 理解已有报表用
  //   严格失败语义同 cellText；取不到的类型留空不臆造。
  function cellMeta(wb, sheet, c, r) {
    var meta = { ok: true };
    try {
      var ce = wb.getReport(sheet).getCellElement(c, r);
      if (!ce) { meta.text = ''; return meta; }
      var v = ce.getValue();
      var cn = v && v.getClass ? String(v.getClass().getName()) : '';
      if (v == null) { meta.text = ''; }
      else if (cn === 'com.fr.base.Formula') {
        meta.type = 'formula';
        meta.formula = (typeof v.getContent === 'function') ? String(v.getContent()) : String(v);
        meta.text = meta.formula;
      } else if (cn === 'com.fr.report.cell.cellattr.core.group.DSColumn') {
        meta.type = 'dsColumn';
        meta.dsColumn = (typeof v.getColumnName === 'function') ? String(v.getColumnName()) : String(v);
        meta.text = meta.dsColumn;
      } else if (cn.indexOf('ChartCollection') >= 0) {
        meta.type = 'chart';
        meta.chartClass = '';
        try {
          var ch = v.getChart(0);
          if (ch && ch.getPlot) meta.chartClass = String(ch.getPlot().getClass().getName());
        } catch (eCh) { }
        meta.text = '[chart]';
      } else {
        meta.type = 'value';
        meta.text = String(v);
      }
      try { var cs = +ce.getColumnSpan(); if (isFinite(cs) && cs > 1) meta.colSpan = cs; } catch (eCs) { }
      try { var rs = +ce.getRowSpan(); if (isFinite(rs) && rs > 1) meta.rowSpan = rs; } catch (eRs) { }
      return meta;
    } catch (e) { return err('cellMeta', 'sheet=' + sheet + ' c=' + c + ' r=' + r + ': ' + e); }
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
  return { describe: describe, datasetExists: datasetExists, cellExists: cellExists, cellText: cellText, cellMeta: cellMeta, datasetSnapshot: datasetSnapshot };
})();
