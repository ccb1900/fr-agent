// lib/spec_validator.js — I1（r2.md）ReportSpec 结构+语义校验（三职责之二：只查合法性，不产 IR）
//   契约完全沿用 I0-01 ir.js：错误 = {code, path(JSON 路径), message}；对任意坏输入只产诊断、绝不抛。
//   红线：本文件不被 ir.js 引用（现有 ir.js 不被 ReportSpec 逻辑污染，r2 §1.2）；单向依赖 ReportSpec 词表。
//   ES5：全 var + function；白名单查表 Object.prototype.hasOwnProperty.call；数值 isFinite 闸；对象拒数组。
var SpecValidator = (function () {
  function E(errs, code, path, message) { errs.push({ code: code, path: path, message: message }); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isArr(v) { return Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isStr(v) { return typeof v === 'string'; }

  // outName 会被 runner 拼成 <outName>_api.cpt 落部署目录——禁路径分隔/穿越/盘符/控制符，
  //   落实 r2 §1.3 "不允许 Agent 指定任意文件系统输出位置"（目录由 BR_DEPLOYDIR env 控，spec 无权指路径）。
  var OUTNAME_BAD = /[\/\\:*?"<>|]|\.\.|[\r\n]/;

  // presentation 校验单点（I1.1 r4 P2）：两分支共用——此前 sql 分支提前 return，showTotal/heightsPt/type
  //   的类型错误在 sql 路无人校验；且 rows 路 compiler 根本不读 presentation.chart（静默忽略=静默少图），
  //   必须在这里明确拒，而不是让用户以为图出了。keys 白名单同样防"写了没人管"的静默丢失。
  var PRESENTATION_KEYS = { type: 1, showTotal: 1, heightsPt: 1, chart: 1, footnote: 1, conditions: 1, cells: 1, total: 1 };  // 2026-11-06 B1/B3/B6：conditions/cells/total(多列求和)
  // 2026-11-07（阶段4 批2-③）：kind 词表单点=Ir.CAPABILITIES——此前两表为手抄闭集，注释声称
  //   "与 Ir.CAPABILITIES.param 同源"实为人工复制且已漂移（IR param 有 filter 注记而此表无）。
  //   机器判据（.zcode/verify/phase4_gate.sh C11）：向 Ir.capabilities() 注入假 param/chart kind 后
  //   validate() 必须零手改放行（词表在 validate 期从 IR 现取，不是 load 期快照）；未知 kind 仍 INVALID_ENUM。
  //   fallback：ir.js 未加载时退回既有字面表（不静默放宽、不整体失效）。
  var PARAM_KINDS_FALLBACK = { label: 1, editor: 1, date: 1, combo: 1, number: 1, textarea: 1, radio: 1, checkbox: 1, combocheck: 1, treecombo: 1, nav: 1, iframe: 1, submit: 1 };
  var CHART_KINDS_FALLBACK = { bar: 1, pie: 1, line: 1, vbar: 1, vline: 1, varea: 1, vscatter: 1, vbubble: 1, vpie: 1, vgauge: 1, vmap: 1, vheatmap: 1, vradar: 1, vfunnel: 1, vbox: 1, bar3d: 1, pie3d: 1, area3d: 1, donut: 1, donut3d: 1, vmultipie: 1 };
  // spec 层对 IR param 词表的唯一刻意收窄（一处声明，不靠手抄全集）：IR param.filter 是
  //   param.filters 能力注记（非控件 kind，object.buildWidget 无此臂）；spec 的执行期筛选走
  //   params[].filter 配置键。除此之外 IR param 新增 kind 自动进入 spec 词表。
  var SPEC_PARAM_KIND_EXCLUDED = { filter: 1 };
  function paramKinds() {
    try {
      if (typeof Ir !== 'undefined' && Ir.capabilities) {
        var cap = Ir.capabilities();
        if (cap && cap.param) {
          var out = {};
          Object.keys(cap.param).forEach(function (k) {
            if (typeof cap.param[k] === 'string' && !SPEC_PARAM_KIND_EXCLUDED[k]) out[k] = 1;
          });
          return out;
        }
      }
    } catch (eIr) { /* ir 未加载/词表异常：退 fallback，不抛 */ }
    return PARAM_KINDS_FALLBACK;
  }
  function chartKinds() {
    try {
      if (typeof Ir !== 'undefined' && Ir.capabilities) {
        var c = Ir.capabilities().chart;
        if (c && c.legacy && c.vanChart) {
          var out = {};
          c.legacy.forEach(function (k) { out[k] = 1; });
          c.vanChart.forEach(function (k) { out[k] = 1; });
          return out;
        }
      }
    } catch (eIr2) { /* 同上 */ }
    return CHART_KINDS_FALLBACK;
  }
  // 审查轮1 P2：param 键白名单（写进 spec 但不被 buildParam 转发 = 静默丢；此表与 buildParam 转发面一一对应）
  var PARAM_KEYS = { kind: 1, name: 1, label: 1, text: 1, value: 1, values: 1, reg: 1, url: 1, bold: 1, sizePt: 1, allowDecimals: 1, maxValue: 1, minValue: 1, filter: 1 };
  // 2026-11-06（B3/B4）：sheet 级扩展键白名单（headerFooter/floats/paper=sheet 级；watermark/toolbar=workbook 级但写在 sheet 对象里便于阅读）
  var SHEET_KEYS = { headerFooter: 1, floats: 1, paper: 1, watermark: 1, toolbar: 1, hideRows: 1, hideCols: 1 };  // 2026-11-06 C2：隐藏行列（行高/列宽归零）
  // 2026-11-06（B5）：chart 装饰键白名单（直通 IR chart 块；形态由 Ir.validate 逐键把关）
  var CHART_KEYS = { kind: 1, category: 1, value: 1, levels: 1, title: 1, heightPt: 1,
    tooltip: 1, label: 1, marker: 1, lineStyle: 1, trend: 1, stack: 1, conditions: 1,
    alpha: 1, bg: 1, border: 1, axisY: 1, axisX: 1, legend: 1, barInterval: 1,
    hotTooltip: 1, seriesBorder: 1, effect: 1, areaFill: 1, seriesImage: 1,
    mapLabel: 1, mapTooltip: 1, bubble: 1, hotHyperLink: 1,   // 批I 地图族+热链（2026-11-07，形态由 Ir.validate 逐键把关）
    x: 1, y: 1, bubbleSize: 1, geoUrl: 1, zoom: 1, longitude: 1, latitude: 1, mapType: 1, heat: 1 };  // D2 map 参数（area|point）+ 热力图 heat（2026-11-07）  // 2026-11-06 审查轮1 P2：散点/气泡的 x/y/bubbleSize 出口
  // r8 A2：sql 数据集列引用可带 {term,label,widthPt}（表头文案/列宽覆盖）；未知键明确拒，不静默忽略
  var REF_KEYS = { term: 1, label: 1, widthPt: 1 };
  // 2026-11-06 C1（475722d 后全局收口）：dataset 契约严格化——
  //   kind ∈ {rows,sql}（缺省=rows 兼容）；rows/sql 数据集键白名单；dimensions/metrics item 键白名单。
  //   既有明确拒（rows 路 sort/topN/dateRange/filters/query/source）保留原样，白名单跳过它们避免双报。
  var SQL_DS_KEYS = { kind: 1, entity: 1, connection: 1, schema: 1, dimensions: 1, metrics: 1, dateRange: 1, filters: 1, sort: 1, topN: 1, query: 1 };
  var ROWS_DS_SKIP = { kind: 1, rows: 1, sort: 1, topN: 1, dateRange: 1, filters: 1, query: 1, source: 1 };
  var DIM_KEYS = { field: 1, label: 1, widthPt: 1, format: 1 };
  var MET_KEYS = { field: 1, label: 1, aggregation: 1, dataType: 1, widthPt: 1, format: 1 };
  function validatePresentation(rs, errs, isSql) {
    if (rs.presentation == null) return;
    var pp = 'presentation';
    // 2026-11-06 复审3：rows 路表宽 = dimensions+metrics（plan 期即可拒落点超宽，不必等 compile 抛）
    var rowsN = isSql ? 0 : ((isArr(rs.dimensions) ? rs.dimensions.length : 0) + (isArr(rs.metrics) ? rs.metrics.length : 0));
    if (!isObj(rs.presentation)) { E(errs, 'INVALID_TYPE', pp, 'presentation must be an object'); return; }
    Object.keys(rs.presentation).forEach(function (k) {
      if (!hasOwn(PRESENTATION_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.' + k, 'presentation 无此键（' + Object.keys(PRESENTATION_KEYS).join('|') + '），写了不生效故拒');
    });
    if (rs.presentation.type != null && !hasOwn(ReportSpec.PRESENTATION_TYPES, rs.presentation.type)) E(errs, 'INVALID_ENUM', pp + '.type', 'presentation.type 越词表（v1 只 table）: ' + rs.presentation.type);
    if (rs.presentation.showTotal != null && typeof rs.presentation.showTotal !== 'boolean') E(errs, 'INVALID_TYPE', pp + '.showTotal', 'showTotal must be boolean');
    if (rs.presentation.footnote != null) {
      if (!isStr(rs.presentation.footnote) || rs.presentation.footnote === '') E(errs, 'INVALID_TYPE', pp + '.footnote', 'footnote 须非空字符串（脚注文案）');
    }
    // 2026-11-06（B1）：conditions（单元格条件格式）——rows 路直通 IR detail 块级 conditions；
    //   形态细节由编译后的 Ir.validate(checkConditions) 二次把关，此处挡明显非法。
    if (rs.presentation.conditions != null) {
      if (!isArr(rs.presentation.conditions)) E(errs, 'INVALID_ARRAY', pp + '.conditions', 'conditions must be an array');
      else rs.presentation.conditions.forEach(function (c, ci) {
        var cp2 = pp + '.conditions[' + ci + ']';
        if (!isObj(c)) { E(errs, 'INVALID_TYPE', cp2, 'condition must be an object'); return; }
        if (!isObj(c.when)) E(errs, 'REQUIRED', cp2 + '.when', 'when must be an object');
        if (!isObj(c.then)) E(errs, 'REQUIRED', cp2 + '.then', 'then must be an object');
      });
    }
    // 2026-11-06（B3）：presentation.cells（额外 cells 块）——形态细节由 Ir.validate 把关。
    //   审查轮1 P2：spec 路 cells 块固定追加在 total 之后（绝对行号 r 必落在已占用区→ object 抛"倒退"），在此明确拒。
    if (rs.presentation.cells != null) {
      if (!isArr(rs.presentation.cells)) E(errs, 'INVALID_ARRAY', pp + '.cells', 'presentation.cells must be an array');
      else rs.presentation.cells.forEach(function (it, ii) {
        if (isObj(it) && it.r != null) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.cells[' + ii + '].r', 'presentation.cells 不支持绝对行号 r（块按块序追加）；需要定位请用 IR cells 块');
        // 2026-11-08：rowSpan 是相对当前块的多行合并（object 游标已计入），可安全表达
        if (isObj(it) && it.rowSpan != null) {
          if (!isNum(it.rowSpan) || it.rowSpan !== Math.floor(it.rowSpan) || it.rowSpan < 1) E(errs, 'INVALID_NUMBER', pp + '.cells[' + ii + '].rowSpan', 'rowSpan 须正整数');
        }
      });
    }
    // 2026-11-06（B6 + P1）：presentation.total{label?,sumCols[]|aggregate}（形态细节由 Ir.validate 把关）
    var TOTAL_KEYS = { label: 1, sumCols: 1, aggregate: 1 };
    var SUMCOL_KEYS = { col: 1, fn: 1, formula: 1, format: 1, align: 1, bold: 1, bg: 1, sizePt: 1 };
    if (rs.presentation.total != null) {
      if (!isObj(rs.presentation.total)) E(errs, 'INVALID_TYPE', pp + '.total', 'total must be an object');
      else {
        Object.keys(rs.presentation.total).forEach(function (k) {
          if (!hasOwn(TOTAL_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.total.' + k, 'total 无此键（' + Object.keys(TOTAL_KEYS).join('|') + '），写了不生效故拒');
        });
        if (rs.presentation.total.label != null && !isStr(rs.presentation.total.label)) E(errs, 'INVALID_TYPE', pp + '.total.label', 'label must be string');
        if (rs.presentation.total.sumCols != null && rs.presentation.total.aggregate != null) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.total', 'sumCols 与 aggregate 互斥（object 优先 sumCols）');
        if (rs.presentation.total.sumCols != null && !isArr(rs.presentation.total.sumCols)) E(errs, 'INVALID_ARRAY', pp + '.total.sumCols', 'sumCols must be an array');
        else if (isArr(rs.presentation.total.sumCols)) {
          var seenCols = {};
          rs.presentation.total.sumCols.forEach(function (sc, si) {
            var sp2 = pp + '.total.sumCols[' + si + ']';
            if (!isObj(sc)) { E(errs, 'INVALID_TYPE', sp2, 'sumCols item must be an object'); return; }
            Object.keys(sc).forEach(function (k) {
              if (!hasOwn(SUMCOL_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', sp2 + '.' + k, 'sumCols item 无此键（' + Object.keys(SUMCOL_KEYS).join('|') + '），写了不生效故拒');
            });
            if (!isNum(sc.col)) E(errs, 'REQUIRED', sp2 + '.col', 'sumCols.col 需要数字列');
            else if (sc.col === 0) E(errs, 'UNSUPPORTED_CAPABILITY', sp2 + '.col', 'sumCols 不能用列 0（合计 label 占 c0）');
            else if (sc.col !== Math.floor(sc.col) || sc.col < 1 || sc.col > 25) E(errs, 'INVALID_NUMBER', sp2 + '.col', 'sumCols.col 须整数列 1..25');
            else if (seenCols[sc.col]) E(errs, 'DUPLICATE', sp2 + '.col', 'dup sumCols col ' + sc.col);
            else seenCols[sc.col] = 1;
            if (rowsN > 0 && isNum(sc.col) && sc.col >= rowsN) E(errs, 'INVALID_NUMBER', sp2 + '.col', 'sumCols.col ' + sc.col + ' 超出表宽 ' + rowsN + '（维度+度量）');
            // 2026-11-06 P1：逐格聚合 fn（缺省 sum；ratio 需两列，请用 formula 或 aggregate）
            if (sc.fn != null && !hasOwn({ sum: 1, avg: 1, count: 1, min: 1, max: 1 }, sc.fn)) E(errs, 'INVALID_ENUM', sp2 + '.fn', 'sumCols.fn 支持 sum|avg|count|min|max（ratio 用 formula/aggregate）');
            if (sc.fn != null && sc.formula != null) E(errs, 'UNSUPPORTED_CAPABILITY', sp2, 'sumCols.fn 与 formula 互斥（formula 优先，fn 写了不生效）');
            if (sc.formula != null && !isStr(sc.formula)) E(errs, 'INVALID_TYPE', sp2 + '.formula', 'formula must be string');
          });
        }
        // 2026-11-06 P1 复审：aggregate 与 IR 同词汇（ratio={num,den}；format 可覆盖分母列整数格式）
        if (rs.presentation.total.aggregate != null) {
          var ag = rs.presentation.total.aggregate, agp = pp + '.total.aggregate';
          if (!isObj(ag)) E(errs, 'INVALID_TYPE', agp, 'aggregate must be an object');
          else {
            var AGK = { fn: 1, col: 1, num: 1, den: 1, format: 1 };
            Object.keys(ag).forEach(function (k) {
              if (!hasOwn(AGK, k)) E(errs, 'UNSUPPORTED_CAPABILITY', agp + '.' + k, 'aggregate 无此键（' + Object.keys(AGK).join('|') + '）');
            });
            if (!hasOwn({ sum: 1, avg: 1, count: 1, min: 1, max: 1, ratio: 1 }, ag.fn)) E(errs, 'INVALID_ENUM', agp + '.fn', 'aggregate.fn 支持 sum|avg|count|min|max|ratio');
            if (ag.fn === 'ratio') {
              if (ag.col != null) E(errs, 'UNSUPPORTED_CAPABILITY', agp + '.col', 'ratio 用 num/den，不用 col');
            } else if (ag.num != null || ag.den != null) E(errs, 'UNSUPPORTED_CAPABILITY', agp + '.num', 'num/den 仅 ratio 使用（当前 fn 不用）');
            var aco = function (v, path, label) {
              if (!isNum(v)) { E(errs, 'REQUIRED', path, label + ' 需要数字列'); return; }
              if (v === 0) { E(errs, 'UNSUPPORTED_CAPABILITY', path, label + ' 不能用列 0（合计 label 占 c0）'); return; }
              if (v !== Math.floor(v) || v < 1 || v > 25) E(errs, 'INVALID_NUMBER', path, label + ' 须整数列 1..25');
            };
            if (ag.fn === 'ratio') {
              aco(ag.num, agp + '.num', 'ratio num');
              aco(ag.den, agp + '.den', 'ratio den');
            } else aco(ag.col, agp + '.col', 'aggregate.col');
            if (rowsN > 0) {
              var agc = (ag.fn === 'ratio') ? [ag.num, ag.den] : [ag.col];
              agc.forEach(function (ac) {
                if (isNum(ac) && ac >= rowsN) E(errs, 'INVALID_NUMBER', agp, '聚合列 ' + ac + ' 超出表宽 ' + rowsN + '（维度+度量）');
              });
            }
            if (ag.format != null && !isStr(ag.format)) E(errs, 'INVALID_TYPE', agp + '.format', 'aggregate.format must be string');
          }
        }
        if (rs.presentation.showTotal === false) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.total', 'showTotal=false 时 total 不发射（写了不生效故拒）');
      }
    }
    // 审查轮1 P1-A：cells/total 仅 rows 内嵌路编译；sql 路不读 = 静默丢 → 明确拒。
    //   2026-11-08（G3 业务验收）：conditions 已由 compileSql 发射到 detail 块（conditions: ...），
    //   旧拒绝口径与实际编译面不符 → 放开 sql 路 conditions（cells 仍拒，total 仍拒待专项证据）。
    if (isSql) {
      ['cells', 'total'].forEach(function (k) {
        if (rs.presentation[k] != null) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.' + k, pp + '.' + k + ' 仅 rows 内嵌数据集路支持（sql 路不发射）');
      });
    }
    if (rs.presentation.heightsPt != null) {
      if (!isObj(rs.presentation.heightsPt)) E(errs, 'INVALID_TYPE', pp + '.heightsPt', 'heightsPt must be an object');
      else ['title', 'header', 'row', 'total'].forEach(function (k) {
        if (rs.presentation.heightsPt[k] != null && !isNum(rs.presentation.heightsPt[k])) E(errs, 'INVALID_NUMBER', pp + '.heightsPt.' + k, k + ' must be a finite number');
      });
    }
    // chart：rows/sql 两路均可出图（2026-11-07 消除 SQL-only 限制；compileRows 发射 chart 块 dataset=dsName）
    if (rs.presentation.chart != null) {
      var chart = rs.presentation.chart;
      if (!isObj(chart)) { E(errs, 'INVALID_TYPE', pp + '.chart', 'chart 须对象'); return; }
      if (chart.kind != null && !hasOwn(chartKinds(), chart.kind)) E(errs, 'INVALID_ENUM', pp + '.chart.kind', 'chart.kind 不在词表（以 Ir.CAPABILITIES.chart legacy+vanChart 为准；当前含 bar|pie|line|bar3d|pie3d|area3d|donut|donut3d + Van v* 族）');
      // 2026-11-06 审查轮1 P2：散点/气泡走 x/y（IR 对这两种 kind 硬要求 x/y），其余走 category/value
      var ck = chart.kind || 'bar';
      if (ck === 'vmultipie') {
        if (!Array.isArray(chart.levels) || !chart.levels.length || !chart.levels.every(function (x) { return isStr(x) && x; })) E(errs, 'REQUIRED', pp + '.chart.levels', 'multipie 需要 chart.levels[]（层级维度别名，非空）');
        if (!isStr(chart.value) || !chart.value) E(errs, 'REQUIRED', pp + '.chart.value', 'multipie 需要 chart.value（度量别名）');
        if (chart.category != null) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.chart.category', 'multipie 用 levels，不用 category');
        ['x', 'y', 'bubbleSize'].forEach(function (k) { if (chart[k] != null) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.chart.' + k, k + ' 仅 vscatter/vbubble（写了不生效故拒）'); });
      } else if (ck === 'vscatter' || ck === 'vbubble') {
        if (!isStr(chart.x) || !chart.x) E(errs, 'REQUIRED', pp + '.chart.x', 'scatter/bubble 需要 chart.x（度量别名）');
        if (!isStr(chart.y) || !chart.y) E(errs, 'REQUIRED', pp + '.chart.y', 'scatter/bubble 需要 chart.y（度量别名）');
        if (chart.category != null) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.chart.category', 'scatter/bubble 不用 category（写了不生效故拒）');
        if (chart.value != null) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.chart.value', 'scatter/bubble 不用 value（写了不生效故拒）');
      } else {
        if (!isStr(chart.category) || !chart.category) E(errs, 'REQUIRED', pp + '.chart.category', 'chart.category 必填(维度别名)');
        if (!isStr(chart.value) || !chart.value) E(errs, 'REQUIRED', pp + '.chart.value', 'chart.value 必填(度量别名)');
        // 审查轮2：x/y/bubbleSize 只在散点/气泡分支被编译（其余 kind 写了会被丢）→ 拒
        ['x', 'y', 'bubbleSize'].forEach(function (k) {
          if (chart[k] != null) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.chart.' + k, k + ' 仅 vscatter/vbubble（写了不生效故拒）');
        });
      }
      Object.keys(chart).forEach(function (k) {
        if (!hasOwn(CHART_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', pp + '.chart.' + k, 'chart 无此键（写了不生效故拒；白名单 ' + Object.keys(CHART_KEYS).join('|') + '）');
      });
    }
  }

  // 2026-11-06 多 Sheet（A1 的 ReportSpec 入口）：extraSheets[] 追加 rows-only sheet；
  //   校验复用主逻辑（合成 spec 递归 + 错误路径前缀），name 必填唯一且不得占用基表 'sheet1'。
  //   复审 P1：必须对 rows/sql 两种基表都执行（此前 sql 分支提前 return 跳过）。
  function validateExtraSheets(rs, errs) {
    if (rs.extraSheets == null) return;
    if (!isArr(rs.extraSheets)) { E(errs, 'INVALID_ARRAY', 'extraSheets', 'extraSheets must be an array'); return; }
    // 复审 P2：多 sheet 的数据集名由编译器分配 ds1..，手写 dsName 会与 ds2 冲突（IR DUPLICATE，晚失败）
    if (rs.dsName != null) E(errs, 'UNSUPPORTED_CAPABILITY', 'dsName', '多 sheet 下数据集名由编译器分配（ds1..），不要手写 dsName');
    var seenSheet = Object.create(null);   // 复审：无原型表，'__proto__' 等键也作普通键
    seenSheet['sheet1'] = 1;
    rs.extraSheets.forEach(function (ex, xi) {
      var ep = 'extraSheets[' + xi + ']';
      if (!isObj(ex)) { E(errs, 'INVALID_TYPE', ep, 'extra sheet must be an object'); return; }
      var XKEYS = { name: 1, dimensions: 1, metrics: 1, dataset: 1, presentation: 1, sheet: 1 };
      Object.keys(ex).forEach(function (k) {
        if (!hasOwn(XKEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', ep + '.' + k, 'extra sheet 无此键（' + Object.keys(XKEYS).join('|') + '），写了不生效故拒');
      });
      if (!isStr(ex.name) || ex.name === '') E(errs, 'REQUIRED', ep + '.name', 'extra sheet needs name');
      else if (hasOwn(seenSheet, ex.name)) E(errs, 'DUPLICATE', ep + '.name', 'dup sheet name ' + ex.name);   // 复审 P2：原型链键不得误判
      else seenSheet[ex.name] = 1;
      // 复审 P2：watermark/toolbar 是 workbook 级且只从基表 sheet 读取——extra 写了会被静默丢 → 拒
      if (isObj(ex.sheet) && ex.sheet.watermark != null) E(errs, 'UNSUPPORTED_CAPABILITY', ep + '.sheet.watermark', 'watermark 是 workbook 级（写在基表 sheet）');
      if (isObj(ex.sheet) && ex.sheet.toolbar != null) E(errs, 'UNSUPPORTED_CAPABILITY', ep + '.sheet.toolbar', 'toolbar 是 workbook 级（写在基表 sheet）');
      // 2026-11-07：SQL extra 放开（compileSql 已支持 opts{dsName,sheetName}；make_api deps 触发见 compile）
      if (false) E(errs, 'UNSUPPORTED_CAPABILITY', ep + '.dataset.kind', '');
      var synth = { outName: 'extra_sheet', dimensions: ex.dimensions, metrics: ex.metrics, dataset: ex.dataset, presentation: ex.presentation, sheet: ex.sheet };
      validate(synth).forEach(function (e2) {
        E(errs, e2.code, ep + (e2.path === 'spec' ? '' : '.' + e2.path), e2.message);
      });
    });
  }

  function validate(rs) {
    var errs = [];
    if (!isObj(rs)) { E(errs, 'INVALID_TYPE', 'spec', 'ReportSpec must be an object'); return errs; }

    // 2026-11-06（B3/B4）：sheet 级扩展键白名单 + presentation.cells 形态（细节由 Ir.validate 把关）
    if (rs.sheet != null) {
      if (!isObj(rs.sheet)) E(errs, 'INVALID_TYPE', 'sheet', 'sheet must be an object');
      else Object.keys(rs.sheet).forEach(function (k) {
        if (!hasOwn(SHEET_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', 'sheet.' + k, 'sheet 无此键（' + Object.keys(SHEET_KEYS).join('|') + '），写了不生效故拒');
      });
      if (rs.sheet && isObj(rs.sheet)) {
        // 2026-11-06（C2）：hideRows/hideCols 必须是非负整数数组（IR 层同闸）
        ['hideRows', 'hideCols'].forEach(function (hk) {
          if (rs.sheet[hk] == null) return;
          if (!isArr(rs.sheet[hk])) { E(errs, 'INVALID_ARRAY', 'sheet.' + hk, hk + ' must be an array'); return; }
          rs.sheet[hk].forEach(function (x, xi) {
            if (!isNum(x) || x !== Math.floor(x) || x < 0) E(errs, 'INVALID_NUMBER', 'sheet.' + hk + '[' + xi + ']', hk + ' items must be non-negative integers');
          });
        });
      }
    }

    // 2026-11-06（B2）：params（参数面板控件族，rows/sql 两路共用）——kind 白名单、name 必填且唯一、value 标量；filter 由 compiler 消费（不转发 widget）
    if (rs.params != null) {
      if (!isArr(rs.params)) E(errs, 'INVALID_ARRAY', 'params', 'params must be an array');
      else {
        var seenNames = Object.create(null);   // 无原型表：'__proto__' 参数名也按普通键计
        rs.params.forEach(function (p, pi) {
          var pp2 = 'params[' + pi + ']';
          if (!isObj(p)) { E(errs, 'INVALID_TYPE', pp2, 'param must be an object'); return; }
          if (!isStr(p.kind) || !hasOwn(paramKinds(), p.kind)) E(errs, 'INVALID_ENUM', pp2 + '.kind', 'param.kind 越词表: ' + Object.keys(paramKinds()).join('|') + '（词表=Ir.CAPABILITIES.param 减 spec 收窄）');
          Object.keys(p).forEach(function (pk) {
            if (!hasOwn(PARAM_KEYS, pk)) E(errs, 'UNSUPPORTED_CAPABILITY', pp2 + '.' + pk, 'param 无此键（' + Object.keys(PARAM_KEYS).join('|') + '），写了不生效故拒');
          });
          if (p.kind !== 'label' && p.kind !== 'submit' && (!isStr(p.name) || p.name === '')) E(errs, 'REQUIRED', pp2 + '.name', 'param needs name（除 label/submit）');
          if (isStr(p.name) && p.name) {
            if (seenNames[p.name]) E(errs, 'DUPLICATE', pp2 + '.name', 'dup param name ' + p.name);
            seenNames[p.name] = 1;
          }
          if (p.value != null && typeof p.value === 'object') E(errs, 'INVALID_TYPE', pp2 + '.value', 'value must be scalar');
          // 审查轮1 P2：submit 需要可见文案（object 层 new FormSubmitButton(undefined) 会落空按钮）；
          //   values 必须是标量数组（object 直接按数组下标读，字符串会被拆成字符项）
          if (p.kind === 'submit' && !isStr(p.text) && !isStr(p.label)) E(errs, 'REQUIRED', pp2 + '.text', 'submit needs text（按钮文案）');
          if (p.values != null) {
            if (!isArr(p.values)) E(errs, 'INVALID_ARRAY', pp2 + '.values', 'values must be an array');
            else p.values.forEach(function (vv, vi) {
              if (vv != null && typeof vv === 'object') E(errs, 'INVALID_TYPE', pp2 + '.values[' + vi + ']', 'values items must be scalars');
            });
          }
          // 2026-11-06 参数执行期筛选（rows 内嵌路）：filter{column,op?} → IR.param.filters（object 挂单元格条件）
          if (p.filter != null) {
            if (!isObj(p.filter)) E(errs, 'INVALID_TYPE', pp2 + '.filter', 'filter must be an object');
            else {
              Object.keys(p.filter).forEach(function (fk) {
                if (fk !== 'column' && fk !== 'op') E(errs, 'UNSUPPORTED_CAPABILITY', pp2 + '.filter.' + fk, 'filter keys: column|op');
              });
              if (!isStr(p.filter.column) || p.filter.column === '') E(errs, 'REQUIRED', pp2 + '.filter.column', 'filter.column required');
              if (p.filter.op != null && !hasOwn({ '==': 1, '=': 1, '!=': 1, '>': 1, '>=': 1, '<': 1, '<=': 1, contains: 1 }, p.filter.op)) E(errs, 'INVALID_ENUM', pp2 + '.filter.op', 'filter.op 白名单 ==|=|!=|>|>=|<|<=|contains');
              if (rs.dataset && isObj(rs.dataset) && rs.dataset.kind === 'sql') E(errs, 'UNSUPPORTED_CAPABILITY', pp2 + '.filter', '参数筛选仅 rows 内嵌数据集生效（sql 路单元格条件不适用）');
              if (p.kind === 'label' || p.kind === 'submit') E(errs, 'REQUIRED', pp2 + '.name', 'filter 需要具名参数（非 label/submit）');
            }
          }
        });
        var nFilters = rs.params.filter(function (p) { return p && isObj(p) && p.filter != null; }).length;
        if (nFilters > 1) E(errs, 'UNSUPPORTED_CAPABILITY', 'params', '多 filter AND 组合未验证（DSColumn 单条件），暂限 1 条');
      }
    }

    // 版本契约（ir.js 同纪律：认当前版、拒未知、缺省=当前版）
    if (rs.specVersion != null && String(rs.specVersion) !== ReportSpec.SPEC_VERSION) {
      E(errs, 'UNSUPPORTED_SPEC_VERSION', 'specVersion', 'unsupported specVersion "' + rs.specVersion + '"（本 backend 只识别 specVersion="' + ReportSpec.SPEC_VERSION + '"）');
      return errs;
    }

    // A段 P2c（2026-11-07）：顶层键白名单——拼写错（dimensons/presentaton）与随手多写的键此前被编译器静默丢，
    //   报表口径悄悄变窄比失败更危险（与 C1 dataset/params/presentation 键白名单同一立论）。
    //   filters/chart 走下方"存在即报"的既有明确拒（跳过防双报）。
    var TOP_KEYS = { specVersion: 1, outName: 1, report: 1, dimensions: 1, metrics: 1, dataset: 1, presentation: 1, params: 1, sheet: 1, extraSheets: 1 };
    Object.keys(rs).forEach(function (k) {
      if (k === 'filters' || k === 'chart') return;
      if (!hasOwn(TOP_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', k, 'spec 顶层无此键（' + Object.keys(TOP_KEYS).join('|') + '），写了不生效故拒——拼写错请对照词表');
    });

    // v1 明确拒的能力键（存在即报，指向应接管的迭代——不是静默忽略）
    if (hasOwn(rs, 'filters')) E(errs, 'UNSUPPORTED_CAPABILITY', 'filters', 'filters 暂不支持（' + ReportSpec.capabilities().filters + ' → ' + ReportSpec.REJECTED.filters + '）');
    if (hasOwn(rs, 'chart')) E(errs, 'UNSUPPORTED_CAPABILITY', 'chart', 'chart 暂不支持（' + ReportSpec.capabilities().chart + ' → ' + ReportSpec.REJECTED.chart + '）');

    // report（可选元信息；name 用作 IR title）
    if (rs.report != null) {
      if (!isObj(rs.report)) E(errs, 'INVALID_TYPE', 'report', 'report must be an object');
      else if (rs.report.name != null && !isStr(rs.report.name)) E(errs, 'INVALID_TYPE', 'report.name', 'report.name must be string');
    }

    // outName 必填 + 路径安全
    if (rs.outName == null) E(errs, 'REQUIRED', 'outName', 'outName is required');
    else if (!isStr(rs.outName)) E(errs, 'INVALID_TYPE', 'outName', 'outName must be a string');
    else if (rs.outName === '') E(errs, 'REQUIRED', 'outName', 'outName must not be empty');
    else if (OUTNAME_BAD.test(rs.outName)) E(errs, 'INVALID_PATH', 'outName', 'outName must be a bare file name (no path/.. /drive): ' + rs.outName);

    // ---- I5：SQL 数据集（模型驱动）形态 ----
    // C1：dataset.kind 词表闸（先于分支选择——非法 kind 不再落错分支、不再被静默当 rows）
    if (rs.dataset && isObj(rs.dataset) && rs.dataset.kind != null) {
      if (!isStr(rs.dataset.kind) || !hasOwn(ReportSpec.DATASET_KINDS, rs.dataset.kind))
        E(errs, 'INVALID_ENUM', 'dataset.kind', 'dataset.kind 越词表（rows|sql，缺省=rows）: ' + JSON.stringify(rs.dataset.kind));
    }
    if (rs.dataset && isObj(rs.dataset) && rs.dataset.kind === 'sql') {
      var ds = rs.dataset;
      Object.keys(ds).forEach(function (k) {
        if (!hasOwn(SQL_DS_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset.' + k, 'sql 数据集无此键（' + Object.keys(SQL_DS_KEYS).join('|') + '），写了不生效故拒');
      });
      if (ds.query != null) E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset.query', '禁自由文本 SQL（§5.2）；须用 model 维度/指标引用由 sqlbuilder 生成');
      if (!isStr(ds.entity) || !ds.entity) E(errs, 'REQUIRED', 'dataset.entity', 'sql 数据集需 entity（模型实体名）');
      if (!isStr(ds.connection) || !ds.connection) E(errs, 'REQUIRED', 'dataset.connection', 'sql 数据集需 connection（数据连接名，凭据不在此）');
      var anySel = false;
      ['dimensions', 'metrics'].forEach(function (key) {
        var arr = ds[key];
        if (arr == null) return;
        if (!isArr(arr) || !arr.length) { E(errs, 'INVALID_ARRAY', 'dataset.' + key, key + ' 须非空数组（模型维度/指标名）'); return; }
        anySel = anySel || arr.length > 0;
        arr.forEach(function (x, i) {
          var name = isStr(x) ? x : (isObj(x) ? x.term : null);
          if (!isStr(name) || !name) E(errs, 'REQUIRED', 'dataset.' + key + '[' + i + ']', '须为模型 ' + key + ' 名（字符串或 {term}）');
          if (isObj(x)) {
            Object.keys(x).forEach(function (k) {
              if (!hasOwn(REF_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset.' + key + '[' + i + '].' + k, '列引用只允许 term|label|widthPt（写了不生效故拒）');
            });
            if (x.label != null && (!isStr(x.label) || x.label === '')) E(errs, 'INVALID_TYPE', 'dataset.' + key + '[' + i + '].label', 'label 须非空字符串');
            if (x.widthPt != null && !isNum(x.widthPt)) E(errs, 'INVALID_NUMBER', 'dataset.' + key + '[' + i + '].widthPt', 'widthPt 须有限数');
          }
        });
      });
      if (!anySel) E(errs, 'REQUIRED', 'dataset', 'sql 数据集至少选一个维度或指标');
      if (ds.dateRange != null) {
        var dr = IsoDate.range(ds.dateRange);   // I5.1 P4 单点：严格双边 + 日历有效性 + from<=to（与 sqlbuilder 同一真相）
        dr.errors.forEach(function (e) { E(errs, e.code, 'dataset.' + e.path, e.message); });
      }
      // I5.3-A sort / topN 形状（语义正确性由 sqlbuilder 兜底，这里挡明显非法入参）
      if (ds.sort != null) {
        if (!isArr(ds.sort) || !ds.sort.length) E(errs, 'INVALID_ARRAY', 'dataset.sort', 'sort 须非空数组');
        else ds.sort.forEach(function (s, i) {
          if (!isObj(s) || !isStr(s.field) || !s.field) E(errs, 'REQUIRED', 'dataset.sort[' + i + ']', 'sort 项须 {field}');
          else if (s.dir != null && s.dir !== 'asc' && s.dir !== 'desc') E(errs, 'INVALID_ENUM', 'dataset.sort[' + i + '].dir', 'sort.dir 只 asc|desc');
        });
      }
      if (ds.topN != null) {
        var tn = isObj(ds.topN) ? ds.topN.n : ds.topN;
        if (!(isNum(tn) && tn > 0 && Math.floor(tn) === tn)) E(errs, 'INVALID_NUMBER', 'dataset.topN', 'topN 须正整数');
      }
      // I5.3-B filters 形状（值安全由 sqlbuilder 受控字面量兜底）
      if (ds.filters != null) {
        if (!isArr(ds.filters) || !ds.filters.length) E(errs, 'INVALID_ARRAY', 'dataset.filters', 'filters 须非空数组');
        else ds.filters.forEach(function (f, i) {
          if (!isObj(f)) { E(errs, 'INVALID_TYPE', 'dataset.filters[' + i + ']', 'filter 须对象'); return; }
          if (!isStr(f.field) || !f.field) E(errs, 'REQUIRED', 'dataset.filters[' + i + '].field', 'filter.field 必填');
          if (f.value == null || f.value === '') E(errs, 'REQUIRED', 'dataset.filters[' + i + '].value', 'filter.value 必填');
        });
      }
      // I5.3-C chart 形状（kind 限 legacy 图种；category/value 为已选列别名，编译期由 spec_compiler 校验）
      //   I1.1：presentation 全套校验走共享函数（与 rows 路一处真相，不再提前 return 跳过）
      validatePresentation(rs, errs, true);
      validateExtraSheets(rs, errs);   // 复审 P1：sql 基表同样要校验 extras（不再提前 return 绕过）
      return errs;
    }

    // dimensions（分组键，恒 text）
    if (!hasOwn(rs, 'dimensions')) E(errs, 'REQUIRED', 'dimensions', 'dimensions is required');
    else if (!isArr(rs.dimensions)) E(errs, 'INVALID_ARRAY', 'dimensions', 'dimensions must be an array');
    else if (!rs.dimensions.length) E(errs, 'REQUIRED', 'dimensions', 'dimensions must not be empty');
    else rs.dimensions.forEach(function (d, i) {
      var dp = 'dimensions[' + i + ']';
      if (!isObj(d)) { E(errs, 'INVALID_TYPE', dp, 'dimension must be an object'); return; }
      // C1：dimension item 键白名单（aggregation 由既有 INVALID_ENUM 专报，跳过避免双报）
      Object.keys(d).forEach(function (k) {
        if (k === 'aggregation') return;
        if (!hasOwn(DIM_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', dp + '.' + k, 'dimension 无此键（' + Object.keys(DIM_KEYS).join('|') + '），写了不生效故拒');
      });
      if (!isStr(d.field) || d.field === '') E(errs, 'REQUIRED', dp + '.field', 'dimension.field required (non-empty string)');
      if (!isStr(d.label) || d.label === '') E(errs, 'REQUIRED', dp + '.label', 'dimension.label required');
      if (d.aggregation != null) E(errs, 'INVALID_ENUM', dp + '.aggregation', 'dimension must not carry aggregation（分组键非度量）');
      if (d.widthPt != null && !isNum(d.widthPt)) E(errs, 'INVALID_NUMBER', dp + '.widthPt', 'widthPt must be a finite number');
      if (d.format != null && !isStr(d.format)) E(errs, 'INVALID_TYPE', dp + '.format', 'format must be string');
    });

    // metrics（度量，aggregation v1=sum-only）
    if (!hasOwn(rs, 'metrics')) E(errs, 'REQUIRED', 'metrics', 'metrics is required');
    else if (!isArr(rs.metrics)) E(errs, 'INVALID_ARRAY', 'metrics', 'metrics must be an array');
    else if (!rs.metrics.length) E(errs, 'REQUIRED', 'metrics', 'metrics must not be empty');
    else rs.metrics.forEach(function (m, i) {
      var mp = 'metrics[' + i + ']';
      if (!isObj(m)) { E(errs, 'INVALID_TYPE', mp, 'metric must be an object'); return; }
      // C1：metric item 键白名单
      Object.keys(m).forEach(function (k) {
        if (!hasOwn(MET_KEYS, k)) E(errs, 'UNSUPPORTED_CAPABILITY', mp + '.' + k, 'metric 无此键（' + Object.keys(MET_KEYS).join('|') + '），写了不生效故拒');
      });
      if (!isStr(m.field) || m.field === '') E(errs, 'REQUIRED', mp + '.field', 'metric.field required');
      if (!isStr(m.label) || m.label === '') E(errs, 'REQUIRED', mp + '.label', 'metric.label required');
      if (m.aggregation == null) E(errs, 'REQUIRED', mp + '.aggregation', 'metric.aggregation required (sum in v1)');
      else if (hasOwn(ReportSpec.AGGREGATIONS, m.aggregation)) { /* ok */ }
      else if (hasOwn(ReportSpec.AGG_UNIMPLEMENTED, m.aggregation)) E(errs, 'UNSUPPORTED_CAPABILITY', mp + '.aggregation', 'aggregation "' + m.aggregation + '" 已规划未实现（v1 sum-only，见 Ir 能力清单）');
      else E(errs, 'INVALID_ENUM', mp + '.aggregation', 'unknown aggregation "' + m.aggregation + '"（v1 只: sum）');
      if (m.dataType != null && !hasOwn(ReportSpec.COLUMN_TYPES, m.dataType)) E(errs, 'INVALID_ENUM', mp + '.dataType', 'metric.dataType 越列型词表: ' + Object.keys(ReportSpec.COLUMN_TYPES).join('|'));
      if (m.widthPt != null && !isNum(m.widthPt)) E(errs, 'INVALID_NUMBER', mp + '.widthPt', 'widthPt must be a finite number');
      if (m.format != null && !isStr(m.format)) E(errs, 'INVALID_TYPE', mp + '.format', 'format must be string');
    });

    // dataset（内嵌 rows；query.type=semantic 拒 = I2/I3）
    if (!hasOwn(rs, 'dataset')) E(errs, 'REQUIRED', 'dataset', 'dataset is required');
    else if (!isObj(rs.dataset)) E(errs, 'INVALID_TYPE', 'dataset', 'dataset must be an object');
    else {
      if (rs.dataset.query != null || rs.dataset.source != null) E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset', 'dataset.query/source(semantic) 暂不支持（' + ReportSpec.REJECTED.semanticQuery + '）');
      // C1：rows 数据集键白名单（kind/rows；sort/topN/dateRange/filters/query/source 走上方既有明确拒，跳过防双报；其余未知键拒）
      Object.keys(rs.dataset).forEach(function (k) {
        if (hasOwn(ROWS_DS_SKIP, k)) return;
        E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset.' + k, 'rows 数据集无此键（rows 缺省兼容；仅 rows|' + Object.keys(ROWS_DS_SKIP).filter(function (x) { return x !== 'kind' && x !== 'rows'; }).sort().join('|') + ' 有既有拒），写了不生效故拒');
      });
      var colCount = (isArr(rs.dimensions) ? rs.dimensions.length : 0) + (isArr(rs.metrics) ? rs.metrics.length : 0);
      if (rs.dataset.rows == null) E(errs, 'REQUIRED', 'dataset.rows', 'dataset.rows is required');
      else if (!isArr(rs.dataset.rows)) E(errs, 'INVALID_ARRAY', 'dataset.rows', 'dataset.rows must be an array');
      else rs.dataset.rows.forEach(function (row, ri) {
        var rp = 'dataset.rows[' + ri + ']';
        if (!isArr(row)) { E(errs, 'INVALID_ARRAY', rp, 'row must be an array'); return; }
        if (colCount && row.length !== colCount) E(errs, 'INVALID_SHAPE', rp, 'row width ' + row.length + ' != columns ' + colCount);
        row.forEach(function (cell, ci) {
          if (cell != null && typeof cell === 'object') E(errs, 'INVALID_TYPE', rp + '[' + ci + ']', 'cell value must be scalar');
        });
      });
    }

    // 2026-11-06（B1 静默丢弃修复）：rows 路的 dataset.sort/topN/dateRange/filters 编译器不消费 → 明确拒，
    //   不再静默丢弃（sql 路合法：sqlbuilder 消费）。
    if (rs.dataset && isObj(rs.dataset)) {
      ['sort', 'topN', 'dateRange', 'filters'].forEach(function (k) {
        if (rs.dataset[k] != null) E(errs, 'UNSUPPORTED_CAPABILITY', 'dataset.' + k, 'dataset.' + k + ' 仅 sql 路（rows 路内嵌数据请在生成 spec 前排好序/过滤）');
      });
    }

    // presentation（可选；共享校验：type/showTotal/heightsPt/chart 形状 + 未支持键拒）
    validatePresentation(rs, errs, false);
    validateExtraSheets(rs, errs);

    return errs;
  }

  return { validate: validate };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SpecValidator;
