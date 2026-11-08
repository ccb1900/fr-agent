// lib/object.js — v3.0 API 对象图构建库
//
// 真源原则：spec → FR 内存对象图（WorkBook AST）→ wb.export() 序列化为 cpt。
// 我们从不手写 XML；XML 是 FR 自己的输出，考古类 bug（公式=前缀、样式默认化、
// 标签顺序）在类型系统层面不存在。
//
// 一手验证依据（改前必须重验）：
//   Align: CENTER=0 / LEFT=2 / RIGHT=4 / DEFAULT=-1（HorizontalAlignType.getAlignType）
//   FRFont：FRSize = pt×4（XML size 单位）；用 getInstanceFromFRSize(name, style, FRSize)
//     ——getInstance(String,int,float) 的 float 参数不是 pt（一手实证 5.25→FRSize42）
//   WorkSheet.setRowHeight(int,UNIT) / setColumnWidth(int,UNIT)，UNIT 具体 FU；
//     XML 序列化行高列宽 = pt×12700（EMU）
//   ColorBackground.getInstance(java.awt.Color)
//   Style.derive* 链（v3_trace.txt）：deriveHorizontalAlignment/deriveFRFont/
//     deriveBackground/deriveFormat/deriveBorder{Top,Bottom,Left,Right}(int,Color)
//   DSColumn：setDSName/setColumnName/setGrouper/无参构造（v3b_trace.txt）
//   TableDataColumn.createColumn(String) 静态工厂
//   Edge style int = 1（细线，对应 XML style="1"）
//
// v3.4（分组小计族，官方 demo/basic/基本明细汇总表A 语料）：
//   font  加 name 参数（官方用"微软雅黑"——SimHei 只是第一家族官方选型，不是引擎限制）
//   style 加 borders 逐边 [styleInt, colorInt] 透传（官方混合 1/2/3/5 样式线：
//     titlebar top=5 粗蓝 Bottom=2 灰点线 / note 全 3 蓝框 / 数据区 Bottom=1 白分隔线）
//   putDSCell 支持 SummaryGrouper（官方数值列：SumFunction/AverageFunction + Result $$$）
//   putCell 支持 expand 属性（CellExpandAttr.setLeftParentColumnRow + setLeftParentDefault(false)
//     ——小计行跟随类别分组扩展；ColumnRow.valueOf(int,int) 直构造）
//   sheet.paper：ReportSettings(PaperSetting(PaperSize, Margin)) 全直构造，
//     EMU 数值直灌 FU.getInstance（官方自定义纸 40320000×42768000 + margins）
//   cells 通用块：任意行任意格（文本/公式/DS 列/超链/expansion），承载 titlebar/subtotal/note 等一切非标准块
//
// v3.5（DB 真数据路线，atom_live_demo/SQL Server 实测）：
//   datasets 双形态——默认自包含 EmbeddedTableData；{kind:'sql', connection, query} →
//     DBTableData(NameDatabaseConnection(connection), query) 生产形态（cpt 只存连接名，
//     连接定义由 runner 注册进 DatasourceManager；绑定层按 dsName 解析，两形态同路）
//
// v3.6（真库钻取族，官方 demo/basic/数据钻取主报表+子报表 语料）：
//   ppArray：ParameterProvider[] 反射数组工厂（Array.newInstance 要真 Class）——
//     DBTableData.setParameters（SQL 数据集参数，查询里 ${名} + 默认值）与
//     ReportletHyperlink.setParameters（linkTo.params，formula='=$$$' 把当前格值传给子报表）共用；
//   linkTo 扩字段 targetFrame/extendParameters/width/height（官方 <TargetFrame>_self / extendParameters="true"）
//
// 反射陷阱（踩过的）：Java.type 结果必须先赋变量再 new；int Class 用 Integer.TYPE；
//   Java.type('int') 返回 StaticClass 不能当 Class 参。

// 模块装载（2026-11-08 拆分）：基础件 → 图表族 → 本文件（块/参数/门面）。
(function () {
  var root = (typeof Paths !== 'undefined' && Paths && Paths.root)
    ? Paths.root : (Java.type('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent');
  load(root + '/lib/object_core.js');
  load(root + '/lib/object_chart.js');
})();

var Obj = (function () {
  var C = ObjCore, CH = ObjChart;
  var Class = C.Class, J = C.J, FN = C.FN, Align = C.Align, FONT_NAME = C.FONT_NAME, FONT_SIZE_PT = C.FONT_SIZE_PT, COLORS = C.COLORS, checkRelUrl = C.checkRelUrl, checkRelReportlet = C.checkRelReportlet, checkTargetFrame = C.checkTargetFrame, checkLocalPath = C.checkLocalPath, cls = C.cls, of = C.of, statField = C.statField, INT_CLASS = C.INT_CLASS, ppArray = C.ppArray, baseStyle = C.baseStyle, awtColor = C.awtColor, font = C.font, bgColor = C.bgColor, edgesOf = C.edgesOf, style = C.style, fuPt = C.fuPt, VAN_KINDS = C.VAN_KINDS, OP = C.OP, applyConditions = C.applyConditions;
  var putChartCell = CH.putChartCell, applyChartDeco = CH.applyChartDeco;


  // ---------- 对象图构建器 ----------
  // v3.1：消费 IR（sheets[].blocks + datasets）。行号由块序线性分配——
  // 新功能族 = 新 block 类型 + case 分支，旧布局零改动。



  // 斜线表头格（v3.3，官方第一张报表语料）：BiasTextPainter(String) 直构造 + setIsBackSlash（官方 false）
  // 文本段用 '|' 分隔、段前空格调距：'     产品|   销售员|       地区'
  function putBiasCell(api, c, r, text, stSpec, spanC) {
    var painter = new (J('com.fr.report.cell.painter.BiasTextPainter'))(text);
    painter.setIsBackSlash(false);
    return api.putCell(c, r, painter, stSpec, spanC);
  }


    // --- 数据集 ---
    //   默认：自包含 EmbeddedTableData 直接注入 IR 数据；
    //   v3.5 kind=sql：生产形态 DBTableData(NameDatabaseConnection(连接名), 模板内置 SQL)。
    //     连接定义由 runner 注册进 DatasourceManager，cpt 只存连接名（凭据不落模板）。
    //   记名供图表/单元格绑定复用（绑定一律走 dsName 字符串，两形态同路）。
  function buildDatasets(wb, IR) {
    var wbTableDatas = {};
    (IR.datasets || []).forEach(function (ds) {
      var etd;
      if (ds.kind === 'sql') {
        etd = new (J('com.fr.data.impl.DBTableData'))(
          new (J('com.fr.data.impl.NameDatabaseConnection'))(ds.connection), ds.query);
        // v3.6 SQL 数据集参数（官方语料 数据钻取子报表订单明细.cpt：ds1 带 Parameter(名,默认值) + 查询里 ${名}）
        if (ds.params && ds.params.length) etd.setParameters(ppArray(ds.params));
      } else {
        etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
        // I0-05（r2.md 任务 0.4）全型别映射表——Class 保真由 probe_typemap.js 实机往返一手证
        //   （9 型 addColumn → export → readTemplateWorkBook 读回 columnClass 逐一相同）。
        //   number/float=legacy（v3.4 既定：number 硬转 Integer），新词 integer/long/decimal/boolean/date/datetime/string。
        //   null 保可空语义（旧 String(null) 会折成 'null' 串——既有 49 spec 语料 data 行零 null，字节不受扰）。
        var DS_JTYPE = {
          text: 'java.lang.String', string: 'java.lang.String', number: 'java.lang.Integer', integer: 'java.lang.Integer',
          long: 'java.lang.Long', float: 'java.lang.Double', decimal: 'java.math.BigDecimal', boolean: 'java.lang.Boolean',
          date: 'java.sql.Date', datetime: 'java.sql.Timestamp'
        };
        ds.columns.forEach(function (c) {
          var jn = (c && DS_JTYPE[c.type]) || 'java.lang.String';
          etd.addColumn(c.name, Class.forName(jn));
        });
        function dsJavaValue(ct, v) {
          if (v == null) return null;
          switch (ct) {
            case 'number': case 'integer': return J('java.lang.Integer').valueOf(v);
            case 'long': return J('java.lang.Long').valueOf(String(v));            // 串转防 JS double 精度损失（探针 9000000001 实证）
            case 'float': return J('java.lang.Double').valueOf(v);
            case 'decimal': return new (J('java.math.BigDecimal'))(String(v));     // String 构造器=高精度语义（number 直构会带二进制浮点噪声）
            case 'boolean': return J('java.lang.Boolean').valueOf(!!v);
            case 'date': return J('java.sql.Date').valueOf(String(v));             // 'yyyy-MM-dd'（ir 层已验形态）
            case 'datetime': return J('java.sql.Timestamp').valueOf(String(v));    // 'yyyy-MM-dd HH:mm:ss'
            default: return String(v);
          }
        }
        ds.rows.forEach(function (src) {
          var row = [];
          for (var cj = 0; cj < src.length; cj++) row.push(dsJavaValue(ds.columns[cj].type, src[cj]));
          etd.addRow(J('java.util.Arrays').asList(row));
        });
      }
      wb.putTableData(ds.name, etd);
      wbTableDatas[ds.name] = etd;
    });
    return wbTableDatas;
  }

  // 单 sheet 构建：纸型 / 页头重复 / 块布局 / 悬浮 / 页眉页脚 / 隐藏行列。
  //   状态（rowCursor/detailRow/headerCols/totalCol/totalRow/dscCells）全部函数局部——多 Sheet 天然隔离。
  // 列号 → 字母（题头公式用，纯函数；build/buildSheet 共用）
  function colLetter(i) { return String.fromCharCode(65 + i); }

  // detail 块：DSColumn 逐列 + 格式派生 + 条件/超链/参数过滤
  function buildDetailBlock(ctx, st, b, IR, P) {
var putCell = ctx.putCell, putDSCell = ctx.putDSCell;
    st.detailRow = st.row;
    var condMap = {};
    var addCond = function (nm, cd) { if (!condMap[nm]) condMap[nm] = []; condMap[nm].push(cd); };
    b.columns.forEach(function (c, i) {
      var pos = i === 0 ? 'first' : (i === b.columns.length - 1 ? 'last' : 'mid');
      var contentAlign = (c.align != null) ? c.align : (c.type !== 'number' ? Align.LEFT : Align.RIGHT);
      // 批D：格式派生扩全型——number(默认 #,##0)→CoreDecimalFormat；date/datetime→SimpleDateFormatThreadSafe(pattern)；
      //   text→TextFormat（显式 format 才上，'' 仍=不上格式）；formatKind 由列型自动派生，零新词汇
      var fmt = null, fmtKind = null;
      if (c.format !== '') {
        if (c.type === 'number') fmt = c.format || '#,##0', fmtKind = 'decimal';
        else if (c.type === 'date' || c.type === 'datetime') { if (c.format) fmt = c.format, fmtKind = 'date'; }
        else if (c.type === 'text' || c.type === 'string') { if (c.format) fmt = c.format, fmtKind = 'text'; }
      }
      var dce = putDSCell(i, st.row, b.dataset, c.name, {
        align: contentAlign, bold: !!c.bold, bg: (c.bg != null) ? c.bg : null, format: fmt, formatKind: fmtKind,
        groupCustom: c.groupCustom || null,
        edges: edgesOf(pos, 'data'),
        color: P ? P.text : undefined, sizePt: c.sizePt != null ? c.sizePt : undefined,
        border: P ? P.border : undefined
      });
      st.dsc[c.name] = dce;
      if (c.html) cellHtml(dce);                      // HTML 显示（49 张官方模板口径）
      if (c.dict) cellDict(dce, c.dict);              // 数据字典（39 张）
      if (c.conditions) c.conditions.forEach(function (cd) { addCond(c.name, cd); });
    });
    // 条件属性（v4.0）：列级 + 块级（块级不带 column = 整行所有列）
    if (b.highlight) addCond(b.highlight.column, {
      when: { column: b.highlight.column, op: b.highlight.op, value: b.highlight.value, valueType: b.highlight.valueType },
      then: { bg: b.highlight.bg }
    });
    (b.conditions || []).forEach(function (cd) {
      if (cd.column) addCond(cd.column, cd);
      else Object.keys(st.dsc).forEach(function (k) { addCond(k, cd); });
    });
    Object.keys(condMap).forEach(function (k) { applyConditions(st.dsc[k], condMap[k]); });
    // 超链（v3.2 尾刀）：by 列挂 NameJavaScriptGroup（钻取 reportlet）
    if (b.link) applyLink(st.dsc, b.link);
    // 参数过滤（v3.2 二批）：编辑器选地区 → $参数公式值过滤；**逐列挂同一条件**（各列独立扩展，条件必须对齐）
    if (IR.param && IR.param.filters) {
      IR.param.filters.forEach(function (f) {
        Object.keys(st.dsc).forEach(function (k) {
          st.dsc[k].getValue().setCondition(new (J('com.fr.data.condition.CommonCondition'))(
            f.column, OP[f.op || '='], new (J('com.fr.base.Formula'))('=$' + f.parameter)));
        });
      });
    }
  }

  // total 块：合计标签 + 多列 SUM/AVG/… 或 ratio 聚合（引用 detailRow）
  function buildTotalBlock(ctx, st, b, P) {
var putCell = ctx.putCell;
    st.totalRow = st.row;
    // 2026-11-06 复审：total 前必须已有 detail（否则公式引用 B0，引擎仍"成功"=假绿）
    if (st.detailRow < 0) throw new Error('[IR] total 块前缺少 detail 块（无明细行可聚合）');
    var labelSpan = (b.labelSpan != null) ? b.labelSpan : (b.span != null ? b.span : 1);
    putCell(0, st.row, b.label || '合计', {
      align: (b.labelAlign != null) ? b.labelAlign : Align.LEFT, bold: b.labelBold !== false,
      bg: (b.labelBg != null) ? b.labelBg : COLORS.totalBg, format: null, edges: edgesOf('first', 'total'),
      color: P ? P.text : undefined, sizePt: b.labelSizePt != null ? b.labelSizePt : undefined,
      border: P ? P.border : undefined
    }, labelSpan);
    if (b.sumCols) { // v3.3 多列求和（官方总计行多列 SUM 公式逐格直落）；2026-11-06 P1：逐格 fn=avg|count|min|max
      var TOTFN = { sum: 'SUM', avg: 'AVERAGE', count: 'COUNT', min: 'MIN', max: 'MAX' };
      b.sumCols.forEach(function (sc) {
        var fmt = (sc.format === '') ? null : sc.format;
        st.totalCol = sc.col;
        var tf = TOTFN[sc.fn || 'sum'] || 'SUM';
        putCell(sc.col, st.row,
          new (J('com.fr.base.Formula'))(sc.formula || ('=' + tf + '(' + colLetter(sc.col) + (st.detailRow + 1) + ')')),
          {
            align: (sc.align != null) ? sc.align : Align.RIGHT, bold: (sc.bold != null) ? sc.bold : true,
            bg: (sc.bg != null) ? sc.bg : COLORS.totalBg, format: fmt,
            edges: edgesOf('last', 'total'),
            color: P ? P.text : undefined, sizePt: sc.sizePt != null ? sc.sizePt : undefined,
            border: P ? P.border : undefined
          });
      });
    } else if (b.aggregate) {
      var TOTFN2 = { sum: 'SUM', avg: 'AVERAGE', count: 'COUNT', min: 'MIN', max: 'MAX' };
      var aggFn = b.aggregate.fn || 'sum';
      var dref = st.detailRow + 1;
      var aggF;
      if (aggFn === 'ratio') {
        st.totalCol = b.aggregate.num;
        aggF = '=SUM(' + colLetter(b.aggregate.num) + dref + ')/SUM(' + colLetter(b.aggregate.den) + dref + ')';
      } else {
        st.totalCol = b.aggregate.col;
        aggF = '=' + (TOTFN2[aggFn] || 'SUM') + '(' + colLetter(st.totalCol) + dref + ')';
      }
      var fmt = (b.aggregate.format != null) ? b.aggregate.format
        : (st.headerCols && st.headerCols[st.totalCol] ? (st.headerCols[st.totalCol].format || null) : null);
      putCell(st.totalCol, st.row,
        new (J('com.fr.base.Formula'))(aggF),
        { align: Align.RIGHT, bold: true, bg: COLORS.totalBg, format: fmt, edges: edgesOf('last', 'total'), border: P ? P.border : undefined });
    }
  }

  // cells 块：绝对行 + rowSpan 合并区（游标推进 = 最大占用行），返回下一行偏移
  function buildCellsBlock(ctx, st, b, sheet, bh) {
var putCell = ctx.putCell, putDSCell = ctx.putDSCell;
    // 2026-11-06（R3-0 收尾）：块占用行数 = max(r 相对偏移 + rowSpan - 1)——rowSpan 必须计入游标，
    //   否则后续 block 落到合并区上（实测会把 rowSpan 合并格整格覆盖丢失）。
    //   绝对行兜底：r 倒退到块首之前、或块内两格区域重叠 → 结构化抛错（IR 层已静态拒可识别冲突）。
    var cellsMaxR = 0;
    var cellBoxes = [];
    (b.items || []).forEach(function (it) {
      var rr0 = (it.r != null) ? it.r : st.row;
      if (rr0 < st.row) throw new Error('[IR] cells item r=' + rr0 + ' 倒退到当前块首 ' + st.row + ' 之前');
      var rs = (it.rowSpan && it.rowSpan > 1) ? Math.floor(it.rowSpan) : 1;
      var cs = (it.span && it.span > 1) ? Math.floor(it.span) : 1;
      var bottom = (rr0 - st.row) + rs - 1;
      if (bottom > cellsMaxR) cellsMaxR = bottom;
      cellBoxes.push({ c: it.c, cs: cs, r: rr0, rs: rs });
    });
    for (var bi = 0; bi < cellBoxes.length; bi++) for (var bj = bi + 1; bj < cellBoxes.length; bj++) {
      var A = cellBoxes[bi], B2 = cellBoxes[bj];
      if (A.c < B2.c + B2.cs && B2.c < A.c + A.cs && A.r < B2.r + B2.rs && B2.r < A.r + A.rs)
        throw new Error('[IR] cells block 内两格区域重叠: c' + A.c + 'r' + A.r + '(cs' + A.cs + 'rs' + A.rs + ') vs c' + B2.c + 'r' + B2.r + '(cs' + B2.cs + 'rs' + B2.rs + ')');
    }
    for (var ci = 0; ci <= cellsMaxR; ci++) sheet.setRowHeight(st.row + ci, fuPt(bh || 45));
    var cursorAdvance = cellsMaxR > 0 ? cellsMaxR + 1 : 1;
    (b.items || []).forEach(function (it) {
      var rr = (it.r != null) ? it.r : st.row;
      var val;
      if (it.ds) {
        val = { __ds: it.ds };
      } else if (it.subreport) {
        // 批G：子报表（官方 SubReport(TemplateWorkBook)——读已部署模板路径整嵌；安全闸同 link.reportlet）
        var spath = checkRelReportlet(it.subreport, 'item.subreport');
        var twb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook(spath);
        val = new (J('com.fr.report.cell.cellattr.core.SubReport'))(twb);
      } else if (it.rich) {
        val = richText(it.rich);                        // v4.1 富文本
      } else if (it.formula) {
        val = new (J('com.fr.base.Formula'))(it.formula.charAt(0) === '=' ? it.formula : '=' + it.formula);
      } else {
        val = (it.text == null) ? '' : it.text; // 空占位格（官方空样式格）也是真值
      }
      var ce2;
      if (it.ds) {
        // C2（2026-11-06 收口）二道防线：IR 层已拒 ds+rowSpan；raw Obj.build 直入时在此 fail-closed——
        //   putDSCell 不产生合并区而游标按 rowSpan 推进，静默放过=游标与最终对象不一致。
        if (it.rowSpan != null) throw new Error('[IR] cells item 同时含 ds 与 rowSpan：putDSCell 不合并（DSColumn 无合并区出口），rowSpan 被拒（C2）；合并格请用 text/formula item');
        ce2 = putDSCell(it.c, rr, b.dataset || (it.ds.ds || 'ds1'), it.ds.column, it.st || {}, {
          summary: it.ds.summary || null, result: it.ds.result || null, noExpand: !!it.ds.noExpand
        });
      } else {
        ce2 = putCell(it.c, rr, val, it.st || {}, it.span, it.rowSpan || null,
          it.expand ? { dir: it.expand.dir, leftCol: it.expand.leftCol, leftRow: it.expand.leftRow } : null);
      }
      if (it.linkTo) cellLink(ce2, it.linkTo);
      else if (it.web) cellLink(ce2, it.web);   // v3.9 URL 链接（数据分析落地路由）
      // v4.0 单元格能力族：通用格同样支持 字典 / HTML / 条件属性
      if (it.dict) cellDict(ce2, it.dict);
      if (it.html || it.rich) cellHtml(ce2);   // 富文本必须开 HTML 显示（官方 套打.cpt：RichText + showAsHTML）
      if (it.conditions) applyConditions(ce2, it.conditions);
      if (it.presentFormula) cellFormulaPresent(ce2, it.presentFormula); // v4.1 公式显示
      // 批G：条码显示（官方 卡片分栏.cpt：BarcodePresent(BarcodeAttr(int 类型))，present 机制把单元格值编码成条码）
      if (it.barcode) {
        var ba = new (J('com.fr.code.bar.core.BarcodeAttr'))(it.barcode.type != null ? it.barcode.type : 1);
        if (it.barcode.barWidth != null) ba.setBarWidth(it.barcode.barWidth);
        if (it.barcode.barHeight != null) ba.setBarHeight(it.barcode.barHeight);
        if (it.barcode.drawingText != null) ba.setDrawingText(!!it.barcode.drawingText);
        ce2.setPresent(new (J('com.fr.report.cell.cellattr.BarcodePresent'))(ba));
      }
    });
    return cursorAdvance;
  }

  function buildSheet(ctx, IR, sIR) {
    var wb = ctx.wb, P = ctx.P, api = ctx.api;
    var putCell = ctx.putCell, putDSCell = ctx.putDSCell;
    var sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
    ctx.sh.cur = sheet; ctx.sh.last = sheet;
    wb.addReport(sIR.name, sheet);
    (sIR.widthsPt || []).forEach(function (w, i) { sheet.setColumnWidth(i, fuPt(w)); });
    // v3.4 纸型（官方自定义纸 EMU 直灌）：ReportSettings(PaperSetting(PaperSize, Margin))
    // probe_paper2 一手实证：三件套全可 new 直构造 + 全 setter 面；fresh sheet.getPaperSetting()=null 必须显式挂
    if (sIR.paper) {
      var FUu = J('com.fr.stable.unit.FU');
      var pzp = new (J('com.fr.base.PaperSize'))();
      pzp.setWidth(FUu.getInstance(sIR.paper.width)); pzp.setHeight(FUu.getInstance(sIR.paper.height));
      var mgp = new (J('com.fr.base.Margin'))();
      mgp.setTop(FUu.getInstance(sIR.paper.top)); mgp.setLeft(FUu.getInstance(sIR.paper.left));
      mgp.setBottom(FUu.getInstance(sIR.paper.bottom)); mgp.setRight(FUu.getInstance(sIR.paper.right));
      var psc = new (J('com.fr.page.stable.PaperSetting'))();
      psc.setPaperSize(pzp); psc.setMargin(mgp);
      var rsp = new (J('com.fr.report.stable.ReportSettings'))();
      rsp.setPaperSetting(psc);
      sheet.setReportSettings(rsp);
    }

    // v3.4.1 页头重复（官方 <HR F="0" T="1"/>：每页重复 r0..r1 标题条带+表头行）
    if (sIR.pageRepeat) {
      var rpax = new (J('com.fr.page.stable.ReportPageAttr'))();
      rpax.setRepeatHeaderRowFrom(sIR.pageRepeat.from);
      rpax.setRepeatHeaderRowTo(sIR.pageRepeat.to);
      sheet.setReportPageAttr(rpax);
    }
    var st = { row: 0, detailRow: -1, headerCols: null, totalCol: -1, totalRow: -1, dsc: {} };
    sIR.blocks.forEach(function (b) {
      var cursorAdvance = 1;   // 块后行游标推进（cells 多行合并表头时 >1，2026-11-06）
      // v4.2 Van 画区地板：只在 chart+Van kind 下抬行高（probe_vanchart30：h160 塌缩 / h240 痊愈）
      var bh = (b.type === 'chart' && VAN_KINDS[b.kind] && (b.heightPt == null || b.heightPt < 240)) ? 240 : b.heightPt;
      sheet.setRowHeight(st.row, fuPt(bh || 45));
      switch (b.type) {
        case 'title':
          putCell(0, st.row, b.text, {
            align: (b.align != null) ? b.align : null, bold: b.bold !== false, bg: null, format: null, edges: edgesOf(null),
            color: P ? P.titleText : undefined, sizePt: b.sizePt != null ? b.sizePt : undefined,
            border: P ? P.border : undefined
          }, b.span);
          break;
        case 'header': {
          st.headerCols = b.columns;
          var startC = 0;
          if (b.corner) { // v3.3 斜线表头角格：占 span 列，后续列右移
            putBiasCell(api, 0, st.row, b.corner.text, {
              align: (b.corner.align != null) ? b.corner.align : Align.CENTER, bold: true,
              bg: (b.corner.bg != null) ? b.corner.bg : (P ? P.headerBg : COLORS.headerBg),
              format: null, edges: edgesOf('first', 'header'),
              color: P ? P.text : undefined, sizePt: b.corner.sizePt != null ? b.corner.sizePt : undefined,
              border: P ? P.border : undefined
            }, b.corner.span);
            startC = b.corner.span;
          }
          b.columns.forEach(function (c, i) {
            var gi = startC + i;
            var pos = gi === 0 ? 'first' : (gi === startC + b.columns.length - 1 ? 'last' : 'mid');
            var contentAlign = (c.align != null) ? c.align : (c.type !== 'number' ? Align.LEFT : Align.RIGHT);
            putCell(gi, st.row, c.label, {
              align: contentAlign, bold: c.bold !== false, bg: P ? P.headerBg : COLORS.headerBg,
              format: null, edges: edgesOf(pos, 'header'),
              color: P ? P.text : undefined, sizePt: c.sizePt != null ? c.sizePt : undefined,
              border: P ? P.border : undefined
            });
          });
          break;
        }
        case 'detail':
          buildDetailBlock(ctx, st, b, IR, P);
          break;
        case 'total':
          buildTotalBlock(ctx, st, b, P);
          break;
        case 'cells':
          cursorAdvance = buildCellsBlock(ctx, st, b, sheet, bh);
          break;
        case 'space': // v3.3 空行（官方表与图表间的 57pt 白隔行）：只占行高不上格
          break;
        case 'chart':
          putChartCell(api, 0, st.row, b, b.span);
          break;
        default:
          throw new Error('[IR] unknown block type: ' + b.type);
      }
      st.row += cursorAdvance;
    });
    // v4.1 悬浮元素族：sheet 级，不占行（官方 产品明细.cpt 图片悬浮/报表块互跳）
    (sIR.floats || []).forEach(function (fl, fi) { fl._i = fi; sheet.addFloatElement(buildFloat(fl, stOf)); });
    // 批C：页眉页脚（官方 207/240，档案式报表.cpt 形态）。探针 _hf7/9：挂接=sheet.setHeader/setFooter(int, ReportHF)；
    //   裸 classpath 下 ReportHF 静态初始化撞 license 墙（LicenseContext），env 全激活后可用——管线 env 恒满足。
    if (sIR.headerFooter) {
      var HF = 'com.fr.report.core.ReportHF';
      // 元素统一走 list 构造（便捷 addXxx API 实测不落 list——首版页眉 CenterList 空的根因）；
      // HFElement 家族：TextHFElement(text,font) / FormulaHFElement(content) / DateHFElement(font,dateFormat)，全部 setXxxList 回写
      var buildHF = function (spec) {
        var hf = new (J(HF))();
        if (spec.bg != null) hf.setBackground(bgColor(spec.bg));
        ['left', 'center', 'right'].forEach(function (pos) {
          var list = spec[pos];
          if (!list || !list.length) return;
          var P = pos.charAt(0).toUpperCase() + pos.substring(1);
          var HFEL = 'com.fr.base.headerfooter.';
          var arr = new (J('java.util.ArrayList'))();
          list.forEach(function (el) {
            var f = font(!!el.bold, el.fontPt);
            if (el.text != null) {
              var te = new (J(HFEL + 'TextHFElement'))(String(el.text), f);
              arr.add(te);
            } else if (el.formula != null) {
              var fe = new (J(HFEL + 'FormulaHFElement'))(String(el.formula));
              fe.setFRFont(f);
              arr.add(fe);
            } else if (el.pageNumber) {
              var pe = new (J(HFEL + 'FormulaHFElement'))('"第" + $$page_number + "页"');
              pe.setFRFont(f);
              arr.add(pe);
            } else if (el.totalPages) {
              var te2 = new (J(HFEL + 'FormulaHFElement'))('"共" + $$totalPage_number + "页"');
              te2.setFRFont(f);
              arr.add(te2);
            } else if (el.date != null) {
              var de = new (J(HFEL + 'DateHFElement'))(f, new (J('java.text.SimpleDateFormat'))(String(el.date)));
              arr.add(de);
            }
            if (el.newLine) arr.add(new (J(HFEL + 'TextHFElement'))('\n', f));  // 官方 addXxxNewLine 同语义（便捷 API 不落 list，list 构造统一）
          });
          hf['set' + P + 'List'](arr);
        });
        return hf;
      };
      if (sIR.headerFooter.header) sheet.setHeader(0, buildHF(sIR.headerFooter.header));
      if (sIR.headerFooter.footer) sheet.setFooter(0, buildHF(sIR.headerFooter.footer));
      if ((J('java.lang.System')).getenv('FR_DEBUG_HF')) {
        var _h = sheet.getHeader(0);
        (J('java.lang.System')).out.println('DBG_HF header=' + (_h ? _h.getClass().getName() : 'null') + ' footer=' + (sheet.getFooter(0) ? 'yes' : 'null'));
      }
    }
    // 2026-11-06（C2）：隐藏行列 = 行高/列宽归零（FR 渲染层唯一语义；官方 cpt 隐藏行即 0 高）。
    //   必须在块构建/行高设定之后应用——否则 setRowHeight(块行) 会把隐藏行高重置回去（首版实测 RowHeight[1]=304800）。
    var fU0 = J('com.fr.stable.unit.FU').getInstance(0);
    (sIR.hideRows || []).forEach(function (hr) { sheet.setRowHeight(hr, fU0); });
    (sIR.hideCols || []).forEach(function (hc) { sheet.setColumnWidth(hc, fU0); });
    return { name: sIR.name, rows: st.row, detailRow: st.detailRow, totalRow: st.totalRow, totalCol: st.totalCol };
  }

  // 参数面板 + 填报属性：workbook 级，不占 sheet 行、不进块序；write 落点是最后一个 sheet
  function applyWorkbookParamAndWrite(wb, IR, sh) {
    // 参数面板（v3.2 新能力族）：workbook 级，不占 sheet 行、不进块序
    if (IR.param) buildParamAttr(wb, IR.param);
    // 批B：装饰应用移交 make_api（build 返回后、导出前）——build 语境（无论中途还是尾段）挂
    //   ConditionCollection 一律被引擎静默清空（bisect2/4/5/6 + DBG_JOB 读回 0 一手实证），
    //   唯「build 返回后、wb.export 前」挂接存活（bisect5/6 XML 一手实证）。任务单=cell 引用+块 spec。
    // 批F：填报属性（官方 产品月销量情况录入表.cpt 形态）——<ReportWriteAttr> 为 sheet 级 AttributeTarget：
    //   挂点=sheet.addAttributeTarget(rwa)（探针 _wa8 XML=1；wb 级 setter/AttrMark 通路均不适用——Cast 异常一手实证）。
    //   BuiltInSQLSubmiter.setName/setDBName(连接名,凭据不落模板)+setDmlConfig(IntelliDMLConfig(Table+ColumnConfig(name,ColumnRow,isKey,skip)))；
    //   多格 ColumnRowGroup/SubmitJob/DBManipulation 面为后续批；真提交（WriteActor DML）= 独立工单（README #76 挂账）
    if (IR.write) {
      var w = IR.write;
      if ((J('java.lang.System')).getenv('FR_DEBUG_HF')) (J('java.lang.System')).out.println('DBG_WRITE reached table=' + w.table.name + ' cols=' + w.columns.length);
      if (!w.table || !w.table.name) throw new Error('[IR] write needs table.name');
      if (!w.columns || !w.columns.length) throw new Error('[IR] write needs columns');
      var rwa = new (J('com.fr.report.write.ReportWriteAttr'))();
      var sub = new (J('com.fr.report.write.BuiltInSQLSubmiter'))();
      sub.setName(w.name || '内置SQL1');
      if (w.connection) sub.setDBName(String(w.connection));
      var cfg = new (J('com.fr.write.config.IntelliDMLConfig'))();
      cfg.setTable(new (J('com.fr.data.core.db.dml.Table'))(w.table.schema || '', String(w.table.name)));
      w.columns.forEach(function (col) {
        if (!col.name || !col.cell) throw new Error('[IR] write column needs name+cell[col,row]');
        var ccfg = new (J('com.fr.write.config.ColumnConfig'))(String(col.name),
          J('com.fr.stable.ColumnRow').valueOf(col.cell[0], col.cell[1]), !!col.isKey, !!col.skipUnmodified);
        cfg.addColumnConfig(ccfg);
      });
      sub.setDmlConfig(cfg);
      rwa.addSubmitVisitor(sub);
      // verifiers 挂点后续批：VerifyItem 不实现 Verifier 接口（ClassCastException 一手实证），真实 Verifier 家族待 probe
      sh.last.addAttributeTarget(rwa);
      if ((J('java.lang.System')).getenv('FR_DEBUG_HF')) {
        var _fosW = new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_dbg_write_mid.cpt');
        wb.export(_fosW); _fosW.close();
      }
    }
  }

  // 模板级杂项：水印 / TemplateId·主题 AttrMark / 工具栏 / Web 固定行分页
  function applyWorkbookAttrs(wb, IR) {
    if (IR.watermark) applyWatermark(wb, IR.watermark);   // v4.1 水印（官方 7 张）
    // 批C：模板级 attrMark（同水印 addAttrMark 通路；TemplateIdAttrMark(String)/TemplateThemeAttrMark().setName/setDark 一手探针）
    if (IR.templateId) wb.addAttrMark(new (J('com.fr.base.iofile.attr.TemplateIdAttrMark'))(String(IR.templateId)));    if (IR.templateTheme) {
      var ttm = new (J('com.fr.base.iofile.attr.TemplateThemeAttrMark'))();
      ttm.setName(String(IR.templateTheme.name));
      if (IR.templateTheme.dark != null) ttm.setDark(!!IR.templateTheme.dark);
      wb.addAttrMark(ttm);
    }
    if (IR.toolbar) applyToolbar(wb, IR.toolbar);         // v4.1 工具栏（官方 45 张）
    // Web 固定行分页（v3.7 数据浏览族）：wb 级 ReportWebAttr(WebPage(pageFixedRow,pageFixedRowCount))。
    // 序列化同构官方语料（3D翘曲检查数据查询.cpt：<WebPage pageFixedRow="true" pageFixedRowCount="10"/> 包在
    // WebPageContent 里，wrapper 由引擎序列化自产，API 面只有 setWebPage 一条路）。
    // 未指定 IR.webPage 时零触碰——基线 demo_api.cpt 不受影响。
    if (IR.webPage) {
      var wpg = new (J('com.fr.report.web.WebPage'))();
      wpg.setPageFixedRow(true);
      wpg.setPageFixedRowCount(IR.webPage.rows > 0 ? IR.webPage.rows : 50);
      var wa = new (J('com.fr.web.attr.ReportWebAttr'))();
      wa.setWebPage(wpg);
      wb.setReportWebAttr(wa);
    }
  }

  function build(IR) {
    var wb = new (J('com.fr.main.impl.WorkBook'))();
    var CellT = J('com.fr.report.cell.DefaultTemplateCellElement'); // 直接 new 用（B 通路）
    var styled = {}; // cache: 样式 spec JSON → Style 对象（同 spec = 同引用 = 对象图天然去重）
    var chartDecoJobs = []; // 批B：装饰后挂队列——build 途中挂 ConditionCollection 会被引擎归一化清空（bisect2/4/5 实证：
                            //   build 内挂→读回 count=0；build 后挂→序列化完好），故收集任务在 build 尾统一应用
    function stOf(stSpec) {
      var k = JSON.stringify(stSpec);
      if (!styled[k]) styled[k] = style(stSpec);
      return styled[k];
    }

    var sh = { cur: null, last: null }; // 当前 / 最后一个 sheet（put* 与 IR.write 的落点）
    function putCell(c, r, value, stSpec, spanC, spanR, ea) {
      try {
        var ce = new CellT(c, r, value); // B 通路：类赋变量后直接 new（newInstance varargs 路径在 env+load 下不稳，见 ctor4/5 探针）
      } catch (eCtor) {
        var vClass = '(js ' + typeof value + ')';
        try { vClass = value.getClass().toString(); } catch (eV) { }
        print('CTOR DEBUG c=' + c + ' r=' + r + ' vClass=' + vClass + ' isInt=' + (c === Math.floor(c) && r === Math.floor(r)));
        throw eCtor;
      }
      ce.setStyle(stOf(stSpec));
      if (spanC && spanC > 1) ce.setColumnSpan(spanC);
      if (spanR && spanR > 1) ce.setRowSpan(spanR);
      // v3.4 expansion 属性：{ dir, leftCol, leftRow } —— CellExpandAttr 直构造
      // 左父绑定（小计行跟随分组）：setLeftParentColumnRow(ColumnRow.valueOf(col,row)) + setLeftParentDefault(false)
      if (ea) {
        var ceaPC = new (J('com.fr.report.cell.cellattr.CellExpandAttr'))();
        if (ea.dir != null) ceaPC.setDirection(ea.dir);
        if (ea.leftRow != null) {
          ceaPC.setLeftParentColumnRow(J('com.fr.stable.ColumnRow').valueOf(ea.leftCol || 0, ea.leftRow));
          ceaPC.setLeftParentDefault(false);
        }
        ce.setCellExpandAttr(ceaPC);
      }
      sh.cur.addCellElement(ce);
      return ce;
    }

    // DSColumn 详情列单元格
    // v3.4 opts: { summary:'SUM'|'AVERAGE', result:'$$$' } —— 官方数值列聚合形态
    //   SummaryGrouper.setFunction(SumFunction/AverageFunction)；Result $$$（单价展示原值）
    function putDSCell(c, r, dsName, columnName, stSpec, opts) {
      opts = opts || {};
      var dsc = new (J('com.fr.report.cell.cellattr.core.group.DSColumn'))();
      dsc.setDSName(dsName);
      dsc.setColumnName(columnName);
      if (opts.summary) {
        dsc.setGrouper((function () {
          var sg = new (J('com.fr.report.cell.cellattr.core.group.SummaryGrouper'))();
          sg.setFunction(new (J(FN[opts.summary]))());
          return sg;
        })());
      } else if (opts.groupCustom) {
        // 批G：自定义分组（官方 CustomGrouper 4 张简单形态：other 兜底组序/odisplay 兜底显示名/more 多值归组/force）
        var cg = new (J('com.fr.report.cell.cellattr.core.group.CustomGrouper'))();
        if (opts.groupCustom.other != null) cg.setOther(opts.groupCustom.other);
        if (opts.groupCustom.otherDisplay != null) cg.setOdisplay(String(opts.groupCustom.otherDisplay));
        if (opts.groupCustom.more != null) cg.setMore(!!opts.groupCustom.more);
        if (opts.groupCustom.force != null) cg.setForce(!!opts.groupCustom.force);
        dsc.setGrouper(cg);
      } else {
        dsc.setGrouper(new (J('com.fr.report.cell.cellattr.core.group.FunctionGrouper'))()); // 列表模式（v2 XML: RG=FunctionGrouper）
      }
      // TableDataColumn 直指（让绑定强类型化，不依赖字符串列名解析时的歧义）
      try { dsc.setColumn(J('com.fr.general.data.TableDataColumn').createColumn(columnName)); } catch (eCol) { }
      if (opts.result) dsc.setResult(opts.result); // 官方单价格的 Result=$$$
      var ce = new CellT(c, r, dsc);
      ce.setStyle(stOf(stSpec));
      // 官方语料：FunctionGrouper 明细格 dir="0" 显式；SummaryGrouper 汇总格为默认 <Expand/>（不强挂）
      if (!opts.noExpand) {
        var cea = new (J('com.fr.report.cell.cellattr.CellExpandAttr'))();
        cea.setDirection(0); // 向下展开（v2 XML: dir="0"）
        // 批H：单元格排序（#45 license 墙重攻定案——env 全激活后 CellSortAttr/SortHeader 可加载；
        ce.setCellExpandAttr(cea);
      }
      sh.cur.addCellElement(ce);
      return ce;
    }

    // 跨函数句柄：图表 / 斜线表头 / 数据集等已外移的构建器经它回写当前 sheet 的对象图
    var api = { wb: wb, putCell: putCell, chartDecoJobs: chartDecoJobs };
    // build 级上下文：sheet 游标 holder + palette + 已外移构建器需要的句柄
    var ctx = { wb: wb, sh: sh, api: api, P: IR.palette || null, putCell: putCell, putDSCell: putDSCell };


    var wbTableDatas = buildDatasets(wb, IR);

    // --- 块布局引擎 ---
    var out = { wb: wb, sheets: [] };
    IR.sheets.forEach(function (sIR) { out.sheets.push(buildSheet(ctx, IR, sIR)); });
    applyWorkbookParamAndWrite(wb, IR, sh);
    out.applyDeco = function () {
      chartDecoJobs.forEach(function (j) {
        var coll = j.ce.getValue();
        var ch = coll.getChart(0);
        applyChartDeco(ch, ch.getPlot(), j.b, j.van);
      });
      return chartDecoJobs.length;
    };
    applyWorkbookAttrs(wb, IR);
    out.styleCount = Object.keys(styled).length;
    out.totalCol = out.sheets[0].totalCol;
    return out;
  }



  // 数据字典（官方 39 张使用；批D 扩三形态——custom map / tableData 数据集字典 / formula 公式字典）：
  //   custom: {A:'合格',...}                     → CustomDictionary(Object[],Object[])（v4.0 原形态，零回归）
  //   { tableData: { ds, keyIdx?, valIdx? } }    → TableDataDictionary(NameTableData(ds), keyIdx, valIdx)（官方 54 张主形态，零凭据）
  //   { formula: '=...' }                        → FormulaDictionary + setFormula（官方 8 张）
  //   DatabaseDictionary/DynamicSQLDict 需 Connection 对象面 → 凭据注入批（README #74 登记工单，不假造）
  function cellDict(ce, d) {
    if (!d) return;
    var dict;
    if (!Array.isArray(d) && typeof d === 'object' && (d.tableData || d.formula)) {
      if (d.tableData) {
        dict = new (J('com.fr.data.impl.TableDataDictionary'))(
          new (J('com.fr.data.impl.NameTableData'))(d.tableData.ds),
          d.tableData.keyIdx != null ? d.tableData.keyIdx : 0,
          d.tableData.valIdx != null ? d.tableData.valIdx : 1);
      } else {
        dict = new (J('com.fr.data.impl.FormulaDictionary'))();
        // 官方形（员工变化查询分析.cpt）：ProduceDict 带等号产出公式 + EFormulaDict 执行公式（缺省 =$$$ 原值即键；
        //   只设 produce 不设 excute → 求值空白——首版渲染空的根因）
        var fstr = String(d.formula);
        dict.setProduceFormula(fstr.charAt(0) === '=' ? fstr : '=' + fstr);
        dict.setExcuteFormula('=$$$');
      }
    } else {
      var keys = Object.keys(d);
      var K = J('java.lang.reflect.Array').newInstance(cls('java.lang.Object'), keys.length);
      var V = J('java.lang.reflect.Array').newInstance(cls('java.lang.Object'), keys.length);
      for (var i = 0; i < keys.length; i++) { K[i] = keys[i]; V[i] = String(d[keys[i]]); }
      dict = new (J('com.fr.data.impl.CustomDictionary'))(K, V);
    }
    ce.setPresent(new (J('com.fr.base.present.DictPresent'))(dict));
  }

  // HTML 显示（官方 49 张使用）：CellGUIAttr.setShowAsHTML
  function cellHtml(ce) {
    var g = ce.getCellGUIAttr();
    if (!g) g = new (J('com.fr.report.cell.cellattr.CellGUIAttr'))();
    g.setShowAsHTML(true);
    ce.setCellGUIAttr(g);
  }

  // ---------- 富文本族（v4.1，官方 21 张使用）----------
  // 官方 套打.cpt 形态：<O t="RichText"><RichText><RichChar styleIndex=N><text>…</text></RichChar>…
  // 一手 API（probe_richtext/2）：com.fr.report.cell.cellattr.core.RichText.addContent(RichChar)
  //   RichChar(String text, Style) / setStyle(Style) / setText(String)
  function richText(parts) {
    var RT = J('com.fr.report.cell.cellattr.core.RichText');
    var RC = J('com.fr.report.cell.cellattr.core.RichChar');
    var rt = new RT();
    parts.forEach(function (p) {
      var st = style({
        bold: !!p.bold, sizePt: p.sizePt, color: (p.color != null ? p.color : undefined),
        name: p.font, align: (p.align != null ? p.align : undefined)
      });
      rt.addContent(new RC(String(p.text == null ? '' : p.text), st));
    });
    return rt;
  }

  // 公式显示（官方 36 张使用）：com.fr.base.present.FormulaPresent(String)
  function cellFormulaPresent(ce, formula) {
    var f = String(formula);
    ce.setPresent(new (J('com.fr.base.present.FormulaPresent'))(f.charAt(0) === '=' ? f : '=' + f));
  }

  // ---------- 悬浮元素族（v4.1，官方 18 张使用）----------
  // 官方 产品明细.cpt 形态：<FloatElementList><com.fr.report.cell.FloatElement>
  //   一手 API：FloatElement(UNIT,UNIT,UNIT,UNIT,Object) + setName/setStyle/setNameHyperlinkGroup
  //   WorkSheet.addFloatElement(FloatElement)
  function buildFloat(fl, stOf) {
    var val;
    if (fl.rich) val = richText(fl.rich);
    else if (fl.imageFile) {
      checkLocalPath(fl.imageFile, 'float imageFile');   // 安全批 B：路径钳制在 FR_AGENT_HOME
      var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(fl.imageFile));
      if (!img) throw new Error('[IR] imageFile unreadable: ' + fl.imageFile);
      var ifmt = fl.imageFormat || 'png';
      if (!/^(png|jpe?g|gif|bmp)$/i.test(ifmt)) throw new Error('[float] imageFormat outside whitelist png|jpg|jpeg|gif|bmp: ' + ifmt);
      val = new (J('com.fr.general.ImageWithSuffix'))(img, ifmt);
    } else val = (fl.text == null ? '' : fl.text);
    var fe = new (J('com.fr.report.cell.FloatElement'))(
      fuPt(fl.leftPt || 0), fuPt(fl.topPt || 0), fuPt(fl.widthPt || 100), fuPt(fl.heightPt || 40), val);
    fe.setName(fl.name || ('float' + (fl._i || 0)));
    if (fl.style) fe.setStyle(stOf(fl.style));
    if (fl.linkTo) cellLink(fe, fl.linkTo);
    return fe;
  }

  // ---------- 水印族（v4.1，官方 7 张使用）----------
  // 官方 水印.cpt 形态：<WatermarkAttr class="com.fr.base.iofile.attr.WatermarkAttr">
  //   一手 API：WatermarkAttr() + setText/setFontSize/setColor/setHorizontalGap/setVerticalGap/setValid
  //   WorkBook.addAttrMark(IOFileAttrMark)
  function applyWatermark(wb, w) {
    var wa = new (J('com.fr.base.iofile.attr.WatermarkAttr'))();
    wa.setText(String(w.text == null ? '' : w.text));
    wa.setFontSize(w.fontSize || 20);
    wa.setHorizontalGap(w.hGap || 200);
    wa.setVerticalGap(w.vGap || 100);
    if (w.color != null) wa.setColor(awtColor(w.color));
    wa.setValid(true);
    wb.addAttrMark(wa);
  }

  // ---------- 工具栏族（v4.1，官方 45 张使用）----------
  // 官方 套打.cpt 形态：<WebPageContent><ToolBars><ToolBarManager><ToolBar><Widget class="com.fr.report.web.button.*">
  //   一手 API（probe_all/3）：com.fr.form.ui.ToolBar.addWidget(Widget) +
  //   com.fr.report.web.ToolBarManager.setToolBar(ToolBar) + ReportWebAttr.setToolBarManager
  var TOOLBAR_BUTTONS = {
    export: 'com.fr.report.web.button.Export',
    email: 'com.fr.report.web.button.Email',
    print: 'com.fr.report.web.button.Print',
    flashPrint: 'com.fr.report.web.button.FlashPrint',
    newPrint: 'com.fr.report.web.button.NewPrint',
    printPreview: 'com.fr.report.web.button.PrintPreview',
    pageSetup: 'com.fr.report.web.button.PageSetup',
    first: 'com.fr.report.web.button.page.First',
    previous: 'com.fr.report.web.button.page.Previous',
    pageNavi: 'com.fr.report.web.button.page.PageNavi',
    next: 'com.fr.report.web.button.page.Next',
    last: 'com.fr.report.web.button.page.Last',
    submit: 'com.fr.report.web.button.write.Submit',
    verify: 'com.fr.report.web.button.write.Verify',
    // 批F：write 工具栏按钮族（官方 频次 AppendColumnRow 18/ShowCellValue 16/DeleteRowButton 11/AppendRowButton 9/ImportExcelData 5）
    appendRow: 'com.fr.report.web.button.write.AppendRowButton',
    deleteRow: 'com.fr.report.web.button.write.DeleteRowButton',
    appendColumnRow: 'com.fr.report.web.button.write.AppendColumnRow',
    showCellValue: 'com.fr.report.web.button.write.ShowCellValue',
    importExcel: 'com.fr.report.web.button.write.ImportExcelData'
  };
  function applyToolbar(wb, bar) {
    var tb = new (J('com.fr.form.ui.ToolBar'))();
    (bar.buttons || []).forEach(function (b, i) {
      var key = (typeof b === 'string') ? b : b.kind;
      // 安全批 B：className 逃生口已移除——只认 TOOLBAR_BUTTONS 白名单键；自定义按钮走受信本地注册表（模型永不直报类名）
      var cn = TOOLBAR_BUTTONS[key];
      if (!cn) throw new Error('[IR] unknown toolbar button: ' + key);
      var wg = new (J(cn))();
      if (typeof b === 'object') {
        if (b.text) { try { wg.setText(b.text); } catch (e1) { } }
        if (b.icon) { try { wg.setIconName(b.icon); } catch (e2) { } }
      }
      try { wg.setWidgetName(key + (i + 1)); } catch (e3) { }
      tb.addWidget(wg);
    });
    var tm = new (J('com.fr.report.web.ToolBarManager'))();
    tm.setToolBar(tb);
    var ra = wb.getReportWebAttr();
    if (!ra) { ra = new (J('com.fr.web.attr.ReportWebAttr'))(); wb.setReportWebAttr(ra); }
    // 一手 API（probe_toolbar2）：工具栏挂在 WebView.setToolBarManagers(ToolBarManager[])
    var wv = ra.getWebView();
    if (!wv) wv = new (J('com.fr.report.web.WebView'))();
    var TMC = cls('com.fr.report.web.ToolBarManager');
    var arr = J('java.lang.reflect.Array').newInstance(TMC, 1);
    arr[0] = tm;
    wv.setToolBarManagers(arr);
    ra.setWebView(wv);
    wb.setReportWebAttr(ra);
  }

  // 超链组装（v3.2 尾刀）：NameJavaScriptGroup(NameJavaScript(名, ReportletHyperlink)) → ce.setNameHyperlinkGroup
  // 一手 API 面（probe_link/2）：ReportletHyperlink(String reportletPath) 直构造；组可用单件构造或 addNameHyperlink
  // v3.4 cellLink：任意格挂官方形态超链（titlebar 链格 byPost=true）——setByPost 一手实证存在
  // 批A（2026-11-04）：组装提取单源 buildLinkGroup——cellLink（挂格）与条件动作
  //   then.link（HyperlinkHighlightAction 官方组形态）共用一个组装器。
  function buildLinkGroup(l, dfltName) {
    var hl;
    if (l.web) {
      // v3.9 URL 链接族（probe_weblink.js 一手 API 面）：WebHyperlink(String) 或 new+setURL；
      // 数据分析落地路由 /webroot/decision/view/report?viewlet=<编码路径>&op=view（零参数、请求大小恒定）
      hl = new (J('com.fr.js.WebHyperlink'))();
      hl.setURL(checkRelUrl(l.web.url, 'link.web'));
    } else {
      var rhl = new (J('com.fr.js.ReportletHyperlink'))(checkRelReportlet(l.reportlet, 'link.reportlet'));
      if (l.byPost) rhl.setByPost(true);
      // v3.6 钻取传参（官方语料 数据钻取主报表.cpt）：Parameters 里 name + =$$$ 公式 = 把当前格值交给子报表
      if (l.params && l.params.length) rhl.setParameters(ppArray(l.params));
      if (l.extendParameters) rhl.setExtendParameters(true);
      // 批E：弹窗属性（ReportletHyperlinkDialogAttr 一手探针：setAttr 挂接 + title/center/left/top）
      if (l.dialog && rhl.setAttr) {
        var da = new (J('com.fr.js.ReportletHyperlinkDialogAttr'))();
        if (l.dialog.title != null) da.setTitle(String(l.dialog.title));
        if (l.dialog.center != null) da.setCenter(!!l.dialog.center);
        if (l.dialog.left != null) da.setLeft(l.dialog.left);
        if (l.dialog.top != null) da.setTop(l.dialog.top);
        rhl.setAttr(da);
      }
      hl = rhl;
    }
    // 批E：宽高/标题（Hyperlink 基类 setter，两分支通用）
    if (l.width != null) hl.setWidth(l.width);
    if (l.height != null) hl.setHeight(l.height);
    if (l.title) hl.setLinkTitle(String(l.title));
    if (l.targetFrame) hl.setTargetFrame(checkTargetFrame(l.targetFrame, 'link.targetFrame'));
    // 批E：超链组多件——主件（reportlet/web）+ js 事件件（ParameterJavaScript 动态参数回填，官方 589 处）
    var main = new (J('com.fr.js.NameJavaScript'))(l.name || dfltName || '跳转报表1', hl);
    if (l.js && l.js.length) {
      var NJSC = cls('com.fr.js.NameJavaScript');
      var arr = J('java.lang.reflect.Array').newInstance(NJSC, l.js.length + 1);
      arr[0] = main;
      for (var ji = 0; ji < l.js.length; ji++) {
        var pj = l.js[ji];
        var pjs = new (J('com.fr.js.ParameterJavaScript'))();
        if (pj.params && pj.params.length) pjs.setParameters(ppArray(pj.params));
        if (pj.recalc != null) pjs.setShouldRecalculate(!!pj.recalc);
        arr[ji + 1] = new (J('com.fr.js.NameJavaScript'))(pj.name || ('动态参数' + (ji + 1)), pjs);
      }
      return new (J('com.fr.js.NameJavaScriptGroup'))(arr);
    }
    return new (J('com.fr.js.NameJavaScriptGroup'))(main);
  }
  function cellLink(ce, l) { ce.setNameHyperlinkGroup(buildLinkGroup(l)); }
  function applyLink(dscCells, l) {
    var ce = dscCells[l.by];
    if (!ce) throw new Error('[IR] link.by not a detail column: ' + l.by);
    // 批E：detail.link 与 cellLink 同路单源（buildLinkGroup；缺省名保 '钻取' 防既有产物字节漂移）
    ce.setNameHyperlinkGroup(buildLinkGroup(l, '钻取'));
  }

  // 参数面板组装（v3.2）：ReportParameterAttr → FormParameterUI(WParameterLayout) → BoundsWidget 布布点
  // 一手 API 面（probe_param/2/3/4/5）：
  //   WorkBook.setReportParameterAttr(ReportParameterAttr)；rpa.setShowWindow/setDelayPlaying/setAlign/setWindowPosition/setParameterWindowTitle/setParameterUI
  //   FormParameterUI(WLayout) 一次性构造 + setDesignSize(Dimension)
  //   WLayout.addWidget(Widget) + WAbsoluteLayout.setBounds(Widget, Rectangle)（内部自动包 WAbsoluteLayout$BoundsWidget）
  //   Label / EditorHolder / TextEditor / FormSubmitButton 全走 AbstractDataControl.setWidgetValue(WidgetValue)（WidgetValue(Object) 即 ValueInitializer 标准实现）
  //   官方语料（GettingStarted.cpt）：EditorHolder 不包内嵌编辑器，widgetName 即参数名，widgetValue 为默认值
  // 批A（2026-11-04）控件构造提取单源（Dryer）：参数面板 buildParamAttr 与条件动作
  //   then.widget（WidgetHighlightAction 内嵌编辑器）共用 buildWidget；几何布点仍归面板
  //   （then.widget 是嵌在 Action 里的编辑器子树，无 Rectangle 布点）。
  function buildWidget(w) {
    var WV = J('com.fr.form.ui.WidgetValue');

    // v4.2 面板控件字典（RadioGroup/CheckBoxGroup/ComboCheckBox/TreeComboBoxEditor 共用）
    function dictOf(values) {
      var S = new (J('java.lang.String[]'))(values.length);
      for (var z = 0; z < values.length; z++) S[z] = String(values[z]);
      return new (J('com.fr.data.impl.CustomDictionary'))(S, S);
    }

    var ww;
    if (w.kind === 'label') {
      ww = new (J('com.fr.form.ui.Label'))();
      if (w.name) ww.setWidgetName(w.name); // 官方语料 Label 带 WidgetName（如 Label地区）
      ww.setWidgetValue(new (WV)(w.text));
      ww.setVerticalCenter(true);           // 官方 LabelAttr verticalcenter="true"
      if (w.bold || w.sizePt) ww.setFont(font(!!w.bold, w.sizePt)); // font(): FRFont 工厂（SimHei 系列）
    } else if (w.kind === 'editor') {
      // TextEditor：EditorHolder 空壳在 web 嵌入式渲染路径起不来（2026-10-27 破案）。
      // 生产 V2 语料同款：正经文本控件（widgetName=参数名, widgetValue=默认值）
      ww = new (J('com.fr.form.ui.TextEditor'))();
      ww.setWidgetName(w.name);
      ww.setWidgetValue(new (WV)(w.value == null ? '' : String(w.value)));
    } else if (w.kind === 'date') {
      // DateEditor（probe_panelwidgets2/probe_inst.js 一手实证）：默认 format=yyyy-MM-dd，widgetName=参数名。
      // 2026-10-27 支持公式默认值：value 以 '=' 开头 → FR 公式（如 =TODAY()-6 / =TODAY()，最近 7 天随数据刷新自动前移）
      ww = new (J('com.fr.form.ui.DateEditor'))();
      ww.setWidgetName(w.name);
      var dv = (w.value == null) ? '' : String(w.value);
      if (dv.charAt(0) === '=') {
        ww.setWidgetValue(new (WV)(new (J('com.fr.base.Formula'))(dv.substring(1))));
      } else {
        ww.setWidgetValue(new (WV)(dv));
      }
    } else if (w.kind === 'combo') {
      // ComboBox + CustomDictionary(keys,values)（probe_panelwidgets3/probe_dict.js）：静态枚举下拉（每页 10/20/30/40/50）
      ww = new (J('com.fr.form.ui.ComboBox'))();
      ww.setWidgetName(w.name);
      ww.setWidgetValue(new (WV)(w.value == null ? '' : String(w.value)));
      var kv = new (J('java.lang.String[]'))(w.values.length);
      for (var z = 0; z < w.values.length; z++) kv[z] = String(w.values[z]);
      ww.setDictionary(new (J('com.fr.data.impl.CustomDictionary'))(kv, kv));
    } else if (w.kind === 'number') {
      // v4.2 NumberEditor（官方 1814 次，参数面板第一大户）
      ww = new (J('com.fr.form.ui.NumberEditor'))();
      ww.setWidgetName(w.name);
      if (w.allowDecimals != null) ww.setAllowDecimals(!!w.allowDecimals);
      if (w.maxValue != null) ww.setMaxValue(w.maxValue);
      if (w.minValue != null) ww.setMinValue(w.minValue);
      ww.setWidgetValue(new (WV)(w.value == null ? J('java.lang.Double').valueOf(0) : J('java.lang.Double').valueOf(w.value)));
    } else if (w.kind === 'textarea') {
      // v4.2 TextArea（多行文本）
      ww = new (J('com.fr.form.ui.TextArea'))();
      ww.setWidgetName(w.name);
      ww.setWidgetValue(new (WV)(w.value == null ? '' : String(w.value)));
    } else if (w.kind === 'radio') {
      // v4.2 RadioGroup（16 张）：字典 + 选中值
      ww = new (J('com.fr.form.ui.RadioGroup'))();
      ww.setWidgetName(w.name);
      ww.setDictionary(dictOf(w.values));
      ww.setWidgetValue(new (WV)(w.value == null ? '' : String(w.value)));
    } else if (w.kind === 'checkbox' || w.kind === 'combocheck') {
      // v4.2 CheckBoxGroup(7) / ComboCheckBox(17)：多选，值按分隔符串给出
      ww = new (J(w.kind === 'checkbox' ? 'com.fr.form.ui.CheckBoxGroup' : 'com.fr.form.ui.ComboCheckBox'))();
      ww.setWidgetName(w.name);
      ww.setDictionary(dictOf(w.values));
      ww.setWidgetValue(new (WV)(w.value == null ? '' : String(w.value)));
    } else if (w.kind === 'treecombo') {
      // v4.2 TreeComboBoxEditor（11 张）：字典当树源，单选
      ww = new (J('com.fr.form.ui.TreeComboBoxEditor'))();
      ww.setWidgetName(w.name);
      ww.setDictionary(dictOf(w.values));
      ww.setWidgetValue(new (WV)(w.value == null ? '' : String(w.value)));
    } else if (w.kind === 'iframe') {
      // v4.2 IframeEditor（5 张）：嵌页面，无 widgetValue —— 安全批 B：目标仅相对路径
      var iu = (w.url != null ? w.url : (w.text == null ? '' : String(w.text)));
      if (iu) iu = checkRelUrl(iu, 'iframe widget');
      ww = new (J('com.fr.form.ui.IframeEditor'))(iu);
      ww.setWidgetName(w.name);
    } else if (w.kind === 'nav') {
      // FreeButton + form.event.Listener(click -> JavaScriptImpl location.href)（probe_inst.js 实例化实证）：
      // 模块导航入面板：整页重载跳数据分析路由，与 WebHyperlink 落地口径一致
      ww = new (J('com.fr.form.ui.FreeButton'))();
      ww.setWidgetName(w.name);
      ww.setText(w.text);
      var lst = new (J('com.fr.form.event.Listener'))();
      lst.setEventName('click');
      lst.setInvokeOnce(false);
      lst.setAction(new (J('com.fr.js.JavaScriptImpl'))("window.location.href='" + checkRelUrl(w.url, 'nav widget') + "';"));
      ww.addListener(lst);
    } else if (w.kind === 'submit') {
      ww = new (J('com.fr.form.parameter.FormSubmitButton'))(w.text);
      ww.setText(w.text);
      ww.setWidgetName(w.name || w.text);
      } else throw new Error('[IR] unknown param widget kind: ' + w.kind);
      // 批F：编辑器校验正则（官方 NoneReg 153/PhoneReg/IDCardReg/CustomReg；TextEditor.setRegex(RegExp)+setRegErrorMessage）
      //   仅值编辑器类（RegexFieldEditor 子族）支持；便捷 NoneReg 为默认不写零触碰（既有 spec 字节零漂移）
      if (w.reg && ww.setRegex) {
        var regSpec = w.reg;
        var REGF = 'com.fr.form.ui.reg.';
        var regObj;
        if (typeof regSpec === 'string') {
          var RMAP = { none: 'NoneReg', phone: 'PhoneReg', idcard: 'IDCardReg', mobile: 'MobileReg', postcard: 'PostCardReg' };
          if (!RMAP[regSpec]) throw new Error('[IR] unknown widget reg: ' + regSpec);
          regObj = new (J(REGF + RMAP[regSpec]))();
        } else if (regSpec.custom) {
          regObj = new (J(REGF + 'CustomReg'))(String(regSpec.custom));
        } else throw new Error('[IR] widget.reg must be none|phone|idcard|mobile|postcard or {custom}');
        ww.setRegex(regObj);
        if (regSpec.err && ww.setRegErrorMessage) ww.setRegErrorMessage(String(regSpec.err));
      }
      return ww;
  }

  function buildParamAttr(wb, p) {
    var Rect = J('java.awt.Rectangle');
    var built = [];

    p.widgets.forEach(function (w, wi) {
      built.push({ ww: buildWidget(w), r: w });
    });

    var wpl = new (J('com.fr.form.ui.container.WParameterLayout'))();
    wpl.setDesignWidth(p.designWidth);
    // 2026-10-27 用户口径：进入页面即显示第一页默认数据（不用先点查询）——
    // 初始不显数据的开关就是面板 XML 里的 DelayDisplayContent(delay)，探针 probe_wpl.js 定位，显式关掉
    wpl.setDelayDisplayContent(false);
    wpl.setDisplay(true);
    // 布点：显式 BoundsWidget(Widget, Rectangle) 包装再 add——官方 XML 里 Layout 子件全为 BoundsWidget；
    // 直接 addWidget(裸 Widget) 会 ClassCastException（内部把子件强转 CRBoundsWidget，joinWArgsPath 实证打脸）
    var BW = J('com.fr.form.ui.container.WAbsoluteLayout$BoundsWidget');
    built.forEach(function (it) {
      wpl.addWidget(new (BW)(it.ww, new (Rect)(it.r.x, it.r.y, it.r.w, it.r.h)));
    });

    var fpi = new (J('com.fr.form.main.parameter.FormParameterUI'))(wpl);
    fpi.setDesignSize(new (J('java.awt.Dimension'))(p.designWidth, p.designHeight));

    var rpa = new (J('com.fr.main.parameter.ReportParameterAttr'))();    rpa.setShowWindow(p.showWindow);
    rpa.setDelayPlaying(p.delayPlaying);
    rpa.setAlign(p.align);
    rpa.setWindowPosition(p.windowPosition);
    // 2026-10-27 破案：useParamsTemplate=false = 引擎放弃 FormParameterUI，走「按模板参数自动生成面板」路线，
    // 而 <Parameters/> 为空 → 嵌入式面板整条不渲染（弹出窗 showWindow 不走此判断，故弹窗形态一直正常）。
    // 自定义 FormParameterUI 必须配 true（生产 V2 与设计器自定义面板模板皆 true）。
    rpa.setUseParamsTemplate(p.useParamsTemplate !== false);
    rpa.setParameterWindowTitle(p.title);
    rpa.setParameterUI(fpi);
    wb.setReportParameterAttr(rpa);
    return rpa;
  }

  return {
    Align: Align, COLORS: COLORS, FONT_NAME: FONT_NAME, FONT_SIZE_PT: FONT_SIZE_PT,
    cls: cls, of: of, statField: statField, INT_CLASS: INT_CLASS,
    baseStyle: baseStyle, font: font, bgColor: bgColor, edgesOf: edgesOf, style: style,
    fuPt: fuPt, build: build, OP: OP, applyLink: applyLink, cellLink: cellLink, FN: FN
  };
})();