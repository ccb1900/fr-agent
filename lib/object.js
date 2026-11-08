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
  // 2026-11-08 vpie 序列化墙重开路线：从官方安装自带的 doc/Chart/PieChart/基础饼图.cpt 反序列化出
  //   一个字段齐全的 AttrLabel（content=AttrTooltipContent），替代 new 空对象（空对象在 vpie 分支
  //   writeXML 丢 ChartCollection）。懒加载一次，失败回退调用方的 new。
  var _vpieTplLabel = null, _vpieTplTried = false;
  function vpieTemplateLabel() {
    if (_vpieTplTried) return _vpieTplLabel;
    _vpieTplTried = true;
    try {
      var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('doc/Chart/PieChart/基础饼图.cpt');
      var sh = wb.getReport(0);
      var rows = +sh.getRowCount(), cols = +sh.getColumnCount();
      for (var r = 0; r < Math.min(rows, 40); r++) {
        for (var c = 0; c < Math.min(cols, 12); c++) {
          var ce = sh.getCellElement(c, r); if (!ce) continue;
          var v = ce.getValue(); if (!v) continue;
          if (String(v.getClass().getName()).indexOf('ChartCollection') < 0) continue;
          var plot = v.getChart(0).getPlot ? v.getChart(0).getPlot() : null;
          var cc = plot && plot.getConditionCollection ? plot.getConditionCollection() : null;
          var da = cc && cc.getDefaultAttr ? cc.getDefaultAttr() : null;
          var it = da && da.getConditionIterator ? da.getConditionIterator() : null;
          while (it && it.hasNext()) {
            var cond = it.next();
            if (String(cond.getClass().getName()).indexOf('AttrLabel') >= 0) { _vpieTplLabel = cond; return cond; }
          }
        }
      }
    } catch (eTpl) { _vpieTplLabel = null; }
    return _vpieTplLabel;
  }

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

  // ---------- Agent 输入安全边界（2026-11-04 外部审计批 B，README #48）----------
  // 输入不再默认可信（Agent 时代三端口收口）：
  //   ① nav/iframe URL 只允许相对路径（ir.js isRelUrl 同规：ir 层验形态，此处强制兜底）；
  //   ② toolbar 自定义 Java 类名逃生口移除（只认 TOOLBAR_BUTTONS 白名单键）；
  //   ③ floats.imageFile 本机路径钳制在 FR_AGENT_HOME 内（禁 .. 穿越与外部绝对路径）。
  function checkRelUrl(url, ctx) {
    var u = (url == null ? '' : String(url));
    if (!u) throw new Error('[' + ctx + '] empty url denied');
    if (u.indexOf('\\') >= 0 || u.indexOf("'") >= 0 || u.indexOf('"') >= 0 || u.indexOf(';') >= 0 || u.indexOf('`') >= 0 || /[\r\n]/.test(u))
      throw new Error('[' + ctx + '] unsafe url (quote/backslash/semicolon/newline denied): ' + u);
    if (u.indexOf('//') === 0)
      throw new Error('[' + ctx + '] protocol-relative url denied (//host escapes to cross-site): ' + u);
    if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(u))
      throw new Error('[' + ctx + '] absolute scheme url denied (relative only): ' + u);
    return u;
  }
  // I0-03（r2.md）：钻取子报表路径 = checkRelUrl 同规 + 禁 .. 穿越（reportlets 根下钳制；
  //   ir.js isRelReportlet 同规验形态，此处强制兜底——Agent 时代纵深防御，绕过 IR 层直喂也拒）。
  function checkRelReportlet(p, ctx) {
    var u = checkRelUrl(p, ctx);
    if (/(^|\/)\.\.(\/|$)/.test(u)) throw new Error('[' + ctx + '] reportlet path traversal denied: ' + u);
    return u;
  }
  // I0-03：targetFrame 白名单形态（目标策略明确化——任意串直进 setTargetFrame 属未审面；
  //   合法形态仅帧标识符：_self/_blank/自定义 [A-Za-z0-9_-]{1,32}）
  function checkTargetFrame(f, ctx) {
    if (f == null) return f;
    var s = String(f);
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(s)) throw new Error('[' + ctx + '] targetFrame outside whitelist ^[A-Za-z0-9_-]{1,32}$: ' + s);
    return s;
  }
  // 文件路径钳制：必须落在 Paths.root（FR_AGENT_HOME）之内；正斜杠归一后比对
  function checkLocalPath(p, ctx) {
    var un = String(p).replace(/\\/g, '/');
    var root = ('' + Paths.root).replace(/\\/g, '/');
    if (un.indexOf('..') >= 0) throw new Error('[' + ctx + '] path traversal denied: ' + p);
    if (!(un === root || un.indexOf(root + '/') === 0)) throw new Error('[' + ctx + '] outside FR_AGENT_HOME denied: ' + p);
    return p;
  }

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
  // 批B axis 群（README #103）：轴公共配置（标题/字/色/反转/箭头/网格/标签显隐/旋转/格式）——
  //   实例配置不构造新轴（Van 族=VanChartAxis 子类实例、legacy=CategoryAxis，plot.getxAxis()/getyAxis() 直取）
  function applyAxisCommon(ax, cfg, vanAxis) {
    if (cfg.title != null && ax.setAxisName) {
      // Van 专属（审查 P1-B 轮2 真引擎实证）：legacy ValueAxis.setTitle 不序列化；
      //   Van 才有 axisName= 属性 + setTitle(new Title) 渲染（m17 实拍 X/Y 标题双现）
      if (vanAxis) {
        ax.setAxisName(String(cfg.title));
        if (ax.setShowAxisTitle) ax.setShowAxisTitle(true);
        if (ax.setTitle) ax.setTitle(new (J('com.fr.chart.chartattr.Title'))(String(cfg.title)));
      }
      // 副作用如实记档：Van setTitle 占位后引擎自动降刻度密度——unit=50 无标题时 50 步全出，有标题时 100 步
    }
    if ((cfg.fontPt != null || cfg.color != null) && ax.setTextAttr) {
      var ta = ax.getTextAttr ? ax.getTextAttr() : null;
      if (ta && ta.setFRFont) {
        ta.setFRFont(font(false, cfg.fontPt != null ? cfg.fontPt : 12, cfg.color != null ? cfg.color : 0x000000));
        ax.setTextAttr(ta);
      }
    }
    if (cfg.reversed != null && ax.setAxisReversed) ax.setAxisReversed(!!cfg.reversed);
    if (cfg.arrow != null && ax.setArrowShow) ax.setArrowShow(!!cfg.arrow);
    if (cfg.showLabel != null && ax.setShowAxisLabel) ax.setShowAxisLabel(!!cfg.showLabel);
    if (cfg.gridColor != null && ax.setMainGridColor) ax.setMainGridColor(awtColor(cfg.gridColor));
    if (cfg.gridStyle != null && ax.setMainGridStyle) ax.setMainGridStyle(cfg.gridStyle);
    if (cfg.rotation != null && ax.setRotation) ax.setRotation(!!cfg.rotation);
    if (cfg.format && ax.setFormat) ax.setFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(cfg.format)));
  }

  // 批B后继：系列图片背景（AttrSeriesImageBackground.setSeriesBackground 通道）。路径=绝对或 FR_AGENT_HOME 相对；
  //   ImageWithSuffix.build(byte[])（probe_r4m14b 一手 CTOR ImageBackground(ImageWithSuffix[,layout])）
  //   A段 P1a（2026-11-07）：此前此路径不经 checkLocalPath——绝对路径可逃逸 FR_AGENT_HOME 读任意文件。
  //   修复=解析后钳制（float imageFile 同规：checkLocalPath 拒 .. / 根外绝对路径），ir 层 INVALID_PATH 同步。
  function imageBackground(path, layout) {
    var Paths2 = J('java.nio.file.Paths');
    var Files2 = J('java.nio.file.Files');
    var ps = String(path);
    var p = Paths2.get(ps);
    if (!p.isAbsolute()) {
      var root = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
      p = Paths2.get(root, ps);
    }
    checkLocalPath(String(p.toAbsolutePath()), 'seriesImage.image');   // 路径钳制在 FR_AGENT_HOME（与 float imageFile 同规）
    if (!Files2.exists(p)) throw new Error('[IR] seriesImage file not found: ' + ps);
    var bytes = Files2.readAllBytes(p);
    var iws = J('com.fr.general.ImageWithSuffix').build(bytes);
    return layout != null ? new (J('com.fr.base.background.ImageBackground'))(iws, layout) : new (J('com.fr.base.background.ImageBackground'))(iws);
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
  // 批D：列格式派生（kind 自动从列型来，零新词汇）——number→CoreDecimalFormat（既有）；
  //   date/datetime→FineDateFormat.getInstance（FR 内部日期格式，SimpleDateFormat 子类 drop-in，
  //   demo 5 张语料 + probe_r4m21 方法面一手；原 SimpleDateFormatThreadSafe 同语义并行类保留注记）
  function buildFormat(fmtStr, kind) {
    if (kind === 'date' || kind === 'datetime') {
      return J('com.fr.general.date.FineDateFormat').getInstance(String(fmtStr));
    }
    if (kind === 'text') return J('com.fr.base.TextFormat').getInstance();
    return new (J('com.fr.base.CoreDecimalFormat'))(String(fmtStr));
  }

  function style(st) {
    var s = baseStyle();
    if (st.align != null) s = s.deriveHorizontalAlignment(st.align);
    s = s.deriveFRFont(font(st.bold, st.sizePt, st.color, st.name));
    if (st.bg != null) s = s.deriveBackground(bgColor(st.bg));
    if (st.format) s = s.deriveFormat(buildFormat(st.format, st.formatKind));
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
  var VAN_KINDS = { vbar: 1, vline: 1, varea: 1, vscatter: 1, vbubble: 1, vpie: 1, vgauge: 1 };   // A段 P2e：补 vbubble（Van 族漏项——缺省高度下限钳制此前对气泡图不生效；与 ir.CAPABILITIES.vanChart 对齐，vmap/vheatmap 地图族有自身高度语义不在此列）
  // 图表格（v3.2 终极大件）：cell.setValue(ChartCollection)。
  // 一手 API 面（probe_chart/2/3/4/5/6/7 + 官方 WorkBook3 语料）：
  //   Chart(Plot) + setTitle(Title(Object)) + setFilterDefinition(TopDefinitionProvider)；
  //   官方绑定形态 = MoreNameCDDefinition(TableData, categoryName, ChartSummaryColumn[])（抽象祖宗 TableDataDefinition 全家实证不可 new）；
  //   ChartSummaryColumn(值列名, 自定义名, SumFunction)，官方 ChartSummaryColumn/function=SumFunction 同构
  //   ChartCollection 继承链 < Object（非 Widget），序列化形态自桩自验（wb.export 后 grep）
  // BarPlot 抽性实证（probe_chart4）：抽象基类，bar 一律用具象 Bar2DPlot；3D 变体后续用 3DPlot 家族
  var TK = { bar: 'com.fr.chart.chartattr.Bar2DPlot', pie: 'com.fr.chart.chartattr.PiePlot', line: 'com.fr.chart.chartattr.LinePlot',
    bar3d: 'com.fr.chart.chartattr.Bar3DPlot', pie3d: 'com.fr.chart.chartattr.Pie3DPlot', area3d: 'com.fr.chart.chartattr.Area3DPlot', donut: 'com.fr.chart.chartattr.Donut2DPlot', donut3d: 'com.fr.chart.chartattr.Donut3DPlot', meter: 'com.fr.chart.chartattr.MeterPlot', stock: 'com.fr.chart.chartattr.StockPlot', range: 'com.fr.chart.chartattr.RangePlot', gismap: 'com.fr.chart.chartattr.GisMapPlot' };
  // v4.2 VanChart 插件图表族（probe_vanchart/2）：VanChart < Chart 一手超类链；默认构造 = 标准形态
  //   vbar 柱形 / vline 折线 / varea 面积 / vscatter 散点 / vpie 饼图 / vgauge 仪表盘（None Pointer 默认）
  var VK = { vbar: 'com.fr.plugin.chart.column.VanChartColumnPlot', vline: 'com.fr.plugin.chart.line.VanChartLinePlot',
    varea: 'com.fr.plugin.chart.area.VanChartAreaPlot', vscatter: 'com.fr.plugin.chart.scatter.VanChartScatterPlot',
    vbubble: 'com.fr.plugin.chart.bubble.VanChartBubblePlot',
    vpie: 'com.fr.plugin.chart.PiePlot4VanChart', vgauge: 'com.fr.plugin.chart.gauge.VanChartGaugePlot',
    vmultipie: 'com.fr.plugin.chart.multilayer.VanChartMultiPiePlot',
    vwordcloud: 'com.fr.plugin.chart.wordcloud.VanChartWordCloudPlot',
    vstructure: 'com.fr.plugin.chart.structure.VanChartStructurePlot',
    vradar: 'com.fr.plugin.chart.radar.VanChartRadarPlot',
    vfunnel: 'com.fr.plugin.chart.funnel.VanChartFunnelPlot',
    vbox: 'com.fr.plugin.chart.box.VanChartBoxPlot', vtreemap: 'com.fr.plugin.chart.treemap.VanChartTreeMapPlot', vgantt: 'com.fr.plugin.chart.gantt.VanChartGanttPlot', vcombo: 'com.fr.plugin.chart.custom.VanChartCustomPlot' };
  // 2026-11-06（D1 阻塞记录，实验代码已回收）：组合图 VanChartCustomPlot 构造/序列化已打通
  //   （CustomStyle.parse + CustomPlotList 子 plot + CustomDefinition/DefinitionMap 枚举键 → 部署 cpt 结构与
  //   官方 柱形图变形.cpt 同构：CustomDefinition/DefinitionMap/OneValueCDDefinition/MoreNameCDDefinition 齐备），
  //   但渲染未达成：分类轴恒单类（4 行被画成 1 类 6 系列），缺「子图系列分配 ConditionCollection
  //   (AttrSeriesStackAndAxis) + 分类 Present 装配」；外层改 plain Chart 直接 NPE。三轮已尽，按规则暂停，
  //   证据=probes/probe_customplot{2}.js/probe_customtype.js/probe_customdef{2}.js + logs/d1_combo*.log。
  //   重开条件：先拿到可运行的 ConditionCollection 系列分配语料（官方 cpt 子图条件块）再接线。
  // D1 组合图第 4 轮（SQL+DataSheet2PlotList）结论：分类塌缩已解决（SQL 数据集），但线系列仍不渲染；
  //   官方 柱形图变形.cpt 无头渲染同样只见柱（无可见线）→ 不接线，证据在 probes/probe_combo_sql_carrier.js + logs/vcustom_sql*.log。
  // 2026-11-06（D2）：地图 vmap（官方 doc/Chart/mapfather.cpt 一手结构：
  //   Plot class=VanChartMapPlot + VanChartMapPlotAttr mapType=area geourl=assets/map/geographic/world/中国.json
  //   + ChartDefinition/VanMapDefinition/areaDefinition class=VanMapMoreNameCDDefinition(10 参)）。

  // 图表单元格总入口：按图表族分派（各族互斥、各自 putCell + 装饰入队）
  function putChartCell(api, c, r, b, spanC) {
    if (b.kind === 'vdrillmap') { putDrillMapCell(api, c, r, b, spanC); return; }
    if (b.kind === 'vmap' || b.kind === 'vheatmap') { putMapChartCell(api, c, r, b, spanC); return; }
    if (VK[b.kind]) { putVanChartCell(api, c, r, b, spanC); return; }
    putLegacyChartCell(api, c, r, b, spanC);
  }

  // 钻取地图：逐层 layerMapType/layerLevel + DrillMapDefinition
  function putDrillMapCell(api, c, r, b, spanC) {
    var dplot = new (J('com.fr.plugin.chart.drillmap.VanChartDrillMapPlot'))();
    // 官方：layerMapType = AREA 逐层；layerLevel = 0..3 or AUTO
    var MTs = new (J('java.util.ArrayList'))();
    var ZLs = new (J('java.util.ArrayList'))();
    var MT=J('com.fr.plugin.chart.type.MapType'), ZL=J('com.fr.plugin.chart.type.ZoomLevel');
    var nLayer = 1 + (b.layerDefs ? b.layerDefs.length : 0);
    for (var dl=0; dl < nLayer; dl++) { MTs.add(MT.AREA); }
    var zl0 = ZL.ZEROPOINTFIVE, zl1 = ZL.TWO, zl2 = ZL.FOUR, zl3 = ZL.SIX;
    if (nLayer > 0) ZLs.add(zl0); if (nLayer > 1) ZLs.add(zl1); if (nLayer > 2) ZLs.add(zl2); if (nLayer > 3) ZLs.add(zl3);
    dplot.setLayerMapTypeList(MTs);
    dplot.setLayerLevelList(ZLs);
    var vchart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(dplot);
    vchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
    var dl = new (J('com.fr.plugin.chart.drillmap.data.DrillMapDefinition'))();
    var cols = (b.bottomValues && b.bottomValues.length) ? b.bottomValues : [];
    var bArrItems = [];
    for (var bi = 0; bi < cols.length; bi++) bArrItems.push(new (J('com.fr.chart.chartdata.ChartSummaryColumn'))(cols[bi], cols[bi], new (J('com.fr.data.util.function.NoneFunction'))()));
    var bArr = J('java.lang.reflect.Array').newInstance(cls('com.fr.chart.chartdata.ChartSummaryColumn'), bArrItems.length);
    for (var bj = 0; bj < bArrItems.length; bj++) bArr[bj] = bArrItems[bj];
    var bDef = new (J('com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))(b.dataset), b.bottomArea, bArr, true, '', '', '', '', '', null);
    dl.setFromBottomData(false); dl.setBottomDataDefinition(bDef);
    var lyrList = new (J('java.util.ArrayList'))();
    (b.layerDefs || []).forEach(function (ld) {
      var lv = (ld.values && ld.values.length) ? ld.values : [];
      var arr2 = [];
      for (var lj = 0; lj < lv.length; lj++) arr2.push(new (J('com.fr.chart.chartdata.ChartSummaryColumn'))(lv[lj], lv[lj], new (J('com.fr.data.util.function.NoneFunction'))()));
      var lArr = J('java.lang.reflect.Array').newInstance(cls('com.fr.chart.chartdata.ChartSummaryColumn'), arr2.length);
      for (var lk = 0; lk < arr2.length; lk++) lArr[lk] = arr2[lk];
      var lDef = new (J('com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition'))(new (J('com.fr.data.impl.NameTableData'))(ld.dataset || b.dataset), ld.area, lArr, true, '', '', '', '', '', null);
      lyrList.add(lDef);
    });
    dl.setEachLayerDataDefinitionList(lyrList);
    vchart.setFilterDefinition(dl);
    dplot.setGeoUrl(b.geoUrl || 'assets/map/geographic/world/中国.json');
    try { dplot.setZoomLevel(J('com.fr.plugin.chart.type.ZoomLevel').ZERO); } catch (eDZ) { }
    var _rce = api.putCell(c, r, (function(){var x=new (J('com.fr.chart.chartattr.ChartCollection'))();x.addChart(vchart);return x;})(), { align:null,bold:false,bg:null,format:null,edges: b.noBorder?null:edgesOf(null)}, spanC);
    api.chartDecoJobs.push({ce:_rce, b:b, van:true});
    return;
  }

  // 地图 / 热力图：mapType + geoUrl + ViewCenter + VanMapDefinition
  function putMapChartCell(api, c, r, b, spanC) {
    // 2026-11-07（D2 热力图）：VanChartHeatMapPlot extends VanChartMapPlot（javap 一手）——heat 四参直接在 plot 上
    //   （setRadius/setBlur/setMinOpacity/setMaxOpacity(double)；官方 XML VanChartHeatMapPlotAttr 是序列化别名）。
    //   官方 doc/Chart/HeatMap/网页热力图.cpt：mapType=point + geourl=image/heatmap.json + heat 35/45/0/70；
    //   热力地图.cpt：point + 中国.json。definition 与 vmap point 完全同构（VanMapDefinition/pointDefinition）。
    var mp = (b.kind === 'vheatmap') ? new (J('com.fr.plugin.chart.heatmap.VanChartHeatMapPlot'))() : new (J('com.fr.plugin.chart.map.VanChartMapPlot'))();
    if (b.kind === 'vheatmap') {
      mp.setRadius(b.heat && b.heat.radius != null ? b.heat.radius : 35);
      mp.setBlur(b.heat && b.heat.blur != null ? b.heat.blur : 45);
      mp.setMinOpacity(b.heat && b.heat.minOpacity != null ? b.heat.minOpacity : 0);
      mp.setMaxOpacity(b.heat && b.heat.maxOpacity != null ? b.heat.maxOpacity : 70);
    }
    var MT = J('com.fr.plugin.chart.type.MapType');
    var mtype = String(b.mapType != null ? b.mapType : (b.kind === 'vheatmap' ? 'point' : 'area')).toLowerCase();
    if (mtype !== 'area' && mtype !== 'point') throw new Error('[IR] vmap/vheatmap mapType 只支持 area|point: ' + b.mapType);
    mp.setMapType(mtype === 'point' ? MT.POINT : MT.AREA);
    if (mtype === 'point' && b.kind !== 'vheatmap') {
      // 官方 doc/Chart/Map/散点地图.cpt：mapType=point + mapmarkertype=1(COMMON，无 SCATTER 常量) + pointDefinition。
      //   热力图不设 marker（官方 网页热力图.cpt mapmarkertype=0=引擎默认）
      try { mp.setMapMarkerType(J('com.fr.plugin.chart.type.MapMarkerType').COMMON); } catch (eMK) { }
    }
    mp.setGeoUrl(b.geoUrl != null ? b.geoUrl : 'assets/map/geographic/world/中国.json');
    try { mp.setZoomLevel(J('com.fr.plugin.chart.type.ZoomLevel').parseInt(b.zoom != null ? b.zoom : (mtype === 'point' ? 0 : 4))); } catch (eZ) { }
    try {
      var vc = new (J('com.fr.plugin.chart.base.ViewCenter'))();
      // 显式经纬度才锁中心；未给则 auto=true 让引擎按地图自适配（任意 geoUrl 不至于跑到视野外）
      if (b.longitude != null || b.latitude != null) {
        vc.setAuto(false);
        vc.setLongitude(b.longitude != null ? b.longitude : 106.258754);
        vc.setLatitude(b.latitude != null ? b.latitude : 38.471318);
      } else vc.setAuto(true);
      mp.setViewCenter(vc);
    } catch (eVC) { }
    var mchart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(mp);
    mchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
    var mapVals = (b.values && b.values.length) ? b.values : [b.value];
    var MCS = cls('com.fr.chart.chartdata.ChartSummaryColumn');
    var MCSC = J('com.fr.chart.chartdata.ChartSummaryColumn');
    var mfn = new (J('com.fr.data.util.function.NoneFunction'))();
    var mcols = J('java.lang.reflect.Array').newInstance(MCS, mapVals.length);
    for (var mvi = 0; mvi < mapVals.length; mvi++) mcols[mvi] = new (MCSC)(mapVals[mvi], mapVals[mvi], mfn);
    var mapDef = new (J('com.fr.plugin.chart.map.data.VanMapDefinition'))();
    // 10 参：TableData, categoryName, columns, useAreaName(boolean), longitude, latitude, endLongitude, endLatitude, endAreaName, matchResult
    var mapAreaDef = new (J('com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition'))(
      new (J('com.fr.data.impl.NameTableData'))(b.dataset), b.category, mcols, true, '', '', '', '', '', null);
    if (mtype === 'point') mapDef.setPointDefinition(mapAreaDef); else mapDef.setAreaDefinition(mapAreaDef);
    mchart.setFilterDefinition(mapDef);
    var _mcc = new (J('com.fr.chart.chartattr.ChartCollection'))();
    _mcc.addChart(mchart);
    var _mce = api.putCell(c, r, _mcc, { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
    api.chartDecoJobs.push({ ce: _mce, b: b, van: true });
    return;
  }

  // VanChart 插件族：plot 无轴/矩形/地图各派 + 各族 FilterDefinition（vpie 走 OneValue）
  // VanChart 绑定定义各族：vbox/vcombo/vtreemap/vgantt/vstructure/vwordcloud/vmultipie/
  //   vpie·vgauge·vfunnel（OneValue）/ vscatter·vbubble（Bubble）/ 其余矩形派（MoreName）
  // 甘特绑定：VanGanttDefinition(VanGanttTableDefinition + 可选 linkDefinition)
  //   linkDefinition 必须非 null（GanttChartDataDefinition.execute 无条件执行）——无数据时注册 0 行命名表
  function applyGanttDefinition(api, vchart, b) {
    var gdef = new (J('com.fr.plugin.chart.gantt.data.VanGanttDefinition'))();
    var gtab = new (J('com.fr.plugin.chart.gantt.data.VanGanttTableDefinition'))();
    gtab.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
    // firstProcess = actual process VALUE from the data (not column name)
    gtab.setFirstProcess(b.firstProcess || b.processname || '');
    gtab.setSeriesName(b.seriesname || '');
    gtab.setStartTime(b.starttime || '');
    gtab.setEndTime(b.endtime || '');
    gtab.setMarkTime(b.marktime || '');
    gtab.setProgress(b.progress || '');
    gtab.setLinkID(b.taskid || '');
    var plist = new (J('java.util.ArrayList'))();
    // 官方 关联线甘特图.cpt 一手：processList 可为空，引擎按数据结构自动推断流程分组；
    //   不得用列名（processname）冒充流程值——会把同一列名重复画成多行（2026-11-08 PNG 实证）。
    if (b.processes) { b.processes.forEach(function(x){ plist.add(x); }); }
    gtab.setProcessList(plist);
    gdef.setDataDefinition(gtab);
    // 审查 F2 修复：GanttChartDataDefinition.execute 无条件执行 linkDefinition（NPE 根因=null）。
    //   无关联线数据时给一个 0 行 EmbeddedTableData 的链接定义（列名占位、attr 指向同名列）；
    //   有 b.link{dataset,start,end,type} 时用真实数据集。
    var linkTd, lStart = 'fromtaskid', lEnd = 'totaskid', lType = 'type';
    if (b.link && b.link.dataset) {
      linkTd = new (J('com.fr.data.impl.NameTableData'))(b.link.dataset);
      if (b.link.start) lStart = b.link.start;
      if (b.link.end) lEnd = b.link.end;
      if (b.link.type) lType = b.link.type;
    } else {
      // VanGanttLinkTableDefinition 执行期强转 NameTableData → 0 行表也必须注册为命名表
      var lname = b.dataset + '__gantt_links';
      var letd = new (J('com.fr.data.impl.EmbeddedTableData'))();
      letd.addColumn(lStart, cls('java.lang.String'));
      letd.addColumn(lEnd, cls('java.lang.String'));
      letd.addColumn(lType, cls('java.lang.String'));
      api.wb.putTableData(lname, letd);
      linkTd = new (J('com.fr.data.impl.NameTableData'))(lname);
    }
    gdef.setLinkDefinition(new (J('com.fr.plugin.chart.gantt.data.VanGanttLinkTableDefinition'))(linkTd, lStart, lEnd, lType));
    try { vplot.setTimeAxis(new (J('com.fr.plugin.chart.gantt.attr.GanttTimeAxis'))());
          vplot.setProcessAxis(new (J('com.fr.plugin.chart.gantt.attr.GanttProcessAxis'))()); } catch (eG) {}
    vchart.setFilterDefinition(gdef);
  }

  function applyVanChartDefinition(api, vchart, vplot, b) {
    if (b.kind === 'vbox') {
      // 2026-11-08 箱线图：官方 doc/Chart/BoxPlot/分组箱型图.cpt 一手
      //   VanBoxTableDefinition(detailed=true) + detailedDefinition=VanBoxMoreNameCDDefinition(category, columns)
      //   + resultDefinition=VanBoxTableResultDefinition（detailed 模式只需占位，统计量由 detailed 数据算）。
      var bvals = (b.values && b.values.length) ? b.values : [b.value];
      var BCSC = J('com.fr.chart.chartdata.ChartSummaryColumn');
      var bcols = J('java.lang.reflect.Array').newInstance(cls('com.fr.chart.chartdata.ChartSummaryColumn'), bvals.length);
      for (var bvi = 0; bvi < bvals.length; bvi++) bcols[bvi] = new (BCSC)(bvals[bvi], bvals[bvi], new (J('com.fr.data.util.function.NoneFunction'))());
      var boxDef = new (J('com.fr.plugin.chart.box.data.VanBoxTableDefinition'))();
      boxDef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      boxDef.setDetailed(true);
      boxDef.setDetailedDefinition(new (J('com.fr.plugin.chart.box.data.VanBoxMoreNameCDDefinition'))(null, b.category, bcols));
      var boxResult = new (J('com.fr.plugin.chart.box.data.VanBoxTableResultDefinition'))();
      // 官方 分组箱型图.cpt 一手：detailed 模式 resultDefinition 仍是占位（categoryName/seriesName/median="无"+五个标签），
      //   空对象会让引擎按默认 0..50 画须（A/C 下须掉到 0）。
      boxResult.setCategoryName('无');
      boxResult.setSeriesName('无');
      boxResult.setMinLabel('最小值');
      boxResult.setQ1Label('下四分位数');
      boxResult.setMedianLabel('中位数');
      boxResult.setQ3Label('上四分位数');
      boxResult.setMaxLabel('最大值');
      boxResult.setMedian('无');
      boxDef.setResultDefinition(boxResult);
      vplot.setDetailed(true);   // plot 与 definition 双开关：只设 definition 时引擎按 resultDefinition 空统计画 0..50 异常须
      vchart.setFilterDefinition(boxDef);
    } else if (b.kind === 'vcombo') {
      // 2026-11-08 组合图（官方 doc/Chart/Combination/ 10 份语料一手）：
      //   plot=VanChartCustomPlot(CustomStyle) + CustomPlotList[column/line/area/bubble/pie 子 plot]
      //   def=CustomDefinition.setDefinitionProviderMap（键=CustomPlotType enum；值按 plot 族：
      //     column/line/area → VanChartMoreNameCDDefinition；pie → VanChartOneValueCDDefinition；
      //     bubble → BubbleTableDefinition(bubbleX/Y/Size)）。
      //   样式按子图集合推导：column+line→COMMON_COLUMN_LINE（b.stack→STACK_COLUMN_LINE）、column+area→COMMON_COLUMN_AREA、
      //   其余组合→CUSTOM（官方 柱形-饼/柱形-气泡/折线-气泡 customStyle="custom"）。
      var CSty = J('com.fr.plugin.chart.custom.type.CustomStyle');
      var CTy = J('com.fr.plugin.chart.custom.type.CustomPlotType');   // 键类型一手：String 键 cpt 导出期 ClassCastException（必须 enum）
      var gs = b.groups || [];
      var pset = {}; gs.forEach(function (g) { pset[g.plot] = 1; });
      var cstyle = b.stacked && pset.column && pset.line ? 'stack_column_line'
        : (pset.column && pset.line && !pset.area && !pset.bubble && !pset.pie ? 'column_line'
        : (pset.column && pset.area && !pset.line && !pset.bubble && !pset.pie ? 'column_area' : 'custom'));
      var CSMAP = { column_line: CSty.COMMON_COLUMN_LINE, column_area: CSty.COMMON_COLUMN_AREA, stack_column_line: CSty.STACK_COLUMN_LINE, custom: CSty.CUSTOM };
      vplot.setCustomStyle(CSMAP[cstyle]);
      var CPK = new (J('java.util.LinkedHashMap'))();
      var cplist = new (J('java.util.ArrayList'))();
      var CRC = J('com.fr.chart.chartdata.ChartSummaryColumn');
      var GPLOT = { column: 'com.fr.plugin.chart.column.VanChartColumnPlot', line: 'com.fr.plugin.chart.line.VanChartLinePlot',
        area: 'com.fr.plugin.chart.area.VanChartAreaPlot', bubble: 'com.fr.plugin.chart.bubble.VanChartBubblePlot',
        pie: 'com.fr.plugin.chart.PiePlot4VanChart' };
      gs.forEach(function (g) {
        var sp = new (J(GPLOT[g.plot]))();
        cplist.add(sp);
        // 堆积柱+线（官方 堆积柱形-折线组合图.cpt 一手）：stack 条件挂 column 子 plot
        //   （命名 ConditionAttr + 空 ListCondition + AttrSeriesStackAndAxis(stacked=true,stackID)），
        //   并把子 plot 的 vanChartPlotType 置 STACK（isStackChart 只认该枚举，README #72 根因）。
        if (b.stacked && g.plot === 'column' && sp.setStackAndAxisCondition) {
          var scc = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
          var sd = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
          var sid = String(b.stackId || '堆积和坐标轴1');
          sd.setName(sid);
          sd.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
          var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
          sa.setStacked(true); sa.setPercentStacked(false); sa.setStackID(sid);
          sd.addDataSeriesCondition(sa);
          scc.addConditionAttr(sd);
          sp.setStackAndAxisCondition(scc);
          try { sp.setVanChartPlotType(J('com.fr.plugin.chart.type.VanChartPlotType').STACK); } catch (eST) { }
        }
        var td = new (J('com.fr.data.impl.NameTableData'))(g.dataset);
        if (g.plot === 'pie') {
          CPK.put(CTy.PIE, new (J('com.fr.plugin.chart.data.VanChartOneValueCDDefinition'))(
            td, '', g.category, g.value, new (J('com.fr.data.util.function.SumFunction'))()));
        } else if (g.plot === 'bubble') {
          var bd = new (J('com.fr.chart.chartdata.BubbleTableDefinition'))();
          bd.setTableData(td);
          bd.setSeriesName('');
          bd.setBubbleX(g.x); bd.setBubbleY(g.y);
          if (g.bubbleSize) bd.setBubbleSize(g.bubbleSize);
          CPK.put(CTy.BUBBLE, bd);
        } else {
          var gvals = (g.values && g.values.length) ? g.values : [g.value];
          var gcols = J('java.lang.reflect.Array').newInstance(cls('com.fr.chart.chartdata.ChartSummaryColumn'), gvals.length);
          for (var gi = 0; gi < gvals.length; gi++) gcols[gi] = new (CRC)(gvals[gi], gvals[gi], new (J('com.fr.data.util.function.NoneFunction'))());
          CPK.put(CTy[String(g.plot).toUpperCase()], new (J('com.fr.plugin.chart.data.VanChartMoreNameCDDefinition'))(td, g.category, gcols));
        }
      });
      vplot.setCustomPlotList(cplist);
      var cdef = new (J('com.fr.plugin.chart.custom.CustomDefinition'))();
      cdef.setDefinitionProviderMap(CPK);
      try { vplot.setAllPlotInCustom(); } catch (eAll) { }
      vchart.setFilterDefinition(cdef);
    } else if (b.kind === 'vtreemap') {
      // 2026-11-08 审查修复（F1-F3）：历史提交把 gantt/structure 代码一并塞进本分支，last-write 覆盖了 treemap 定义。
      //   三分支现各自独立，禁止再合并写。
      var tmdef = new (J('com.fr.plugin.chart.multilayer.data.MultiPieValueDefinition'))();
      tmdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      tmdef.setSeriesName(b.seriesName || '');
      tmdef.setValueColumnName(b.value || (b.values && b.values[0]));
      tmdef.setDataFunction(new (J('com.fr.data.util.function.NoneFunction'))());
      tmdef.setLevelCount(b.levels.length);
      b.levels.forEach(function (lv) { tmdef.addLevelName(lv); });
      vchart.setFilterDefinition(tmdef);
    } else if (b.kind === 'vgantt') {
      applyGanttDefinition(api, vchart, b);
    } else if (b.kind === 'vstructure') {
      var stdef = new (J('com.fr.plugin.chart.structure.data.StructureTableDefinition'))();
      stdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      stdef.setSeriesName(b.seriesName || '');
      stdef.setNodeID(b.nodeId); stdef.setParentID(b.parentId); stdef.setNodeName(b.nodeName); stdef.setNodeValue(b.nodeValue);
      stdef.setDataFunction(new (J('com.fr.data.util.function.NoneFunction'))());
      vchart.setFilterDefinition(stdef);
    } else if (b.kind === 'vwordcloud') {
      var wcdef = new (J('com.fr.plugin.chart.wordcloud.data.WordCloudTableDefinition'))();
      wcdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      wcdef.setWordName(b.wordName); wcdef.setWordValue(b.wordValue);
      wcdef.setDataFunction(new (J('com.fr.data.util.function.NoneFunction'))());
      vchart.setFilterDefinition(wcdef);
    } else if (b.kind === 'vmultipie') {
      var mpdef = new (J('com.fr.plugin.chart.multilayer.data.MultiPieValueDefinition'))();
      mpdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      mpdef.setSeriesName(b.seriesName || '');
      mpdef.setValueColumnName(b.value || (b.values && b.values[0]));
      mpdef.setDataFunction(new (J('com.fr.data.util.function.NoneFunction'))());
      mpdef.setLevelCount(b.levels.length);
      b.levels.forEach(function (lv) { mpdef.addLevelName(lv); });
      vchart.setFilterDefinition(mpdef);
    } else if (b.kind === 'vpie' || b.kind === 'vgauge' || b.kind === 'vfunnel') {
      vchart.setFilterDefinition(new (J('com.fr.plugin.chart.data.VanChartOneValueCDDefinition'))(
        new (J('com.fr.data.impl.NameTableData'))(b.dataset), '',
        b.category, b.value || (b.values && b.values[0]),
        new (J('com.fr.data.util.function.SumFunction'))()));
    } else if (b.kind === 'vscatter' || b.kind === 'vbubble') {
      var btd = new (J('com.fr.chart.chartdata.BubbleTableDefinition'))();
      btd.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      btd.setSeriesName(b.seriesName || 'series');
      btd.setBubbleX(b.x || (b.values && b.values[0]));
      btd.setBubbleY(b.y || (b.values && b.values[1]));
      // #46 遗留（右下大蓝点）定案：官方 气泡图 bubbleSize="库存订购量差" 属性同位——未设 → 引擎默认按自动定位画出异常巨点。显式传入即修
      if (b.bubbleSize) btd.setBubbleSize(b.bubbleSize);
      vchart.setFilterDefinition(btd);
    } else {
      applyChartAttrs(vchart, vplot, b, true, true);
    }
  }

  function putVanChartCell(api, c, r, b, spanC) {
    var vplot = new (J(VK[b.kind]))(); // 无轴派（pie/gauge）getyAxis=null，轴参数自动跳过
    var vchart = new (J('com.fr.plugin.chart.vanchart.VanChart'))(vplot);
    // Van 图占位标题（Fine-Engine_Chart_Title_New_Title）默认绘出且吃掉全部绘图区：空串显式压制（二分实证唯一有效项）。
    // 2026-11-08 缺陷修复（bubbleAttr 专项暴露 vbar/vbubble + title 整图空白）：非空标题必须用 VanChartTitle
    //   并给布局（官方 demo 柱形图变形.cpt 一手：TitleVisible=true position=0 maxHeight=15，Attr4VanChart
    //   floating=false limitSize=false），plain Title(text) 无这些字段会把绘图区吃成 0。
    var _vt = b.title == null ? '' : String(b.title);
    if (_vt === '') {
      vchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(''));
    } else {
      var vtitle = new (J('com.fr.plugin.chart.attr.VanChartTitle'))(_vt);
      vtitle.setTitleVisible(true);
      vtitle.setPosition(0);
      vtitle.setMaxHeight(15.0);
      vtitle.setUseHtml(false);
      vtitle.setFloating(false);
      vtitle.setLimitSize(false);
      vchart.setTitle(vtitle);
    }
    // v4.2 绑定分歧（probe_vanchart6/7 一手实证）：
    //   矩形派（bar/line/area/scatter 外）MoreNameCDDefinition 实测可用（分组柱/双系列图例正确）；
    //   vpie/vgauge 官方形态 = VanChartOneValueCDDefinition(TableData, 系列名, 分类名, 值列名, DataFunction)，More 会把分类读成系列（4 全圆事故）
    //   vscatter 官方形态 = BubbleTableDefinition(TableData, seriesName, bubbleX, bubbleY, bubbleSize)（doc/Chart/Scatter/常规散点图.cpt）
    applyVanChartDefinition(api, vchart, vplot, b);
    // 批B：装饰后挂 + 挂「cell 里那个 chart/plot 实例」（浅拷贝语义：legend/axis 引用共享而
    //   conditionCollection 是引用替换，必须挂到序列化走的实例上——bisect5 一手实证）
    var _vcc = new (J('com.fr.chart.chartattr.ChartCollection'))();
    _vcc.addChart(vchart);
    var _vce = api.putCell(c, r, _vcc, { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
    api.chartDecoJobs.push({ ce: _vce, b: b, van: true });
    return;
  }

  // legacy 图表族：stock/range/meter/donut/gismap + MoreNameCDDefinition 通用绑定
  function putLegacyChartCell(api, c, r, b, spanC) {
    if (b.kind === 'stock') {
        var stD = new (J('com.fr.chart.chartdata.StockTableDefinition'))();
        var stLb = new (J('com.fr.chart.chartdata.StockLabel'))();
        stD.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
        if (b.cateTime) stD.setCateTime(b.cateTime);
        if (b.openString) stD.setOpenString(b.openString);
        if (b.highString) stD.setHighString(b.highString);
        if (b.lowString) stD.setLowString(b.lowString);
        if (b.closeString) stD.setCloseString(b.closeString);
        if (b.volumnString) stD.setVolumnString(b.volumnString);
        if (b.stockLabels) { stLb.setOpenLabel(b.stockLabels.open||''); stLb.setHighLabel(b.stockLabels.high||''); stLb.setLowLabel(b.stockLabels.low||''); stLb.setCloseLabel(b.stockLabels.close||''); stLb.setVolumeLabel(b.stockLabels.volume||''); stD.setStockLabels(stLb); } else { stD.setStockLabels(stLb); }
      } else if (b.kind === 'range') {
        var rdef = new (J('com.fr.chart.chartdata.ScatterTableDefinition'))();
        rdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
        rdef.setSeriesName(b.seriesName || 'range');
        rdef.setScatterX(b.category); rdef.setScatterY(b.value || (b.values && b.values[0]));
      } else if (b.kind === 'meter') {
        var mtdef = new (J('com.fr.chart.chartdata.MeterTableDefinition'))();
        mtdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
        mtdef.setName(b.seriesName || '值');
        mtdef.setValue(b.category || b.value || (b.values && b.values[0]));
        mtdef.setMeterType(0);
        mtdef.setCustom(false);
      } else if (b.kind === 'donut' || b.kind === 'donut3d') {
      // 2026-11-08 经典分段环形尝试：MoreName 会把每个分类画成一环（同心环）；改用 OneValueCDDefinition
      //   让分类成为扇区（同 legacy pie 的语义），值列=value/values[0]。
      var dplot = new (J(TK[b.kind]))();
      var dchart = new (J('com.fr.chart.chartattr.Chart'))(dplot);
      var dvals = (b.values && b.values.length) ? b.values : [b.value];
      dchart.setFilterDefinition(new (J('com.fr.chart.chartdata.OneValueCDDefinition'))(
        new (J('com.fr.data.impl.NameTableData'))(b.dataset), b.category, b.category, dvals[0],
        new (J('com.fr.data.util.function.SumFunction'))()));
      dchart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
      var _dce = api.putCell(c, r, (function () { var x = new (J('com.fr.chart.chartattr.ChartCollection'))(); x.addChart(dchart); return x; })(), { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
      api.chartDecoJobs.push({ ce: _dce, b: b, van: false });
      return;
    }
    // legacy 图 plot 类：meter 主题变体（MeterBluePlot/SimpleMeterPlot 均 extends MeterPlot、零新增 API）走 theme 键
    var _plotCls = TK[b.kind];
    if (b.kind === 'meter' && b.theme === 'blue') _plotCls = 'com.fr.chart.chartattr.MeterBluePlot';
    else if (b.kind === 'meter' && b.theme === 'simple') _plotCls = 'com.fr.chart.chartattr.SimpleMeterPlot';
    var chart = new (J('com.fr.chart.chartattr.Chart'))(new (J(_plotCls))());
    if (b.kind === 'stock') {
        var stD = new (J('com.fr.chart.chartdata.StockTableDefinition'))();
        var stLb = new (J('com.fr.chart.chartdata.StockLabel'))();
        stD.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
        if (b.cateTime) stD.setCateTime(b.cateTime);
        if (b.openString) stD.setOpenString(b.openString);
        if (b.highString) stD.setHighString(b.highString);
        if (b.lowString) stD.setLowString(b.lowString);
        if (b.closeString) stD.setCloseString(b.closeString);
        if (b.volumnString) stD.setVolumnString(b.volumnString);
        if (b.stockLabels) { stLb.setOpenLabel(b.stockLabels.open||''); stLb.setHighLabel(b.stockLabels.high||''); stLb.setLowLabel(b.stockLabels.low||''); stLb.setCloseLabel(b.stockLabels.close||''); stLb.setVolumeLabel(b.stockLabels.volume||''); stD.setStockLabels(stLb); } else { stD.setStockLabels(stLb); }
      } else if (b.kind === 'meter') {
      chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
      chart.setFilterDefinition(mtdef);
    } else if (b.kind === 'gismap') {
      // 2026-11-08 probe_gismap 一手：GisMapPlot extends Plot，setGisType/setAddressType/setBaiduKey/setGoogleKey；
      //   数据=GisMapTableDefinition(setAddress/setAddressName/setAddressType/setLnglatOrder+addTittleValue(SeriesDefinition))
      var gplot = chart.getPlot();
      try { gplot.setGisType(b.gisType !== false); gplot.setAddressType(!!b.addressType); } catch (eGp) {}
      var gdef = new (J('com.fr.chart.chartdata.GisMapTableDefinition'))();
      gdef.setTableData(new (J('com.fr.data.impl.NameTableData'))(b.dataset));
      gdef.setAddress(b.address);
      if (b.addressName) gdef.setAddressName(b.addressName);
      gdef.setAddressType(!!b.addressType);
      gdef.setLnglatOrder(b.lnglatOrder !== false);
      var gvals = (b.values && b.values.length) ? b.values : [b.value];
      for (var gvi = 0; gvi < gvals.length; gvi++) {
        gdef.addTittleValue(new (J('com.fr.chart.chartdata.SeriesDefinition'))(gvals[gvi], gvals[gvi]));
      }
      chart.setTitle(new (J('com.fr.chart.chartattr.Title'))(b.title == null ? '' : b.title));
      chart.setFilterDefinition(gdef);
    } else {
      applyChartAttrs(chart, chart.getPlot(), b);
    }
    var _cce = api.putCell(c, r, (function () { var x = new (J('com.fr.chart.chartattr.ChartCollection'))(); x.addChart(chart); return x; })(), { align: null, bold: false, bg: null, format: null, edges: b.noBorder ? null : edgesOf(null) }, spanC);
    api.chartDecoJobs.push({ ce: _cce, b: b, van: false }); // legacy 装饰同路后挂
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
    // 批B：装饰改为 build 尾后挂（chartDecoJobs），此处只做绑定
  }

  // 批B（2026-11-04）图表装饰单源（由 applyChartAttrs 尾段上提 + 扩容）：legend/axisY(含 unit 主刻度)/barInterval
  //   + tooltip/label/marker/line/trend/条件系列 格式。挂接=Plot.setConditionCollection(ConditionCollection)，
  //     装饰件入 DefaultAttr(ConditionAttr).addDataSeriesCondition(...)（官方 DataVisualization.cpt 条件集形态同构）；
  //     tooltip 内容一手=getContent() 活引用（AttrTooltip 无 setContent setter，官方 initAttrTooltipContent 同理回填）；
  //     plot 级 alpha/bg/border 走 GeneralInfo setters；堆叠轴走 VanChartRectanglePlot.setStackAndAxisCondition（仅 vbar/varea）。
  // 批I 地图族共用件（2026-11-07）：AttrLabel/AttrTooltip 装配子函数——b.label/b.tooltip 主路不动的
  //   前提下，mapLabel/mapTooltip 的 payload 走同一装配面（与主路同类构造，不另造词表）。
  function buildMapLabelDetail(ls) {
    var lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
    if (ls.enable != null) lab.setEnable(!!ls.enable);
    var ld = lab.getAttrLabelDetail ? lab.getAttrLabelDetail() : null;
    if (ld) {
      if (ls.position != null && ld.setPosition) ld.setPosition(ls.position);
      if ((ls.fontPt != null || ls.color != null || ls.bold) && ld.setTextAttr) {
        var ta = ld.getTextAttr ? ld.getTextAttr() : null;
        if (!ta || !ta.setFRFont) ta = new (J('com.fr.chart.base.TextAttr'))();
        ta.setFRFont(font(!!ls.bold, ls.fontPt != null ? ls.fontPt : 12, ls.color != null ? ls.color : 0x000000));
        ld.setTextAttr(ta);
      }
      if (ls.backgroundColor != null && ld.setBackgroundColor) ld.setBackgroundColor(awtColor(ls.backgroundColor));
      if (ls.align != null && ld.setAlign) ld.setAlign(ls.align);
      if (ls.autoAdjust != null && ld.setAutoAdjust) ld.setAutoAdjust(!!ls.autoAdjust);
    }
    return lab;
  }
  function buildMapTooltipDetail(ts) {
    var tip = new (J('com.fr.plugin.chart.base.AttrTooltip'))();
    tip.setEnable(true);
    if (ts.muti != null) tip.setShowMutiSeries(!!ts.muti);
    var ctt = tip.getContent();
    if (ctt) {
      if (ts.format && ctt.setValueFormat) {
        var vf = new (J('com.fr.plugin.chart.base.format.AttrTooltipValueFormat'))();
        vf.setEnable(true);
        vf.setFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(ts.format)));
        ctt.setValueFormat(vf);
      }
      if (ts.richText && ctt.setRichTextAttr) {
        var rtc = String(ts.richText.content || '');
        var rt = new (J('com.fr.plugin.chart.base.AttrTooltipRichText'))();
        rt.setContent(rtc);
        rt.setAuto(!!ts.richText.auto);
        rt.setInitParamsContent(rtc);
        ctt.setRichText(true);
        ctt.setRichTextAttr(rt);
      }
    }
    return tip;
  }
  // 系列提示：AttrTooltip（散点/气泡走 Scatter 子类）+ 格式槽/富文本
  function addChartTooltip(dTag, b) {
    // 散点/气泡官方类=ScatterAttrTooltip（content 真类=ScatterAttrTooltipContent 才有 x/y/size 三槽，
    //   官方 doc/Chart/Scatter/常规散点图.cpt 一手；probe_r4m14c 实证）
    var isScatter = (b.kind === 'vscatter' || b.kind === 'vbubble');
    var tip = isScatter ? new (J('com.fr.plugin.chart.scatter.attr.ScatterAttrTooltip'))() : new (J('com.fr.plugin.chart.base.AttrTooltip'))();
    tip.setEnable(true);
    if (b.tooltip.muti != null) tip.setShowMutiSeries(!!b.tooltip.muti);
    var ctt = tip.getContent();
    if (ctt) {
      var TF = { series: 'setSeriesFormat', value: 'setValueFormat', percent: 'setPercentFormat', changedValue: 'setChangedValueFormat', changedPercent: 'setChangedPercentFormat', category: 'setCategoryFormat' };
      var FC = { series: 'AttrTooltipSeriesFormat', value: 'AttrTooltipValueFormat', percent: 'AttrTooltipPercentFormat', changedValue: 'AttrTooltipChangedValueFormat', changedPercent: 'AttrTooltipChangedPercentFormat', category: 'AttrTooltipCategoryFormat' };
      // 批I 地图族（2026-11-07 阶段4 首靶）：地图种 tooltip 格式槽=地图专用子类——官方 按钮式图表切换.cpt/mapfather
      //   一手 <category class="...AttrTooltipAreaNameFormat"> 与 <richTextValue class="...AttrTooltipMapValueFormat">；
      //   基类槽位在 vmap/vheatmap 上与官方语料类名偏差，按 kind 选子类对齐（API 面=probes/_probe_template.js 实测）。
      if (b.kind === 'vmap' || b.kind === 'vheatmap') { FC.category = 'AttrTooltipAreaNameFormat'; FC.value = 'AttrTooltipMapValueFormat'; }
      if (isScatter) { TF.x = 'setXFormat'; TF.y = 'setYFormat'; TF.size = 'setSizeFormat'; FC.x = 'AttrTooltipXFormat'; FC.y = 'AttrTooltipYFormat'; FC.size = 'AttrTooltipSizeFormat'; }
      Object.keys(TF).forEach(function (fk) {
        var fv = b.tooltip.formats ? b.tooltip.formats[fk] : undefined;
        if (fv === undefined) return;
        var fo = new (J('com.fr.plugin.chart.base.format.' + FC[fk]))();
        fo.setEnable(true);
        if (typeof fv === 'string') fo.setFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(fv)));  // 格式串=直塞 CoreDecimalFormat
        ctt[TF[fk]](fo);
      });
      // 富文本 tooltip（probe_r4m14b 一手：setRichTextAttr+setRichText(true)；官方 各部门反馈情况 richText 节点同构）
      if (b.tooltip.richText && ctt.setRichTextAttr) {
        var rtc = String(b.tooltip.richText.content || '');
        var rt = new (J('com.fr.plugin.chart.base.AttrTooltipRichText'))();
        rt.setContent(rtc);
        rt.setAuto(!!b.tooltip.richText.auto);
        rt.setInitParamsContent(rtc);
        ctt.setRichText(true);
        ctt.setRichTextAttr(rt);
      }
    }
    dTag.addDataSeriesCondition(tip);
  }

  // 数值标签：AttrLabel(+Detail) 位置/字体/边框/富文本；vpie 用官方模板 + DefaultAttr 挂法
  function addChartLabel(cc, dTag, b) {
    // 2026-11-08 vpie 序列化墙实验：饼图 label 用官方 cpt 反序列化得到的 AttrLabel（字段齐全），
    //   而不是 new 空对象（空对象在 vpie 分支 writeXML 会丢 ChartCollection，CHART SERIALIZED 实锤）。
    //   模板=doc/Chart/PieChart/基础饼图.cpt（官方安装自带）；缺失时回退 new。
    var lab = null;
    var labFromTpl = false;
    if (b.kind === 'vpie' && b.label.richText) {
      try { lab = vpieTemplateLabel(); } catch (eTpl) { lab = null; }
      if (!lab) throw new Error('[IR] vpie label.richText 需要官方模板 doc/Chart/PieChart/基础饼图.cpt（字段齐全的 AttrLabel）；模板缺失时拒绝构建，不静默丢标签');
      labFromTpl = true;
    }
    if (!lab) lab = new (J('com.fr.plugin.chart.base.AttrLabel'))();
    if (b.label.enable != null) lab.setEnable(!!b.label.enable);
    // 位置/字/底/对齐在 AttrLabelDetail 上（AttrLabel 无 setPosition 一手探针实证）；主 detail=getAttrLabelDetail() 活引用回填
    //   批B axis 群扩（README #103，probe_r4m16 方法面）：fontPt/color/bold/backgroundColor/align/autoAdjust/showGuidLine
    var ld = lab.getAttrLabelDetail ? lab.getAttrLabelDetail() : null;
    if (ld) {
      if (b.label.position != null && ld.setPosition) ld.setPosition(b.label.position);
      if ((b.label.fontPt != null || b.label.color != null || b.label.bold) && ld.setTextAttr) {
        var lta = ld.getTextAttr ? ld.getTextAttr() : null;
        if (!lta || !lta.setFRFont) lta = new (J('com.fr.chart.base.TextAttr'))();
        lta.setFRFont(font(!!b.label.bold, b.label.fontPt != null ? b.label.fontPt : 12, b.label.color != null ? b.label.color : 0x000000));
        ld.setTextAttr(lta);
      }
      if (b.label.backgroundColor != null && ld.setBackgroundColor) ld.setBackgroundColor(awtColor(b.label.backgroundColor));
      if (b.label.align != null && ld.setAlign) ld.setAlign(b.label.align);
      if (b.label.autoAdjust != null && ld.setAutoAdjust) ld.setAutoAdjust(!!b.label.autoAdjust);
      if (b.label.showGuidLine != null && ld.setShowGuidLine) ld.setShowGuidLine(!!b.label.showGuidLine);
      // 2026-11-08 新能力：标签边框——官方 268/268 一手（labelDetail > AttrBorderWithShape，
      //   lineStyle=0、shapeType=RectangularMarker）；活对象 API=setBorderColor/setBorderStyle/setShape(MarkerType)。
      if (b.label.border && ld.setBorder) {
        var lbd = new (J('com.fr.plugin.chart.base.AttrBorderWithShape'))();
        // 官方 XML isAutoColor="true" 会让引擎忽略自定义色（首跑实测：边框画了但呈白/灰）；
        //   要自定义颜色必须 setAutoColor(false) + setBorderColor。
        if (lbd.setAutoColor) lbd.setAutoColor(false);
        lbd.setBorderColor(awtColor(b.label.border.color != null ? b.label.border.color : 0x000000));
        lbd.setBorderStyle(b.label.border.style != null ? b.label.border.style : 0);
        try { lbd.setShape(J('com.fr.plugin.chart.marker.type.MarkerType').valueOf('MARKER_RECTANGULAR')); } catch (eLBS) { }
        ld.setBorder(lbd);
      }
    }
    // 批B 头部（2026-11-06, README #104）：旧 summary 路已废（IR 现明确拒 label.summary：
    //   PieCategoryLabelContent 不渲染）。vpie 标签内容=richText，label 对象取自官方 cpt 模板，
    //   保留其自带 content（AttrTooltipContent）并覆盖 richText 文本。
    var lct = null;
    if (ld.getContent) lct = ld.getContent();
    if (b.label.richText && lct && lct.setRichTextAttr) {
      var lrtc = String(b.label.richText.content || '');
      var lrt = new (J('com.fr.plugin.chart.base.AttrTooltipRichText'))();
      lrt.setContent(lrtc);
      lrt.setAuto(!!b.label.richText.auto);
      lrt.setInitParamsContent(lrtc);
      lct.setRichText(true);
      lct.setRichTextAttr(lrt);
    }
    // 渲染定案（probe_r4m9）：label 必须挂命名 ConditionAttr(恒真 ListCondition) 才渲染（官方条件属性4 同构）
    //   2026-11-08 模板实验：vpie 的 label 挂 DefaultAttr（官方 基础饼图.cpt 的挂法），其余走命名条件。
    if (b.kind === 'vpie') {
      dTag.addDataSeriesCondition(lab);
    } else {
      var lTag = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
      lTag.setName('数值标签');
      lTag.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
      lTag.addDataSeriesCondition(lab);
      cc.addConditionAttr(lTag);
    }
  }

  // 标记点：VanChartAttrMarker + 透明度 AttrMarkerAlpha
  function addChartMarker(dTag, b) {
    var mk = new (J('com.fr.plugin.chart.base.VanChartAttrMarker'))();
    var MT = J('com.fr.plugin.chart.marker.type.MarkerType');
    var MMAP = { none: 'MARKER_NULL', circle: 'MARKER_CIRCLE', square: 'MARKER_SQUARE', diamond: 'MARKER_DIAMOND', triangle: 'MARKER_TRIANGLE', circleHollow: 'MARKER_CIRCLE_HOLLOW', squareHollow: 'MARKER_SQUARE_HOLLOW', diamondHollow: 'MARKER_DIAMOND_HOLLOW', triangleHollow: 'MARKER_TRIANGLE_HOLLOW', star: 'MARKER_STAR', rect: 'MARKER_RECTANGULAR', dialog: 'MARKER_DIALOG', parallelogram: 'MARKER_PARALLELOGRAM', ellipse: 'MARKER_ELLIPSE', lineTriangle: 'MARKER_LINE_TRIANGLE' };
    mk.setMarkerType(MT.valueOf(MMAP[b.marker.type] || 'MARKER_AUTO'));
    if (b.marker.radius != null) mk.setRadius(b.marker.radius);
    if (b.marker.common != null) mk.setCommon(!!b.marker.common);
    dTag.addDataSeriesCondition(mk);
    if (b.marker.alpha != null) {  // 批B后继：标记透明度=AttrMarkerAlpha（AttrAlpha 子类，probe_r4m14 一手）
      var mkA = new (J('com.fr.plugin.chart.base.AttrMarkerAlpha'))();
      mkA.setAlpha(b.marker.alpha);
      dTag.addDataSeriesCondition(mkA);
    }
  }

  // 线型/线式：VanChartAttrLine（LineType × LineStyle）
  function addChartLineStyle(dTag, b) {
    var ln = new (J('com.fr.plugin.chart.base.VanChartAttrLine'))();
    var LT = J('com.fr.plugin.chart.type.LineType');  // LINE=NONE|SOLID|DASHED（probe 一手枚举）
    var LMAP = { solid: 'SOLID', dashed: 'DASHED', none: 'NONE' };
    if (b.lineStyle.type) ln.setLineType(LT.valueOf(LMAP[b.lineStyle.type] || 'SOLID'));
    var LS = J('com.fr.plugin.chart.type.LineStyle'); // LINE=NORMAL|STEP|CURVE
    var LSMAP = { normal: 'NORMAL', step: 'STEP', curve: 'CURVE' };
    if (b.lineStyle.style) ln.setLineStyle(LS.valueOf(LSMAP[b.lineStyle.style] || 'NORMAL'));
    if (b.lineStyle.width != null) ln.setLineWidth(b.lineStyle.width);
    dTag.addDataSeriesCondition(ln);
  }

  // 趋势线：VanChartAttrTrendLine + LineStyleInfo（缺线型/线色即不序列化）
  function addChartTrend(dTag, b) {
    var tl = new (J('com.fr.plugin.chart.base.VanChartAttrTrendLine'))();
    var KW = { linear: 'Linear', exp: 'Exponent', log: 'Log', poly: 'Polynomial' };
    // 枚举常量经 Class.forName 取（StaticClass 不透 getEnumConstants）；匹配 toString 后常量对象直传
    var TCS = java.lang.Class.forName('com.fr.plugin.chart.base.TrendLineType').getEnumConstants();
    var hit = null;
    for (var ti = 0; ti < TCS.length; ti++) if (String(TCS[ti]).indexOf(KW[b.trend.type]) >= 0) hit = TCS[ti];
    if (!hit) throw new Error('[IR] unknown trend type: ' + b.trend.type);
    tl.setTrendLineType(hit);
    tl.setTrendLineName(String(b.trend.name || '趋势线'));
    // isValidTrendLine 门槛：需 LineStyleInfo（线型+线色），缺省=无效不序列化（probe 一手：裸 type/name → TrendLine 节点 0）
    var lsi = new (J('com.fr.chart.base.LineStyleInfo'))();
    lsi.setAttrLineColor(new (J('com.fr.chart.base.AttrColor'))(awtColor(b.trend.color != null ? b.trend.color : 0xD0392E)));
    var als = new (J('com.fr.chart.base.AttrLineStyle'))();
    try { als.setLineStyle(2); } catch (eALS) { }   // 线型枚举 int（默认实线可渲染即达标）
    lsi.setAttrLineStyle(als);
    tl.setLineStyleInfo(lsi);
    if (b.trend.pre != null) tl.setPrePeriod(b.trend.pre);
    if (b.trend.after != null) tl.setAfterPeriod(b.trend.after);
    dTag.addDataSeriesCondition(tl);
  }

  // 系列条件染色：命名 ConditionAttr + AttrBackground/AttrAlpha
  function addChartSeriesConditions(dTag, b) {
    var th = cd && cd.then;
    if (!th || (th.seriesColor == null && th.alpha == null)) return;  // 坏 then 已由 ir 层结构化拒，这里双键空即无装饰
    var ca = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
    ca.setName(cd.name || ('图表条件' + (cdi + 1)));
    ca.setCondition(conditionOf(cd.when));
    // 渲染定案（probe_r4m7 D_a 实拍全染）：系列条件染色正类=AttrBackground+ColorBackground；
    //   AttrColor 挂上引擎不染（批B 挂账根因，manifest conditionalSeries same）
    if (th.seriesColor != null) ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrBackground'))(bgColor(th.seriesColor)));
    if (th.alpha != null) ca.addDataSeriesCondition(new (J('com.fr.chart.base.AttrAlpha'))(th.alpha));
    cc.addConditionAttr(ca);
  }

  // 柱缘：AttrBorder（AttrBorderWithAlpha 通道引擎不画，IR 已移除）
  function addChartSeriesBorder(dTag, b) {
    var sbc = awtColor(b.seriesBorder.color != null ? b.seriesBorder.color : 0x000000);
    var sbs = b.seriesBorder.style != null ? b.seriesBorder.style : 1;
    dTag.addDataSeriesCondition(new (J('com.fr.chart.base.AttrBorder'))(sbc, sbs));
  }

  // 动画：AttrEffect
  function addChartEffect(dTag, b) {
    var ef = new (J('com.fr.plugin.chart.base.AttrEffect'))();
    ef.setEnabled(b.effect.enabled == null ? true : !!b.effect.enabled);
    if (b.effect.period != null) ef.setPeriod(b.effect.period);
    dTag.addDataSeriesCondition(ef);
  }

  // 面积填充：AttrAreaSeriesFillColorBackground
  function addChartAreaFill(dTag, b) {
    var af = new (J('com.fr.plugin.chart.base.AttrAreaSeriesFillColorBackground'))();
    af.setColorBackground(bgColor(b.areaFill.color != null ? b.areaFill.color : 0x99BBFF));
    if (b.areaFill.alpha != null) af.setAlpha(b.areaFill.alpha);
    dTag.addDataSeriesCondition(af);
  }

  // 系列贴图：命名 ConditionAttr(CATEGORY_INDEX) + AttrSeriesImageBackground
  function addChartSeriesImage(cc, b) {
    // 2026-11-07 渲染修复（官方 国旗柱形图.cpt 一手）：AttrSeriesImageBackground 必须挂在
    //   ConditionAttrList 的命名 ConditionAttr 上（配 ChartCommonCondition CATEGORY_INDEX），
    //   DefaultAttr 通道引擎不画（此前 PNG 柱纯色 = 挂错槽，非引擎墙）。
    var sib = new (J('com.fr.plugin.chart.base.AttrSeriesImageBackground'))();
    sib.setSeriesBackground(imageBackground(b.seriesImage.image, b.seriesImage.layout));
    var imgTag = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
    imgTag.setName('seriesImage');
    try { imgTag.setCondition(conditionOf({ column: 'CATEGORY_INDEX', op: '>=', value: 0 })); } catch (eImg) { }
    imgTag.addDataSeriesCondition(sib);
    cc.addConditionAttr(imgTag);
  }

  // 地图标签：AttrMapLabel(area/point) 复用 buildMapLabelDetail
  function addChartMapLabel(dTag, b) {
    if (b.kind !== 'vmap' && b.kind !== 'vheatmap') throw new Error('[IR] mapLabel 仅 vmap/vheatmap（AttrMapLabel 物理宿主=地图 plot 条件集合）');
    var aml = new (J('com.fr.plugin.chart.map.attr.AttrMapLabel'))();
    if (b.mapLabel.areaLabel) aml.setAreaLabel(buildMapLabelDetail(b.mapLabel.areaLabel));
    if (b.mapLabel.pointLabel) aml.setPointLabel(buildMapLabelDetail(b.mapLabel.pointLabel));
    dTag.addDataSeriesCondition(aml);
  }

  // 地图提示：AttrMapTooltip(area/point/line) 复用 buildMapTooltipDetail
  function addChartMapTooltip(dTag, b) {
    if (b.kind !== 'vmap' && b.kind !== 'vheatmap') throw new Error('[IR] mapTooltip 仅 vmap/vheatmap（AttrMapTooltip 物理宿主=地图 plot 条件集合）');
    var amt = new (J('com.fr.plugin.chart.map.attr.AttrMapTooltip'))();
    if (b.mapTooltip.areaTooltip) amt.setAreaTooltip(buildMapTooltipDetail(b.mapTooltip.areaTooltip));
    if (b.mapTooltip.pointTooltip) amt.setPointTooltip(buildMapTooltipDetail(b.mapTooltip.pointTooltip));
    if (b.mapTooltip.lineTooltip) amt.setLineTooltip(buildMapTooltipDetail(b.mapTooltip.lineTooltip));
    dTag.addDataSeriesCondition(amt);
  }

  // 气泡：VanChartAttrBubble（直径/阴影/负值）
  function addChartBubble(dTag, b) {
    if (b.kind !== 'vbubble') throw new Error('[IR] bubble 仅 vbubble（VanChartAttrBubble 物理宿主=气泡 plot 条件集合）');
    var bab = new (J('com.fr.plugin.chart.bubble.attr.VanChartAttrBubble'))();
    if (b.bubble.minDiameter != null) bab.setMinDiameter(b.bubble.minDiameter);
    if (b.bubble.maxDiameter != null) bab.setMaxDiameter(b.bubble.maxDiameter);
    if (b.bubble.shadow != null) bab.setShadow(!!b.bubble.shadow);
    if (b.bubble.displayNegative != null) bab.setDisplayNegative(!!b.bubble.displayNegative);
    dTag.addDataSeriesCondition(bab);
  }

  // 图表热链：ChartHyperRelateCellLink 挂 plot/area/point/line
  function addChartHotHyperLink(plot, b) {
    var hhl = b.hotHyperLink;
    var hgrp = new (J('com.fr.js.NameJavaScriptGroup'))();
    (Array.isArray(hhl.items) ? hhl.items : []).forEach(function (hit) {
      var lnk = new (J('com.fr.chart.web.ChartHyperRelateCellLink'))();
      if (hit.relateCCName != null) lnk.setRelateCCName(String(hit.relateCCName));
      if (hit.itemName != null) lnk.setItemName(String(hit.itemName));
      if (hit.title != null) lnk.setLinkTitle(String(hit.title));
      if (hit.width != null) lnk.setWidth(hit.width);
      if (hit.height != null) lnk.setHeight(hit.height);
      hgrp.addNameHyperlink(new (J('com.fr.js.NameJavaScript'))(String(hit.name || 'chart link'), lnk));
    });
    var hTgt = String(hhl.target || 'plot');
    if (hTgt === 'area' && plot.setAreaHotHyperLink) plot.setAreaHotHyperLink(hgrp);
    else if (hTgt === 'point' && plot.setPointHotHyperLink) plot.setPointHotHyperLink(hgrp);
    else if (hTgt === 'line' && plot.setLineHotHyperLink) plot.setLineHotHyperLink(hgrp);
    else if (plot.setHotHyperLink) plot.setHotHyperLink(hgrp);
    else throw new Error('[IR] hotHyperLink: plot has no HotHyperLink setter');
  }

  function applyChartDeco(chart, plot, b, van) {
    // v3.3 图例：legend 住在 Plot 上（Chart.getLegend 不存在一手实证，getPlot().getLegend 才对）；legend 类名=com.fr.chart.chartattr.Legend（probe _leg 定名）
    if (b.legend && plot) {
      var lg = plot.getLegend();
      if (lg) {
        if (b.legend.fontPt != null || b.legend.color != null) lg.setFRFont(font(b.legend.bold || false, b.legend.fontPt || 12, b.legend.color));
        if (b.legend.position != null) lg.setPosition(b.legend.position);
        if (b.legend.visible != null) lg.setLegendVisible(b.legend.visible);
      }
    }
    // v3.3 轴口径（Formula 包装 BaseFormula；Van 必须 setCustomMaxValue/MinValue(true)，否则 Y 轴按默认 "=0" 走）
    // 审查 P1-B 轮2：公共轴配置无条件应用（probe_legacy_axis 实证 legacy Bar2D/LinePlot.getyAxis()=ValueAxis，
    //   setTextAttr/setTitle/setFormat/setAxisColor/setShowAxisLabel 等公共 setter 全在；PiePlot 无 yAxis 自动跳过）。
    //   去掉 (van || b.legend) 继承闸——与 axisX 同口径；Van 专属 max|min|unit|alerts 留在 van 门槛内（ir 同步拒 legacy 用这些键）。
    if (b.axisY && plot && plot.getyAxis) {
      var yA = plot.getyAxis();
      if (yA) {
        applyAxisCommon(yA, b.axisY, van);   // 公共键：legacy/Van 同适用；title 仅 Van
        // max|min 归公共：legacy ValueAxis 也有 setMaxValue/setMinValue（rebuild_first.js #46 既有用法）；
        //   custom 开关只在 Van 路径验证（legacy 不调，语义保守）
        if (b.axisY.max != null) {
          yA.setMaxValue(new (J('com.fr.base.Formula'))('=' + b.axisY.max));
          if (van && yA.setCustomMaxValue) yA.setCustomMaxValue(true);
        }
        if (b.axisY.min != null) {
          yA.setMinValue(new (J('com.fr.base.Formula'))('=' + b.axisY.min));
          if (van && yA.setCustomMinValue) yA.setCustomMinValue(true);
        }
        if (van) {
          // 批B axis 群（README #103）：预警值=VanChartAlertValue 列表（LineColor/LineStyle 双件门槛同 trend，probe_r4m16b 一手）
          if (b.axisY.alerts && b.axisY.alerts.length && yA.setAlertValues) {
            var AV = J('com.fr.plugin.chart.attr.axis.VanChartAlertValue');
            var alist = new (J('java.util.ArrayList'))();
            b.axisY.alerts.forEach(function (al) {
              if (!al || al.value == null) return;
              var av = new AV();
              av.setAlertValueFormula(new (J('com.fr.base.Formula'))('=' + al.value));
              if (al.content != null) av.setAlertContent(String(al.content));
              if (al.color != null) {
                av.setLineColor(new (J('com.fr.chart.base.AttrColor'))(awtColor(al.color)));
                try { var _als = new (J('com.fr.chart.base.AttrLineStyle'))(); _als.setLineStyle(2); av.setLineStyle(_als); } catch (eAL) { }
              }
              if (al.alpha != null) av.setAlertLineAlpha(al.alpha);
              alist.add(av);
            });
            yA.setAlertValues(alist);
          }
          // #46 遗留（240pt auto 刻度只 0/150 两级）：显式主刻度步长=Axis.setMainUnit(Formula)+setCustomMainUnit(true)
          if (b.axisY.unit != null) {
            yA.setMainUnit(new (J('com.fr.base.Formula'))('=' + b.axisY.unit));
            yA.setCustomMainUnit(true);
          }
        }
      }
    }
    // 批B axis 群（2026-11-06, README #103）：X 轴=VanChartAxis 实例配置（Van 族）/ CategoryAxis（legacy），
    //   不构造新轴；axisX 全键 legacy 同适用（审查 P2-6:去掉 (van||b.legend) 继承闸——公共 setter 非公式包装）
    if (b.axisX && plot && plot.getxAxis) {
      var xA = plot.getxAxis();
      if (xA) applyAxisCommon(xA, b.axisX, van);
    }
    // 2026-11-06（P3 精确化）：barInterval 仅 vbar 落 XML（legacy Bar2DPlot 有 setter 但 writer 不序列化，
    //   部署 cpt 零命中一手）；调用点保留 setter 存在性守卫，IR 已把非 vbar 结构化拒。
    if (b.barInterval != null && plot && plot.setCategoryIntervalPercent) plot.setCategoryIntervalPercent(b.barInterval);
    // 批B 装饰族（ConditionCollection 通道；ir.js 已限 Van kind + 形态白名单）
    var hasDeco = b.tooltip || b.label || b.marker || b.lineStyle || b.trend || (b.conditions && b.conditions.length)
      || b.seriesBorder || b.effect || b.areaFill || b.seriesImage || b.mapLabel || b.mapTooltip || b.hotHyperLink || b.bubble;
    if (hasDeco && plot.setConditionCollection) {
      var cc = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
      var dTag = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
      dTag.setName('');
      addChartTooltip(dTag, b);
      addChartLabel(cc, dTag, b);
      addChartMarker(dTag, b);
      addChartLineStyle(dTag, b);
      addChartTrend(dTag, b);
      addChartSeriesConditions(dTag, b);
      // 批B后继（2026-11-06, README #102）扩容词汇——方法面 probe_r4m14/b 一手；DefaultAttr 系列条件通道
      //   2026-11-08 渲染实证（官方 551 处 ConditionAttr AttrBorder 一手 + 载体 PNG red=596）：
      //   纯 AttrBorder 通道真的画柱缘；AttrBorderWithAlpha 通道引擎不画（alpha=1 仍零像素）→
      //   IR 侧已移除 alpha 键，这里只用 AttrBorder。
      addChartSeriesBorder(dTag, b);
      addChartEffect(dTag, b);
      addChartAreaFill(dTag, b);
      addChartSeriesImage(cc, b);
      // 批I 地图族（2026-11-07 阶段4）：地图专属标签/提示条件（AttrMapLabel/AttrMapTooltip extends
      //   DataSeriesCondition，物理宿主=地图 plot 条件集合；官方 按钮式图表切换.cpt <Attr class="...AttrMapLabel">
      //   条件集合同构；API 面=probes/_probe_template.js 一手 setAreaLabel/setPointLabel(AttrLabel)、
      //   setAreaTooltip/setPointTooltip/setLineTooltip(AttrTooltip)）——payload 复用 buildMapLabelDetail/buildMapTooltipDetail
      addChartMapLabel(dTag, b);
      addChartMapTooltip(dTag, b);
      addChartBubble(dTag, b);
      // 批I 图表热链（ChartHyperRelateCellLink；官方 资产负债联动图表.cpt 一手：<NameJavaScriptGroup><NameJavaScript
      //   name="..."><JavaScript class="com.fr.chart.web.ChartHyperRelateCellLink">）。挂点=plot.setHotHyperLink
      //   （通用）/setAreaHotHyperLink|setPointHotHyperLink|setLineHotHyperLink（地图；probe 一手方法面）。
      //   parameters 槽（官方 <Parameters> Formula 传参）本批不接——IR 层结构化拒，不静默丢。
      addChartHotHyperLink(plot, b);
      cc.setDefaultAttr(dTag);   // ★ 批B 定案补（根因）：装饰件全在 dTag 上，缺这行=从未挂进 ConditionCollection（bisect5/6 对拍揪出）
      plot.setConditionCollection(cc);
    }
    if (b.stack && plot.setStackAndAxisCondition) {
      // 官方形（demo/analytics/Demo.cpt 一手）：ConditionAttrList 里的命名 ConditionAttr + 空 ListCondition(恒真) + stackID=attr 名
      var scc = new (J('com.fr.chart.chartglyph.ConditionCollection'))();
      var sd = new (J('com.fr.chart.chartglyph.ConditionAttr'))();
      var sid = String(b.stack.stackId || 'stack1');
      sd.setName(sid);
      sd.setCondition(new (J('com.fr.data.condition.ListCondition'))(new (J('java.util.ArrayList'))()));
      var sa = new (J('com.fr.plugin.chart.base.AttrSeriesStackAndAxis'))();
      if (b.stack.stacked) sa.setStacked(true);
      if (b.stack.percent) sa.setPercentStacked(true);
      sa.setStackID(sid);
      sd.addDataSeriesCondition(sa);
      scc.addConditionAttr(sd);
      plot.setStackAndAxisCondition(scc);
      // m3 结案：isStackChart() 只认 plot.vanChartPlotType==STACK/STACK_BY_PERCENT——只有
      //   setStackAndAxisCondition 时序列化在、渲染仍分组（README #72 挂账根因）
      if (plot.setVanChartPlotType) {
        var PT = J('com.fr.plugin.chart.type.VanChartPlotType');
        plot.setVanChartPlotType(b.stack.percent ? PT.STACK_BY_PERCENT : PT.STACK);
      }
    }
    // 批B后继：plot 级热提示样式（legacy+Van 同路，官方 XML newHotTooltipStyle=AttrContents 一手；
    //   probe_r4m14b：Plot.setHotTooltipStyle(AttrContents)）
    if (b.hotTooltip && plot.setHotTooltipStyle) {
      var hc = new (J('com.fr.chart.base.AttrContents'))();
      if (b.hotTooltip.position != null) hc.setPosition(b.hotTooltip.position);
      if (b.hotTooltip.showMutiSeries != null) hc.setShowMutiSeries(!!b.hotTooltip.showMutiSeries);
      if (b.hotTooltip.whiteBackground != null) hc.setWhiteBackground(!!b.hotTooltip.whiteBackground);
      if (b.hotTooltip.seriesLabel != null) hc.setSeriesLabel(String(b.hotTooltip.seriesLabel));
      if (b.hotTooltip.format) hc.setFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(b.hotTooltip.format)));
      if (b.hotTooltip.percentFormat) hc.setPercentFormat(new (J('com.fr.base.CoreDecimalFormat'))(String(b.hotTooltip.percentFormat)));
      plot.setHotTooltipStyle(hc);
    }
    // plot 级外观（GeneralInfo setters 直通）
    if (b.alpha != null && plot.setAlpha) plot.setAlpha(b.alpha);
    if (b.bg != null && plot.setBackground) plot.setBackground(bgColor(b.bg));
    if (b.border != null) {
      if (b.border.color != null && plot.setBorderColor) plot.setBorderColor(awtColor(b.border.color));
      if (b.border.style != null && plot.setBorderStyle) plot.setBorderStyle(b.border.style);
    }
  }


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
  function buildCellsBlock(ctx, st, b, sheet) {
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
          cursorAdvance = buildCellsBlock(ctx, st, b, sheet);
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
    var CellC = cls('com.fr.report.cell.DefaultTemplateCellElement');
    var CellT = J('com.fr.report.cell.DefaultTemplateCellElement'); // 直接 new 用（B 通路）
    var cellCtor = CellC.getConstructor(INT_CLASS, INT_CLASS, cls('java.lang.Object'));  // 保留：类型依据
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
  //   then: { bg, color, bold, sizePt, font, rowHeight, colWidth, page }（v4.0 官方 163/240 基本款）
  //        + { value 串|{formula}, border {top/bottom/left/right:{line,color}}, link, widget }（批A 满血，官方 717/19/7/1）
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
    // 批A（2026-11-04）四动作满血：换值/粗细边框/动态超链/内嵌输入控件（官方 717/19/7/1）
    //   探针依据：probe_hla2（构造器一手）+ probe_hla2b（CellBorderStyle setTopStyle/Color）+ 官方 XML 四样本
    if (then.value != null) acts.push(new (J(H + 'ValueHighlightAction'))(
      (typeof then.value === 'object' && then.value.formula != null)
        ? new (J('com.fr.base.Formula'))(then.value.formula)      // 官方 公司评级.cpt：=IF(F6>0..., "A","B","C")
        : String(then.value)));
    if (then.border) {
      var cb = new (J('com.fr.base.CellBorderStyle'))();
      (['top', 'bottom', 'left', 'right']).forEach(function (sk) {
        var sd = then.border[sk];
        if (!sd) return;
        var C = sk.charAt(0).toUpperCase() + sk.substring(1);
        cb['set' + C + 'Style'](sd.line);                        // 官方 签约情况分析.cpt：line 0=断开 / 2=粗
        if (sd.color != null) cb['set' + C + 'Color'](awtColor(sd.color));
      });
      acts.push(new (J(H + 'BorderHighlightAction'))(cb));
    }
    if (then.link) acts.push(new (J(H + 'HyperlinkHighlightAction'))(buildLinkGroup(then.link)));
    if (then.widget) acts.push(new (J(H + 'WidgetHighlightAction'))(buildWidget(then.widget)));  // 官方 产品月销量情况录入表：内嵌 TextEditor 子树
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



