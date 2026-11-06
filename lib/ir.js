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
    sheet: { singleSheet: 'supported', multiSheet: 'supported', multiSheetNote: 'object 每 sheet 独立游标；ReportSpec/Planner 路仍无多 sheet 入口' },
    block: { title: 'supported', titlebar: 'supported', header: 'supported', detail: 'supported', total: 'supported', cells: 'supported', chart: 'supported' },
    dataset: { embedded: 'supported', sql: 'supported', reverseFromCpt: 'unsupported' },
    columnType: { embedded: ['text', 'string', 'number', 'integer', 'long', 'float', 'decimal', 'boolean', 'date', 'datetime'], dataBrowserProfile: ['num', 'cent', 'space', 'code', 'string'], note: 'I0-05 定案（2026-11-04，probe_typemap.js 实机往返证 Class 保真）：number/float=legacy（number 硬转 Integer 为 v3.4 既定），string=text 别名；行值形态在 validate 逐格把关（date/datetime 字面格式、integer/long 整值、decimal 精确串、boolean 字面量、null 可空）。dataBrowserProfile 列是浏览器族样式词表（不后进 embedded 数据集），与 embedded 词表正交。' },
    param: { editor: 'supported', date: 'supported', combo: 'supported', number: 'supported', textarea: 'supported', radio: 'supported', checkbox: 'supported', combocheck: 'supported', treecombo: 'supported', nav: 'supported', iframe: 'partial（仅相对 URL，#48 安全批）', submit: 'supported', label: 'supported' },
    condition: { formula: 'supported', column: 'supported', list: 'supported', thenActions: ['bg', 'color', 'bold', 'sizePt', 'font', 'rowHeight', 'colWidth', 'page', 'value', 'border', 'link', 'widget'] },
    formula: {
      // FR 嵌入式公式解释器（InterpreterError）实测词汇——迭代 4 现成 Agent 真跑学费：
      //   SUMPRODUCT 等 Excel 专有函数不存在，别假设。加权平均用 SUM(x)/SUM(n) 或独立聚合行，别用 SUMPRODUCT。
      supported: ['SUM', 'AVERAGE', 'AVG', 'MAX', 'MIN', 'COUNT', 'round()', 'row()', 'col()', '=$$$ 钻取传值', '公式单元 =expr'],
      unsupported: ['SUMPRODUCT', 'VLOOKUP', 'IFERROR', '多数 Excel 专有函数（未实现，执行期 InterpreterError）'],
      note: '以引擎实测为准，逐函数补，勿照 Excel 直觉写'
    },
    chart: { legacy: ['bar', 'pie', 'line'], vanChart: ['vbar', 'vline', 'varea', 'vscatter', 'vbubble', 'vpie', 'vgauge'], deco: { tooltip: 'supported(van; x|y|size 仅 vscatter/vbubble; richText)', label: 'supported(van)', marker: 'supported(van; alpha)', lineStyle: 'supported(van)', trend: 'supported(van)', stack: 'supported(vbar|varea)', alpha: 'supported', bg: 'supported', border: 'supported', axisYUnit: 'supported', conditionalSeries: 'supported(van, seriesColor|alpha)', hotTooltip: 'supported(全 kind, plot 级 AttrContents)', seriesBorder: 'supported(AttrBorder|BorderWithAlpha)', effect: 'supported(AttrEffect, web 动画序列化)', areaFill: 'supported(varea)', seriesImage: 'supported(ImageBackground, 路径限 FR_AGENT_HOME 相对或绝对)', note: '批B（README #72/#101/#102）：装饰后挂 out.applyDeco()。能力状态四层真相（构造/序列化/渲染/agentAvailable）以 application/capability_manifest.js 为准——本处 supported 仅指构造层，Agent 对外承诺以 manifest.agentAvailable 为准（r10-B）' } },
    extras: { rich: 'supported', floats: 'partial（text/rich/imageFile 钳制 FR_AGENT_HOME）', watermark: 'supported', toolbar: 'partial（仅白名单键，className 逃生口已除）', hyperlinks: 'partial（钻取/subtotal reportrelative；nav/iframe 仅相对）' }
  };
  // 深拷贝 IR（纯数据：无函数/Date/Java 句柄——JSON 往返安全）。供 compile 保证输入不可变。
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function lastNumberIdx(columns) {
    for (var i = columns.length - 1; i >= 0; i--) if (columns[i].type === 'number') return i;
    return -1;
  }

  // ===== I0-01（r2.md，2026-11-04）校验契约助手：validate 输出统一 {code,path,message} =====
  //   path = JSON 路径（sheets[0].blocks[1].columns[2]）；code 词汇表（一处真相，Agent 可键控消费）：
  //   REQUIRED / INVALID_TYPE / INVALID_ARRAY / INVALID_NUMBER / INVALID_ENUM / INVALID_SHAPE /
  //   DUPLICATE / UNKNOWN_REF / INVALID_URL / INVALID_TARGET / UNSUPPORTED_IR_VERSION / UNSUPPORTED_CAPABILITY /
  //   SQL_READONLY（I0-04 只读闸）
  //   红线：校验器自身对任意坏输入只产诊断、绝不抛（审计 jjs 实测坐实的自炸路径全部有闸）。
  function E(errs, code, path, message) { errs.push({ code: code, path: path, message: message }); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }   // NaN/Infinity 拒（typeof 前提下的 isFinite）
  function isStr(v) { return typeof v === 'string'; }
  function pathTail(p) { var s = String(p); var i = s.lastIndexOf('.'); return i >= 0 ? s.slice(i + 1) : s; }
  // 数组闸：null/absent 由调用方决定必填与否；真值非数组 = INVALID_ARRAY（不再 .forEach 自炸）
  function eachArr(errs, v, path, req, fn) {
    if (v == null) { if (req) E(errs, 'REQUIRED', path, pathTail(path) + ' is required'); return; }
    if (!Array.isArray(v)) { E(errs, 'INVALID_ARRAY', path, pathTail(path) + ' must be an array'); return; }
    if (req && !v.length) { E(errs, 'REQUIRED', path, pathTail(path) + ' must not be empty'); return; }
    v.forEach(function (x, i) { fn(x, i, path + '[' + i + ']'); });
  }
  function numOpt(errs, o, k, path) {
    if (o[k] != null && !isNum(o[k])) E(errs, 'INVALID_NUMBER', path + '.' + k, k + ' must be a finite number');
  }
  function strOpt(errs, o, k, path) {
    if (o[k] != null && !isStr(o[k])) E(errs, 'INVALID_TYPE', path + '.' + k, k + ' must be a string');
  }

  // v4.0 条件属性结构自检：when 三选一（formula / column / list）+ then 非空 + op 合法
  // 迭代 1 严格化（2026-11-04 用户拍板批；断言前已逐字段读 object.js conditionOf/actionsOf 消费语义——#48 教训）：
  //   ① when 恰好三选一——conditionOf 按 formula→column→list 静默优先取一，混写=用户意图被悄悄丢弃；
  //   ② column 条件必须给 value 或 formulaValue——两者全缺时后端走 Double.valueOf(null) 当场炸；
  //   ③ list 子条件同形态递归——conditionOf 对坏子条件返回 null，会静默混进 ListCondition；
  //   ④ then 键白名单+类型校验——actionsOf 对白名单外键静默忽略=用户要求的属性后端悄悄丢；
  //   ⑤ scope/valueType/value 形态收紧（I0-01 起数值一律有限闸）。
  var OPS = { '==': 1, '=': 1, '!=': 1, '>': 1, '>=': 1, '<': 1, '<=': 1, contains: 1 };
  var COND_THEN_KEYS = { bg: 1, color: 1, bold: 1, sizePt: 1, font: 1, rowHeight: 1, colWidth: 1, page: 1, value: 1, border: 1, link: 1, widget: 1 };
  // 批A（2026-11-04）then 动作满血词表（官方 717/19/7/1）：
  //   value   → ValueHighlightAction(Object)：换显示值，串或 {formula}（官方 公司评级.cpt=IF(F6>0...,"A","B","C")）
  //   border  → BorderHighlightAction(CellBorderStyle)：top|bottom|left|right 各 {line:0..5, color:argb}（官方 签约情况分析.cpt）
  //   link    → HyperlinkHighlightAction(NameJavaScriptGroup)：复用 checkLinkShape（web/reportlet 同规）
  //   widget  → WidgetHighlightAction(Widget)：内嵌编辑器（官方 产品月销量情况录入表.cpt=TextEditor 子树；kind 白名单=值编辑器四件）
  var COND_THEN_WIDGET_KINDS = { editor: 1, number: 1, date: 1, textarea: 1 };
  var COND_THEN_BORDER_SIDES = { top: 1, bottom: 1, left: 1, right: 1 };
  // path = when 节点自身路径（'...conditions[0].when' 或 list 子节点 '...when.list[1]'）
  function checkWhen(w, path, errs) {
    if (!isObj(w)) { E(errs, 'REQUIRED', path, 'missing when'); return; }
    if (w.list != null && !Array.isArray(w.list)) { E(errs, 'INVALID_ARRAY', path + '.list', 'when.list must be an array'); return; }
    var hasF = w.formula != null, hasC = w.column != null, hasL = Array.isArray(w.list) && w.list.length > 0;
    var nSel = (hasF ? 1 : 0) + (hasC ? 1 : 0) + (hasL ? 1 : 0);
    if (nSel === 0) { E(errs, 'REQUIRED', path, 'when needs formula|column|list'); return; }
    if (nSel > 1) { E(errs, 'INVALID_TYPE', path, 'when must pick exactly one of formula|column|list'); return; }
    if (hasF) {
      if (!isStr(w.formula) || String(w.formula).trim() === '') E(errs, 'REQUIRED', path + '.formula', 'when.formula empty');
    } else if (hasL) {
      w.list.forEach(function (x, xi) { checkWhen(x, path + '.list[' + xi + ']', errs); });
    } else {
      if (!isStr(w.column) || w.column === '') E(errs, 'REQUIRED', path + '.column', 'when.column empty');
      if (w.op != null && !hasOwn(OPS, w.op)) E(errs, 'INVALID_ENUM', path + '.op', 'unknown op ' + w.op);
      if (w.value == null && w.formulaValue == null) E(errs, 'REQUIRED', path + '.value', 'column condition needs value or formulaValue（后端 Double.valueOf(null) 必炸）');
      if (w.formulaValue != null && !isStr(w.formulaValue)) E(errs, 'INVALID_TYPE', path + '.formulaValue', 'formulaValue must be string');
      if (w.valueType != null && w.valueType !== 'string' && w.valueType !== 'number') E(errs, 'INVALID_ENUM', path + '.valueType', 'valueType must be "string"|"number"');
      if (w.valueType === 'number' && w.value != null && typeof w.value !== 'number') E(errs, 'INVALID_TYPE', path + '.value', 'valueType=number but value is not a number');
      if (w.value != null && !isNum(w.value) && !isStr(w.value)) E(errs, 'INVALID_TYPE', path + '.value', 'value must be number|string');
    }
  }
  function checkThen(t, path, errs) {
    var tp = path + '.then';
    if (!isObj(t) || !Object.keys(t).length) { E(errs, 'REQUIRED', tp, 'missing then'); return; }
    Object.keys(t).forEach(function (k) {
      if (!hasOwn(COND_THEN_KEYS, k)) { E(errs, 'INVALID_ENUM', tp + '.' + k, 'then unsupported action "' + k + '"（actionsOf 白名单: ' + Object.keys(COND_THEN_KEYS).join('|') + '）'); return; }
      if ((k === 'sizePt' || k === 'rowHeight' || k === 'colWidth' || k === 'page') && !isNum(t[k])) E(errs, 'INVALID_NUMBER', tp + '.' + k, 'then.' + k + ' must be number');
      if ((k === 'bg' || k === 'color' || k === 'font') && !isNum(t[k]) && !isStr(t[k])) E(errs, 'INVALID_TYPE', tp + '.' + k, 'then.' + k + ' must be color int|string');
      // 批A 四动作类型闸（消费语义=object.js actionsOf 对应构造器一手探针）
      if (k === 'value') {
        if (isStr(t[k])) { /* 串=字面换值 */ return; }
        if (!isObj(t[k])) { E(errs, 'INVALID_TYPE', tp + '.value', 'then.value must be string or {formula:string}'); return; }
        Object.keys(t[k]).forEach(function (vk) {
          if (vk !== 'formula') E(errs, 'INVALID_ENUM', tp + '.value', 'then.value only key formula: ' + vk);
        });
        if (!isStr(t[k].formula) || String(t[k].formula).trim() === '') E(errs, 'REQUIRED', tp + '.value.formula', 'then.value{formula} needs a formula string');
      }
      if (k === 'border') {
        if (!isObj(t[k])) { E(errs, 'INVALID_TYPE', tp + '.border', 'then.border must be object'); return; }
        var anySide = false;
        Object.keys(t[k]).forEach(function (sk) {
          if (!hasOwn(COND_THEN_BORDER_SIDES, sk)) { E(errs, 'INVALID_ENUM', tp + '.border', 'then.border side must be top|bottom|left|right: ' + sk); return; }
          anySide = true;
          var sd = t[k][sk];
          if (!isObj(sd)) { E(errs, 'INVALID_TYPE', tp + '.border.' + sk, 'side must be object'); return; }
          if (sd.line == null) E(errs, 'REQUIRED', tp + '.border.' + sk + '.line', 'side needs line（CellBorderStyle.setXXStyle 直塞）');
          else if (!isNum(sd.line) || sd.line !== Math.floor(sd.line) || sd.line < 0 || sd.line > 5) E(errs, 'INVALID_NUMBER', tp + '.border.' + sk + '.line', 'side.line must be integer 0..5（CellBorderStyle.setXXStyle 直塞）');
          if (sd.color != null && !isNum(sd.color)) E(errs, 'INVALID_TYPE', tp + '.border.' + sk + '.color', 'side.color must be argb number');
        });
        if (!anySide) E(errs, 'REQUIRED', tp + '.border', 'then.border needs at least one of top|bottom|left|right');
      }
      if (k === 'link') {
        if (!checkLinkShape(errs, t[k], tp + '.link')) return;
        if (!t[k].web && !t[k].reportlet) E(errs, 'REQUIRED', tp + '.link', 'then.link needs web.url or reportlet');
      }
      if (k === 'widget') {
        if (!isObj(t[k])) { E(errs, 'INVALID_TYPE', tp + '.' + k, 'then.widget must be an object'); return; }
        if (t[k].kind == null) { E(errs, 'REQUIRED', tp + '.widget.kind', 'then.widget needs kind（值编辑器四件 ' + Object.keys(COND_THEN_WIDGET_KINDS).join('|') + '）'); return; }
        if (!hasOwn(COND_THEN_WIDGET_KINDS, t[k].kind)) { E(errs, 'INVALID_ENUM', tp + '.widget.kind', 'then.widget kind 值编辑器白名单 ' + Object.keys(COND_THEN_WIDGET_KINDS).join('|') + ': ' + t[k].kind); return; }
        if (t[k].name != null && !isStr(t[k].name)) E(errs, 'INVALID_TYPE', tp + '.widget.name', 'then.widget.name must be string');
        if (t[k].value != null && !isStr(t[k].value) && !isNum(t[k].value)) E(errs, 'INVALID_TYPE', tp + '.widget.value', 'then.widget.value must be string|number');
      }
    });
  }
  // 收集 when 树（含 list 递归）里全部 column——供语义层列成员校验；回调给 (列名, 该 column 的 JSON 路径)
  function eachWhenColumn(w, path, fn) {
    if (!isObj(w)) return;
    if (w.column != null) fn(w.column, path + '.column');
    if (Array.isArray(w.list)) w.list.forEach(function (x, xi) { eachWhenColumn(x, path + '.list[' + xi + ']', fn); });
  }
  function checkConditions(list, path, errs) {
    var cp = path + '.conditions';
    if (list == null) return;
    if (!Array.isArray(list)) { E(errs, 'INVALID_ARRAY', cp, 'conditions must be an array'); return; }
    list.forEach(function (cd, ci) {
      var cpath = cp + '[' + ci + ']';
      if (!isObj(cd)) { E(errs, 'INVALID_TYPE', cpath, 'not an object'); return; }
      checkWhen(cd.when, cpath + '.when', errs);
      checkThen(cd.then, cpath, errs);
      if (cd.scope != null && !isNum(cd.scope)) E(errs, 'INVALID_NUMBER', cpath + '.scope', 'scope must be number');
      strOpt(errs, cd, 'name', cpath);
    });
  }

  // 批C（2026-11-05）页眉页脚（官方 207/240，档案式报表.cpt 形态）+ 模板级 attrMark 词汇闸
  //   探针 probe_pagehf/_hf7/9：挂接=sheet.setHeader/setFooter(int, ReportHF)；裸 classpath 下 ReportHF
  //   静态初始化撞 license 墙（LicenseContext），env 全激活后可用——管线 env 恒满足。
  function checkHFList(list, path, errs) {
    if (!Array.isArray(list) || !list.length) { E(errs, 'INVALID_ARRAY', path, 'must be a non-empty array'); return; }
    list.forEach(function (el, ei) {
      var ep = path + '[' + ei + ']';
      if (!isObj(el)) { E(errs, 'INVALID_TYPE', ep, 'not an object'); return; }
      var kinds = (el.text != null ? 1 : 0) + (el.formula != null ? 1 : 0) + (el.pageNumber ? 1 : 0) + (el.totalPages ? 1 : 0) + (el.date != null ? 1 : 0);
      if (kinds === 0) { E(errs, 'REQUIRED', ep, 'needs one of text|formula|pageNumber|totalPages|date'); return; }
      if (kinds > 1) { E(errs, 'INVALID_TYPE', ep, 'exactly one of text|formula|pageNumber|totalPages|date'); return; }
      if (el.text != null && !isStr(el.text)) E(errs, 'INVALID_TYPE', ep + '.text', 'text must be string');
      if (el.formula != null && !isStr(el.formula)) E(errs, 'INVALID_TYPE', ep + '.formula', 'formula must be string');
      if (el.date != null && !isStr(el.date)) E(errs, 'INVALID_TYPE', ep + '.date', 'date format must be string like yyyy-MM-dd');
      if (el.fontPt != null && !isNum(el.fontPt)) E(errs, 'INVALID_NUMBER', ep + '.fontPt', 'fontPt must be number');
      if (el.bold != null && typeof el.bold !== 'boolean') E(errs, 'INVALID_TYPE', ep + '.bold', 'bold must be boolean');
      if (el.newLine != null && typeof el.newLine !== 'boolean') E(errs, 'INVALID_TYPE', ep + '.newLine', 'newLine must be boolean');
    });
  }
  function checkHeaderFooter(hf, path, errs) {
    if (!isObj(hf)) { E(errs, 'INVALID_TYPE', path, 'headerFooter must be object'); return; }
    ['header', 'footer'].forEach(function (side) {
      if (hf[side] == null) return;
      var sp = path + '.' + side;
      if (!isObj(hf[side])) { E(errs, 'INVALID_TYPE', sp, side + ' must be object'); return; }
      var any = false;
      ['left', 'center', 'right'].forEach(function (pos) {
        if (hf[side][pos] == null) return;
        any = true;
        checkHFList(hf[side][pos], sp + '.' + pos, errs);
      });
      if (!any) E(errs, 'REQUIRED', sp, side + ' needs at least one of left|center|right');
      if (hf[side].bg != null && !isNum(hf[side].bg)) E(errs, 'INVALID_TYPE', sp + '.bg', 'bg must be argb number');
    });
    if (hf.header == null && hf.footer == null) E(errs, 'REQUIRED', path, 'headerFooter needs header or footer');
  }

  // 批D：字典三形态闸（custom map 保留 / tableData / formula；Database|DynamicSQLDict 需连接面→凭据注入批工单）
  function checkDict(d, path, errs) {
    if (!isObj(d)) { E(errs, 'INVALID_TYPE', path, 'dict must be a non-empty map or {tableData|formula}'); return; }
    if (d.tableData != null) {
      Object.keys(d).forEach(function (k) { if (k !== 'tableData') E(errs, 'INVALID_ENUM', path + '.' + k, 'dict 单形态：tableData'); });
      var td = d.tableData;
      if (!isObj(td)) { E(errs, 'INVALID_TYPE', path + '.tableData', 'tableData must be object'); return; }
      if (!isStr(td.ds) || td.ds === '') E(errs, 'REQUIRED', path + '.tableData.ds', 'tableData needs ds（数据集名）');
      if (td.keyIdx != null && !isNum(td.keyIdx)) E(errs, 'INVALID_NUMBER', path + '.tableData.keyIdx', 'keyIdx must be number');
      if (td.valIdx != null && !isNum(td.valIdx)) E(errs, 'INVALID_NUMBER', path + '.tableData.valIdx', 'valIdx must be number');
      return;
    }
    if (d.formula != null) {
      Object.keys(d).forEach(function (k) { if (k !== 'formula') E(errs, 'INVALID_ENUM', path + '.' + k, 'dict 单形态：formula'); });
      if (!isStr(d.formula)) E(errs, 'INVALID_TYPE', path + '.formula', 'formula must be string');
      return;
    }
    if (!Object.keys(d).length) E(errs, 'INVALID_TYPE', path, 'dict must be a non-empty map or {tableData|formula}');
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
    // 批C：页眉页脚（sheet 级）+ 模板级 attrMark（workbook 级）——v2 spec 路径透传（rawIR 直通本就保留）
    if (spec.headerFooter) out.sheets[0].headerFooter = spec.headerFooter;
    if (spec.templateId) out.templateId = spec.templateId;
    if (spec.templateTheme) out.templateTheme = spec.templateTheme;
    // 批F：填报属性（workbook 级词汇，sheet.addAttributeTarget 挂接）——同批C 教训二：v2 逐字段白名单必须显式透传
    if (spec.write) out.write = spec.write;
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
  // I0-01 超链族：子报表路径 = isRelUrl 同规 + 禁 .. 穿越（钻取目标应钳在 reportlets 根下）
  function isRelReportlet(p) {
    var s = String(p == null ? '' : p);
    if (!isRelUrl(s)) return false;
    return !/(^|\/)\.\.(\/|$)/.test(s);
  }
  // 与 lib/object.js TOOLBAR_BUTTONS 键一致（安全批 B：className 逃生口已移除，IR 侧同报未知 kind）
  var TOOLBAR_KEYS = { export: 1, email: 1, print: 1, flashPrint: 1, newPrint: 1, printPreview: 1, pageSetup: 1,
    first: 1, previous: 1, pageNavi: 1, next: 1, last: 1, submit: 1, verify: 1,
    appendRow: 1, deleteRow: 1, appendColumnRow: 1, showCellValue: 1, importExcel: 1 };
  var IMAGE_FMTS = { png: 1, jpg: 1, jpeg: 1, gif: 1, bmp: 1 };
  var CHART_KINDS = { bar: 1, pie: 1, line: 1, vbar: 1, vline: 1, varea: 1, vscatter: 1, vbubble: 1, vpie: 1, vgauge: 1 };  // D1 组合图：构造/序列化已证，渲染未达成（阻塞记录见 object.js 同段注释）

  // 超链对象共同形态闸（detail.link / cells linkTo / floats linkTo 共用）：
  //   web.url 过 isRelUrl；reportlet 过 isRelReportlet；targetFrame 白名单；params 项 = {name, value|formula}
  //   （ppArray 消费语义 object.js:94-103：缺 name 造不出 ParameterProvider，formula 非串必炸）。
  function checkLinkShape(errs, l, path) {
    if (!isObj(l)) { E(errs, 'INVALID_TYPE', path, 'link must be an object'); return false; }
    if (l.web != null) {
      if (!isObj(l.web)) E(errs, 'INVALID_TYPE', path + '.web', 'web must be an object');
      else {
        if (!l.web.url) E(errs, 'REQUIRED', path + '.web.url', 'web needs url');
        else if (!isRelUrl(l.web.url)) E(errs, 'INVALID_URL', path + '.web.url', 'web.url must be relative (安全只相对路径)');
      }
    }
    if (l.reportlet != null && !isRelReportlet(l.reportlet)) E(errs, 'INVALID_URL', path + '.reportlet', 'reportlet must be relative reportlets path（禁 scheme/引号/.. 穿越）');
    if (l.targetFrame != null && !isStr(l.targetFrame)) E(errs, 'INVALID_TYPE', path + '.targetFrame', 'targetFrame must be a string');
    else if (l.targetFrame != null && !/^[A-Za-z0-9_-]{1,32}$/.test(l.targetFrame)) E(errs, 'INVALID_TARGET', path + '.targetFrame', 'targetFrame 越界白名单 ^[A-Za-z0-9_-]{1,32}$: ' + l.targetFrame);
    strOpt(errs, l, 'by', path);
    strOpt(errs, l, 'name', path);
    // 批E：事件 JS 体系（ParameterJavaScript 589/DialogAttr 26）——超链组多件 + 弹窗属性 + 宽高/标题
    if (l.title != null && !isStr(l.title)) E(errs, 'INVALID_TYPE', path + '.title', 'title must be string');
    ['width', 'height'].forEach(function (whk) {
      if (l[whk] != null && !isNum(l[whk])) E(errs, 'INVALID_NUMBER', path + '.' + whk, whk + ' must be number');
    });
    if (l.dialog != null) {
      if (!isObj(l.dialog)) E(errs, 'INVALID_TYPE', path + '.dialog', 'dialog must be object');
      else {
        if (l.dialog.title != null && !isStr(l.dialog.title)) E(errs, 'INVALID_TYPE', path + '.dialog.title', 'dialog.title must be string');
        ['left', 'top'].forEach(function (dk) { if (l.dialog[dk] != null && !isNum(l.dialog[dk])) E(errs, 'INVALID_NUMBER', path + '.dialog.' + dk, 'dialog.' + dk + ' must be number'); });
        if (l.dialog.center != null && typeof l.dialog.center !== 'boolean') E(errs, 'INVALID_TYPE', path + '.dialog.center', 'dialog.center must be boolean');
        Object.keys(l.dialog).forEach(function (dk) { if (['title', 'left', 'top', 'center'].indexOf(dk) < 0) E(errs, 'INVALID_ENUM', path + '.dialog.' + dk, 'dialog keys: title|left|top|center'); });
      }
    }
    if (l.js != null) {
      eachArr(errs, l.js, path + '.js', false, function (jv, ji, jp) {
        if (!isObj(jv)) { E(errs, 'INVALID_TYPE', jp, 'js item must be object'); return; }
        if (jv.name != null && !isStr(jv.name)) E(errs, 'INVALID_TYPE', jp + '.name', 'js.name must be string');
        if (jv.recalc != null && typeof jv.recalc !== 'boolean') E(errs, 'INVALID_TYPE', jp + '.recalc', 'js.recalc must be boolean');
        if (jv.params != null) eachArr(errs, jv.params, jp + '.params', false, function (p, pi, pp) {
          if (!isObj(p)) { E(errs, 'INVALID_TYPE', pp, 'param must be an object'); return; }
          if (!isStr(p.name) || p.name === '') E(errs, 'REQUIRED', pp + '.name', 'param needs name');
          if (p.formula == null && p.value == null) E(errs, 'REQUIRED', pp + '.value', 'param needs value or formula');
          if (p.formula != null && !isStr(p.formula)) E(errs, 'INVALID_TYPE', pp + '.formula', 'formula must be string');
          if (p.value != null && !isStr(p.value) && !isNum(p.value) && typeof p.value !== 'boolean') E(errs, 'INVALID_TYPE', pp + '.value', 'value must be string|number|boolean');
        });
      });
    }
    if (l.params != null) eachArr(errs, l.params, path + '.params', false, function (p, pi, pp) {
      if (!isObj(p)) { E(errs, 'INVALID_TYPE', pp, 'param must be an object'); return; }
      if (!isStr(p.name) || p.name === '') E(errs, 'REQUIRED', pp + '.name', 'param needs name');
      if (p.formula == null && p.value == null) E(errs, 'REQUIRED', pp + '.value', 'param needs value or formula');
      if (p.formula != null && !isStr(p.formula)) E(errs, 'INVALID_TYPE', pp + '.formula', 'formula must be string');
      if (p.value != null && !isStr(p.value) && !isNum(p.value) && typeof p.value !== 'boolean') E(errs, 'INVALID_TYPE', pp + '.value', 'value must be string|number|boolean');
    });
    return true;
  }

  // I0-05（r2.md 任务 0.4）：embedded 数据集列类型表（词表=CAPABILITIES.columnType.embedded 一处真相；
  //   Class 保真由 probe_typemap.js 实机往返一手证）。行值逐格按列型把关——边界一次 parse、内部信任。
  var EDS_TYPES = { text: 1, string: 1, number: 1, integer: 1, long: 1, float: 1, decimal: 1, boolean: 1, date: 1, datetime: 1 };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var DTS_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  var NUMSTR_RE = /^-?\d+(\.\d+)?$/;
  function checkRowValue(v, type, vp, errs) {
    if (v == null) return;                                    // 可空语义：null 放行（落 Java null，不再 String 强折 'null' 串）
    if (typeof v === 'object') { E(errs, 'INVALID_TYPE', vp, 'cell value must be scalar'); return; }
    if (type === 'number' || type === 'integer') {
      if (!isNum(v) || Math.floor(v) !== v) E(errs, 'INVALID_TYPE', vp, type + ' 列值必须为整数（后端 Integer 硬转，小数会被静默截断）');
      else if (v > 2147483647 || v < -2147483648) E(errs, 'INVALID_TYPE', vp, type + ' 列值超 int 域，请用 long');
    } else if (type === 'long') {
      if (!(isNum(v) && Math.floor(v) === v) && !/^-?\d+$/.test(String(v))) E(errs, 'INVALID_TYPE', vp, 'long 列值必须为整数（或纯数字串）');
    } else if (type === 'float' || type === 'decimal') {
      if (!isNum(v) && !NUMSTR_RE.test(String(v))) E(errs, 'INVALID_TYPE', vp, type + ' 列值必须为数或精确数字串');
    } else if (type === 'boolean') {
      if (typeof v !== 'boolean') E(errs, 'INVALID_TYPE', vp, 'boolean 列值必须为 true|false 字面量');
    } else if (type === 'date') {
      if (!DATE_RE.test(String(v))) E(errs, 'INVALID_TYPE', vp, 'date 列值必须为字面 yyyy-MM-dd（java.sql.Date.valueOf 口径）');
      else {
        var mm = +String(v).slice(5, 7), dd = +String(v).slice(8, 10);
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) E(errs, 'INVALID_TYPE', vp, 'date 列值月/日越界: ' + v);
      }
    } else if (type === 'datetime') {
      if (!DTS_RE.test(String(v))) E(errs, 'INVALID_TYPE', vp, 'datetime 列值必须为字面 yyyy-MM-dd HH:mm:ss（java.sql.Timestamp.valueOf 口径）');
    }
  }

  // IR 结构自检 v3.10（2026-11-04 审计批 A 重构；I0-01/r2 完整化批 2026-11-04 二次重构）：
  //   两层校验——结构层（容器/必填/类型）+ 语义层（跨对象引用完整性）。
  //   ① no-sheets/缺容器时短路返回，validator 自身不再被无效 IR 炸掉（审计 P1-2 行为固化）；
  //   ② detail.link 校验独立成段（原实现困在 chart 分支出 return 之后，永不可达——审计 P1-1）；
  //   ③ multi-sheet IR 在此即报（backend 单 sheet，object.js v3.2 预留 throw——审计边界项）；
  //   ④ dataset/列/参数引用完整性（审计 P1-3）；kind=sql 数据集列名运行期可变，列级检查自动豁免；
  //   imageFile 本机路径钳制归 object 层（paths 单点在 runtime/paths.js，ir 层零依赖红线不可达 Paths）。
  //   I0-01（r2.md 任务 0.1）新增：错误一律 {code,path,message}（JSON 路径）；数组字段带闸（真值非数组
  //   只诊断不抛——审计 jjs 实测的 columns/items/sumCols/floats/filters/buttons/values/rows 8 条自炸路全堵）；
  //   数值一律有限闸（NaN/Infinity 拒）；block.type/aggregate.fn/dataset.kind 枚举白名单（block 白名单
  //   = object.js case 实消费集：title|titlebar|header|detail|total|cells|space|chart；aggregate.fn 只有
  //   sum 是真——object.js:555-560 硬编码 =SUM，其余聚合走 sumCols.formula）；对象字段拒数组；
  //   title.text/span、detail.dataset、total 聚合二选一、column.name、ds.name（必填+唯一）、rows 宽度
  //   等必填洞补齐；超链族 reportlet/targetFrame/params 闸（isRelReportlet，同 object 层纵深 U3）。
  //   零误报铁律：全部 42 张在库 spec 必须过新闸（probes/scan_all_specs.js 离线全量扫），合法报表是回归门。
  function validate(IR) {
    var errs = [];
    // ===== 结构层 =====
    if (!isObj(IR)) { E(errs, 'INVALID_TYPE', 'IR', 'not an object'); return errs; }
    // 迭代 2 版本契约：认当前版本、拒未知版本（不猜语义，短路返回）；缺省视为当前版本（向后兼容）
    if (IR.irVersion != null && String(IR.irVersion) !== IR_VERSION) {
      E(errs, 'UNSUPPORTED_IR_VERSION', 'irVersion', 'unsupported irVersion "' + IR.irVersion + '"（本 backend 只识别 irVersion="' + IR_VERSION + '"）');
      return errs;
    }
    if (!Array.isArray(IR.sheets) || !IR.sheets.length) { E(errs, 'REQUIRED', 'sheets', 'no sheets'); return errs; }
    // 2026-11-06（A1）：multi_sheet 拒已撤——object.js 每 sheet 状态隔离（rowCursor 等循环内重置），
    //   IR 层接受多 sheet；ReportSpec/Planner 入口仍无（B 类后续）。
    var BLOCK_TYPES = { title: 1, titlebar: 1, header: 1, detail: 1, total: 1, cells: 1, space: 1, chart: 1 };
    var AGG_FNS = { sum: 1, avg: 1, count: 1, min: 1, max: 1, ratio: 1 };   // 2026-11-06 P1：合计行非 sum 聚合（object 映射 SUM/AVERAGE/COUNT/MIN/MAX；ratio=SUM(num)/SUM(den)）
    var sheetNames = {};        // 审查轮1 P2：多 sheet 名称必填且唯一（wb.addReport 按名索引，重名=静默覆盖）
    IR.sheets.forEach(function (s, si) {
      var sp = 'sheets[' + si + ']';
      if (!isObj(s)) { E(errs, 'INVALID_TYPE', sp, 'not an object'); return; }
      if (!isStr(s.name) || s.name === '') E(errs, 'REQUIRED', sp + '.name', 'sheet needs name（多 sheet 的 wb.addReport 键）');
      else {
        if (sheetNames[s.name]) E(errs, 'DUPLICATE', sp + '.name', 'dup sheet name ' + s.name);
        sheetNames[s.name] = 1;
      }
      if (!Array.isArray(s.blocks) || !s.blocks.length) { E(errs, 'REQUIRED', sp + '.blocks', 'no blocks'); return; }
      var types = s.blocks.map(function (b) { return (b && b.type) || ''; });
      // v3.4：官方 basic 族首行是 titlebar（横条带标题+超链格）——用 cells 块承载
      if (types[0] !== 'title' && types[0] !== 'titlebar' && types[0] !== 'cells') E(errs, 'REQUIRED', sp + '.blocks[0].type', 'first block must be title|titlebar|cells');
      // v3.4：cells 通用块（rawIR 官方重建）自带头/明细行，旧 header/detail 硬性要求不适用
      if (types.indexOf('cells') < 0) {
        if (types.indexOf('header') < 0) E(errs, 'REQUIRED', sp + '.blocks', 'missing header block');
        if (types.indexOf('detail') < 0) E(errs, 'REQUIRED', sp + '.blocks', 'missing detail block');
      }
      s.blocks.forEach(function (b, bi) {
        var bp = sp + '.blocks[' + bi + ']';
        if (!isObj(b)) { E(errs, 'INVALID_TYPE', bp, 'not an object'); return; }
        if (!hasOwn(BLOCK_TYPES, b.type)) E(errs, 'INVALID_ENUM', bp + '.type', 'unknown block type "' + b.type + '"（白名单: ' + Object.keys(BLOCK_TYPES).join('|') + '）');
        numOpt(errs, b, 'heightPt', bp);
        strOpt(errs, b, 'dataset', bp);
        if (b.type === 'title') {
          if (b.text == null || b.text === '') E(errs, 'REQUIRED', bp + '.text', 'title needs text');
          if (!isNum(b.span)) E(errs, 'REQUIRED', bp + '.span', 'title needs span (column count)');
        }
        // v4.0 条件属性族：块级/列级/item 级同形，when 形态与 then 白名单在此把关
        if (b.type !== 'chart') checkConditions(b.conditions, bp, errs);   // chart 条件=系列级格式（seriesColor|alpha），在 chart 分支单独把闸
        // v3.2 highlight 旧形态自检（object.js 以 {column,op,value,valueType}/{bg} 包成单条 condition）：坏 value/op 同炸点
        if (b.type === 'detail' && b.highlight != null) {
          var hp = bp + '.highlight';
          if (!isObj(b.highlight)) E(errs, 'INVALID_TYPE', hp, 'highlight must be object');
          else {
            var hl = b.highlight;
            if (!hl.column) E(errs, 'REQUIRED', hp + '.column', 'highlight needs column');
            if (hl.op != null && !hasOwn(OPS, hl.op)) E(errs, 'INVALID_ENUM', hp + '.op', 'highlight unknown op ' + hl.op);
            if (hl.value == null) E(errs, 'REQUIRED', hp + '.value', 'highlight needs value');
            if (hl.bg == null) E(errs, 'REQUIRED', hp + '.bg', 'highlight needs bg');
            if (hl.valueType != null && hl.valueType !== 'string' && hl.valueType !== 'number') E(errs, 'INVALID_ENUM', hp + '.valueType', 'highlight valueType must be "string"|"number"');
          }
        }
        eachArr(errs, b.columns, bp + '.columns', false, function (c, ci, cp) {
          if (!isObj(c)) { E(errs, 'INVALID_TYPE', cp, 'not an object'); return; }
          // name=数据集绑定键：detail 列必须有名；header 官方重建形态可 label-only（纯显示文本，无绑定）
          if (b.type === 'detail' && (!isStr(c.name) || c.name === '')) E(errs, 'REQUIRED', cp + '.name', 'column name required');
          if (c.type != null && !isStr(c.type)) E(errs, 'INVALID_TYPE', cp + '.type', 'column type must be string');
          numOpt(errs, c, 'widthPt', cp);
          strOpt(errs, c, 'format', cp);
          checkConditions(c.conditions, cp, errs);
          if (c.html != null && typeof c.html !== 'boolean') E(errs, 'INVALID_TYPE', cp + '.html', 'html must be boolean');
          if (c.dict != null) checkDict(c.dict, cp + '.dict', errs);
          // 批H 定案（2026-11-05）：license 墙已破（CellSortAttr/SortHeader env 后可加载——修正 #45 定性）、
          //   挂点已证（CellExpandAttr.setCellSortAttr/setSortFormula），但 setSortFormula 直塞不序列化、
          //   SortHeader 组合面（SortItem/Direction/SortRule/SortArea）无官方语料参照——结构化拒，不盲写
          if (c.sort != null) E(errs, 'UNSUPPORTED_CAPABILITY', cp + '.sort', '单元格排序：墙已破但缺官方语料（SortHeader 组合面），待语料后批收');
          // 批G：自定义分组（CustomGrouper 简单形态）
          if (c.groupCustom != null) {
            if (!isObj(c.groupCustom)) E(errs, 'INVALID_TYPE', cp + '.groupCustom', 'groupCustom must be object');
            else {
              if (c.groupCustom.other != null && !isNum(c.groupCustom.other)) E(errs, 'INVALID_NUMBER', cp + '.groupCustom.other', 'other must be number');
              if (c.groupCustom.otherDisplay != null && !isStr(c.groupCustom.otherDisplay)) E(errs, 'INVALID_TYPE', cp + '.groupCustom.otherDisplay', 'otherDisplay must be string');
              if (c.groupCustom.more != null && typeof c.groupCustom.more !== 'boolean') E(errs, 'INVALID_TYPE', cp + '.groupCustom.more', 'more must be boolean');
              if (c.groupCustom.force != null && typeof c.groupCustom.force !== 'boolean') E(errs, 'INVALID_TYPE', cp + '.groupCustom.force', 'force must be boolean');
              Object.keys(c.groupCustom).forEach(function (gk) { if (['other', 'otherDisplay', 'more', 'force'].indexOf(gk) < 0) E(errs, 'INVALID_ENUM', cp + '.groupCustom.' + gk, 'groupCustom keys: other|otherDisplay|more|force'); });
            }
          }
        });
        if (b.type === 'detail' && b.columns == null) E(errs, 'REQUIRED', bp + '.columns', 'detail needs columns');
        if (b.type === 'detail' && b.dataset == null) E(errs, 'REQUIRED', bp + '.dataset', 'detail needs dataset');
        if (b.type === 'header' && b.columns == null) E(errs, 'REQUIRED', bp + '.columns', 'header needs columns');
        // v3.4 cells 通用块：items 需有列号；linkTo 需有 reportlet 或 web.url
        if (b.type === 'cells') {
          eachArr(errs, b.items, bp + '.items', false, function (it, ii, ip) {
            if (!isObj(it)) { E(errs, 'INVALID_TYPE', ip, 'not an object'); return; }
            if (!isNum(it.c)) E(errs, 'REQUIRED', ip + '.c', 'missing c');
            // 2026-11-06（R3-0）：r 非负整数、span/rowSpan 正整数——结构化拒，不交给 Object/引擎猜
            if (it.r != null && (!isNum(it.r) || it.r !== Math.floor(it.r) || it.r < 0)) E(errs, 'INVALID_NUMBER', ip + '.r', 'r must be a non-negative integer');
            if (it.span != null && (!isNum(it.span) || it.span !== Math.floor(it.span) || it.span < 1)) E(errs, 'INVALID_NUMBER', ip + '.span', 'span must be a positive integer (>=1)');
            if (it.rowSpan != null && (!isNum(it.rowSpan) || it.rowSpan !== Math.floor(it.rowSpan) || it.rowSpan < 1)) E(errs, 'INVALID_NUMBER', ip + '.rowSpan', 'rowSpan must be a positive integer (>=1)');
            if (it.st != null && !isObj(it.st)) E(errs, 'INVALID_TYPE', ip + '.st', 'st must be an object (style spec)');
            if (it.linkTo != null) checkLinkShape(errs, it.linkTo, ip + '.linkTo');
            if (it.ds != null && !isObj(it.ds) && !isStr(it.ds)) E(errs, 'INVALID_TYPE', ip + '.ds', 'ds must be string|object');
            if (isObj(it.ds)) {
              strOpt(errs, it.ds, 'column', ip + '.ds');
              strOpt(errs, it.ds, 'ds', ip + '.ds');
              strOpt(errs, it.ds, 'summary', ip + '.ds');
              strOpt(errs, it.ds, 'result', ip + '.ds');
              if (it.ds.noExpand != null && typeof it.ds.noExpand !== 'boolean') E(errs, 'INVALID_TYPE', ip + '.ds.noExpand', 'noExpand must be boolean');
            }
            if (it.rich != null) {
              if (!Array.isArray(it.rich) || !it.rich.length) E(errs, 'INVALID_ARRAY', ip + '.rich', 'rich must be a non-empty array');
              else it.rich.forEach(function (rg, ri) {
                if (!isObj(rg)) { E(errs, 'INVALID_TYPE', ip + '.rich[' + ri + ']', 'not an object'); return; }
                if (rg.text == null) E(errs, 'REQUIRED', ip + '.rich[' + ri + '].text', 'rich part needs text');
              });
            }
            if (it.text != null && !isStr(it.text) && !isNum(it.text)) E(errs, 'INVALID_TYPE', ip + '.text', 'text must be string|number');
            if (!it.ds && !it.formula && !it.rich && !it.presentFormula && it.text == null && !it.st && !it.subreport) E(errs, 'REQUIRED', ip, 'empty item (no text/formula/rich/ds/st/subreport)');
            checkConditions(it.conditions, ip, errs);
            if (it.dict != null) checkDict(it.dict, ip + '.dict', errs);
            // 批G：条码/子报表（cells item 级）
            if (it.barcode != null) {
              if (!isObj(it.barcode)) E(errs, 'INVALID_TYPE', ip + '.barcode', 'barcode must be object');
              else {
                if (it.barcode.type != null && !isNum(it.barcode.type)) E(errs, 'INVALID_NUMBER', ip + '.barcode.type', 'type must be number（BarcodeAttr 条码类型枚举）');
                ['barWidth', 'barHeight'].forEach(function (bk) { if (it.barcode[bk] != null && !isNum(it.barcode[bk])) E(errs, 'INVALID_NUMBER', ip + '.barcode.' + bk, bk + ' must be number'); });
                if (it.barcode.drawingText != null && typeof it.barcode.drawingText !== 'boolean') E(errs, 'INVALID_TYPE', ip + '.barcode.drawingText', 'drawingText must be boolean');
                Object.keys(it.barcode).forEach(function (bk) { if (['type', 'barWidth', 'barHeight', 'drawingText'].indexOf(bk) < 0) E(errs, 'INVALID_ENUM', ip + '.barcode.' + bk, 'barcode keys: type|barWidth|barHeight|drawingText'); });
              }
            }
            if (it.subreport != null && !isStr(it.subreport)) E(errs, 'INVALID_TYPE', ip + '.subreport', 'subreport must be relative reportlets path');
          });
          // 2026-11-06（R3-0）：cells 块内区域重叠静态拒（显式 r 的格之间、无 r 的同行格之间）。
          //   混合（显式 r vs 默认行）IR 层无法确定默认行，由 object.js 绝对行兜底（r 倒退/重叠即抛错）。
          var cBoxes = [];
          (Array.isArray(b.items) ? b.items : []).forEach(function (it) {
            if (!isObj(it) || !isNum(it.c)) return;
            var rs0 = (it.rowSpan && it.rowSpan > 1) ? Math.floor(it.rowSpan) : 1;
            var cs0 = (it.span && it.span > 1) ? Math.floor(it.span) : 1;
            cBoxes.push({ c: it.c, cs: cs0, r: (it.r != null) ? it.r : null, rs: rs0, i: cBoxes.length });
          });
          for (var x1 = 0; x1 < cBoxes.length; x1++) for (var x2 = x1 + 1; x2 < cBoxes.length; x2++) {
            var AA = cBoxes[x1], BB = cBoxes[x2];
            if ((AA.r == null) !== (BB.r == null)) continue;
            var ar = (AA.r == null) ? 0 : AA.r, br = (BB.r == null) ? 0 : BB.r;
            if (AA.c < BB.c + BB.cs && BB.c < AA.c + AA.cs && ar < br + BB.rs && br < ar + AA.rs)
              E(errs, 'DUPLICATE', bp + '.items[' + BB.i + ']', 'cells 块内两格区域重叠（c' + AA.c + 'r' + ar + ' vs c' + BB.c + 'r' + br + '，含 span/rowSpan）');
          }
        }
        if (b.type === 'header' && b.corner) {
          var kp = bp + '.corner';
          if (!isObj(b.corner)) E(errs, 'INVALID_TYPE', kp, 'corner must be an object');
          else {
            if (!b.corner.text) E(errs, 'REQUIRED', kp + '.text', 'corner needs text');
            if (!isNum(b.corner.span) || !(b.corner.span > 1)) E(errs, 'INVALID_NUMBER', kp + '.span', 'corner.span must be >1');
          }
        }
        if (b.type === 'total') {
          if (b.aggregate == null && b.sumCols == null) E(errs, 'REQUIRED', bp + '.aggregate', 'total needs aggregate or sumCols');
          if (b.aggregate != null) {
            var ap = bp + '.aggregate';
            if (!isObj(b.aggregate)) E(errs, 'INVALID_TYPE', ap, 'aggregate must be an object');
            else {
              if (!hasOwn(AGG_FNS, b.aggregate.fn)) E(errs, 'INVALID_ENUM', ap + '.fn', 'aggregate.fn="' + b.aggregate.fn + '" 不支持（支持 ' + Object.keys(AGG_FNS).join('|') + '；自定义公式走 sumCols.formula）');
              // 2026-11-06 复审：列号必须整数 1..25（colLetter 只产 A..Z；0=合计 label 格，小数会让公式与落格错位）
              var colChk = function (v, path, label) {
                if (!isNum(v)) { E(errs, 'REQUIRED', path, label + ' 需要数字列'); return; }
                if (v === 0) { E(errs, 'UNSUPPORTED_CAPABILITY', path, label + ' 不能用列 0（合计 label 占 c0）'); return; }
                if (v !== Math.floor(v) || v < 1 || v > 25) E(errs, 'INVALID_NUMBER', path, label + ' 须整数列 1..25');
              };
              if (b.aggregate.fn === 'ratio') {
                colChk(b.aggregate.num, ap + '.num', 'ratio num');
                colChk(b.aggregate.den, ap + '.den', 'ratio den');
              } else colChk(b.aggregate.col, ap + '.col', 'aggregate.col');
              if (b.aggregate.format != null && !isStr(b.aggregate.format)) E(errs, 'INVALID_TYPE', ap + '.format', 'aggregate.format must be string');
            }
          }
          if (Array.isArray(b.sumCols) && !b.sumCols.length) E(errs, 'REQUIRED', bp + '.sumCols', 'sumCols empty');
          if (b.sumCols != null && b.aggregate != null) E(errs, 'UNSUPPORTED_CAPABILITY', bp, 'sumCols 与 aggregate 互斥（object 优先 sumCols，aggregate 写了不生效）');
        }
        var seenSumCols = {};
        eachArr(errs, b.sumCols, bp + '.sumCols', false, function (sc, sci, scp) {
          if (!isObj(sc)) { E(errs, 'INVALID_TYPE', scp, 'not an object'); return; }
          if (!isNum(sc.col)) E(errs, 'REQUIRED', scp + '.col', 'sumCols.col 需要数字列');
          else if (sc.col === 0) E(errs, 'UNSUPPORTED_CAPABILITY', scp + '.col', 'sumCols 不能用列 0（合计 label 占 c0）');
          else if (sc.col !== Math.floor(sc.col) || sc.col < 1 || sc.col > 25) E(errs, 'INVALID_NUMBER', scp + '.col', 'sumCols.col 须整数列 1..25');
          else if (seenSumCols[sc.col]) E(errs, 'DUPLICATE', scp + '.col', 'dup sumCols col ' + sc.col);
          else seenSumCols[sc.col] = 1;
          // 2026-11-06 P1：逐格聚合函数（缺省 sum）；ratio 需两列，走 formula 或 aggregate
          if (sc.fn != null && !hasOwn({ sum: 1, avg: 1, count: 1, min: 1, max: 1 }, sc.fn)) E(errs, 'INVALID_ENUM', scp + '.fn', 'sumCols.fn 支持 sum|avg|count|min|max（ratio 用 formula）');
          if (sc.fn != null && sc.formula != null) E(errs, 'UNSUPPORTED_CAPABILITY', scp, 'sumCols.fn 与 formula 互斥（formula 优先，fn 写了不生效）');
          if (sc.formula != null && String(sc.formula).charAt(0) !== '=') E(errs, 'INVALID_TYPE', scp + '.formula', 'formula needs "=" prefix');
        });
      });
    });
    if (!Array.isArray(IR.datasets) || !IR.datasets.length) E(errs, 'REQUIRED', 'datasets', 'no datasets');
    // v3.5 数据集两形态：kind=sql（连接名 + 模板内置 SQL）/ 默认自包含（columns+rows）
    var dsArr = Array.isArray(IR.datasets) ? IR.datasets : [];
    var seenDs = {};
    dsArr.forEach(function (ds, di) {
      var dp = 'datasets[' + di + ']';
      if (!isObj(ds)) { E(errs, 'INVALID_TYPE', dp, 'not an object'); return; }
      if (ds.name == null || ds.name === '' || !isStr(ds.name)) {
        if (ds.name != null && !isStr(ds.name)) E(errs, 'INVALID_TYPE', dp + '.name', 'name must be string');
        else E(errs, 'REQUIRED', dp + '.name', 'dataset name required');
      } else if (hasOwn(seenDs, ds.name)) E(errs, 'DUPLICATE', dp + '.name', 'duplicate dataset name "' + ds.name + '"');
      else seenDs[ds.name] = 1;
      if (ds.kind != null && ds.kind !== 'sql' && ds.kind !== 'embedded') E(errs, 'INVALID_ENUM', dp + '.kind', 'kind must be "sql"|"embedded"（缺省=embedded 自包含）');
      if (ds.kind === 'sql') {
        if (!ds.connection) E(errs, 'REQUIRED', dp + '.connection', 'sql needs connection');
        if (!ds.query) E(errs, 'REQUIRED', dp + '.query', 'sql needs query');
        else if (!isStr(ds.query)) E(errs, 'INVALID_TYPE', dp + '.query', 'query must be string');
        // I0-04（r2.md）只读闸：单语句 SELECT/WITH 起头 + 禁内嵌 ;（多语句注入面）。
        //   既有语料实证零误伤：5 张 sql spec + 浏览器族 pagedSql/fullSql 全为 WITH/SELECT 起头、无 ;
        else if (!/^(SELECT|WITH)\b/i.test(ds.query.replace(/^[\s(]+/, '')) || ds.query.indexOf(';') >= 0)
          E(errs, 'SQL_READONLY', dp + '.query', 'sql query 必须单语句 SELECT/WITH 起头且无内嵌 ;（只读闸）');
      } else {
        if (ds.columns == null || ds.rows == null) E(errs, 'REQUIRED', dp, 'embedded needs columns+rows');
        eachArr(errs, ds.columns, dp + '.columns', false, function (c, ci, cp) {
          if (!isObj(c)) { E(errs, 'INVALID_TYPE', cp, 'not an object'); return; }
          if (!isStr(c.name) || c.name === '') E(errs, 'REQUIRED', cp + '.name', 'column name required');
          if (c.type != null && !isStr(c.type)) E(errs, 'INVALID_TYPE', cp + '.type', 'column type must be string');
          if (c.type != null && !hasOwn(EDS_TYPES, c.type)) E(errs, 'INVALID_ENUM', cp + '.type', 'embedded column type 越白名单: ' + c.type + '（词表: ' + Object.keys(EDS_TYPES).join('|') + '）');
          strOpt(errs, c, 'format', cp);
        });
        eachArr(errs, ds.rows, dp + '.rows', false, function (r, ri, rp) {
          if (!Array.isArray(r)) { E(errs, 'INVALID_ARRAY', rp, 'row must be an array'); return; }
          if (Array.isArray(ds.columns) && ds.columns.length && r.length !== ds.columns.length)
            E(errs, 'INVALID_SHAPE', rp, 'row width ' + r.length + ' != columns ' + ds.columns.length);
          else if (Array.isArray(ds.columns)) {
            ds.columns.forEach(function (c, cj) {
              if (c && isObj(c) && c.type) checkRowValue(r[cj], c.type, rp + '[' + cj + ']', errs);
            });
          }
        });
      }
      if (ds.params != null) eachArr(errs, ds.params, dp + '.params', false, function (p, pi, pp) {
        if (!isObj(p)) { E(errs, 'INVALID_TYPE', pp, 'param must be an object'); return; }
        if (!isStr(p.name) || p.name === '') E(errs, 'REQUIRED', pp + '.name', 'param needs name');
        if (p.formula == null && p.value == null) E(errs, 'REQUIRED', pp + '.value', 'param needs value or formula');
        if (p.formula != null && !isStr(p.formula)) E(errs, 'INVALID_TYPE', pp + '.formula', 'formula must be string');
        if (p.value != null && !isStr(p.value) && !isNum(p.value) && typeof p.value !== 'boolean') E(errs, 'INVALID_TYPE', pp + '.value', 'value must be string|number|boolean');
      });
    });
    // v4.1 新增能力族校验：富文本/公式显示/浮层/水印/工具栏（容器逐层防护）
    IR.sheets.forEach(function (s, si) {
      if (!s || !isObj(s)) return; // 结构层已报 not an object；此处只取 floats/widthsPt（审计 P1-2 同类残余：null sheet 自炸）
      eachArr(errs, s.widthsPt, 'sheets[' + si + '].widthsPt', false, function (w, wi, wp) {
        if (!isNum(w)) E(errs, 'INVALID_NUMBER', wp, 'widthPt must be a finite number');
      });
      // 2026-11-06（C2）：隐藏行列 = 行高/列宽归零（object 在 sheet 构建末应用）；整数下标闸
      ['hideRows', 'hideCols'].forEach(function (hk) {
        eachArr(errs, s[hk], 'sheets[' + si + '].' + hk, false, function (x, xi, xp) {
          if (!isNum(x) || x !== Math.floor(x) || x < 0) E(errs, 'INVALID_NUMBER', xp, hk + ' items must be non-negative integers');
        });
      });
      // 审查轮1 P2：paper 此前无任何校验，object 直接 FU.getInstance(width/height/...) → NaN 纸型
      if (s.paper != null) {
        if (!isObj(s.paper)) E(errs, 'INVALID_TYPE', 'sheets[' + si + '].paper', 'paper must be an object');
        else ['width', 'height', 'top', 'left', 'bottom', 'right'].forEach(function (pk) {
          if (!isNum(s.paper[pk]) || s.paper[pk] < 0) E(errs, 'INVALID_NUMBER', 'sheets[' + si + '].paper.' + pk, 'paper.' + pk + ' must be a non-negative number');
        });
      }
      eachArr(errs, s.floats, 'sheets[' + si + '].floats', false, function (fl, fi, fp) {
        if (!isObj(fl)) { E(errs, 'INVALID_TYPE', fp, 'not an object'); return; }
        if (!fl.text && !fl.rich && !fl.imageFile) E(errs, 'REQUIRED', fp, 'needs text | rich | imageFile');
        if (fl.rich != null) {
          if (!Array.isArray(fl.rich) || !fl.rich.length) E(errs, 'INVALID_ARRAY', fp + '.rich', 'rich must be a non-empty array');
          else fl.rich.forEach(function (rg, ri) {
            if (!isObj(rg)) { E(errs, 'INVALID_TYPE', fp + '.rich[' + ri + ']', 'not an object'); return; }
            if (rg.text == null) E(errs, 'REQUIRED', fp + '.rich[' + ri + '].text', 'rich part needs text');
          });
        }
        ['leftPt', 'topPt', 'widthPt', 'heightPt'].forEach(function (k) {
          if (fl[k] != null && !isNum(fl[k])) E(errs, 'INVALID_NUMBER', fp + '.' + k, k + ' must be number');
        });
        if (fl.imageFile != null && !isStr(fl.imageFile)) E(errs, 'INVALID_TYPE', fp + '.imageFile', 'imageFile must be string');
        if (fl.imageFormat != null && !hasOwn(IMAGE_FMTS, fl.imageFormat)) E(errs, 'INVALID_ENUM', fp + '.imageFormat', 'imageFormat not in png|jpg|jpeg|gif|bmp: ' + fl.imageFormat);
        if (fl.style != null && !isObj(fl.style)) E(errs, 'INVALID_TYPE', fp + '.style', 'style must be an object');
        if (fl.text != null && !isStr(fl.text) && !isNum(fl.text)) E(errs, 'INVALID_TYPE', fp + '.text', 'text must be string|number');
        if (fl.linkTo != null) checkLinkShape(errs, fl.linkTo, fp + '.linkTo');
      });
      // 批C：页眉页脚（sheet 级）
      if (s.headerFooter != null) checkHeaderFooter(s.headerFooter, 'sheets[' + si + '].headerFooter', errs);
    });
    // 批C：模板级 attrMark（workbook 级）
    if (IR.templateId != null && !isStr(IR.templateId)) E(errs, 'INVALID_TYPE', 'templateId', 'templateId must be string');    if (IR.templateTheme != null) {
      if (!isObj(IR.templateTheme)) E(errs, 'INVALID_TYPE', 'templateTheme', 'templateTheme must be object');
      else {
        if (!isStr(IR.templateTheme.name) || IR.templateTheme.name === '') E(errs, 'REQUIRED', 'templateTheme.name', 'templateTheme needs name');
        if (IR.templateTheme.dark != null && typeof IR.templateTheme.dark !== 'boolean') E(errs, 'INVALID_TYPE', 'templateTheme.dark', 'dark must be boolean');
      }
    }
    // 批F：填报属性（ReportWriteAttr=AttributeTarget 挂 sheet；BuiltInSQLSubmiter+IntelliDMLConfig 官方 产品月销量情况录入表.cpt 形态）
    if (IR.write != null) {
      if (!isObj(IR.write)) E(errs, 'INVALID_TYPE', 'write', 'write must be object');
      else {
        // 审查轮1 P2：write 挂点是单 sheet（object 在 sheet 循环后挂到最后一个 sheet）；多 sheet 时语义不明确 → 拒
        if (IR.sheets.length > 1) E(errs, 'UNSUPPORTED_CAPABILITY', 'write', '多 sheet 下 write 挂点不明确（当前实现挂最后一个 sheet）；请拆成单 sheet 模板');
        if (!isObj(IR.write.table) || !isStr(IR.write.table.name) || IR.write.table.name === '') E(errs, 'REQUIRED', 'write.table.name', 'write needs table.name');
        if (isObj(IR.write.table) && IR.write.table.schema != null && !isStr(IR.write.table.schema)) E(errs, 'INVALID_TYPE', 'write.table.schema', 'schema must be string');
        if (IR.write.name != null && !isStr(IR.write.name)) E(errs, 'INVALID_TYPE', 'write.name', 'name must be string');
        if (IR.write.connection != null && !isStr(IR.write.connection)) E(errs, 'INVALID_TYPE', 'write.connection', 'connection must be string（连接名，凭据不落模板）');
        if (!Array.isArray(IR.write.columns) || !IR.write.columns.length) E(errs, 'REQUIRED', 'write.columns', 'write needs columns');
        else IR.write.columns.forEach(function (col, ci) {
          var cp = 'write.columns[' + ci + ']';
          if (!isObj(col)) { E(errs, 'INVALID_TYPE', cp, 'not an object'); return; }
          if (!isStr(col.name) || col.name === '') E(errs, 'REQUIRED', cp + '.name', 'column needs name');
          if (!Array.isArray(col.cell) || col.cell.length !== 2 || !isNum(col.cell[0]) || !isNum(col.cell[1])) E(errs, 'REQUIRED', cp + '.cell', 'column needs cell [col,row]（单格 v1；多格 ColumnRowGroup 后续批）');
          if (col.isKey != null && typeof col.isKey !== 'boolean') E(errs, 'INVALID_TYPE', cp + '.isKey', 'isKey must be boolean');
          if (col.skipUnmodified != null && typeof col.skipUnmodified !== 'boolean') E(errs, 'INVALID_TYPE', cp + '.skipUnmodified', 'skipUnmodified must be boolean');
        });
        // verifiers 结构化拒（一处真相红线：VerifyItem 不实现 Verifier 接口挂不上 ReportWriteAttr——build 不消费的词汇不许放行；真实 Verifier 家族待 probe 后批）
        if (IR.write.verifiers != null) E(errs, 'UNSUPPORTED_CAPABILITY', 'write.verifiers', 'verifiers 挂点未通（VerifyItem≠Verifier），暂结构化拒');
      }
    }
    if (IR.watermark != null) {
      if (!isObj(IR.watermark)) E(errs, 'INVALID_TYPE', 'watermark', 'watermark must be an object');
      else {
        if (IR.watermark.text == null) E(errs, 'REQUIRED', 'watermark.text', 'watermark: missing text');
        ['fontSize', 'hGap', 'vGap'].forEach(function (k) {
          if (IR.watermark[k] != null && !isNum(IR.watermark[k])) E(errs, 'INVALID_NUMBER', 'watermark.' + k, k + ' must be number');
        });
        if (IR.watermark.color != null && !isNum(IR.watermark.color) && !isStr(IR.watermark.color)) E(errs, 'INVALID_TYPE', 'watermark.color', 'color must be color int|string');
      }
    }
    if (IR.toolbar != null) {
      if (!isObj(IR.toolbar)) E(errs, 'INVALID_TYPE', 'toolbar', 'toolbar must be an object');
      else if (IR.toolbar.buttons == null) E(errs, 'REQUIRED', 'toolbar.buttons', 'toolbar: no buttons');
      else eachArr(errs, IR.toolbar.buttons, 'toolbar.buttons', false, function (b, bi, bp) {
        var key = isStr(b) ? b : (isObj(b) ? b.kind : null);
        if (!key || !TOOLBAR_KEYS[key]) E(errs, 'INVALID_ENUM', bp, 'toolbar button unknown kind ' + key + '（className 逃生口已移除，安全批 B）');
        if (isObj(b)) { strOpt(errs, b, 'text', bp); strOpt(errs, b, 'icon', bp); }
      });
    }
    // ===== 语义层（跨对象引用完整性——审计 P1-3；容器级防护，结构层报过的不再阻断此处）=====
    var dsIdx = {};
    dsArr.forEach(function (ds) { if (ds && isObj(ds) && ds.name != null) dsIdx[ds.name] = ds; });
    function dsCols(ds) {
      var o = {};
      if (ds && ds.kind !== 'sql' && Array.isArray(ds.columns)) ds.columns.forEach(function (c) { if (c && isObj(c) && c.name != null) o[c.name] = 1; });
      return o;
    }
    IR.sheets.forEach(function (s, si) {
      if (!s || !isObj(s) || !Array.isArray(s.blocks)) return;
      s.blocks.forEach(function (b, bi) {
        if (!b || !isObj(b)) return;
        var bp = 'sheets[' + si + '].blocks[' + bi + ']';
        // 数据集引用存在性（detail/chart）
        if ((b.type === 'detail' || b.type === 'chart') && b.dataset != null && dsIdx[b.dataset] == null)
          E(errs, 'UNKNOWN_REF', bp + '.dataset', 'unknown dataset "' + b.dataset + '"');
        // detail.link 校验独立成段（原困在 chart 分支内永不可达——审计 P1-1）
        if (b.type === 'detail' && b.link != null) {
          var lp = bp + '.link';
          if (checkLinkShape(errs, b.link, lp)) {
            if (!b.link.reportlet) E(errs, 'REQUIRED', lp + '.reportlet', 'link needs reportlet path');
            if (b.link.by != null && Array.isArray(b.columns) && b.columns.some(function (c) { return c && isObj(c) && c.name === b.link.by; }) === false)
              E(errs, 'UNKNOWN_REF', lp + '.by', 'link.by not in detail columns: ' + b.link.by);
          }
        }
        // 条件属性/highlight 列成员校验（迭代 1；Agent 生成 IR 列名写错高发点。kind=sql 列名运行期可变→列级豁免）
        if (b.type === 'detail') {
          var dsc = dsCols(dsIdx[b.dataset]);
          var dscAny = false; for (var ck3 in dsc) { dscAny = true; break; }
          if (dscAny) {
            var badCol = function (col, colPath) {
              if (col != null && !dsc[col]) E(errs, 'UNKNOWN_REF', colPath, 'column not in dataset "' + b.dataset + '" columns: ' + col);
            };
            if (Array.isArray(b.conditions)) b.conditions.forEach(function (cd, k) {
              if (cd && isObj(cd) && cd.when) eachWhenColumn(cd.when, bp + '.conditions[' + k + '].when', badCol);
            });
            if (Array.isArray(b.columns)) b.columns.forEach(function (c, ci) {
              if (c && isObj(c) && Array.isArray(c.conditions)) c.conditions.forEach(function (cd, cdi) {
                if (cd && isObj(cd) && cd.when) eachWhenColumn(cd.when, bp + '.columns[' + ci + '].conditions[' + cdi + '].when', badCol);
              });
            });
            if (b.highlight && isObj(b.highlight)) badCol(b.highlight.column, bp + '.highlight.column');
          }
        }
        // 图表列成员校验（kind=sql 数据集列名运行期可变 → 列级检查豁免）
        if (b.type === 'chart') {
          if (!hasOwn(CHART_KINDS, b.kind)) E(errs, 'INVALID_ENUM', bp + '.kind', 'unknown chart kind ' + b.kind);
          if (b.kind === 'vscatter' || b.kind === 'vbubble') {
            if (!b.dataset || !b.x || !b.y) E(errs, 'REQUIRED', bp, 'scatter chart needs dataset/x/y');
          } else if (!b.dataset || !b.category || !(b.value || (b.values && b.values.length))) {
            E(errs, 'REQUIRED', bp, 'chart needs dataset/category/(value|values)');
          }
          var colOk = dsCols(dsIdx[b.dataset]);
          var colOkAny = false;
          for (var ck2 in colOk) { colOkAny = true; break; }
          if (colOkAny) {
            if (b.category != null && !colOk[b.category]) E(errs, 'UNKNOWN_REF', bp + '.category', 'chart category not in dataset columns: ' + b.category);
            var vstrs = [];
            if (typeof b.value === 'string') vstrs.push([b.value, bp + '.value']);
            eachArr(errs, b.values, bp + '.values', false, function (v, vi, vp) { if (typeof v === 'string') vstrs.push([v, vp]); });
            if (typeof b.x === 'string') vstrs.push([b.x, bp + '.x']);
            if (typeof b.y === 'string') vstrs.push([b.y, bp + '.y']);
            vstrs.forEach(function (t) {
              if (!colOk[t[0]]) E(errs, 'UNKNOWN_REF', t[1], 'chart column not in dataset columns: ' + t[0]);
            });
          }
          // 批B（2026-11-04）图表装饰层形态闸：仅 Van 图族（kind 以 v 开头）；stack 仅 vbar/varea。
          //   探针依据 probe_chartdeco/2/3：挂接=plot.setConditionCollection；plot 级 alpha/bg/border=GeneralInfo setters。
          var TF_KEYS = { series: 1, value: 1, percent: 1, changedValue: 1, changedPercent: 1, category: 1, x: 1, y: 1, size: 1 };
          var MARKER_TYPES = { none: 1, circle: 1, square: 1, diamond: 1, triangle: 1, circleHollow: 1, squareHollow: 1, diamondHollow: 1, triangleHollow: 1, star: 1, rect: 1, dialog: 1, parallelogram: 1, ellipse: 1, lineTriangle: 1 };
          ['tooltip', 'label', 'marker', 'lineStyle', 'trend', 'stack'].forEach(function (dk) {
            if (b[dk] == null) return;
            if (b.kind.charAt(0) !== 'v') { E(errs, 'INVALID_SHAPE', bp + '.' + dk, '装饰层仅 Van 图（kind 以 v 开头）支持: ' + dk); return; }
            if (!isObj(b[dk])) { E(errs, 'INVALID_TYPE', bp + '.' + dk, dk + ' must be object'); return; }
            var op = b[dk];
            Object.keys(op).forEach(function (k) {
              var AL = { tooltip: { muti: 'bool', formats: 'obj', richText: 'obj' }, label: { enable: 'bool', position: 'num', fontPt: 'num', color: 'num', bold: 'bool', backgroundColor: 'num', align: 'num', autoAdjust: 'bool', showGuidLine: 'bool', richText: 'obj', summary: 'sum' },
                marker: { type: 'marker', radius: 'num', common: 'bool', alpha: 'num' },
                lineStyle: { type: 'ltype', style: 'lstyle', width: 'num' },
                trend: { type: 'trend', name: 'str', pre: 'num', after: 'num' },
                stack: { stacked: 'bool', percent: 'bool', stackId: 'str' } }[dk];
              if (!AL || !(k in AL)) { E(errs, 'INVALID_ENUM', bp + '.' + dk + '.' + k, dk + ' key not in ' + Object.keys(AL || {}).join('|')); return; }
              var v = op[k];
              if (AL[k] === 'bool' && typeof v !== 'boolean') E(errs, 'INVALID_TYPE', bp + '.' + dk + '.' + k, k + ' must be boolean');
              if (AL[k] === 'obj' && !isObj(v)) E(errs, 'INVALID_TYPE', bp + '.' + dk + '.' + k, k + ' must be object');
              if (AL[k] === 'num' && !isNum(v)) E(errs, 'INVALID_NUMBER', bp + '.' + dk + '.' + k, k + ' must be number');
              if (AL[k] === 'str' && !isStr(v)) E(errs, 'INVALID_TYPE', bp + '.' + dk + '.' + k, k + ' must be string');
              if (AL[k] === 'marker' && !hasOwn(MARKER_TYPES, v)) E(errs, 'INVALID_ENUM', bp + '.' + dk + '.type', 'marker type 15 白名单 ' + Object.keys(MARKER_TYPES).join('|'));
              if (AL[k] === 'ltype' && { solid: 1, dashed: 1, none: 1 }[v] == null) E(errs, 'INVALID_ENUM', bp + '.' + dk + '.type', 'line type 白名单 solid|dashed|none');
              if (AL[k] === 'lstyle' && { normal: 1, step: 1, curve: 1 }[v] == null) E(errs, 'INVALID_ENUM', bp + '.' + dk + '.style', 'line style 白名单 normal|step|curve');
              if (AL[k] === 'trend' && { linear: 1, exp: 1, log: 1, poly: 1 }[v] == null) E(errs, 'INVALID_ENUM', bp + '.' + dk + '.type', 'trend type 白名单 linear|exp|log|poly');
              if (AL[k] === 'sum' && !(v === true || isObj(v))) E(errs, 'INVALID_TYPE', bp + '.' + dk + '.' + k, k + ' must be true or object {format}');
            });
            if (dk === 'tooltip' && op.formats != null) {
              if (!isObj(op.formats)) E(errs, 'INVALID_TYPE', bp + '.tooltip.formats', 'formats must be object');
              else Object.keys(op.formats).forEach(function (fk) {
                if (!hasOwn(TF_KEYS, fk)) { E(errs, 'INVALID_ENUM', bp + '.tooltip.formats.' + fk, 'tooltip format key 白名单 ' + Object.keys(TF_KEYS).join('|')); return; }
                // x/y/size 物理归属=散点/气泡（ScatterAttrTooltipContent 独有三槽，probe_r4m14c/cpt 一手）——其余 kind 结构化拒
                if ((fk === 'x' || fk === 'y' || fk === 'size') && b.kind !== 'vscatter' && b.kind !== 'vbubble') { E(errs, 'INVALID_SHAPE', bp + '.tooltip.formats.' + fk, 'x|y|size 仅 vscatter/vbubble（ScatterAttrTooltipContent 独有槽位）'); return; }
                var fv = op.formats[fk];
                if (fv !== true && !isStr(fv)) E(errs, 'INVALID_TYPE', bp + '.tooltip.formats.' + fk, 'value must be true or numeric format string like #,##0.0');
              });
            }
            if (dk === 'tooltip' && op.richText != null) {
              if (!isObj(op.richText)) E(errs, 'INVALID_TYPE', bp + '.tooltip.richText', 'richText must be object');
              else {
                if (op.richText.content == null || !isStr(op.richText.content)) E(errs, 'REQUIRED', bp + '.tooltip.richText.content', 'richText needs content（string）');
                if (op.richText.auto != null && typeof op.richText.auto !== 'boolean') E(errs, 'INVALID_TYPE', bp + '.tooltip.richText.auto', 'auto must be boolean');
              }
            }
            if (dk === 'label' && op.richText != null) {
              if (!isObj(op.richText)) E(errs, 'INVALID_TYPE', bp + '.label.richText', 'richText must be object');
              else {
                if (op.richText.content == null || !isStr(op.richText.content)) E(errs, 'REQUIRED', bp + '.label.richText.content', 'richText needs content（string）');
                if (op.richText.auto != null && typeof op.richText.auto !== 'boolean') E(errs, 'INVALID_TYPE', bp + '.label.richText.auto', 'auto must be boolean');
              }
            }
            if (dk === 'label' && op.summary != null) {
              // 审查 P1-A（2026-11-06 轮2）：无论 summary=true 还是 {format}，只要非空就必须 vpie
              //   （物理宿主=PieCategoryLabelContent 独有；非 vpie 结构化拒，不静默丢）
              if (b.kind !== 'vpie') E(errs, 'INVALID_SHAPE', bp + '.label.summary', 'label.summary 仅 vpie(PieCategoryLabelContent 独有槽位)');
              else if (isObj(op.summary)) {
                if (op.summary.format != null && !isStr(op.summary.format)) E(errs, 'INVALID_TYPE', bp + '.label.summary.format', 'format must be string');
                if (Object.keys(op.summary).some(function (sk) { return sk !== 'format'; })) E(errs, 'INVALID_ENUM', bp + '.label.summary', 'summary keys: format');
              }
            }
            if (dk === 'stack' && !{ vbar: 1, varea: 1 }[b.kind]) E(errs, 'INVALID_SHAPE', bp + '.stack', 'stack 仅 vbar/varea（setStackAndAxisCondition 属 RectanglePlot）');
            if (dk === 'trend' && op.type == null) E(errs, 'REQUIRED', bp + '.trend.type', 'trend needs type');
          });
          // plot 级外观（alpha/bg/border）+ axisY.unit 主刻度（#46）
          if (b.alpha != null && !isNum(b.alpha)) E(errs, 'INVALID_NUMBER', bp + '.alpha', 'alpha must be number 0..1');
          if (b.alpha != null && (b.alpha < 0 || b.alpha > 1)) E(errs, 'INVALID_NUMBER', bp + '.alpha', 'alpha must be 0..1');
          if (b.bg != null && !isNum(b.bg)) E(errs, 'INVALID_TYPE', bp + '.bg', 'bg must be argb color number');
          if (b.border != null) {
            if (!isObj(b.border)) E(errs, 'INVALID_TYPE', bp + '.border', 'border must be object');
            else Object.keys(b.border).forEach(function (k) {
              if (k !== 'color' && k !== 'style') E(errs, 'INVALID_ENUM', bp + '.border.' + k, 'border keys: color|style');
              else if (!isNum(b.border[k])) E(errs, 'INVALID_NUMBER', bp + '.border.' + k, 'border.' + k + ' must be number');
            });
          }
          // 审查轮1 P2：legend/barInterval 此前被 spec 白名单接受但 IR 无闸（object 直接 consume → 类型错直进 Java）
          if (b.legend != null) {
            if (!isObj(b.legend)) E(errs, 'INVALID_TYPE', bp + '.legend', 'legend must be object');
            else Object.keys(b.legend).forEach(function (k) {
              var LT = { fontPt: 'num', color: 'num', position: 'num', visible: 'bool', bold: 'bool' };
              if (!hasOwn(LT, k)) { E(errs, 'INVALID_ENUM', bp + '.legend.' + k, 'legend keys: ' + Object.keys(LT).join('|')); return; }
              if (LT[k] === 'num' && !isNum(b.legend[k])) E(errs, 'INVALID_NUMBER', bp + '.legend.' + k, k + ' must be number');
              if (LT[k] === 'bool' && typeof b.legend[k] !== 'boolean') E(errs, 'INVALID_TYPE', bp + '.legend.' + k, k + ' must be boolean');
            });
          }
          if (b.barInterval != null && !isNum(b.barInterval)) E(errs, 'INVALID_NUMBER', bp + '.barInterval', 'barInterval must be a finite number');
          // 审查轮2：object 只在 (van || legend) 应用 barInterval；legacy 无 legend 时写了会被丢 → 拒
          if (b.barInterval != null && b.kind.charAt(0) !== 'v' && b.legend == null) E(errs, 'INVALID_SHAPE', bp + '.barInterval', 'barInterval 仅 Van 图（或带 legend 的 legacy 图）生效');
          // 公共键=legacy/Van 同适用（probe_legacy_axis 实证 ValueAxis setter 面 + test_legacy_axis 真引擎
          //   部署 XML：TextAttr/FRFont/foreground/isShowAxisLabel/AxisReversed/ArrowShow 均落 legacy ValueAxis）。
          //   ★ title 归 Van 专属：legacy Axis.setTitle(Title) 实测不序列化（部署 XML 零命中），
          //     Van 才有 axisName= 属性（m17 实拍 setTitle 渲染）——审查 P1-B 轮2 一并收紧，不静默丢。
          //   max|min|unit|alerts=Van 专属（VanChartAlertValue 类+custom 开关只在 Van 路径验证过）。
          function checkAxisShape(o, p, isY) {
            if (!isObj(o)) { E(errs, 'INVALID_TYPE', p, (isY ? 'axisY' : 'axisX') + ' must be object'); return false; }
            var AX_COMMON = { fontPt: 'num', color: 'num', reversed: 'bool', arrow: 'bool', gridColor: 'num', gridStyle: 'num', rotation: 'bool', showLabel: 'bool', format: 'str' };
            // max|min 归公共：probe_legacy_axis 实证 legacy ValueAxis 有 setMaxValue/setMinValue（既有 #46 用法 rebuild_first.js 在用）
            var AX_Y_COMMON = { max: 'num', min: 'num' };
            // unit|alerts 归 Van 专属：customMainUnit/VanChartAlertValue 只在 Van 路径验证（rebuild_first 无此键，零误伤）
            var AX_Y_VAN = { unit: 'num' };
            var isVan = b.kind.charAt(0) === 'v';
            Object.keys(o).forEach(function (k) {
              if (AX_COMMON[k] != null) {
                var t = AX_COMMON[k];
                if (t === 'num' && !isNum(o[k])) E(errs, 'INVALID_NUMBER', p + '.' + k, k + ' must be number');
                if (t === 'str' && !isStr(o[k])) E(errs, 'INVALID_TYPE', p + '.' + k, k + ' must be string');
                if (t === 'bool' && typeof o[k] !== 'boolean') E(errs, 'INVALID_TYPE', p + '.' + k, k + ' must be boolean');
                return;
              }
              if (k === 'title') {
                if (!isVan) { E(errs, 'INVALID_SHAPE', p + '.title', 'axis title 仅 Van 图族（legacy ValueAxis.setTitle 实测不序列化，不静默丢）'); return; }
                if (!isStr(o[k])) E(errs, 'INVALID_TYPE', p + '.title', 'title must be string');
                return;
              }
              if (isY && AX_Y_COMMON[k] != null) {
                if (!isNum(o[k])) E(errs, 'INVALID_NUMBER', p + '.' + k, k + ' must be number');
                return;
              }
              if (isY && (AX_Y_VAN[k] != null || k === 'alerts')) {
                if (!isVan) { E(errs, 'INVALID_SHAPE', p + '.' + k, k + ' 仅 Van 图族支持（legacy ValueAxis 该组合未验证，不静默丢）'); return; }
                if (k !== 'alerts' && !isNum(o[k])) E(errs, 'INVALID_NUMBER', p + '.' + k, k + ' must be number');
                return;   // alerts 子闸（下）
              }
              E(errs, 'INVALID_ENUM', p + '.' + k, (isY ? 'axisY' : 'axisX') + ' keys: ' + Object.keys(AX_COMMON).concat(['title']).concat(isY ? Object.keys(AX_Y_COMMON).concat(Object.keys(AX_Y_VAN), ['alerts']) : []).join('|'));
            });
            return true;
          }
          if (b.axisY != null && checkAxisShape(b.axisY, bp + '.axisY', true)) {
            if (b.axisY.alerts != null) {
              if (!Array.isArray(b.axisY.alerts)) E(errs, 'INVALID_ARRAY', bp + '.axisY.alerts', 'alerts must be array');
              else b.axisY.alerts.forEach(function (al, ai) {
                var ap = bp + '.axisY.alerts[' + ai + ']';
                if (!isObj(al)) { E(errs, 'INVALID_TYPE', ap, 'alert must be object'); return; }
                if (al.value == null || !isNum(al.value)) { E(errs, 'REQUIRED', ap + '.value', 'alert needs value（number）'); return; }
                Object.keys(al).forEach(function (k) {
                  if ({ value: 1, content: 1, color: 1, alpha: 1 }[k] == null) { E(errs, 'INVALID_ENUM', ap + '.' + k, 'alert keys: value|content|color|alpha'); return; }
                  if (k === 'content' && !isStr(al[k])) E(errs, 'INVALID_TYPE', ap + '.content', 'content must be string');
                  if ((k === 'color' || k === 'alpha') && !isNum(al[k])) E(errs, 'INVALID_NUMBER', ap + '.' + k, k + ' must be number');
                  if (k === 'alpha' && (al[k] < 0 || al[k] > 1)) E(errs, 'INVALID_NUMBER', ap + '.alpha', 'alpha must be 0..1');
                });
              });
            }
          }
          if (b.axisX != null) checkAxisShape(b.axisX, bp + '.axisX', false);
          // 批B后继（2026-11-06）扩容词汇闸：hotTooltip/seriesBorder/effect/areaFill/seriesImage（probe_r4m14/b 方法面一手）
          if (b.hotTooltip != null) {
            if (!isObj(b.hotTooltip)) E(errs, 'INVALID_TYPE', bp + '.hotTooltip', 'hotTooltip must be object');
            else Object.keys(b.hotTooltip).forEach(function (k) {
              if ({ position: 1, showMutiSeries: 1, whiteBackground: 1, seriesLabel: 1, format: 1, percentFormat: 1 }[k] == null) { E(errs, 'INVALID_ENUM', bp + '.hotTooltip.' + k, 'hotTooltip keys: position|showMutiSeries|whiteBackground|seriesLabel|format|percentFormat'); return; }
              if ((k === 'position') && !isNum(b.hotTooltip[k])) E(errs, 'INVALID_NUMBER', bp + '.hotTooltip.position', 'position must be number');
              if ((k === 'showMutiSeries' || k === 'whiteBackground') && typeof b.hotTooltip[k] !== 'boolean') E(errs, 'INVALID_TYPE', bp + '.hotTooltip.' + k, k + ' must be boolean');
              if ((k === 'seriesLabel' || k === 'format' || k === 'percentFormat') && !isStr(b.hotTooltip[k])) E(errs, 'INVALID_TYPE', bp + '.hotTooltip.' + k, k + ' must be string');
            });
          }
          if (b.seriesBorder != null) {
            if (!isObj(b.seriesBorder)) E(errs, 'INVALID_TYPE', bp + '.seriesBorder', 'seriesBorder must be object');
            else Object.keys(b.seriesBorder).forEach(function (k) {
              if ({ color: 1, style: 1, alpha: 1 }[k] == null) { E(errs, 'INVALID_ENUM', bp + '.seriesBorder.' + k, 'seriesBorder keys: color|style|alpha'); return; }
              if (!isNum(b.seriesBorder[k])) E(errs, 'INVALID_NUMBER', bp + '.seriesBorder.' + k, k + ' must be number');
              if (k === 'alpha' && (b.seriesBorder[k] < 0 || b.seriesBorder[k] > 1)) E(errs, 'INVALID_NUMBER', bp + '.seriesBorder.alpha', 'alpha must be 0..1');
            });
          }
          if (b.effect != null) {
            if (!isObj(b.effect)) E(errs, 'INVALID_TYPE', bp + '.effect', 'effect must be object');
            else Object.keys(b.effect).forEach(function (k) {
              if ({ enabled: 1, period: 1 }[k] == null) { E(errs, 'INVALID_ENUM', bp + '.effect.' + k, 'effect keys: enabled|period'); return; }
              if (k === 'enabled' && typeof b.effect[k] !== 'boolean') E(errs, 'INVALID_TYPE', bp + '.effect.enabled', 'enabled must be boolean');
              if (k === 'period' && !isNum(b.effect[k])) E(errs, 'INVALID_NUMBER', bp + '.effect.period', 'period must be number');
            });
          }
          if (b.areaFill != null) {
            if (b.kind !== 'varea') E(errs, 'INVALID_SHAPE', bp + '.areaFill', 'areaFill 仅 varea（AttrAreaSeriesFillColorBackground 物理归属）');
            else if (!isObj(b.areaFill)) E(errs, 'INVALID_TYPE', bp + '.areaFill', 'areaFill must be object');
            else Object.keys(b.areaFill).forEach(function (k) {
              if ({ color: 1, alpha: 1 }[k] == null) { E(errs, 'INVALID_ENUM', bp + '.areaFill.' + k, 'areaFill keys: color|alpha'); return; }
              if (!isNum(b.areaFill[k])) E(errs, 'INVALID_NUMBER', bp + '.areaFill.' + k, k + ' must be number');
              if (k === 'alpha' && (b.areaFill[k] < 0 || b.areaFill[k] > 1)) E(errs, 'INVALID_NUMBER', bp + '.areaFill.alpha', 'alpha must be 0..1');
            });
          }
          if (b.seriesImage != null) {
            if (!isObj(b.seriesImage)) E(errs, 'INVALID_TYPE', bp + '.seriesImage', 'seriesImage must be object');
            else Object.keys(b.seriesImage).forEach(function (k) {
              if ({ image: 1, layout: 1 }[k] == null) { E(errs, 'INVALID_ENUM', bp + '.seriesImage.' + k, 'seriesImage keys: image|layout'); return; }
              if (k === 'image' && !isStr(b.seriesImage[k])) E(errs, 'INVALID_TYPE', bp + '.seriesImage.image', 'image must be file path string');
              if (k === 'layout' && !isNum(b.seriesImage[k])) E(errs, 'INVALID_NUMBER', bp + '.seriesImage.layout', 'layout must be number');
            });
          }
          // 条件系列格式（官方 ConditionAttr 条件着色/透明度——then 仅 seriesColor|alpha）
          if (b.conditions != null) {
            if (b.kind.charAt(0) !== 'v') E(errs, 'INVALID_SHAPE', bp + '.conditions', 'chart conditions 仅 Van 图族支持');
            else if (!Array.isArray(b.conditions)) E(errs, 'INVALID_ARRAY', bp + '.conditions', 'chart conditions must be array');
            else b.conditions.forEach(function (cd, ci) {
              var cp = bp + '.conditions[' + ci + ']';
              if (!isObj(cd)) { E(errs, 'INVALID_TYPE', cp, 'not an object'); return; }
              checkWhen(cd.when, cp + '.when', errs);
              if (!isObj(cd.then)) { E(errs, 'INVALID_TYPE', cp + '.then', 'then must be object'); return; }
              Object.keys(cd.then).forEach(function (tk) {
                if (tk === 'seriesColor') { if (!isNum(cd.then[tk])) E(errs, 'INVALID_TYPE', cp + '.then.' + tk, 'seriesColor must be argb number'); }
                else if (tk === 'alpha') { if (!isNum(cd.then[tk]) || cd.then[tk] < 0 || cd.then[tk] > 1) E(errs, 'INVALID_NUMBER', cp + '.then.' + tk, 'alpha must be 0..1'); }
                else E(errs, 'INVALID_ENUM', cp + '.then.' + tk, 'chart cond then 仅 seriesColor|alpha');
              });
            });
          }
        }
        // cells item 数据集引用（对象形态：真绑定名 = it.ds.ds || b.dataset；字符串形态为历史语义遗留，
        // object 层 putDSCell 对其 column=undefined 的消费至今零回归，故不在 ir 层断言——2026-11-04 校准）
        if (b.type === 'cells' && Array.isArray(b.items)) {
          b.items.forEach(function (it, ii) {
            if (it && isObj(it) && isObj(it.ds)) {
              var dsn = it.ds.ds || b.dataset;
              if (dsn != null && dsIdx[dsn] == null)
                E(errs, 'UNKNOWN_REF', bp + '.items[' + ii + '].ds', 'unknown dataset "' + dsn + '"');
            }
          });
        }
      });
    });
    // v3.9 面板控件家族校验：date=DateEditor / combo=ComboBox+CustomDictionary / nav=FreeButton+click JS
    var KINDS = { label: 1, editor: 1, date: 1, combo: 1, nav: 1, submit: 1,
      number: 1, textarea: 1, radio: 1, checkbox: 1, combocheck: 1, treecombo: 1, iframe: 1 };
    var EDITOR_LIKE = { editor: 1, date: 1, combo: 1, number: 1, textarea: 1, radio: 1, checkbox: 1, combocheck: 1, treecombo: 1 };
    var VALUES_LIKE = { combo: 1, radio: 1, checkbox: 1, combocheck: 1, treecombo: 1 };
    if (IR.param != null) {
      if (!isObj(IR.param)) E(errs, 'INVALID_TYPE', 'param', 'param must be an object');
      else {
        ['designWidth', 'designHeight', 'align', 'windowPosition'].forEach(function (k) { numOpt(errs, IR.param, k, 'param'); });
        if (!IR.param.widgets || !Array.isArray(IR.param.widgets) || !IR.param.widgets.length) E(errs, 'REQUIRED', 'param.widgets', 'param: no widgets');
        else {
          var pnames = {};
          IR.param.widgets.forEach(function (w) { if (w && isObj(w) && w.name != null) pnames[w.name] = 1; });
          IR.param.widgets.forEach(function (w, wi) {
            var wp = 'param.widgets[' + wi + ']';
            if (!isObj(w)) { E(errs, 'INVALID_TYPE', wp, 'not an object'); return; }
            if (!hasOwn(KINDS, w.kind)) E(errs, 'INVALID_ENUM', wp + '.kind', 'unknown kind ' + w.kind);
            if (hasOwn(EDITOR_LIKE, w.kind) && !w.name) E(errs, 'REQUIRED', wp + '.name', 'editor-like kind needs name (=参数名)');
            strOpt(errs, w, 'name', wp);
            // 批F：编辑器校验正则（none|phone|idcard|mobile|postcard 或 {custom, err?}）
            if (w.reg != null) {
              if (typeof w.reg === 'string') {
                if (!hasOwn({ none: 1, phone: 1, idcard: 1, mobile: 1, postcard: 1 }, w.reg)) E(errs, 'INVALID_ENUM', wp + '.reg', 'reg 白名单 none|phone|idcard|mobile|postcard 或 {custom, err}');
              } else if (isObj(w.reg)) {
                if (!isStr(w.reg.custom) || w.reg.custom === '') E(errs, 'REQUIRED', wp + '.reg.custom', 'reg.custom needs 正则串');
                if (w.reg.err != null && !isStr(w.reg.err)) E(errs, 'INVALID_TYPE', wp + '.reg.err', 'reg.err must be string');
                Object.keys(w.reg).forEach(function (rk) { if (rk !== 'custom' && rk !== 'err') E(errs, 'INVALID_ENUM', wp + '.reg.' + rk, 'reg object keys: custom|err'); });
              } else E(errs, 'INVALID_TYPE', wp + '.reg', 'reg must be string or {custom, err?}');
            }
            if (hasOwn(VALUES_LIKE, w.kind) && (!w.values || !w.values.length)) E(errs, 'REQUIRED', wp + '.values', w.kind + ' needs values');
            if (w.kind === 'nav') {
              if (!w.url) E(errs, 'REQUIRED', wp + '.url', 'nav needs url');
              else if (!isRelUrl(w.url)) E(errs, 'INVALID_URL', wp + '.url', 'nav url must be relative (安全只相对路径)');
            }
            if (w.kind === 'iframe') {
              if (!w.url && !w.text) E(errs, 'REQUIRED', wp + '.url', 'iframe needs url');
              else {
                var iu = (w.url != null ? w.url : w.text);
                if (iu && !isRelUrl(iu)) E(errs, 'INVALID_URL', wp + '.url', 'iframe url must be relative (安全只相对路径)');
              }
            }
            ['x', 'y', 'w', 'h'].forEach(function (kk) {
              if (w[kk] == null) E(errs, 'REQUIRED', wp + '.' + kk, 'missing ' + kk);
              else if (!isNum(w[kk])) E(errs, 'INVALID_NUMBER', wp + '.' + kk, kk + ' must be a finite number');
            });
            if (w.targetFrame != null && !/^[A-Za-z0-9_-]{1,32}$/.test(String(w.targetFrame))) E(errs, 'INVALID_TARGET', wp + '.targetFrame', 'targetFrame 越界白名单: ' + w.targetFrame);
          });
          var hasEmbedded = dsArr.some(function (ds) { return ds && isObj(ds) && ds.kind !== 'sql'; });
          if (IR.param.filters != null) eachArr(errs, IR.param.filters, 'param.filters', false, function (f, fi, fp) {
            if (!isObj(f)) { E(errs, 'INVALID_TYPE', fp, 'not an object'); return; }
            if (!f.column) E(errs, 'REQUIRED', fp + '.column', 'missing column');
            if (!f.parameter) E(errs, 'REQUIRED', fp + '.parameter', 'missing parameter');
            if (f.op && !hasOwn(OPS, f.op)) E(errs, 'INVALID_ENUM', fp + '.op', 'unknown op ' + f.op);
            if (f.parameter != null && !pnames[f.parameter]) E(errs, 'UNKNOWN_REF', fp + '.parameter', 'parameter not a defined widget name: ' + f.parameter);
            if (f.column != null && hasEmbedded) {
              var colAny = dsArr.some(function (ds) { return ds && isObj(ds) && ds.kind !== 'sql' && dsCols(ds)[f.column]; });
              if (!colAny) E(errs, 'UNKNOWN_REF', fp + '.column', 'column not in any embedded dataset: ' + f.column);
            }
          });
        }
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
