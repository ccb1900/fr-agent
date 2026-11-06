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
  //   2026-11-06：widthPt 缺省 110（planner rows 路从模型映射出的列不带 widthPt——此前直接产出 undefined → IR 拒）
  function buildColumns(rs) {
    var FW = 110;
    var cols = [];
    rs.dimensions.forEach(function (d) {
      var c = { label: d.label, name: d.field, type: 'text', widthPt: (d.widthPt != null ? d.widthPt : FW) };
      if (d.format != null) c.format = d.format;
      cols.push(c);
    });
    rs.metrics.forEach(function (m) {
      var c = { label: m.label, name: m.field, type: m.dataType || 'number', widthPt: (m.widthPt != null ? m.widthPt : FW) };
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
    // r8 A2：列引用可带 {term,label,widthPt} 覆盖（迁移旧报表时的表头文案/列宽对齐；缺省走模型标签+110pt）
    var refOverrides = {};
    (rs.dataset.dimensions || []).concat(rs.dataset.metrics || []).forEach(function (x) {
      if (x && typeof x === 'object' && x.term) refOverrides[x.term] = x;
    });
    function labelOf(alias) {
      var ov = refOverrides[alias];
      if (ov && typeof ov.label === 'string' && ov.label) return ov.label;
      var d = dimByName[alias], m = metricByName[alias];
      return (d && d.label) || (m && m.label) || alias;
    }
    function widthOf(alias) {
      var ov = refOverrides[alias];
      if (ov && typeof ov.widthPt === 'number' && isFinite(ov.widthPt)) return ov.widthPt;
      return 110;
    }
    function fmtOf(alias) { var m = metricByName[alias]; return m && m.format ? m.format : null; }   // I5 修复：模型指标 format 流到产物格样式
    function numSt(alias) { var f = fmtOf(alias); return f ? { format: f, align: 4 } : { align: 4 }; }
    var showTotal = !(rs.presentation && rs.presentation.showTotal === false);
    var DETAIL_ROW = 3, TOTAL_ROW = 4;   // #52 同构：title(r1)+header(r2) → detail r3、total r4（1-based）
    var n = cols.length;
    var widths = cols.map(function (c) { return widthOf(c.alias); });

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
    // I5.3-C 图表：presentation.chart {kind,category,value} → 复用同一 SQL 数据集 ds1 出 chart 块
    //   category=维度列别名、value=基础度量列别名（比率派生列不作图，值须是 SQL 数值列）；kind 限 legacy 图种（Van 需 ≥240pt 画区，另计）
    var ch = rs.presentation && rs.presentation.chart;
    if (ch) {
      var ckind = ch.kind || 'bar';
      var isScatter = (ckind === 'vscatter' || ckind === 'vbubble');
      if (isScatter) {
        // 审查轮1 P2：散点/气泡走 x/y（IR 对这两种 kind 硬要求 x/y；category/value 不适用）
        if (idxByAlias[ch.x] == null || !built.baseAliases.some(function (b) { return b.alias === ch.x; })) throw new Error('[SpecCompiler] chart.x 须为已选基础度量列: ' + ch.x);
        if (idxByAlias[ch.y] == null || !built.baseAliases.some(function (b) { return b.alias === ch.y; })) throw new Error('[SpecCompiler] chart.y 须为已选基础度量列: ' + ch.y);
      } else {
        if (idxByAlias[ch.category] == null) throw new Error('[SpecCompiler] chart.category 非已选维度列: ' + ch.category);
        if (idxByAlias[ch.value] == null || !built.baseAliases.some(function (b) { return b.alias === ch.value; })) throw new Error('[SpecCompiler] chart.value 须为已选基础度量列(非派生比率): ' + ch.value);
      }
      blocks.push({ type: 'space', heightPt: 10 });
      // 2026-11-06（B5）：Van 族 + 装饰键直通 IR chart 块（形态由 Ir.validate 逐键把关；Van 画区地板 240pt 由 object 层兜）
      var cblk = { type: 'chart', kind: ckind, title: ch.title || labelOf(isScatter ? ch.y : ch.value), dataset: 'ds1',
        span: n, heightPt: ch.heightPt || 260 };
      if (isScatter) { cblk.x = ch.x; cblk.y = ch.y; if (ch.bubbleSize != null) cblk.bubbleSize = ch.bubbleSize; }
      else { cblk.category = ch.category; cblk.value = ch.value; }
      ['tooltip', 'label', 'marker', 'lineStyle', 'trend', 'stack', 'conditions', 'alpha', 'bg', 'border',
        'axisY', 'axisX', 'legend', 'barInterval', 'hotTooltip', 'seriesBorder', 'effect', 'areaFill', 'seriesImage',
        'geoUrl', 'zoom', 'longitude', 'latitude', 'mapType'
      ].forEach(function (k) { if (ch[k] != null) cblk[k] = ch[k]; });
      blocks.push(cblk);
    }
    // r8 A2：脚注（迁移旧报表的口径说明行；缺省不发射，不影响既有产物）
    var fn = rs.presentation && rs.presentation.footnote;
    if (typeof fn === 'string' && fn) {
      blocks.push({ type: 'space', heightPt: 10 });
      blocks.push({ type: 'cells', heightPt: 24, items: [{ c: 0, span: n, text: fn, st: { align: 2, sizePt: 8 } }] });
    }
    return {
      irVersion: ReportSpec.SPEC_VERSION,
      sheets: [makeSheet(rs, widths, blocks)],
      datasets: [{ name: 'ds1', kind: 'sql', connection: rs.dataset.connection, query: built.sql }]
    };
  }

  // 2026-11-06（B2）：ReportSpec.params → IR.param（object.buildParamAttr 消费 widgets{x,y,w,h,kind,name,value,text}）
  //   布局=固定 140×28 网格（每行 6 个），designWidth 960；面板标题取报表名。参数默认值同时进 execute（make_api paramDefaults）。
  function buildParam(rs) {
    var W = 140, H = 28, GAP = 10, PER_ROW = 6;
    var widgets = rs.params.map(function (p, i) {
      var col = i % PER_ROW, row = Math.floor(i / PER_ROW);
      return {
        kind: p.kind, name: p.name,
        value: p.value != null ? p.value : (p.text != null ? p.text : ''),
        text: p.text != null ? p.text : (p.label != null ? p.label : p.name),
        values: p.values || null,
        reg: p.reg != null ? p.reg : null,   // 2026-11-06（B6）：编辑器校验正则（none/phone/idcard/custom{...}，IR 层校验形态）
        // 审查轮1 P2：以下键此前被静默丢（IR/object 均可消费）
        url: p.url != null ? p.url : null,
        bold: p.bold != null ? p.bold : null,
        sizePt: p.sizePt != null ? p.sizePt : null,
        allowDecimals: p.allowDecimals != null ? p.allowDecimals : null,
        maxValue: p.maxValue != null ? p.maxValue : null,
        minValue: p.minValue != null ? p.minValue : null,
        x: 10 + col * (W + GAP), y: 10 + row * (H + GAP), w: W, h: H
      };
    });
    var rows = Math.ceil(rs.params.length / PER_ROW);
    return {
      title: (rs.report && rs.report.name) || '参数',
      showWindow: false, delayPlaying: false, align: 1, windowPosition: 1,
      designWidth: 960, designHeight: 20 + rows * (H + GAP), widgets: widgets
    };
  }

  // 2026-11-06（B4）：sheet 级扩展直通 IR（headerFooter/floats/paper 为 IR sheet 键；watermark/toolbar 是 workbook 级，在 compile 里注入顶层）
  function makeSheet(rs, widths, blocks, name) {
    var sh = { name: name || 'sheet1', widthsPt: widths, blocks: blocks };
    if (rs.sheet) ['headerFooter', 'floats', 'paper', 'hideRows', 'hideCols'].forEach(function (k) {
      if (rs.sheet[k] != null) sh[k] = rs.sheet[k];
    });
    return sh;
  }

  function compile(rs, deps) {
    // 2026-11-06（B2）：分发 + 参数面板注入（sql/rows 两路共用）
    var ir = (rs && rs.dataset && rs.dataset.kind === 'sql') ? compileSql(rs, deps) : compileRows(rs);
    // 2026-11-06 多 Sheet：extraSheets（rows-only）→ 追加 sheet + 独立数据集 ds2..（块内 dataset 引用已按 dsN 发射）
    if (rs && Object.prototype.toString.call(rs.extraSheets) === '[object Array]') {
      rs.extraSheets.forEach(function (ex, xi) {
        var sub = compileRows(ex, { dsName: 'ds' + (xi + 2), sheetName: ex.name });
        ir.sheets.push(sub.sheets[0]);
        ir.datasets.push(sub.datasets[0]);
      });
    }
    if (rs.params && rs.params.length) {
      ir.param = buildParam(rs);
      // 2026-11-06：参数执行期筛选（rows 路）→ IR.param.filters（object 对每个明细格挂 CommonCondition）
      var pf = [];
      rs.params.forEach(function (p) {
        if (p && p.filter && p.filter.column) pf.push({ column: p.filter.column, op: p.filter.op || '=', parameter: p.name });
      });
      if (pf.length) ir.param.filters = pf;
    }
    // 2026-11-06（B4）：watermark/toolbar 是 workbook 级 IR 键（ir.js:32-34 一手契约）
    if (rs.sheet && rs.sheet.watermark != null) ir.watermark = rs.sheet.watermark;
    if (rs.sheet && rs.sheet.toolbar != null) ir.toolbar = rs.sheet.toolbar;
    return ir;
  }

  // ===== I1 内嵌 rows 路：以下逐字为原 compile，未动 =====
  function compileRows(rs, opts) {
    opts = opts || {};
    var dsName = opts.dsName || rs.dsName || 'ds1';
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
      { type: 'title', text: (rs.report && rs.report.name) || opts.sheetName || '', span: n, heightPt: H.title },
      { type: 'header', columns: columns, heightPt: H.header },
      { type: 'detail', dataset: dsName, columns: columns, heightPt: H.row, highlight: null, conditions: (rs.presentation && rs.presentation.conditions) || null, link: null }
    ];
    var totalCfg = rs.presentation && rs.presentation.total;
    if (showTotal) {
      // 2026-11-06（B6）：presentation.total.sumCols（多列求和，IR total 块 sumCols 通道）
      if (totalCfg && Object.prototype.toString.call(totalCfg.sumCols) === '[object Array]' && totalCfg.sumCols.length) {
        // 审查轮1 P1-B：label 合并区不得吞掉被求和列——span = 最小求和列号（≥1），与 rebuild_first.js 的 labelSpan 口径一致
        var minSumCol = n - 1;
        totalCfg.sumCols.forEach(function (sc) {
          var cc = (sc && typeof sc.col === 'number') ? sc.col : null;
          if (cc != null && cc >= n) throw new Error('[SpecCompiler] total.sumCols.col=' + cc + ' 超出表宽 n=' + n);
          if (cc != null && cc >= 0 && cc < minSumCol) minSumCol = cc;
        });
        blocks.push({ type: 'total', label: totalCfg.label || '合计', span: Math.max(1, minSumCol), sumCols: totalCfg.sumCols, heightPt: H.total });
      } else if (totalCfg && totalCfg.aggregate) {
        // 2026-11-06 P1：aggregate 直通（sum/avg/count/min/max/ratio）；label span 仍取聚合落点最小列，避免吞格
        var ag = totalCfg.aggregate;
        var agCol = (ag.fn === 'ratio') ? Math.min(ag.num, ag.den) : ag.col;
        // 2026-11-06 复审2：落点必须在表宽内（且 label span 不越 n-1），否则合计格跑到表外静默"成功"
        if (typeof agCol === 'number' && agCol >= n) throw new Error('[SpecCompiler] total.aggregate 落点列=' + agCol + ' 超出表宽 n=' + n);
        var agSpan = (typeof agCol === 'number') ? Math.max(1, Math.min(agCol, n - 1)) : Math.max(1, n - 1);
        blocks.push({ type: 'total', label: totalCfg.label || '合计', span: agSpan, aggregate: ag, heightPt: H.total });
      } else {
        blocks.push({ type: 'total', label: (totalCfg && totalCfg.label) || '合计', span: n - 1, aggregate: { fn: 'sum', col: totalCol }, heightPt: H.total });
      }
    }
    // 2026-11-06（B3）：presentation.cells（额外 cells 块，透传 IR cells item 族——
    //   rich/dict/subreport/barcode/corner/expand/linkTo/web/groupCustom；形态由 Ir.validate 把关）
    var pc = rs.presentation && rs.presentation.cells;
    if (Object.prototype.toString.call(pc) === '[object Array]' && pc.length) {
      blocks.push({ type: 'cells', heightPt: H.row, items: pc });
    }
    // 2026-11-06（B1 静默丢弃修复）：rows 路也发射脚注（与 sql 路同形；此前过校验但编译器不读 = 静默丢）
    var fnR = rs.presentation && rs.presentation.footnote;
    if (typeof fnR === 'string' && fnR) {
      blocks.push({ type: 'space', heightPt: 10 });
      blocks.push({ type: 'cells', heightPt: 24, items: [{ c: 0, span: n, text: fnR, st: { align: 2, sizePt: 8 } }] });
    }

    return {
      irVersion: ReportSpec.SPEC_VERSION,
      sheets: [makeSheet(rs, columns.map(function (c) { return c.widthPt; }), blocks, opts.sheetName)],
      datasets: [{ name: dsName, columns: columns, rows: rs.dataset.rows }]
    };
  }

  return { compile: compile };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpecCompiler;
