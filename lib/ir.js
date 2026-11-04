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

  // URL 安全口径：只允许相对路径（reportlets 相对名 / /webroot 路由 / #锚；scheme://、javascript:、
  // data:、file:、反斜杠、引号分号反引号、换行一律拒）。与 object.js checkRelUrl 同规：ir 层验形态，object 层强制。
  function isRelUrl(u) {
    var s = String(u == null ? '' : u);
    if (!s) return false;
    if (s.indexOf('\\') >= 0 || s.indexOf("'") >= 0 || s.indexOf('"') >= 0 || s.indexOf(';') >= 0 || s.indexOf('`') >= 0) return false;
    if (/[\r\n]/.test(s)) return false;
    if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(s)) return false;
    return true;
  }
  // 与 lib/object.js TOOLBAR_BUTTONS 键一致（安全批 B：className 逃生口已移除，IR 侧同报未知 kind）
  var TOOLBAR_KEYS = { export: 1, email: 1, print: 1, flashPrint: 1, newPrint: 1, printPreview: 1, pageSetup: 1,
    first: 1, previous: 1, pageNavi: 1, next: 1, last: 1, submit: 1, verify: 1 };

  // IR 结构自检 v3.10（2026-11-04 审计批 A 重构）：
  //   两层校验——结构层（容器/必填/类型）+ 语义层（跨对象引用完整性）。
  //   ① no-sheets/缺容器时短路返回，validator 自身不再被无效 IR 炸掉（审计 P1-2）；
  //   ② detail.link 校验独立成段（原实现困在 chart 分支出 return 之后，永不可达——审计 P1-1）；
  //   ③ multi-sheet IR 在此即报（backend 单 sheet，object.js v3.2 预留 throw——审计边界项）；
  //   ④ dataset/列/参数引用完整性（审计 P1-3）；kind=sql 数据集列名运行期可变，列级检查自动豁免；
  //   imageFile 本机路径钳制归 object 层（paths 单点在 runtime/paths.js，ir 层零依赖红线不可达 Paths）。
  function validate(IR) {
    var errs = [];
    // ===== 结构层 =====
    if (!IR || (typeof IR !== 'object') || Array.isArray(IR)) { errs.push('IR: not an object'); return errs; }
    if (!IR.sheets || !Array.isArray(IR.sheets) || !IR.sheets.length) { errs.push('no sheets'); return errs; }
    if (IR.sheets.length > 1) errs.push('multi-sheet unsupported（backend 单 sheet，v3.2 预留）');
    IR.sheets.forEach(function (s, si) {
      if (!s || typeof s !== 'object') { errs.push('sheet' + si + ': not an object'); return; }
      if (!s.blocks || !Array.isArray(s.blocks) || !s.blocks.length) { errs.push('sheet' + si + ': no blocks'); return; }
      var types = s.blocks.map(function (b) { return (b && b.type) || ''; });
      // v3.4：官方 basic 族首行是 titlebar（横条带标题+超链格）——用 cells 块承载
      if (types[0] !== 'title' && types[0] !== 'titlebar' && types[0] !== 'cells') errs.push('sheet' + si + ': first block must be title|titlebar|cells');
      // v3.4：cells 通用块家族（rawIR 官方重建）自带头/明细行，旧 header/detail 硬性要求不适用
      if (types.indexOf('cells') < 0) {
        if (types.indexOf('header') < 0) errs.push('sheet' + si + ': missing header block');
        if (types.indexOf('detail') < 0) errs.push('sheet' + si + ': missing detail block');
      }
      s.blocks.forEach(function (b, bi) {
        if (!b || typeof b !== 'object') { errs.push('sheet' + si + ' block' + bi + ': not an object'); return; }
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
            if (!it || typeof it !== 'object') { errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': not an object'); return; }
            if (typeof it.c !== 'number') errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': missing c');
            if (it.linkTo && !it.linkTo.reportlet && !(it.linkTo.web && it.linkTo.web.url)) errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': linkTo needs reportlet or web.url');
            if (it.linkTo && it.linkTo.web && it.linkTo.web.url && !isRelUrl(it.linkTo.web.url)) errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': linkTo.web.url must be relative (安全只相对路径)');
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
    if (!Array.isArray(IR.datasets) || !IR.datasets.length) errs.push('no datasets');
    // v3.5 数据集两形态：kind=sql（连接名 + 模板内置 SQL）/ 默认自包含（columns+rows）
    (Array.isArray(IR.datasets) ? IR.datasets : []).forEach(function (ds, di) {
      if (!ds || typeof ds !== 'object') { errs.push('dataset' + di + ': not an object'); return; }
      if (ds.kind === 'sql') {
        if (!ds.connection) errs.push('dataset' + di + ': sql needs connection');
        if (!ds.query) errs.push('dataset' + di + ': sql needs query');
      } else if (!ds.columns || !ds.rows) errs.push('dataset' + di + ': embedded needs columns+rows');
    });
    var CHART_KINDS = { bar: 1, pie: 1, line: 1, vbar: 1, vline: 1, varea: 1, vscatter: 1, vpie: 1, vgauge: 1 };
    // v4.1 新增能力族校验：富文本/公式显示/浮层/水印/工具栏（容器逐层防护）
    IR.sheets.forEach(function (s, si) {
      (s.floats || []).forEach(function (fl, fi) {
        if (!fl || typeof fl !== 'object') { errs.push('sheet' + si + ' float' + fi + ': not an object'); return; }
        if (!fl.text && !fl.rich && !fl.imageFile) errs.push('sheet' + si + ' float' + fi + ': needs text | rich | imageFile');
        if (fl.rich && !fl.rich.length) errs.push('sheet' + si + ' float' + fi + ': rich empty');
        ['leftPt', 'topPt', 'widthPt', 'heightPt'].forEach(function (k) {
          if (fl[k] != null && typeof fl[k] !== 'number') errs.push('sheet' + si + ' float' + fi + ': ' + k + ' must be number');
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
      else IR.toolbar.buttons.forEach(function (b, bi) {
        var key = (typeof b === 'string') ? b : (b && b.kind);
        if (!key || !TOOLBAR_KEYS[key]) errs.push('toolbar button' + bi + ': unknown kind ' + key + '（className 逃生口已移除，安全批 B）');
      });
    }
    // ===== 语义层（跨对象引用完整性——审计 P1-3；容器级防护，结构层报过的不再阻断此处）=====
    var dsArr = Array.isArray(IR.datasets) ? IR.datasets : [];
    var dsIdx = {};
    dsArr.forEach(function (ds) { if (ds && ds.name != null) dsIdx[ds.name] = ds; });
    function dsCols(ds) {
      var o = {};
      if (ds && ds.kind !== 'sql' && Array.isArray(ds.columns)) ds.columns.forEach(function (c) { if (c && c.name != null) o[c.name] = 1; });
      return o;
    }
    IR.sheets.forEach(function (s, si) {
      if (!s || !Array.isArray(s.blocks)) return;
      s.blocks.forEach(function (b, bi) {
        if (!b || typeof b !== 'object') return;
        // 数据集引用存在性（detail/chart）
        if ((b.type === 'detail' || b.type === 'chart') && b.dataset != null && dsIdx[b.dataset] == null)
          errs.push('sheet' + si + ' block' + bi + ': unknown dataset "' + b.dataset + '"');
        // detail.link 校验独立成段（原困在 chart 分支内永不可达——审计 P1-1）
        if (b.type === 'detail' && b.link) {
          if (!b.link.reportlet) errs.push('sheet' + si + ' block' + bi + ': link needs reportlet path');
          if (b.link.by != null && (b.columns || []).some(function (c) { return c && c.name === b.link.by; }) === false)
            errs.push('sheet' + si + ' block' + bi + ': link.by not in detail columns');
        }
        // 图表列成员校验（kind=sql 数据集列名运行期可变 → 列级检查豁免）
        if (b.type === 'chart') {
          if (!CHART_KINDS[b.kind]) errs.push('sheet' + si + ' block' + bi + ': unknown chart kind ' + b.kind);
          if (b.kind === 'vscatter') {
            if (!b.dataset || !b.x || !b.y) errs.push('sheet' + si + ' block' + bi + ': scatter chart needs dataset/x/y');
          } else if (!b.dataset || !b.category || !(b.value || (b.values && b.values.length))) {
            errs.push('sheet' + si + ' block' + bi + ': chart needs dataset/category/(value|values)');
          }
          var colOk = dsCols(dsIdx[b.dataset]);
          var colOkAny = false;
          for (var ck2 in colOk) { colOkAny = true; break; }
          if (colOkAny) {
            if (b.category != null && !colOk[b.category]) errs.push('sheet' + si + ' block' + bi + ': chart category not in dataset columns: ' + b.category);
            var vstrs = [];
            if (b.value != null) vstrs.push(b.value);
            (b.values || []).forEach(function (v) { if (v != null) vstrs.push(v); });
            if (b.x != null) vstrs.push(b.x);
            if (b.y != null) vstrs.push(b.y);
            vstrs.forEach(function (v) {
              if (typeof v === 'string' && !colOk[v]) errs.push('sheet' + si + ' block' + bi + ': chart column not in dataset columns: ' + v);
            });
          }
        }
        // cells item 数据集引用（对象形态：真绑定名 = it.ds.ds || b.dataset；字符串形态为历史语义遗留，
        // object 层 putDSCell 对其 column=undefined 的消费至今零回归，故不在 ir 层断言——2026-11-04 校准）
        if (b.type === 'cells' && Array.isArray(b.items)) {
          b.items.forEach(function (it, ii) {
            if (it && typeof it.ds === 'object' && it.ds != null) {
              var dsn = it.ds.ds || b.dataset;
              if (dsn != null && dsIdx[dsn] == null)
                errs.push('sheet' + si + ' block' + bi + ' item' + ii + ': unknown dataset "' + dsn + '"');
            }
          });
        }
      });
    });
    // v3.9 面板控件家族校验：date=DateEditor / combo=ComboBox+CustomDictionary / nav=FreeButton+click JS
    var KINDS = { label: 1, editor: 1, date: 1, combo: 1, nav: 1, submit: 1,
      number: 1, textarea: 1, radio: 1, checkbox: 1, combocheck: 1, treecombo: 1, iframe: 1 };
    if (IR.param) {
      if (!IR.param.widgets || !Array.isArray(IR.param.widgets) || !IR.param.widgets.length) errs.push('param: no widgets');
      else {
        var pnames = {};
        IR.param.widgets.forEach(function (w) { if (w && typeof w === 'object' && w.name != null) pnames[w.name] = 1; });
        IR.param.widgets.forEach(function (w, wi) {
          if (!w || typeof w !== 'object') { errs.push('param widget' + wi + ': not an object'); return; }
          if (!KINDS[w.kind]) errs.push('param widget' + wi + ': unknown kind ' + w.kind);
          if ((w.kind === 'editor' || w.kind === 'date' || w.kind === 'combo' || w.kind === 'number'
            || w.kind === 'textarea' || w.kind === 'radio' || w.kind === 'checkbox'
            || w.kind === 'combocheck' || w.kind === 'treecombo') && !w.name) errs.push('param widget' + wi + ': editor-like kind needs name (=参数名)');
          if ((w.kind === 'combo' || w.kind === 'radio' || w.kind === 'checkbox'
            || w.kind === 'combocheck' || w.kind === 'treecombo') && (!w.values || !w.values.length)) errs.push('param widget' + wi + ': ' + w.kind + ' needs values');
          if (w.kind === 'nav') {
            if (!w.url) errs.push('param widget' + wi + ': nav needs url');
            else if (!isRelUrl(w.url)) errs.push('param widget' + wi + ': nav url must be relative (安全只相对路径)');
          }
          if (w.kind === 'iframe') {
            if (!w.url && !w.text) errs.push('param widget' + wi + ': iframe needs url');
            else {
              var iu = (w.url != null ? w.url : w.text);
              if (iu && !isRelUrl(iu)) errs.push('param widget' + wi + ': iframe url must be relative (安全只相对路径)');
            }
          }
          for (var k = 0; k < ['x', 'y', 'w', 'h'].length; k++) {
            var kk = ['x', 'y', 'w', 'h'][k];
            if (typeof w[kk] !== 'number') errs.push('param widget' + wi + ': missing ' + kk);
          }
        });
        var hasEmbedded = dsArr.some(function (ds) { return ds && ds.kind !== 'sql'; });
        (IR.param.filters || []).forEach(function (f, fi) {
          if (!f || typeof f !== 'object') { errs.push('param filter' + fi + ': not an object'); return; }
          if (!f.column) errs.push('param filter' + fi + ': missing column');
          if (!f.parameter) errs.push('param filter' + fi + ': missing parameter');
          if (f.op && !Object.prototype.hasOwnProperty.call({ '==': 1, '=': 1, '!=': 1, '>': 1, '>=': 1, '<': 1, '<=': 1, contains: 1 }, f.op)) errs.push('param filter' + fi + ': unknown op ' + f.op);
          if (f.parameter != null && !pnames[f.parameter]) errs.push('param filter' + fi + ': parameter not a defined widget name: ' + f.parameter);
          if (f.column != null && hasEmbedded) {
            var colAny = dsArr.some(function (ds) { return ds && ds.kind !== 'sql' && dsCols(ds)[f.column]; });
            if (!colAny) errs.push('param filter' + fi + ': column not in any embedded dataset: ' + f.column);
          }
        });
      }
    }
    return errs;
  }

  return { compile: compile, validate: validate };
})();
