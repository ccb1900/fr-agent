// lib/spec_compiler.js — I1（r2.md）ReportSpec → ReportIR 编译器（三职责之三：只做转换，不校验）
//   前置：入参已由 spec_validator 把关（边界一次校验、内部信任）。产物 = 现有 ReportIR 形态，
//   喂给既有 Ir.validate + Obj.build + CPT 全链——本文件不引 FR 类、不产 XML、不重复排版规则。
//   等价铁证（verify/fast_report_spec.js）：compile(examples/report-spec/sales_demo.json)
//     的 JSON 串 ≡ Ir.compile(reports/sales_demo.js 的 SPEC)——逐字镜像 ir.js compile out 字面量的键序/块序，
//     使 rawIR 直通路（runner 包 SPEC={outName,IR}）与 v2 直写通路产出的对象图结构一致 → CPT 逐字节相等。
//   红线：不污染 ir.js（单向依赖），输入不可变+幂等（#50 纪律）。ES5：全 var + function，无箭头/模板串。
var SpecCompiler = (function () {
  var DEFAULT_HEIGHTS = { title: 30, header: 24, row: 24, total: 24 };

  // 与 ir.js lastNumberIdx 同规则：最后一个 type==='number' 列（决定 total SUM 落哪列）
  function lastNumberIdx(columns) {
    for (var i = columns.length - 1; i >= 0; i--) if (columns[i].type === 'number') return i;
    return -1;
  }

  // dimensions→text 列，metrics→数值列（dataType 缺省 number）；键序 label,name,type,widthPt[,format]（对齐 v2 语料字面量）
  function buildColumns(rs) {
    var cols = [];
    rs.dimensions.forEach(function (d) {
      var c = { label: d.label, name: d.field, type: 'text', widthPt: d.widthPt };
      if (d.format != null) c.format = d.format;
      cols.push(c);
    });
    rs.metrics.forEach(function (m) {
      var c = { label: m.label, name: m.field, type: m.dataType || 'number', widthPt: m.widthPt };
      if (m.format != null) c.format = m.format;
      cols.push(c);
    });
    return cols;
  }

  function compile(rs) {
    var dsName = rs.dsName || 'ds1';
    var columns = buildColumns(rs);
    var n = columns.length;
    var totalCol = lastNumberIdx(columns);
    var hp = (rs.presentation && rs.presentation.heightsPt) || {};
    var H = {
      title: hp.title != null ? hp.title : DEFAULT_HEIGHTS.title,
      header: hp.header != null ? hp.header : DEFAULT_HEIGHTS.header,
      row: hp.row != null ? hp.row : DEFAULT_HEIGHTS.row,
      total: hp.total != null ? hp.total : DEFAULT_HEIGHTS.total
    };
    var showTotal = !(rs.presentation && rs.presentation.showTotal === false);
    var blocks = [
      { type: 'title', text: (rs.report && rs.report.name) || '', span: n, heightPt: H.title },
      { type: 'header', columns: columns, heightPt: H.header },
      { type: 'detail', dataset: dsName, columns: columns, heightPt: H.row, highlight: null, conditions: null, link: null }
    ];
    if (showTotal) blocks.push({ type: 'total', label: '合计', span: n - 1, aggregate: { fn: 'sum', col: totalCol }, heightPt: H.total });

    return {
      irVersion: ReportSpec.SPEC_VERSION,
      sheets: [{
        name: 'sheet1',
        widthsPt: columns.map(function (c) { return c.widthPt; }),
        blocks: blocks
      }],
      datasets: [{ name: dsName, columns: columns, rows: rs.dataset.rows }]
    };
  }

  return { compile: compile };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpecCompiler;
