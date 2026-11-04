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

  // ===== I5：SQL 数据集（模型驱动）→ #52 同构 cells IR =====
  //   入 rs.dataset.kind='sql' + deps{model, SqlBuilder}；调 sqlbuilder 生成受控 SQL + 列规格，
  //   发射 cells：标题/表头/明细(ds 绑定 base 列 + 派生 ratio 自格公式)/总计(SUM base + ratio 引用总计行)。
  //   行号算术镜像 agent_daily_report（title 1 行 + header 1 行 → 明细模板行 1-based=3、总计行=4）。
  function colLetter(i) { var s = ''; i = i + 1; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  function compileSql(rs, deps) {
    var errs = [];
    var model = deps && deps.model, SB = deps && deps.SqlBuilder;
    if (!model || !SB) throw new Error('[SpecCompiler] sql 数据集需 deps{model,SqlBuilder}');
    var built = SB.build(model, {
      entity: rs.dataset.entity,
      dimensions: (rs.dataset.dimensions || []).map(function (x) { return typeof x === 'string' ? x : x.term; }),
      metrics: (rs.dataset.metrics || []).map(function (x) { return typeof x === 'string' ? x : x.term; }),
      dateRange: rs.dataset.dateRange,
      sort: rs.dataset.sort, topN: rs.dataset.topN,   // I5.3-A
      filters: rs.dataset.filters                      // I5.3-B 非日期筛选（受控字面量，校验在 sqlbuilder+spec_validator）
    });
    if (built.errors && built.errors.length) throw new Error('[SpecCompiler] sqlbuilder: ' + built.errors.map(function (e) { return e.code + ' @ ' + e.path + ': ' + e.message; }).join(' ; '));
    var cols = (built.baseAliases || []).concat(built.derived || []);   // 列序：维度→base 指标→派生 ratio
    var idxByAlias = {}; cols.forEach(function (c, i) { idxByAlias[c.alias] = i; });
    var dimByName = {}, metricByName = {};
    (model.dimensions || []).forEach(function (d) { dimByName[d.name] = d; });
    (model.metrics || []).forEach(function (m) { metricByName[m.name] = m; });
    function labelOf(alias) {
      var d = dimByName[alias], m = metricByName[alias];
      return (d && d.label) || (m && m.label) || alias;
    }
    function fmtOf(alias) { var m = metricByName[alias]; return m && m.format ? m.format : null; }   // I5 修复：模型指标 format 流到产物格样式
    function numSt(alias) { var f = fmtOf(alias); return f ? { format: f, align: 4 } : { align: 4 }; }
    var showTotal = !(rs.presentation && rs.presentation.showTotal === false);
    var DETAIL_ROW = 3, TOTAL_ROW = 4;   // #52 同构：title(r1)+header(r2) → detail r3、total r4（1-based）
    var n = cols.length;
    var widths = cols.map(function () { return 110; });

    var items = [{ c: 0, span: n, text: (rs.report && rs.report.name) || rs.outName || '', st: { bold: true, align: 0 } }];
    var headerItems = cols.map(function (c, i) { return { c: i, text: labelOf(c.alias), st: { bold: true, align: 0 } }; });
    var detailItems = cols.map(function (c, i) {
      if (c.role === 'derived') {
        var num = colLetter(idxByAlias[c.numerator]), den = colLetter(idxByAlias[c.denominator]);
        return { c: i, formula: '=' + num + DETAIL_ROW + '*' + (c.scale == null ? 1 : c.scale) + '/' + den + DETAIL_ROW, st: numSt(c.alias) };
      }
      if (c.role === 'metric') return { c: i, ds: { column: c.alias }, st: numSt(c.alias) };
      return { c: i, ds: { column: c.alias } };
    });
    var blocks = [
      { type: 'cells', heightPt: 44, items: items },
      { type: 'cells', heightPt: 34, items: headerItems },
      { type: 'cells', heightPt: 30, dataset: 'ds1', items: detailItems }
    ];
    if (showTotal) {
      var totalItems = [{ c: 0, text: '总计', st: { bold: true } }];
      cols.forEach(function (c, i) {
        if (i === 0) return;   // 首列留总计标签
        if (c.role === 'derived') {
          var num = colLetter(idxByAlias[c.numerator]), den = colLetter(idxByAlias[c.denominator]);
          totalItems.push({ c: i, formula: '=' + num + TOTAL_ROW + '*' + (c.scale == null ? 1 : c.scale) + '/' + den + TOTAL_ROW, st: numSt(c.alias) });
        } else {
          totalItems.push({ c: i, formula: '=SUM(' + colLetter(i) + DETAIL_ROW + ')', st: numSt(c.alias) });
        }
      });
      blocks.push({ type: 'cells', heightPt: 36, items: totalItems });
    }
    return {
      irVersion: ReportSpec.SPEC_VERSION,
      sheets: [{ name: 'sheet1', widthsPt: widths, blocks: blocks }],
      datasets: [{ name: 'ds1', kind: 'sql', connection: rs.dataset.connection, query: built.sql }]
    };
  }

  function compile(rs, deps) {
    if (rs && rs.dataset && rs.dataset.kind === 'sql') return compileSql(rs, deps);   // I5 SQL 路（opt-in）
    // ===== I1 内嵌 rows 路：以下逐字为原 compile，未动 =====
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
