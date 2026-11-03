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

var Obj = (function () {
  var Class = Java.type('java.lang.Class');
  function J(n) { return Java.type(n); }
  // v3.4 聚合函数家族（SummaryGrouper.setFunction 用；官方语料 FN 直引全类名）
  var FN = { SUM: 'com.fr.data.util.function.SumFunction', AVERAGE: 'com.fr.data.util.function.AverageFunction' };

  // ---------- 常量（封死） ----------
  var Align = { CENTER: 0, LEFT: 2, RIGHT: 4, DEFAULT: -1 };
  var FONT_NAME = 'SimHei';          // 引擎只认 SimHei（黑体）
  var FONT_SIZE_PT = 10.5;
  var BORDER_LINE = 1;               // 细实线
  var COLORS = {
    headerBg: -2497805,              // 表头蓝（TABLE_DESIGN_STANDARD）
    totalBg: -855310,                // 合计灰
    lightLine: -3417120              // 数据区内线浅灰
  };

  // ---------- 反射工具 ----------
  function cls(n) { return Class.forName(n); }
  function of(n) { return cls(n).newInstance(); }
  function statField(n, f) { return cls(n).getField(f).get(null); }
  var INT_CLASS = cls('java.lang.Integer').getField('TYPE').get(null);

  // v3.6 参数数组工厂：DBTableData.setParameters / ReportletHyperlink.setParameters 都吃 ParameterProvider[]
  //   （Java 数组只能反射建：Array.newInstance 要真 Class，Java.type 的 JavaClass 不行 → cls()）
  //   项形态：{ name, value } 普通值（子报表默认值）| { name, formula } 公式值（钻取 =$$$ 传当前格）
  function ppArray(pairs) {
    var arr = J('java.lang.reflect.Array').newInstance(cls('com.fr.stable.ParameterProvider'), pairs.length);
    for (var i = 0; i < pairs.length; i++) {
      var pr = pairs[i];
      var val = pr.formula != null
        ? new (J('com.fr.base.Formula'))(pr.formula.charAt(0) === '=' ? pr.formula : '=' + pr.formula)
        : String(pr.value == null ? '' : pr.value);
      J('java.lang.reflect.Array').set(arr, i, new (J('com.fr.base.Parameter'))(pr.name, val));
    }
    return arr;
  }

  // ---------- 样式工厂 ----------
  var defStyle = null;
  function baseStyle() {
    if (!defStyle) defStyle = statField('com.fr.base.Style', 'DEFAULT_STYLE');
    return defStyle;
  }
  // 颜色统一入口（v4.1，2026-11-02）：0xRRGGBB（正数、无 alpha 字节）按不透明 RGB 处理；
  //   负数（ARGB 全 32 位，如 -16777216 / 官方语料色）走 hasalpha 通路。
  //   事故根因：0xEEF3FA 当 ARGB 用 → alpha=0 → 整片透明（自检表底色/字色消失）。
  function awtColor(v) {
    if (v == null) return null;
    if (typeof v === 'string') v = parseInt(v.replace(/^#/, ''), 16);
    if (v >= 0 && v <= 0xFFFFFF) return new (J('java.awt.Color'))((v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF);
    return new (J('java.awt.Color'))(v, true);
  }
  function font(bold, sizePt, colorInt, name) {
    // 字号口径（2026-10-27 用户拍板"甲 = 生产同款"）：attr = sizePt × 8，sizePt = 设计器框显示值。
    //   锚点（生产 3D翘曲检查数据分析V2 attr112 ↔ 框显示14；attr36 ↔ 4.5）；attr112 物理纸面 = 56pt（大字号，生产观感）。
    //   旧标尺推论（attr/2=纸面pt）仍成立，用于纸面几何计算；设计器框 = attr/8 = 纸面/4，二者并存不冲突。
    var FR_SIZE = Math.round((sizePt || FONT_SIZE_PT) * 8);
    var F = J('com.fr.general.FRFont');
    // 事故根因（2026-11-02，probe_font/2/3/4 实证）：
    //   getInstanceFromFRSize 返回**全局共享实例**（sameInstance=true），FRFont.clone() 又返回 this，
    //   setForeground 会污染所有同 name+style+size 的 Style（自检表标题/表头/合计被条件属性的红字整体带红）。
    //   → 改走 getInstance(name, style, size2D, color)：带色实例按色缓存、彼此独立（probe_font4：a!==b、fg 各归各）。
    //     size2D = FRSize/8（FRFont.getSize2D 口径，probe_font4 实证 84→10.5）。
    var sz2d = FR_SIZE / 8;
    // 无颜色 → 走原 getInstanceFromFRSize（基线像素逐字节不变）；带色 → getInstance(size2D, color)
    //   （probe_font4：带色实例按色缓存、彼此独立，不再共享黑体实例，故无需 clone 也不敢 clone——clone 返回 this）
    var f = (colorInt == null)
      ? F.getInstanceFromFRSize(name || FONT_NAME, bold ? 1 : 0, FR_SIZE)
      : F.getInstance(name || FONT_NAME, bold ? 1 : 0, sz2d, awtColor(colorInt));
    return f;
  }
  function bgColor(intVal) {
    return J('com.fr.base.background.ColorBackground').getInstance(awtColor(intVal));
  }

  // 边框分级（TABLE_DESIGN_STANDARD §四）：pos 'first'|'mid'|'last'（整行合并用 null）
  // 语义与 v2 对齐：'deep' = 深色黑边（外框/表头上下/合计线），L = 数据区内线浅灰
  function edgesOf(pos, deep) {
    var L = COLORS.lightLine;
    if (deep === 'header') return { top: 'deep', bottom: 'deep', left: pos === 'first' ? 'deep' : L, right: pos === 'last' ? 'deep' : L };
    if (deep === 'data') return { top: L, bottom: L, left: pos === 'first' ? 'deep' : L, right: pos === 'last' ? 'deep' : L };
    if (deep === 'total') return { top: 'deep', bottom: 'deep', left: pos === 'first' ? 'deep' : L, right: pos === 'last' ? 'deep' : L };
    return { top: 'deep', bottom: 'deep', left: 'deep', right: 'deep' }; // 标题：全深框（v2 语义：全 null=全深）
  }

  // st: { align, bold, bg, format, edges:{top,bottom,left,right}, deep }
  // edges 里值为 int 深浅色；null = 该边不上线。"深色边"由 deep=true 显式给出（合并行/表头下线）？
  // 不——v2 语义：深色边 = style="1" 无 color（默认黑）。API 层深色边用显式黑色 int -16777216。
  function style(st) {
    var s = baseStyle();
    if (st.align != null) s = s.deriveHorizontalAlignment(st.align);
    s = s.deriveFRFont(font(st.bold, st.sizePt, st.color, st.name));
    if (st.bg != null) s = s.deriveBackground(bgColor(st.bg));
    if (st.format) s = s.deriveFormat(new (J('com.fr.base.CoreDecimalFormat'))(st.format));
    // v3.7 单元格内边距（排版标准五.1"待验"一手实证：Style.derivePadding(左,右) 存在）——
    // 密集表去竖线后，文字不贴边、右数字与次列左文字之间的呼吸感全靠它。
    if (st.padL != null) s = s.derivePaddingLeft(st.padL);
    if (st.padR != null) s = s.derivePaddingRight(st.padR);
    // v3.4 borders 逐边 [styleInt, colorInt] 透传（官方混合线型：1 细/2 灰点/3 框/5 粗）
    var bw = st.borders;
    if (bw) {
      if (bw.top != null) s = s.deriveBorderTop(bw.top[0], awtColor(bw.top[1]));
      if (bw.bottom != null) s = s.deriveBorderBottom(bw.bottom[0], awtColor(bw.bottom[1]));
      if (bw.left != null) s = s.deriveBorderLeft(bw.left[0], awtColor(bw.left[1]));
      if (bw.right != null) s = s.deriveBorderRight(bw.right[0], awtColor(bw.right[1]));
    }
    var e = st.edges;
    if (e) {
      // palette 统一边框色（官方样式 s0-s3 全部四边 -13725210 统一色）：st.border 覆盖深浅两档
      var Q = st.border != null ? st.border : -16777216; // 深色(默认纯黑)
      var Lc = st.border != null ? st.border : COLORS.lightLine;
      function ec(v) {
        var c = (v === 'deep') ? Q : (st.border != null ? st.border : v);
        return awtColor(c);
      }
      if (e.top != null) s = s.deriveBorderTop(BORDER_LINE, ec(e.top));
      if (e.bottom != null) s = s.deriveBorderBottom(BORDER_LINE, ec(e.bottom));
      if (e.left != null) s = s.deriveBorderLeft(BORDER_LINE, ec(e.left));
      if (e.right != null) s = s.deriveBorderRight(BORDER_LINE, ec(e.right));
    }
    return s;
  }

  // ---------- 单位 ----------
  function fuPt(pt) {
    // XML 序列化值 = pt×12700；WorkSheet API 直接收 FU.getInstance(同值)（待 export 对比实证）
    return J('com.fr.stable.unit.FU').getInstance(Math.round(pt * 12700));
  }

  // ---------- 对象图构建器 ----------
  // v3.1：消费 IR（sheets[].blocks + datasets）。行号由块序线性分配——
  // 新功能族 = 新 block 类型 + case 分支，旧布局零改动。
  // v4.2 VanChart 画区地板（probe_vanchart30 一手像素证据）：Van 族画格行高 < 240pt 时
  //   auto 刻度塌缩到只剩 "0"、数据压扁（A160/E160Px 双图种复现 → B240/F240 全刻度痊愈）。
  //   表格块行高一律不动（默认路径零漂移是回归门红线）；legacy bar/pie/line 无证据不碰。
  var VAN_KINDS = { vbar: 1, vline: 1, varea: 1, vscatter: 1, vpie: 1, vgauge: 1 };
  function build(IR) {
    var wb = new (J('com.fr.main.impl.WorkBook'))();
    var CellC = cls('com.fr.report.cell.DefaultTemplateCellElement');
    var CellT = J('com.fr.report.cell.DefaultTemplateCellElement'); // 直接 new 用（B 通路）
    var cellCtor = CellC.getConstructor(INT_CLASS, INT_CLASS, cls('java.lang.Object'));  // 保留：类型依据
    var styled = {}; // cache: 样式 spec JSON → Style 对象（同 spec = 同引用 = 对象图天然去重）
    function stOf(stSpec) {
      var k = JSON.stringify(stSpec);
      if (!styled[k]) styled[k] = style(stSpec);
      return styled[k];
    }

    var sheet = null; // 当前 sheet（闭包给 put*）
    var P = IR.palette || null; // v3.3 palette（官方 demo 语料配色直通：字色/标题字色/底色/统一边框色）
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
      sheet.addCellElement(ce);
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
        ce.setCellExpandAttr(cea);
      }
      sheet.addCellElement(ce);
      return ce;
    }

    var colLetter = function (i) { return String.fromCharCode(65 + i); };

    // 图表格（v3.2 终极大件）：cell.setValue(ChartCollection)。
    // 一手 API 面（probe_chart/2/3/4/5/6/7 + 官方 WorkBook3 语料）：
    //   Chart(Plot) + setTitle(Title(Object)) + setFilterDefinition(TopDefinitionProvider)；
    //   官方绑定形态 = MoreNameCDDefinition(TableData, categoryName, ChartSummaryColumn[])（抽象祖宗 TableDataDefinition 全家实证不可 new）；
    //   ChartSummaryColumn(值列名, 自定义名, SumFunction)，官方 ChartSummaryColumn/function=SumFunction 同构
    //   ChartCollection 继承链 < Object（非 Widget），序列化形态自桩自验（wb.export 后 grep）
    function putChartCell(c, r, b, spanC) {
      // BarPlot 抽性实证（probe_chart4）：抽象基类，bar 一律用具象 Bar2DPlot；3D 变体后续用 3DPlot 家族
      var TK = { bar: 'com.fr.chart.chartattr.Bar2DPlot', pie: 'com.fr.chart.chartattr.PiePlot', line: 'com.fr.chart.chartattr.LinePlot' };
      // v4.2 VanChart 插件图表族（probe_vanchart/2）：VanChart < Chart 一手超类链；默认构造 = 标准形态
      //   vbar 柱形 / vline 折线 / varea 面积 / vscatter 散点 / vpie 饼图 / vgauge 仪表盘（None Pointer 默认）
      var VK = { vbar: 'com.fr.plugin.chart.column.VanChartColumnPlot', vline: 'com.fr.plugin.chart.line.VanChartLinePlot',
        varea: 'com.fr.plugin.chart.area.VanChartAreaPlot', vscatter: 'com.fr.plugin.chart.scatter.VanChartScatterPlot',
        vpie: 'com.fr.plugin.chart.PiePlot4VanChart', vgauge: 'com.fr.plugin.chart.gauge.VanChartGaugePlot' };
      if (VK[b.kind]) {
        var vplot = new (J(VK[b.kind]))(); // 无轴派（pie/gauge）getyAxis=null，轴参数自动跳过
        var vchart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(vplot);
        // Van 图占位标题（Fine-Engine_Chart_Title_New_Title）默认绘出且吃掉全部绘图区：空串显式压制（二分实证唯一有效项）
        vchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
        // v4.2 绑定分歧（probe_vanchart6/7 一手实证）：
        //   矩形派（bar/line/area/scatter 外）MoreNameCDDefinition 实测可用（分组柱/双系列图例正确）；
        //   vpie/vgauge 官方形态 = VanChartOneValueCDDefinition(TableData, 系列名, 分类名, 值列名, DataFunction)，More 会把分类读成系列（4 全圆事故）
        //   vscatter 官方形态 = BubbleTableDefinition(TableData, seriesName, bubbleX, bubbleY, bubbleSize)（doc/Chart/Scatter/常规散点图.cpt）
        if (b.kind === 'vpie' || b.kind === 'vgauge') {
          vchart.setFilterDefinition(new (J('com.fr.plugin.chart.data.VanChartOneValueCDDefinition'))(
            new (J('com.fr.data.impl.NameTableData'))(b.dataset), '',
            b.category, b.value || (b.values && b.values[0]),
            new (J('com.fr.data.util.function.SumFunction'))()));
        } else if (b.kind === 'vscatter') {
          var btd = new (J('com.fr.chart.chartdata.BubbleTableDefinition'))();
          btd.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
          btd.setSeriesName(b.seriesName || 'series');
          btd.setBubbleX(b.x || (b.values && b.values[0]));
          btd.setBubbleY(b.y || (b.values && b.values[1]));
          vchart.setFilterDefinition(btd);
        } else {
          applyChartAttrs(vchart, vplot, b, true, true);
        }
        var vcc = new (J('com.fr.chart.chartattr.ChartCollection'))();
        vcc.addChart(vchart);
        putCell(c, r, vcc, { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
        return;
      }
      var chart = new (J('com.fr.chart.chartattr.Chart'))(new (J(TK[b.kind]))());
      applyChartAttrs(chart, chart.getPlot(), b);
      var cc = new (J('com.fr.chart.chartattr.ChartCollection'))();
      cc.addChart(chart);
      // v3.3 noBorder（官方图表格 s=4 无边框样式）：edges null = 不 derive 边框（引擎默认 NullBorder）
      putCell(c, r, cc, { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
    }

    // v4.2 图表通用装配（新旧 plot 同路）：绑定（MoreNameCDDefinition）+ 图例 + Y 轴 + 柱间隙
    //   VanChart 族实证（probe_vanchart/2）：VanChart.setFilterDefinition/setTitle 同 Chart；
    //   VanChartValueAxis.setMaxValue/minValue 同口径（getMaxValue 回读 "=0" → Formula 包装）；
    //   无轴派（vpie/vgauge）getyAxis=null → axisY/barInterval 自动跳过
    function applyChartAttrs(chart, plot, b, skipTitle, van) {
      if (!skipTitle && b.title != null) chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title)); // 空串也显式压掉引擎默认占位标题（如 Fine-Engine_Chart_Title_New_Title）
      var CSC = cls('com.fr.chart.chartdata.ChartSummaryColumn'); // StaticClass 不能传 Array.newInstance（README #18 同款），用 cls() 取 Class 对象
      var CSCS = J('com.fr.chart.chartdata.ChartSummaryColumn');  // new 用 StaticClass
      // v3.3 多系列：b.values 数组 → 每系列一个 ChartSummaryColumn（列名=系列名）；单值 b.value 老路径不变
      var vals = (b.values && b.values.length) ? b.values : [b.value];
      // v4.2 A/B 实证（柱形图变形.cpt 形态）：官方 Van 柱形 def 配 NoneFunction；SumFunction 曾致 Y 轴自适货运异常（待验证）
      var fnc = (typeof van !== 'undefined' && van) ? new (J('com.fr.data.util.function.NoneFunction'))() : new (J('com.fr.data.util.function.SumFunction'))();
      var cols = J('java.lang.reflect.Array').newInstance(CSC, vals.length);
      for (var vi = 0; vi < vals.length; vi++) {
        cols[vi] = new (CSCS)(vals[vi], vals[vi], fnc);
      }
      var def = new (J('com.fr.chart.chartdata.MoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))(b.dataset), b.category, cols);
      chart.setFilterDefinition(def);
      // v3.3 图例：官方第一张报表 position=4（右）+ 可见；legend 住在 Plot 上（Chart.getLegend 不存在一手实证，getPlot().getLegend 才对）
      //   Van 默认图例可见（不设 legend 也绘出），故 v4.2 Van 分支 axisY/barInterval 不依赖 legend 是否传参
      if (b.legend && plot) {
        var lg = plot.getLegend();
        if (lg) {
          if (b.legend.fontPt != null || b.legend.color != null) lg.setFRFont(font(b.legend.bold || false, b.legend.fontPt || 12, b.legend.color));
          if (b.legend.position != null) lg.setPosition(b.legend.position);
          if (b.legend.visible != null) lg.setLegendVisible(b.legend.visible);
        }
      }
      // v3.3 轴口径（官方 Y 轴 0-1000 vs legacy auto 800 陆差）：Formula 包装 BaseFormula
      //   v4.2 Van 实证（probe_vanchart16）：setMaxValue 不联动 custom 标志，必须显式 setCustomMaxValue/MinValue(true)，
      //   否则 Y 轴按默认 "=0" 走 → 刻度只剩 0、数据压缩（老路径 Formula 直设即生效，不动）
      if (b.axisY && plot && plot.getyAxis && (van || b.legend)) {
        var yA = plot.getyAxis();
        if (yA) {
          if (b.axisY.max != null) {
            yA.setMaxValue(new (J('com.fr.base.Formula'))('=' + b.axisY.max));
            if (van && yA.setCustomMaxValue) yA.setCustomMaxValue(true);
          }
          if (b.axisY.min != null) {
            yA.setMinValue(new (J('com.fr.base.Formula'))('=' + b.axisY.min));
            if (van && yA.setCustomMinValue) yA.setCustomMinValue(true);
          }
        }
      }
      if (b.barInterval != null && plot && plot.setCategoryIntervalPercent && (van || b.legend)) plot.setCategoryIntervalPercent(b.barInterval);
    }

    // 斜线表头格（v3.3，官方第一张报表语料）：BiasTextPainter(String) 直构造 + setIsBackSlash（官方 false）
    // 文本段用 '|' 分隔、段前空格调距：'     产品|   销售员|       地区'
    function putBiasCell(c, r, text, stSpec, spanC) {
      var painter = new (J('com.fr.report.cell.painter.BiasTextPainter'))(text);
      painter.setIsBackSlash(false);
      return putCell(c, r, painter, stSpec, spanC);
    }

    // --- 数据集 ---
    //   默认：自包含 EmbeddedTableData 直接注入 IR 数据；
    //   v3.5 kind=sql：生产形态 DBTableData(NameDatabaseConnection(连接名), 模板内置 SQL)。
    //     连接定义由 runner 注册进 DatasourceManager，cpt 只存连接名（凭据不落模板）。
    //   记名供图表/单元格绑定复用（绑定一律走 dsName 字符串，两形态同路）。
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
        ds.columns.forEach(function (c) {
          // v3.4 float 类型（官方单价 21.35 小数）：Double；number → Integer；其余 String
          var jType = c.type === 'number' ? Class.forName('java.lang.Integer')
            : (c.type === 'float' ? Class.forName('java.lang.Double') : Class.forName('java.lang.String'));
          etd.addColumn(c.name, jType);
        });
        ds.rows.forEach(function (src) {
          var row = [];
          for (var cj = 0; cj < src.length; cj++) {
            var ct = ds.columns[cj].type;
            row.push(ct === 'number' ? J('java.lang.Integer').valueOf(src[cj])
              : (ct === 'float' ? J('java.lang.Double').valueOf(src[cj]) : String(src[cj])));
          }
          etd.addRow(J('java.util.Arrays').asList(row));
        });
      }
      wb.putTableData(ds.name, etd);
      wbTableDatas[ds.name] = etd;
    });

    // --- 块布局引擎 ---
    var out = { wb: wb, sheets: [] };
    IR.sheets.forEach(function (sIR, si) {
      if (si > 0) throw new Error('[IR] multi-sheet backend lands in v3.2'); // 预留
      sheet = new (J('com.fr.report.worksheet.WorkSheet'))();
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
      var rowCursor = 0, detailRow = -1, headerCols = null, totalCol = -1, totalRow = -1, dscCells = {};
      sIR.blocks.forEach(function (b) {
        // v4.2 Van 画区地板：只在 chart+Van kind 下抬行高（probe_vanchart30：h160 塌缩 / h240 痊愈）
        var bh = (b.type === 'chart' && VAN_KINDS[b.kind] && (b.heightPt == null || b.heightPt < 240)) ? 240 : b.heightPt;
        sheet.setRowHeight(rowCursor, fuPt(bh || 45));
        switch (b.type) {
          case 'title':
            putCell(0, rowCursor, b.text, {
              align: (b.align != null) ? b.align : null, bold: b.bold !== false, bg: null, format: null, edges: edgesOf(null),
              color: P ? P.titleText : undefined, sizePt: b.sizePt != null ? b.sizePt : undefined,
              border: P ? P.border : undefined
            }, b.span);
            break;
          case 'header': {
            headerCols = b.columns;
            var startC = 0;
            if (b.corner) { // v3.3 斜线表头角格：占 span 列，后续列右移
              putBiasCell(0, rowCursor, b.corner.text, {
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
              putCell(gi, rowCursor, c.label, {
                align: contentAlign, bold: c.bold !== false, bg: P ? P.headerBg : COLORS.headerBg,
                format: null, edges: edgesOf(pos, 'header'),
                color: P ? P.text : undefined, sizePt: c.sizePt != null ? c.sizePt : undefined,
                border: P ? P.border : undefined
              });
            });
            break;
          }
          case 'detail': {
            detailRow = rowCursor;
            var condMap = {};
            var addCond = function (nm, cd) { if (!condMap[nm]) condMap[nm] = []; condMap[nm].push(cd); };
            b.columns.forEach(function (c, i) {
              var pos = i === 0 ? 'first' : (i === b.columns.length - 1 ? 'last' : 'mid');
              var contentAlign = (c.align != null) ? c.align : (c.type !== 'number' ? Align.LEFT : Align.RIGHT);
              var fmt = (c.format === '') ? null : (c.type !== 'number' ? null : (c.format || '#,##0')); // format '' = 不上格式
              var dce = putDSCell(i, rowCursor, b.dataset, c.name, {
                align: contentAlign, bold: !!c.bold, bg: (c.bg != null) ? c.bg : null, format: fmt,
                edges: edgesOf(pos, 'data'),
                color: P ? P.text : undefined, sizePt: c.sizePt != null ? c.sizePt : undefined,
                border: P ? P.border : undefined
              });
              dscCells[c.name] = dce;
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
              else Object.keys(dscCells).forEach(function (k) { addCond(k, cd); });
            });
            Object.keys(condMap).forEach(function (k) { applyConditions(dscCells[k], condMap[k]); });
            // 超链（v3.2 尾刀）：by 列挂 NameJavaScriptGroup（钻取 reportlet）
            if (b.link) applyLink(dscCells, b.link);
            // 参数过滤（v3.2 二批）：编辑器选地区 → $参数公式值过滤；**逐列挂同一条件**（各列独立扩展，条件必须对齐）
            if (IR.param && IR.param.filters) {
              IR.param.filters.forEach(function (f) {
                Object.keys(dscCells).forEach(function (k) {
                  dscCells[k].getValue().setCondition(new (J('com.fr.data.condition.CommonCondition'))(
                    f.column, OP[f.op || '='], new (J('com.fr.base.Formula'))('=$' + f.parameter)));
                });
              });
            }
            break;
          }
          case 'total': {
            totalRow = rowCursor;
            var labelSpan = (b.labelSpan != null) ? b.labelSpan : (b.span != null ? b.span : 1);
            putCell(0, rowCursor, b.label || '合计', {
              align: (b.labelAlign != null) ? b.labelAlign : Align.LEFT, bold: b.labelBold !== false,
              bg: (b.labelBg != null) ? b.labelBg : COLORS.totalBg, format: null, edges: edgesOf('first', 'total'),
              color: P ? P.text : undefined, sizePt: b.labelSizePt != null ? b.labelSizePt : undefined,
              border: P ? P.border : undefined
            }, labelSpan);
            if (b.sumCols) { // v3.3 多列求和（官方总计行多列 SUM 公式逐格直落）
              b.sumCols.forEach(function (sc) {
                var fmt = (sc.format === '') ? null : sc.format;
                totalCol = sc.col;
                putCell(sc.col, rowCursor,
                  new (J('com.fr.base.Formula'))(sc.formula || ('=SUM(' + colLetter(sc.col) + (detailRow + 1) + ')')),
                  {
                    align: (sc.align != null) ? sc.align : Align.RIGHT, bold: (sc.bold != null) ? sc.bold : true,
                    bg: (sc.bg != null) ? sc.bg : COLORS.totalBg, format: fmt,
                    edges: edgesOf('last', 'total'),
                    color: P ? P.text : undefined, sizePt: sc.sizePt != null ? sc.sizePt : undefined,
                    border: P ? P.border : undefined
                  });
              });
            } else if (b.aggregate) {
              totalCol = b.aggregate.col;
              var fmt = headerCols && headerCols[totalCol] ? (headerCols[totalCol].format || null) : null;
              putCell(totalCol, rowCursor,
                new (J('com.fr.base.Formula'))('=SUM(' + colLetter(totalCol) + (detailRow + 1) + ')'),
                { align: Align.RIGHT, bold: true, bg: COLORS.totalBg, format: fmt, edges: edgesOf('last', 'total'), border: P ? P.border : undefined });
            }
            break;
          }
          case 'cells': // v3.4 通用格陈列块：承载 titlebar/subtotal/note 等一切非标准行（items 逐格直落）
            (b.items || []).forEach(function (it) {
              var rr = (it.r != null) ? it.r : rowCursor;
              var val;
              if (it.ds) {
                val = { __ds: it.ds };
              } else if (it.rich) {
                val = richText(it.rich);                        // v4.1 富文本
              } else if (it.formula) {
                val = new (J('com.fr.base.Formula'))(it.formula.charAt(0) === '=' ? it.formula : '=' + it.formula);
              } else {
                val = (it.text == null) ? '' : it.text; // 空占位格（官方空样式格）也是真值
              }
              var ce2;
              if (it.ds) {
                ce2 = putDSCell(it.c, rr, b.dataset || (it.ds.ds || 'ds1'), it.ds.column, it.st || {}, {
                  summary: it.ds.summary || null, result: it.ds.result || null, noExpand: !!it.ds.noExpand
                });
              } else {
                ce2 = putCell(it.c, rr, val, it.st || {}, it.span, null,
                  it.expand ? { dir: it.expand.dir, leftCol: it.expand.leftCol, leftRow: it.expand.leftRow } : null);
              }
              if (it.linkTo) cellLink(ce2, it.linkTo);
              else if (it.web) cellLink(ce2, it.web);   // v3.9 URL 链接（数据分析落地路由）
              // v4.0 单元格能力族：通用格同样支持 字典 / HTML / 条件属性
              if (it.dict) cellDict(ce2, it.dict);
              if (it.html || it.rich) cellHtml(ce2);   // 富文本必须开 HTML 显示（官方 套打.cpt：RichText + showAsHTML）
              if (it.conditions) applyConditions(ce2, it.conditions);
              if (it.presentFormula) cellFormulaPresent(ce2, it.presentFormula); // v4.1 公式显示
            });
            break;
          case 'space': // v3.3 空行（官方表与图表间的 57pt 白隔行）：只占行高不上格
            break;
          case 'chart':
            putChartCell(0, rowCursor, b, b.span);
            break;
          default:
            throw new Error('[IR] unknown block type: ' + b.type);
        }
        rowCursor++;
      });
      // v4.1 悬浮元素族：sheet 级，不占行（官方 产品明细.cpt 图片悬浮/报表块互跳）
      (sIR.floats || []).forEach(function (fl, fi) { fl._i = fi; sheet.addFloatElement(buildFloat(fl, stOf)); });
      out.sheets.push({ name: sIR.name, rows: rowCursor, detailRow: detailRow, totalRow: totalRow, totalCol: totalCol });
    });
    // 参数面板（v3.2 新能力族）：workbook 级，不占 sheet 行、不进块序
    if (IR.param) buildParamAttr(wb, IR.param);
    if (IR.watermark) applyWatermark(wb, IR.watermark);   // v4.1 水印（官方 7 张）
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
    out.styleCount = Object.keys(styled).length;
    out.totalCol = out.sheets[0].totalCol;
    return out;
  }

  // ---------- 条件属性族（v4.0，2026-11-02）----------
  // 官方 demo 240 张里 163 张使用；形态远超「单列单条件改底色」。一手 API 面
  // （probe_hl_api/2/3 反射 + 官方 利润结构分析.cpt 序列化形态）：
  //   DefaultHighlight.setName / setCondition / addHighlightAction
  //   Condition: CommonCondition(String col,int Compare,Object value) / FormulaCondition(String)
  //              ListCondition(List) / ObjectCondition(Compare)
  //   Action:    Background(Background,int scope) / Foreground(Color,int) / FRFont(FRFont,int)
  //              RowHeight(UNIT) / ColWidth(UNIT) / Page(int) / Border(CellBorderStyle)
  //              Hyperlink(NameJavaScriptGroup) / Widget(Widget)
  //   HighlightGroup 用数组构造（无 add 方法）
  // IR 形态：conditions: [{ name?, when, then, scope? }]
  //   when: { formula:'row() % 2 == 0' } | { column, op, value, valueType:'string'|'number', formulaValue }
  //         | { list:[when...] }
  //   then: { bg, color, bold, sizePt, font, rowHeight, colWidth, page }
  var OP = { '==': 0, '=': 0, '!=': 1, '>': 2, '>=': 3, '<': 4, '<=': 5, 'contains': 10 };

  function colorOf(v) {
    return awtColor(v);
  }

  function conditionOf(w) {
    if (!w) return null;
    if (w.formula != null) {
      var f = String(w.formula);
      return new (J('com.fr.data.condition.FormulaCondition'))(f.charAt(0) === '=' ? f.substring(1) : f);
    }
    if (w.column != null) {
      var op = OP[w.op == null ? '=' : w.op];
      if (op == null) throw new Error('[IR] unknown condition op: ' + w.op);
      var v;
      if (w.formulaValue) v = new (J('com.fr.base.Formula'))(w.formulaValue);
      else if (w.valueType === 'string' || typeof w.value === 'string') v = String(w.value == null ? '' : w.value);
      else v = (w.value === Math.floor(w.value)) ? J('java.lang.Integer').valueOf(w.value) : J('java.lang.Double').valueOf(w.value);
      return new (J('com.fr.data.condition.CommonCondition'))(w.column, op, v);
    }
    if (w.list && w.list.length) {
      var arrL = new (J('java.util.ArrayList'))();
      w.list.forEach(function (x) { arrL.add(conditionOf(x)); });
      return new (J('com.fr.data.condition.ListCondition'))(arrL);
    }
    return null;
  }

  function actionsOf(then, scope) {
    var acts = [];
    if (!then) return acts;
    var H = 'com.fr.report.cell.cellattr.highlight.';
    if (then.bg != null) acts.push(new (J(H + 'BackgroundHighlightAction'))(bgColor(then.bg), scope));
    if (then.color != null) acts.push(new (J(H + 'ForegroundHighlightAction'))(colorOf(then.color), scope));
    if (then.bold != null || then.sizePt != null || then.font != null) {
      acts.push(new (J(H + 'FRFontHighlightAction'))(
        font(!!then.bold, then.sizePt || FONT_SIZE_PT, then.color, then.font), scope));
    }
    if (then.rowHeight != null) acts.push(new (J(H + 'RowHeightHighlightAction'))(fuPt(then.rowHeight)));
    if (then.colWidth != null) acts.push(new (J(H + 'ColWidthHighlightAction'))(fuPt(then.colWidth)));
    if (then.page != null) acts.push(new (J(H + 'PageHighlightAction'))(then.page));
    return acts;
  }

  function buildHighlight(cd, idx) {
    var h = new (J('com.fr.report.cell.cellattr.highlight.DefaultHighlight'))();
    h.setName(cd.name || ('条件属性' + (idx + 1)));
    var cond = conditionOf(cd.when);
    if (cond) h.setCondition(cond);
    actionsOf(cd.then, cd.scope == null ? 0 : cd.scope).forEach(function (a) { h.addHighlightAction(a); });
    return h;
  }

  function applyConditions(ce, list) {
    if (!list || !list.length || !ce) return;
    var HI = cls('com.fr.report.cell.cellattr.highlight.Highlight');
    var arr = J('java.lang.reflect.Array').newInstance(HI, list.length);
    for (var i = 0; i < list.length; i++) arr[i] = buildHighlight(list[i], i);
    ce.setHighlightGroup(new (J('com.fr.report.cell.cellattr.highlight.HighlightGroup'))(arr));
  }

  // 旧 highlight 形态（v3.2）→ conditions 新形态，向后兼容一行不改
  function applyHighlight(dscCells, hl) {
    var ce = dscCells[hl.column];
    if (!ce) throw new Error('[IR] highlight.column not a detail column: ' + hl.column);
    applyConditions(ce, [{ when: { column: hl.column, op: hl.op, value: hl.value, valueType: hl.valueType }, then: { bg: hl.bg } }]);
  }

  // 数据字典（官方 39 张使用）：CustomDictionary(Object[],Object[]) → DictPresent → cell.setPresent
  function cellDict(ce, map) {
    if (!map) return;
    var keys = Object.keys(map);
    var K = J('java.lang.reflect.Array').newInstance(cls('java.lang.Object'), keys.length);
    var V = J('java.lang.reflect.Array').newInstance(cls('java.lang.Object'), keys.length);
    for (var i = 0; i < keys.length; i++) { K[i] = keys[i]; V[i] = String(map[keys[i]]); }
    ce.setPresent(new (J('com.fr.base.present.DictPresent'))(new (J('com.fr.data.impl.CustomDictionary'))(K, V)));
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
      var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(fl.imageFile));
      if (!img) throw new Error('[IR] imageFile unreadable: ' + fl.imageFile);
      val = new (J('com.fr.general.ImageWithSuffix'))(img, fl.imageFormat || 'png');
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
    verify: 'com.fr.report.web.button.write.Verify'
  };
  function applyToolbar(wb, bar) {
    var tb = new (J('com.fr.form.ui.ToolBar'))();
    (bar.buttons || []).forEach(function (b, i) {
      var key = (typeof b === 'string') ? b : b.kind;
      var cn = TOOLBAR_BUTTONS[key] || (b.className || null);
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
  function cellLink(ce, l) {
    var hl;
    if (l.web) {
      // v3.9 URL 链接族（probe_weblink.js 一手 API 面）：WebHyperlink(String) 或 new+setURL；
      // 数据分析落地路由 /webroot/decision/view/report?viewlet=<编码路径>&op=view（零参数、请求大小恒定）
      hl = new (J('com.fr.js.WebHyperlink'))();
      hl.setURL(l.web.url);
    } else {
      var rhl = new (J('com.fr.js.ReportletHyperlink'))(l.reportlet);
      if (l.byPost) rhl.setByPost(true);
      // v3.6 钻取传参（官方语料 数据钻取主报表.cpt）：Parameters 里 name + =$$$ 公式 = 把当前格值交给子报表
      if (l.params && l.params.length) rhl.setParameters(ppArray(l.params));
      if (l.extendParameters) rhl.setExtendParameters(true);
      hl = rhl;
    }
    if (l.targetFrame) hl.setTargetFrame(l.targetFrame);
    ce.setNameHyperlinkGroup(new (J('com.fr.js.NameJavaScriptGroup'))(
      new (J('com.fr.js.NameJavaScript'))(l.name || '跳转报表1', hl)));
  }
  function applyLink(dscCells, l) {
    var ce = dscCells[l.by];
    if (!ce) throw new Error('[IR] link.by not a detail column: ' + l.by);
    var rhl = new (J('com.fr.js.ReportletHyperlink'))(l.reportlet);
    var njs = new (J('com.fr.js.NameJavaScript'))(l.name || '钻取', rhl);
    ce.setNameHyperlinkGroup(new (J('com.fr.js.NameJavaScriptGroup'))(njs));
  }

  // 参数面板组装（v3.2）：ReportParameterAttr → FormParameterUI(WParameterLayout) → BoundsWidget 布布点
  // 一手 API 面（probe_param/2/3/4/5）：
  //   WorkBook.setReportParameterAttr(ReportParameterAttr)；rpa.setShowWindow/setDelayPlaying/setAlign/setWindowPosition/setParameterWindowTitle/setParameterUI
  //   FormParameterUI(WLayout) 一次性构造 + setDesignSize(Dimension)
  //   WLayout.addWidget(Widget) + WAbsoluteLayout.setBounds(Widget, Rectangle)（内部自动包 WAbsoluteLayout$BoundsWidget）
  //   Label / EditorHolder / TextEditor / FormSubmitButton 全走 AbstractDataControl.setWidgetValue(WidgetValue)（WidgetValue(Object) 即 ValueInitializer 标准实现）
  //   官方语料（GettingStarted.cpt）：EditorHolder 不包内嵌编辑器，widgetName 即参数名，widgetValue 为默认值
  function buildParamAttr(wb, p) {
    var WV = J('com.fr.form.ui.WidgetValue');
    var Rect = J('java.awt.Rectangle');
    var built = [];

    // v4.2 面板控件字典（RadioGroup/CheckBoxGroup/ComboCheckBox/TreeComboBoxEditor 共用）
    function dictOf(values) {
      var S = new (J('java.lang.String[]'))(values.length);
      for (var z = 0; z < values.length; z++) S[z] = String(values[z]);
      return new (J('com.fr.data.impl.CustomDictionary'))(S, S);
    }

    p.widgets.forEach(function (w, wi) {
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
        // v4.2 IframeEditor（5 张）：嵌页面，无 widgetValue
        ww = new (J('com.fr.form.ui.IframeEditor'))(w.url || w.text || '');
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
        lst.setAction(new (J('com.fr.js.JavaScriptImpl'))("window.location.href='" + w.url + "';"));
        ww.addListener(lst);
      } else if (w.kind === 'submit') {
        ww = new (J('com.fr.form.parameter.FormSubmitButton'))(w.text);
        ww.setText(w.text);
        ww.setWidgetName(w.name || w.text);
      } else throw new Error('[IR] unknown param widget kind: ' + w.kind);
      built.push({ ww: ww, r: w });
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
