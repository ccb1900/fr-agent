// lib/ir.js — v3.1 ReportIR：与模板形态无关的中间表示
//
// 报表 = sheets[{ blocks[] , widthsPt }] + datasets[]
// 新功能族 = 新 IR 节点 + backend 翻译（lib/object.js），不碰已有节点。
//
// 节点词汇（v3.1 首批）：
//   title  { text, span, heightPt }
//   header { columns[], heightPt }              — 列定义即表头内容源
//   detail { dataset, columns[], heightPt, highlight?, link?, conditions? }
//            highlight: {column,op,value,bg}                     — v3.2 旧形态（保留）
//            conditions: [{ name?, when, then, scope? }]         — v4.0 新形态（官方 163/240 使用）
//              when: { formula:'row()%2==0' } | { column, op, value, valueType?, formulaValue? } | { list:[when…] }
//              then: { bg, color, bold, sizePt, font, rowHeight, colWidth, page }
//            link: { by, name?, reportlet } — by=挂链列，reportrelative 路径（钻取）
//   columns[] 额外可选：html（HTML 显示）、dict（数据字典 {value:label}）、conditions（列级条件属性）
//   total  { label, span, aggregate:{fn,col}, heightPt }  — col = 汇总值所在列（0 基）
//   chart  { kind:'bar'|'pie'|'line'|vbar|vline|varea|vscatter|vpie|vgauge(VanChart 插件族), title, dataset, category, value, span, heightPt }
//           分类/值直指数据集列名；数据必须预聚合（spec 显式给数，不赌 FR 汇总语义）
//
// datasets: [{ name, columns:[{name,type,format}], rows:[...] }]
//
// param（v3.2 参数面板，workbook 级，不占 sheet 行）：
//   { title, showWindow, delayPlaying, align, windowPosition,
//     designWidth, designHeight,
//     widgets: [{ kind:'label'|'editor'|'submit', name?, text, value?, x,y,w,h }] }
//
// v4.0/v4.1 能力族（对照官方 demo 240 张 cpt 的真实用法）：
//   cells 块 item 可选：rich:[{text,bold?,sizePt?,color?,font?}]（富文本 RichText）
//                       presentFormula:'=ROW()'（FormulaPresent 公式显示）
//   sheet 级 floats: [{ name?, leftPt, topPt, widthPt, heightPt,
//                       text? | rich? | imageFile?+imageFormat?, style?, linkTo? }]
//   workbook 级 watermark: { text, fontSize?, color?, hGap?, vGap? }
//   workbook 级 toolbar:   { buttons:['export'|'print'|'email'|'first'|'previous'|'pageNavi'|'next'|'last'|…] }
//   三者与 spec 键同名，IR 直通路径（spec.IR）也会被 extrasOut 注入。

var Ir = (function () {
  function lastNumberIdx(columns) {
    for (var i = columns.length - 1; i >= 0; i--) if (columns[i].type === 'number') return i;
    return -1;
  }

  // v4.0 条件属性结构自检：when 三选一（formula / column / list）+ then 非空 + op 合法
  function checkConditions(list, ctx, errs) {
    if (list == null) return;
    if (!Array.isArray(list)) { errs.push(ctx + ': conditions must be an array'); return; }
    list.forEach(function (cd, ci) {
      var at = ctx + ' cond' + ci;
      if (!cd || typeof cd !== 'object') { errs.push(at + ': not an object'); return; }
      var w = cd.when;
      if (!w || typeof w !== 'object') { errs.push(at + ': missing when'); return; }
      if (w.formula == null && w.column == null && !(w.list && w.list.length)) errs.push(at + ': when needs formula|column|list');
      if (w.column != null && w.op != null) {
        if (!Object.prototype.hasOwnProperty.call({ '==': 1, '=': 1, '!=': 1, '>': 1, '>=': 1, '<': 1, '<=': 1, contains: 1 }, w.op)) errs.push(at + ': unknown op ' + w.op);
      }
      var t = cd.then;
      if (!t || typeof t !== 'object' || !Object.keys(t).length) errs.push(at + ': missing then');
    });
  }

  // spec（v2 形态）→ IR（v3 形态）。spec 字段不变，业务层零迁移成本。
  // v3.3：spec.IR 显式直通（官方 demo 重建路径：报规格已超出 compile 词汇表，
  //   由 spec 作者直接给 IR；validate 仍把关）。默认 compile 路径一字未动 = 回归门。
  function compile(spec) {
    if (spec.IR) { extrasOut(spec.IR, spec); return spec.IR; }
    var dsName = spec.dsName || 'ds1';
    var n = spec.columns.length;
    var totalCol = lastNumberIdx(spec.columns);
    var out = {
      sheets: [{
        name: 'sheet1',
        widthsPt: spec.columns.map(function (c) { return c.widthPt; }),
        blocks: [
          { type: 'title', text: spec.title, span: n, heightPt: spec.heightsPt.title },
          { type: 'header', columns: spec.columns, heightPt: spec.heightsPt.header },
          { type: 'detail', dataset: dsName, columns: spec.columns, heightPt: spec.heightsPt.row, highlight: spec.highlight || null, conditions: spec.conditions || null, link: spec.link || null },
          { type: 'total', label: '合计', span: n - 1, aggregate: { fn: 'sum', col: totalCol }, heightPt: spec.heightsPt.total }
        ]
      }],
      datasets: [{ name: dsName, columns: spec.columns, rows: spec.data }]
    };
    blocksOut(out, spec);
    paramsOut(out, spec);
    extrasOut(out, spec);
    return out;
  }

  // v4.1 能力族直通：水印 / 浮层 / 工具栏（spec 键与 IR 键同名，装配在 object.js）
  function extrasOut(out, spec) {
    if (spec.watermark) out.watermark = spec.watermark;
    if (spec.floats) out.sheets[0].floats = spec.floats;
    if (spec.toolbar) out.toolbar = spec.toolbar;
  }

  // v3.3 图表多系列：spec.chart.values 数组直通；单值老路径不变
  function blocksOut(out, spec) {
    if (!spec.chart) return;
    // v4.2 VanChart 插件族（probe_vanchart/2 实证）：vxx 一律 VanChart 包装
    var KINDS = { bar: 'BarPlot', pie: 'PiePlot', line: 'LinePlot',
      vbar: 'VanChartColumnPlot', vline: 'VanChartLinePlot', varea: 'VanChartAreaPlot',
      vscatter: 'VanChartScatterPlot', vpie: 'PiePlot4VanChart', vgauge: 'VanChartGaugePlot' };
    if (!KINDS[spec.chart.kind]) throw new Error('[IR] unknown chart kind: ' + spec.chart.kind);
    var dsName = spec.chart.dataset || 'dsChart';
    out.datasets.push({ name: dsName, columns: spec.chart.columns, rows: spec.chartData });
    out.sheets[0].blocks.push({
      type: 'chart', kind: spec.chart.kind, title: spec.chart.title,
      dataset: dsName, category: spec.chart.category, value: spec.chart.value,
      values: spec.chart.values, legend: spec.chart.legend, noBorder: spec.chart.noBorder,
      span: spec.columns.length, heightPt: spec.chart.heightPt || 200
    });
  }

  // 参数面板（可选能力族，v3.2）：workbook 级，不参与 sheet 块序
  function paramsOut(out, spec) {
    if (!spec.paramPanel) return;
    out.param = {
      title: spec.paramPanel.title || '参数',
      showWindow: spec.paramPanel.showWindow !== false,
      delayPlaying: spec.paramPanel.delayPlaying !== false,
      align: spec.paramPanel.align == null ? 1 : spec.paramPanel.align,
      windowPosition: spec.paramPanel.windowPosition == null ? 1 : spec.paramPanel.windowPosition,
      designWidth: spec.paramPanel.designWidth || 960,
      designHeight: spec.paramPanel.designHeight || 81,
      widgets: spec.paramPanel.widgets,
      filters: spec.paramPanel.filters || []   // 参数过滤：{column, op, parameter} 绑 DSColumn.setCondition
    };
  }

  // IR 结构自检：块序合法、聚合列在界内、数据列数一致
  // v3.3 增量检查：chart.values / corner / sumCols / space（最小合法集，默认路径不受扰）
  function validate(IR) {
    var errs = [];
    if (!IR.sheets || !IR.sheets.length) errs.push('no sheets');
    IR.sheets.forEach(function (s, si) {
      if (!s.blocks || !s.blocks.length) errs.push('sheet' + si + ': no blocks');
      var types = s.blocks.map(function (b) { return b.type; });
      // v3.4：官方 basic 族首行是 titlebar（横条带标题+超链格）——用 cells 块承载
      if (types[0] !== 'title' && types[0] !== 'titlebar' && types[0] !== 'cells') errs.push('sheet' + si + ': first block must be title|titlebar|cells');
      // v3.4：cells 通用块家族（rawIR 官方重建）自带头/明细行，旧 header/detail 硬性要求不适用
      if (types.indexOf('cells') < 0) {
        if (types.indexOf('header') < 0) errs.push('sheet' + si + ': missing header block');
        if (types.indexOf('detail') < 0) errs.push('sheet' + si + ': missing detail block');
      }
      s.blocks.forEach(function (b, bi) {
        // v4.0 条件属性族：块级/列级同形，when 必须有可判定的三选一
        checkConditions(b.conditions, 'sheet' + si + ' block' + bi, errs);
        (b.columns || []).forEach(function (c, ci) {
          checkConditions(c.conditions, 'sheet' + si + ' block' + bi + ' col' + ci + '(' + c.name + ')', errs);
          if (c.html != null && typeof c.html !== 'boolean') errs.push('sheet' + si + ' block' + bi + ' col' + ci + ': html must be boolean');
          if (c.dict != null && (typeof c.dict !== 'object' || !Object.keys(c.dict).length)) errs.push('sheet' + si + ' block' + bi + ' col' + ci + ': dict must be a non-empty map');
        });
        // v3.4 cells 通用块：items 需有列号；linkTo 需有 reportlet
        if (b.type === 'cells') {
          (b.items || []).forEach(function (it, ii) {
            if (typeof it.c !== 'number') errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': missing c');
            if (it.linkTo && !it.linkTo.reportlet && !(it.linkTo.web && it.linkTo.web.url)) errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': linkTo needs reportlet or web.url');
            if (!it.ds && !it.formula && !it.rich && !it.presentFormula && it.text == null && !it.st) errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': empty item (no text/formula/rich/ds/st)');
            checkConditions(it.conditions, 'sheet' + si + ' block' + bi + ' item' + ii, errs);
            if (it.dict != null && (typeof it.dict !== 'object' || !Object.keys(it.dict).length)) errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': dict must be a non-empty map');
          });
        }
        if (b.type === 'header' && b.corner) {
          if (!b.corner.text) errs.push('sheet' + si + ' block' + bi + ': corner needs text');
          if (!(b.corner.span > 1)) errs.push('sheet' + si + ' block' + bi + ': corner.span must be >1');
        }
        if (b.type === 'total' && b.sumCols) {
          if (!b.sumCols.length) errs.push('sheet' + si + ' block' + bi + ': sumCols empty');
          b.sumCols.forEach(function (sc, ci) {
            if (typeof sc.col !== 'number') errs.push('sheet' + si + ' block' + bi + ' sumCol' + ci + ': missing col');
            if (sc.formula && sc.formula.charAt(0) !== '=') errs.push('sheet' + si + ' block' + bi + ' sumCol' + ci + ': formula needs "=" prefix');
          });
        }
      });
    });
    if (!IR.datasets || !IR.datasets.length) errs.push('no datasets');
    // v3.5 数据集两形态：kind=sql（连接名 + 模板内置 SQL）/ 默认自包含（columns+rows）
    (IR.datasets || []).forEach(function (ds, di) {
      if (ds.kind === 'sql') {
        if (!ds.connection) errs.push('dataset' + di + ': sql needs connection');
        if (!ds.query) errs.push('dataset' + di + ': sql needs query');
      } else if (!ds.columns || !ds.rows) errs.push('dataset' + di + ': embedded needs columns+rows');
    });
    var CHART_KINDS = { bar: 1, pie: 1, line: 1, vbar: 1, vline: 1, varea: 1, vscatter: 1, vpie: 1, vgauge: 1 };
    // v4.1 新增能力族校验：富文本/公式显示/浮层/水印/工具栏
    IR.sheets.forEach(function (s, si) {
      (s.floats || []).forEach(function (fl, fi) {
        var at = 'sheet' + si + ' float' + fi;
        if (!fl.text && !fl.rich && !fl.imageFile) errs.push(at + ': needs text | rich | imageFile');
        if (fl.rich && !fl.rich.length) errs.push(at + ': rich empty');
        ['leftPt', 'topPt', 'widthPt', 'heightPt'].forEach(function (k) {
          if (fl[k] != null && typeof fl[k] !== 'number') errs.push(at + ': ' + k + ' must be number');
        });
      });
    });
    if (IR.watermark) {
      if (IR.watermark.text == null) errs.push('watermark: missing text');
      ['fontSize', 'hGap', 'vGap'].forEach(function (k) {
        if (IR.watermark[k] != null && typeof IR.watermark[k] !== 'number') errs.push('watermark: ' + k + ' must be number');
      });
    }
    if (IR.toolbar) {
      if (!IR.toolbar.buttons || !IR.toolbar.buttons.length) errs.push('toolbar: no buttons');
    }
    IR.sheets.forEach(function (s, si) {
      s.blocks.forEach(function (b, bi) {
        if (b.type !== 'chart') return;
        if (!CHART_KINDS[b.kind]) errs.push('sheet' + si + ' block' + bi + ': unknown chart kind ' + b.kind);
        // v4.2 vscatter 走 BubbleTableDefinition（x/y 绑定），与 axis 图的 category/value 形态不同
        if (b.kind === 'vscatter') {
          if (!b.dataset || !b.x || !b.y) errs.push('sheet' + si + ' block' + bi + ': scatter chart needs dataset/x/y');
        } else if (!b.dataset || !b.category || !(b.value || (b.values && b.values.length))) {
          errs.push('sheet' + si + ' block' + bi + ': chart needs dataset/category/(value|values)');
        }
        if (b.type === 'detail' && b.link) {
          var hasCol = (b.columns || []).some(function (c) { return c.name === b.link.by; });
          if (!hasCol) errs.push('sheet' + si + ' block' + bi + ': link.by not in detail columns');
          if (!b.link.reportlet) errs.push('sheet' + si + ' block' + bi + ': link needs reportlet path');
        }
      });
    });
    // 2026-10-27 v3.9 面板控件家族扩容：date=DateEditor / combo=ComboBox+CustomDictionary / nav=FreeButton+click JS
    var KINDS = { label: 1, editor: 1, date: 1, combo: 1, nav: 1, submit: 1,
      number: 1, textarea: 1, radio: 1, checkbox: 1, combocheck: 1, treecombo: 1, iframe: 1 };
    if (IR.param) {
      if (!IR.param.widgets || !IR.param.widgets.length) errs.push('param: no widgets');
      else IR.param.widgets.forEach(function (w, wi) {
        if (!KINDS[w.kind]) errs.push('param widget' + wi + ': unknown kind ' + w.kind);
        if ((w.kind === 'editor' || w.kind === 'date' || w.kind === 'combo' || w.kind === 'number'
          || w.kind === 'textarea' || w.kind === 'radio' || w.kind === 'checkbox'
          || w.kind === 'combocheck' || w.kind === 'treecombo') && !w.name) errs.push('param widget' + wi + ': editor-like kind needs name (=参数名)');
        if ((w.kind === 'combo' || w.kind === 'radio' || w.kind === 'checkbox'
          || w.kind === 'combocheck' || w.kind === 'treecombo') && (!w.values || !w.values.length)) errs.push('param widget' + wi + ': ' + w.kind + ' needs values');
        if (w.kind === 'nav' && !w.url) errs.push('param widget' + wi + ': nav needs url');
        if (w.kind === 'iframe' && !w.url && !w.text) errs.push('param widget' + wi + ': iframe needs url');
        for (var k = 0; k < ['x', 'y', 'w', 'h'].length; k++) {
          var kk = ['x', 'y', 'w', 'h'][k];
          if (typeof w[kk] !== 'number') errs.push('param widget' + wi + ': missing ' + kk);
        }
      });
      (IR.param.filters || []).forEach(function (f, fi) {
        if (!f.column) errs.push('param filter' + fi + ': missing column');
        if (!f.parameter) errs.push('param filter' + fi + ': missing parameter');
        if (f.op && !Object.prototype.hasOwnProperty.call({ '==': 1, '=': 1, '!=': 1, '>': 1, '>=': 1, '<': 1, '<=': 1, contains: 1 }, f.op)) errs.push('param filter' + fi + ': unknown op ' + f.op);
      });
    }
    return errs;
  }

  return { compile: compile, validate: validate };
})();
