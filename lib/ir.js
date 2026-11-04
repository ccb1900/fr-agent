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
  // ===== 迭代 2：ReportIR 契约（版本 + 能力清单，2026-11-04）=====
  // irVersion：compile 产物一律带当前版本；validate 认当前版本、拒未知版本（不猜语义）。
  //   缺省（老 spec / rawIR 未标）= 视为当前版本（向后兼容，49 spec 零迁移、字节零漂移）。
  var IR_VERSION = '1';
  // 能力清单（机器+人双读，非重型 Registry）：supported=已构建且经真实渲染/回归验证；
  //   partial=部分形态；unsupported=IR 词汇可表达但 backend 未实现/未验证（validate 提前拒，Agent 据此收边界）。
  //   新增能力须同步补对应 IR 校验 + 对象构建测试 + 真实结果验证（AGENTS 铁律）才可挪 supported。
  var CAPABILITIES = {
    irVersion: IR_VERSION,
    sheet: { singleSheet: 'supported', multiSheet: 'unsupported' },
    block: { title: 'supported', titlebar: 'supported', header: 'supported', detail: 'supported', total: 'supported', cells: 'supported', chart: 'supported' },
    dataset: { embedded: 'supported', sql: 'supported', reverseFromCpt: 'unsupported' },
    columnType: { embedded: ['text', 'number', 'float'], dataBrowserProfile: ['num', 'cent', 'space', 'code', 'string'], note: '统一类型白名单 + decimal/long 后端映射延至迭代 3（需真实业务数据 + 对象构建测试，不一上来全实现）' },
    param: { editor: 'supported', date: 'supported', combo: 'supported', number: 'supported', textarea: 'supported', radio: 'supported', checkbox: 'supported', combocheck: 'supported', treecombo: 'supported', nav: 'supported', iframe: 'partial（仅相对 URL，#48 安全批）', submit: 'supported', label: 'supported' },
    condition: { formula: 'supported', column: 'supported', list: 'supported', thenActions: ['bg', 'color', 'bold', 'sizePt', 'font', 'rowHeight', 'colWidth', 'page'] },
    formula: {
      // FR 嵌入式公式解释器（InterpreterError）实测词汇——迭代 4 现成 Agent 真跑学费：
      //   SUMPRODUCT 等 Excel 专有函数不存在，别假设。加权平均用 SUM(x)/SUM(n) 或独立聚合行，别用 SUMPRODUCT。
      supported: ['SUM', 'AVERAGE', 'AVG', 'MAX', 'MIN', 'COUNT', 'round()', 'row()', 'col()', '=$$$ 钻取传值', '公式单元 =expr'],
      unsupported: ['SUMPRODUCT', 'VLOOKUP', 'IFERROR', '多数 Excel 专有函数（未实现，执行期 InterpreterError）'],
      note: '以引擎实测为准，逐函数补，勿照 Excel 直觉写'
    },
    chart: { legacy: ['bar', 'pie', 'line'], vanChart: ['vbar', 'vline', 'varea', 'vscatter', 'vpie', 'vgauge'] },
    extras: { rich: 'supported', floats: 'partial（text/rich/imageFile 钳制 FR_AGENT_HOME）', watermark: 'supported', toolbar: 'partial（仅白名单键，className 逃生口已除）', hyperlinks: 'partial（钻取/subtotal reportrelative；nav/iframe 仅相对）' }
  };
  // 深拷贝 IR（纯数据：无函数/Date/Java 句柄——JSON 往返安全）。供 compile 保证输入不可变。
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function lastNumberIdx(columns) {
    for (var i = columns.length - 1; i >= 0; i--) if (columns[i].type === 'number') return i;
    return -1;
  }

  // v4.0 条件属性结构自检：when 三选一（formula / column / list）+ then 非空 + op 合法
  // 迭代 1 严格化（2026-11-04 用户拍板批；断言前已逐字段读 object.js conditionOf/actionsOf 消费语义——#48 教训）：
  //   ① when 恰好三选一——conditionOf 按 formula→column→list 静默优先取一，混写=用户意图被悄悄丢弃；
  //   ② column 条件必须给 value 或 formulaValue——两者全缺时后端走 Double.valueOf(null) 当场炸；
  //   ③ list 子条件同形态递归——conditionOf 对坏子条件返回 null，会静默混进 ListCondition；
  //   ④ then 键白名单+类型校验——actionsOf 对白名单外键静默忽略=用户要求的属性后端悄悄丢；
  //   ⑤ scope/valueType/value 形态收紧。
  var OPS = { '==': 1, '=': 1, '!=': 1, '>': 1, '>=': 1, '<': 1, '<=': 1, contains: 1 };
  var COND_THEN_KEYS = { bg: 1, color: 1, bold: 1, sizePt: 1, font: 1, rowHeight: 1, colWidth: 1, page: 1 };
  function checkWhen(w, at, errs) {
    if (!w || typeof w !== 'object') { errs.push(at + ': missing when'); return; }
    var hasF = w.formula != null, hasC = w.column != null, hasL = !!(w.list && w.list.length);
    var nSel = (hasF ? 1 : 0) + (hasC ? 1 : 0) + (hasL ? 1 : 0);
    if (nSel === 0) { errs.push(at + ': when needs formula|column|list'); return; }
    if (nSel > 1) { errs.push(at + ': when must pick exactly one of formula|column|list'); return; }
    if (hasF) {
      if (String(w.formula).trim() === '') errs.push(at + ': when.formula empty');
    } else if (hasL) {
      w.list.forEach(function (x, xi) { checkWhen(x, at + ' list' + xi, errs); });
    } else {
      if (!String(w.column)) errs.push(at + ': when.column empty');
      if (w.op != null && !Object.prototype.hasOwnProperty.call(OPS, w.op)) errs.push(at + ': unknown op ' + w.op);
      if (w.value == null && w.formulaValue == null) errs.push(at + ': column condition needs value or formulaValue（后端 Double.valueOf(null) 必炸）');
      if (w.formulaValue != null && typeof w.formulaValue !== 'string') errs.push(at + ': formulaValue must be string');
      if (w.valueType != null && w.valueType !== 'string' && w.valueType !== 'number') errs.push(at + ': valueType must be "string"|"number"');
      if (w.valueType === 'number' && w.value != null && typeof w.value !== 'number') errs.push(at + ': valueType=number but value is not a number');
      if (w.value != null && typeof w.value !== 'number' && typeof w.value !== 'string') errs.push(at + ': value must be number|string');
    }
  }
  function checkThen(t, at, errs) {
    if (!t || typeof t !== 'object' || !Object.keys(t).length) { errs.push(at + ': missing then'); return; }
    Object.keys(t).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(COND_THEN_KEYS, k)) { errs.push(at + ': then unsupported action "' + k + '"（actionsOf 白名单: ' + Object.keys(COND_THEN_KEYS).join('|') + '）'); return; }
      if ((k === 'sizePt' || k === 'rowHeight' || k === 'colWidth' || k === 'page') && typeof t[k] !== 'number') errs.push(at + ': then.' + k + ' must be number');
      if ((k === 'bg' || k === 'color' || k === 'font') && typeof t[k] !== 'number' && typeof t[k] !== 'string') errs.push(at + ': then.' + k + ' must be color int|string');
    });
  }
  // 收集 when 树（含 list 递归）里全部 column——供语义层列成员校验
  function eachWhenColumn(w, fn) {
    if (!w || typeof w !== 'object') return;
    if (w.column != null) fn(w.column);
    if (Array.isArray(w.list)) w.list.forEach(function (x) { eachWhenColumn(x, fn); });
  }
  function checkConditions(list, ctx, errs) {
    if (list == null) return;
    if (!Array.isArray(list)) { errs.push(ctx + ': conditions must be an array'); return; }
    list.forEach(function (cd, ci) {
      var at = ctx + ' cond' + ci;
      if (!cd || typeof cd !== 'object') { errs.push(at + ': not an object'); return; }
      checkWhen(cd.when, at, errs);
      checkThen(cd.then, at, errs);
      if (cd.scope != null && typeof cd.scope !== 'number') errs.push(at + ': scope must be number');
      if (cd.name != null && typeof cd.name !== 'string') errs.push(at + ': name must be string');
    });
  }

  // spec（v2 形态）→ IR（v3 形态）。spec 字段不变，业务层零迁移成本。
  // v3.3：spec.IR 显式直通（官方 demo 重建路径：报规格已超出 compile 词汇表，
  //   由 spec 作者直接给 IR；validate 仍把关）。默认 compile 路径一字未动 = 回归门。
  // 迭代 2（契约）：① 输入不可变——rawIR 直通先深拷贝再注入 extrasOut（原实现直接向
  //   spec.IR 挂 watermark/floats/toolbar，污染调用方 + 依赖前次残留，违 Agent 反复试改）；
  //   ② 两条路径产物均带 irVersion（缺省视为当前版本）；③ 同一输入多次 compile 结果一致。
  function compile(spec) {
    if (spec.IR) {
      var ir = deepClone(spec.IR);          // 不改动 spec.IR 本体（purity）
      extrasOut(ir, spec);
      if (ir.irVersion == null) ir.irVersion = IR_VERSION;
      return ir;
    }
    var dsName = spec.dsName || 'ds1';
    var n = spec.columns.length;
    var totalCol = lastNumberIdx(spec.columns);
    var out = {
      irVersion: IR_VERSION,
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
    // 迭代 2 版本契约：认当前版本、拒未知版本（不猜语义，短路返回）；缺省视为当前版本（向后兼容）
    if (IR.irVersion != null && String(IR.irVersion) !== IR_VERSION) {
      errs.push('UNSUPPORTED_IR_VERSION: ' + IR.irVersion + '（本 backend 只识别 irVersion="' + IR_VERSION + '"）');
      return errs;
    }
    if (!IR.sheets || !Array.isArray(IR.sheets) || !IR.sheets.length) { errs.push('no sheets'); return errs; }
    if (IR.sheets.length > 1) errs.push('UNSUPPORTED_CAPABILITY:multi_sheet（backend 单 sheet，object.js v3.2 预留 throw）');
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
        // v4.0 条件属性族：块级/列级/item 级同形，when 形态与 then 白名单在此把关
        checkConditions(b.conditions, 'sheet' + si + ' block' + bi, errs);
        // v3.2 highlight 旧形态自检（object.js 以 {column,op,value,valueType}/{bg} 包成单条 condition）：坏 value/op 同炸点
        if (b.type === 'detail' && b.highlight != null) {
          var hl = b.highlight;
          if (typeof hl !== 'object') errs.push('sheet' + si + ' block' + bi + ': highlight must be object');
          else {
            if (!hl.column) errs.push('sheet' + si + ' block' + bi + ': highlight needs column');
            if (hl.op != null && !Object.prototype.hasOwnProperty.call(OPS, hl.op)) errs.push('sheet' + si + ' block' + bi + ': highlight unknown op ' + hl.op);
            if (hl.value == null) errs.push('sheet' + si + ' block' + bi + ': highlight needs value');
            if (hl.bg == null) errs.push('sheet' + si + ' block' + bi + ': highlight needs bg');
            if (hl.valueType != null && hl.valueType !== 'string' && hl.valueType !== 'number') errs.push('sheet' + si + ' block' + bi + ': highlight valueType must be "string"|"number"');
          }
        }
        (b.columns || []).forEach(function (c, ci) {
          if (!c || typeof c !== 'object') { errs.push('sheet' + si + ' block' + bi + ' col' + ci + ': not an object'); return; }
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
      if (!s || typeof s !== 'object') return; // 结构层已报 not an object；此处只取 floats（审计 P1-2 同类残余：null sheet 自炸）
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
        // 条件属性/highlight 列成员校验（迭代 1；Agent 生成 IR 列名写错高发点。kind=sql 列名运行期可变→列级豁免）
        if (b.type === 'detail') {
          var dsc = dsCols(dsIdx[b.dataset]);
          var dscAny = false; for (var ck3 in dsc) { dscAny = true; break; }
          if (dscAny) {
            var badCol = function (col, where) {
              if (col != null && !dsc[col]) errs.push('sheet' + si + ' block' + bi + ': ' + where + ' column not in dataset "' + b.dataset + '" columns: ' + col);
            };
            (b.conditions || []).forEach(function (cd, k) {
              if (cd && cd.when) eachWhenColumn(cd.when, function (col) { badCol(col, 'cond' + k); });
            });
            (b.columns || []).forEach(function (c, ci) {
              ((c && c.conditions) || []).forEach(function (cd, cdi) {
                if (cd && cd.when) eachWhenColumn(cd.when, function (col) { badCol(col, 'col' + ci + ' cond' + cdi); });
              });
            });
            if (b.highlight && typeof b.highlight === 'object') badCol(b.highlight.column, 'highlight');
          }
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
          if (f.op && !Object.prototype.hasOwnProperty.call(OPS, f.op)) errs.push('param filter' + fi + ': unknown op ' + f.op);
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

  return {
    compile: compile, validate: validate,
    IR_VERSION: IR_VERSION,                 // 当前契约版本
    capabilities: function () { return CAPABILITIES; }   // 机器+人双读能力清单（含 unsupported 边界）
  };
})();
