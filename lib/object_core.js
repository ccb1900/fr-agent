// lib/object_core.js — 对象图基础件（2026-11-08 从 object.js 拆出）
//   反射入口 / 样式工厂 / 单位 / 颜色 / Agent 输入安全闸 / 条件属性族 / 共享常量。
//   依赖：只吃 JDK + FR 类；由 object.js 内部 load（裸 load 场景用 FR_AGENT_HOME 兜底）。

var ObjCore = (function () {
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

  // v4.2 VanChart 画区地板（probe_vanchart30 一手像素证据）：Van 族画格行高 < 240pt 时
  //   auto 刻度塌缩到只剩 "0"、数据压扁（A160/E160Px 双图种复现 → B240/F240 全刻度痊愈）。
  //   表格块行高一律不动（默认路径零漂移是回归门红线）；legacy bar/pie/line 无证据不碰。
  var VAN_KINDS = { vbar: 1, vline: 1, varea: 1, vscatter: 1, vbubble: 1, vpie: 1, vgauge: 1 };   // A段 P2e：补 vbubble（Van 族漏项——缺省高度下限钳制此前对气泡图不生效；与 ir.CAPABILITIES.vanChart 对齐，vmap/vheatmap 地图族有自身高度语义不在此列）

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

  return {
    Class: Class, J: J, FN: FN, vpieTemplateLabel: vpieTemplateLabel,
    Align: Align, FONT_NAME: FONT_NAME, FONT_SIZE_PT: FONT_SIZE_PT, BORDER_LINE: BORDER_LINE, COLORS: COLORS,
    checkRelUrl: checkRelUrl, checkRelReportlet: checkRelReportlet, checkTargetFrame: checkTargetFrame, checkLocalPath: checkLocalPath,
    cls: cls, of: of, statField: statField, INT_CLASS: INT_CLASS, ppArray: ppArray,
    baseStyle: baseStyle, awtColor: awtColor, font: font, bgColor: bgColor,
    applyAxisCommon: applyAxisCommon, imageBackground: imageBackground, edgesOf: edgesOf,
    buildFormat: buildFormat, style: style, fuPt: fuPt, VAN_KINDS: VAN_KINDS,
    OP: OP, colorOf: colorOf, conditionOf: conditionOf, actionsOf: actionsOf,
    buildHighlight: buildHighlight, applyConditions: applyConditions, applyHighlight: applyHighlight
  };
})();
