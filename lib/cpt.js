// lib/cpt.js — 声明式 cpt 构建库（纯字符串组装，不依赖 FR 引擎）
//
// 确定性三原则：
//   1) 枚举常量封死：业务代码只能引用 Cpt.Align.LEFT 等，写不出 "3" 这种臆造值
//   2) XML 写法是代码不是手工：子元素顺序、括号闭合由生成器负责（顺序即规范，
//      例如 Format 必须在 FRFont 之前、Formula 用 <Attributes> 带 = 前缀）
//   3) 双重校验：落盘前 javax XML 解析 + 不变量断言；引擎读回后再断言一次
//      （防"style 被默认化/公式丢失"这类静默陷阱）
//
// 一手验证记录（不要改，除非重新验证）：
//   Align: CENTER=0 / LEFT=2 / RIGHT=4 / DISTRIBUTED=6 / DEFAULT=-1
//   来源 com.fr.nx.cell.attr.style.type.HorizontalAlignType.getAlignType()，渲染三变体证实
//   字号 size = pt × 4；行高列宽 EMU = pt × 12700
//   样式必须无名索引式（style_name/full 写法读取时会被默认化）

var Cpt = (function () {
  // ---------- 常量（封死） ----------
  var Align = { CENTER: 0, LEFT: 2, RIGHT: 4, DEFAULT: -1 };
  var FONT = 'SimHei';               // 黑体
  var SIZE_BODY = 21;                // 10.5pt × 2（2026-10-27 font_ruler 标尺：attr 单位=pt×2，旧 42 实为 21pt）
  var COLORS = { headerBg: -2497805, totalBg: -855310, lightLine: -3417120 };
  var ROUNDING_HALF_UP = 4;          // CoreDecimalFormat roundingMode

  function emu(pt) { return Math.round(pt * 12700); }
  function colLetter(i) { return String.fromCharCode(65 + i); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- XML 片段生成器 ----------
  function fontXml(bold) {
    return '<FRFont name="' + FONT + '" style="' + (bold ? 1 : 0) + '" size="' + SIZE_BODY + '"/>';
  }
  function bgXml(color) {
    return color == null
      ? '<Background name="NullBackground"/>'
      : '<Background name="ColorBackground">\n<color>\n<FineColor color="' + color + '" hor="-1" ver="-1"/>\n</color>\n</Background>';
  }
  function edgeXml(tag, color) { // color==null → 深色(默认黑)
    return color == null
      ? '<' + tag + ' style="1"/>'
      : '<' + tag + ' style="1"><color><FineColor color="' + color + '" hor="-1" ver="-1"/></color></' + tag + '>';
  }
  function borderXml(e) { // e: {top,bottom,left,right} 色值（null=深色边）
    return '<Border>\n' + edgeXml('Top', e.top) + '\n' + edgeXml('Bottom', e.bottom) + '\n'
      + edgeXml('Left', e.left) + '\n' + edgeXml('Right', e.right) + '\n</Border>';
  }
  function fmtXml(f) {
    return '<Format class="com.fr.base.CoreDecimalFormat" roundingMode="' + ROUNDING_HALF_UP + '">\n<![CDATA[' + f + ']]>\n</Format>';
  }

  // 样式序列化：子元素顺序固定 [Format] -> FRFont -> Background -> Border
  function styleXml(st) {
    var out = '<Style ' + (st.align === null ? '' : 'horizontal_alignment="' + st.align + '" ') + 'imageLayout="1">\n';
    if (st.format) out += fmtXml(st.format) + '\n';
    out += fontXml(st.bold) + '\n';
    out += bgXml(st.bg) + '\n';
    out += borderXml(st.edges) + '\n';
    return out + '</Style>';
  }

  // ---------- 样式系统（把排版标准编译成代码） ----------
  // 边框分级：外框与表头/合计上下线 = 深色(null)；数据区内线 = 浅色
  function edgesOf(pos, deep) { // pos: 'first'|'mid'|'last' 或 null（合并行）
    if (deep === 'header') return { top: null, bottom: null, left: pos === 'first' ? null : COLORS.lightLine, right: pos === 'last' ? null : COLORS.lightLine };
    if (deep === 'data')   return { top: COLORS.lightLine, bottom: COLORS.lightLine, left: pos === 'first' ? null : COLORS.lightLine, right: pos === 'last' ? null : COLORS.lightLine };
    if (deep === 'total')  return { top: null, bottom: null, left: pos === 'first' ? null : COLORS.lightLine, right: pos === 'last' ? null : COLORS.lightLine };
    return { top: null, bottom: null, left: null, right: null };
  }

  // 生成全部样式（按列规则 + 相同内容确定性去重）
  function buildStyles(columns, titleBold) {
    var order = [];
    var seen = {};
    function push(st, tag) {
      var s = styleXml(st);
      if (!seen[s]) { seen[s] = order.length; order.push(s); }
      return seen[s];
    }
    var ids = { byCol: [] };
    // 0: 标题
    ids.title = push({ align: null, bold: titleBold, bg: null, format: null, edges: { top: null, bottom: null, left: null, right: null } });
    // 每列：表头 + 数据
    for (var i = 0; i < columns.length; i++) {
      var c = columns[i];
      var isText = c.type !== 'number';
      var pos = i === 0 ? 'first' : (i === columns.length - 1 ? 'last' : 'mid');
      // 表头：对齐跟内容（标准 §一.3），加粗，蓝底
      ids.byCol[i] = {};
      ids.byCol[i].header = push({ align: isText ? Align.LEFT : Align.RIGHT, bold: true, bg: COLORS.headerBg, format: null, edges: edgesOf(pos, 'header') });
      // 数据文字/数字
      ids.byCol[i].data = push({
        align: isText ? Align.LEFT : Align.RIGHT, bold: false, bg: null,
        format: !isText ? (c.format || '#,##0') : null,
        edges: edgesOf(pos, 'data')
      });
    }
    // 合计：标签（左）+ 数字（右、加粗、格式与数字列一致）
    var numCol = lastNumberCol(columns);
    ids.totalLabel = push({ align: Align.LEFT, bold: true, bg: COLORS.totalBg, format: null, edges: edgesOf('first', 'total') });
    ids.totalNum = push({
      align: Align.RIGHT, bold: true, bg: COLORS.totalBg,
      format: numCol && numCol.format ? numCol.format : null,
      edges: edgesOf('last', 'total')
    });
    return { ids: ids, list: order };
  }
  function lastNumberCol(columns) {
    for (var i = columns.length - 1; i >= 0; i--) if (columns[i].type === 'number') return columns[i];
    return null;
  }

  // ---------- 单元格 ----------
  function textCell(c, r, s, text, cs) {
    return '<C c="' + c + '" r="' + r + '"' + (cs ? ' cs="' + cs + '"' : '') + ' s="' + s + '">\n<O>\n<![CDATA[' + esc(text) + ']]></O>\n'
      + '<PrivilegeControl/>\n<Expand>\n<cellSortAttr/>\n</Expand>\n</C>';
  }
  function dsCell(c, r, s, colName) {
    return '<C c="' + c + '" r="' + r + '" s="' + s + '">\n<O t="DSColumn">\n'
      + '<Attributes dsName="ds1" columnName="' + esc(colName) + '"/>\n<Complex/>\n'
      + '<RG class="com.fr.report.cell.cellattr.core.group.FunctionGrouper"/>\n<Parameters/>\n<cellSortAttr/>\n</O>\n'
      + '<PrivilegeControl/>\n<Expand dir="0">\n<cellSortAttr/>\n</Expand>\n</C>';
  }
  function formulaCell(c, r, s, formula) {
    return '<C c="' + c + '" r="' + r + '" s="' + s + '">\n<O t="XMLable" class="com.fr.base.Formula">\n<Attributes>\n<![CDATA[=' + formula + ']]></Attributes>\n</O>\n'
      + '<PrivilegeControl/>\n<Expand>\n<cellSortAttr/>\n</Expand>\n</C>';
  }

  // ---------- 主生成器 ----------
  // spec: { title, webTitle, outName, columns:[{label,name,type,widthPt,format?}], heightsPt:{title,header,row,total}, data:[[...]] }
  function build(spec) {
    var cols = spec.columns, n = cols.length;
    var styles = buildStyles(cols, spec.titleBold !== false);
    var H = spec.heightsPt;

    var parts = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<WorkBook xmlVersion="20211223" releaseVersion="11.5.0">');
    parts.push('<TableDataMap>\n<TableData name="ds1" class="com.fr.data.impl.DBTableData">\n<Desensitizations desensitizeOpen="false"/>\n<Parameters/>\n<Attributes maxMemRowCount="-1"/>\n<Connection class="com.fr.data.impl.NameDatabaseConnection">\n<DatabaseName>\n<![CDATA[FRDemo]]></DatabaseName>\n</Connection>\n<Query>\n<![CDATA[SELECT 1]]></Query>\n<PageQuery>\n<![CDATA[]]></PageQuery>\n</TableData>\n</TableDataMap>');
    parts.push('<ReportWebAttr>\n<Title>\n<![CDATA[' + esc(spec.webTitle || spec.outName) + ']]></Title>\n</ReportWebAttr>');
    parts.push('<ElementCaseMobileAttr>\n<ElementCaseMobileAttrProvider horizontal="1" vertical="1" zoom="true" refresh="false" isUseHTML="false" isMobileCanvasSize="false" appearRefresh="false" allowFullScreen="false" allowDoubleClickOrZoom="true" functionalWhenUnactivated="false"/>\n</ElementCaseMobileAttr>');
    parts.push('<Report class="com.fr.report.worksheet.WorkSheet" name="sheet1">');
    parts.push('<ReportPageAttr>\n<HR/>\n<FR/>\n<HC/>\n<FC/>\n<USE REPEAT="false" PAGE="false" WRITE="false"/>\n</ReportPageAttr>');
    parts.push('<ColumnPrivilegeControl/>');
    parts.push('<RowPrivilegeControl/>');
    parts.push('<RowHeight defaultValue="' + emu(57) + '">\n<![CDATA['
      + [emu(H.title), emu(H.header), emu(H.row), emu(H.total)].join(',') + ']]></RowHeight>');
    parts.push('<ColumnWidth defaultValue="' + emu(216) + '">\n<![CDATA['
      + cols.map(function (c) { return emu(c.widthPt); }).join(',') + ']]></ColumnWidth>');
    parts.push('<CellElementList>');
    parts.push(textCell(0, 0, styles.ids.title, spec.title, n));
    for (var i = 0; i < n; i++) parts.push(textCell(i, 1, styles.ids.byCol[i].header, cols[i].label));
    for (var i2 = 0; i2 < n; i2++) parts.push(dsCell(i2, 2, styles.ids.byCol[i2].data, cols[i2].name));
    var totalIdx = -1;
    for (var ti = 0; ti < n; ti++) if (cols[ti].type === 'number') totalIdx = ti;
    parts.push(textCell(0, 3, styles.ids.totalLabel, '合计', n - 1));
    if (totalIdx >= 0) parts.push(formulaCell(totalIdx, 3, styles.ids.totalNum, 'SUM(' + colLetter(totalIdx) + '3)'));
    parts.push('</CellElementList>');
    parts.push('<ReportAttrSet>\n<ReportSettings headerHeight="0" footerHeight="0">\n<PaperSetting/>\n<FollowingTheme background="true"/>\n<Background name="ColorBackground">\n<color>\n<FineColor color="-1" hor="-1" ver="-1"/>\n</color>\n</Background>\n</ReportSettings>\n</ReportAttrSet>');
    parts.push('<PrivilegeControl/>');
    parts.push('</Report>');
    parts.push('<StyleList>\n' + styles.list.join('\n') + '\n</StyleList>');
    parts.push('<DesensitizationList/>');
    parts.push('<DesignerVersion DesignerVersion="LAA"/>');
    parts.push('<PreviewType PreviewType="0"/>');
    parts.push('<TemplateThemeAttrMark class="com.fr.base.iofile.attr.TemplateThemeAttrMark">\n<TemplateThemeAttrMark name="兼容主题" dark="false"/>\n</TemplateThemeAttrMark>');
    parts.push('<ForkIdAttrMark class="com.fr.base.iofile.attr.ForkIdAttrMark">\n<ForkIdAttrMark forkId="b7e3f2a1-4c5d-4e6f-9a8b-1f2e3d4c5b6a"/>\n</ForkIdAttrMark>');
    parts.push('<TemplateIdAttMark class="com.fr.base.iofile.attr.TemplateIdAttrMark">\n<TemplateIdAttMark TemplateId="b7e3f2a1-4c5d-4e6f-9a8b-1f2e3d4c5b6a"/>\n</TemplateIdAttMark>');
    parts.push('</WorkBook>');
    var xml = parts.join('\n') + '\n';
    return { xml: xml, styleCount: styles.list.length };
  }

  // ---------- 校验器 ----------
  function fail(msg) { throw new Error('[CPT VALIDATE] ' + msg); }

  // 落盘前：well-formed + 结构不变量
  function validate(xml, expect) {
    var dbf = J('javax.xml.parsers.DocumentBuilderFactory').newInstance();
    var db = dbf.newDocumentBuilder();
    var StringReaderC = J('java.io.StringReader');
    var InputSourceC = J('org.xml.sax.InputSource');
    db.parse(new InputSourceC(new StringReaderC(xml)));
    // 不变量
    if (expect.styleCount && (xml.match(/<Style[ >]/g) || []).length !== expect.styleCount) {
      fail('style count mismatch: got ' + (xml.match(/<Style[ >]/g) || []).length + ' expect ' + expect.styleCount);
    }
    // 所有对齐值必须在封死枚举内
    var m = xml.match(/horizontal_alignment="(-?\d+)"/g) || [];
    for (var i = 0; i < m.length; i++) {
      var v = /-?\d+/.exec(m[i])[0];
      if (v !== '0' && v !== '2' && v !== '4') fail('illegal alignment value ' + v + ' (enum: CENTER=0/LEFT=2/RIGHT=4)');
    }
    // 公式必须在且用 <Attributes>CDATA[=] —— 仅对含公式的模板族（公式缺失/无=前缀会被静默读成空公式）。
    // 浏览器族（v3.7）：模板零公式（分页=引擎原生，无自造按钮公式），allowNoFormula 时整段断言关闭。
    if (!expect.allowNoFormula) {
      if (xml.indexOf('class="com.fr.base.Formula"') < 0) fail('missing formula cell');
      var need = /[Aa]ttributes>\s*\n?\s*<!\[CDATA\[=/;
      if (!need.test(xml)) fail('formula must use <Attributes><![CDATA[=SUM... (无=前缀会被读成空公式)');
    }
    // 严禁命名字式样式（会被默认化）
    if (/style_name=/.test(xml)) fail('named style forbidden (style_name= 读取即默认化)');
    // 引擎只认 SimHei（v3.2 精化：参数面板/图表段摘除后查——控件默认字体与图表自带字体不属单元格管辖；
    // 图表格序列化是缩写标记 <O t="CC">，段尾即 </C>）
    // v3.4：rawIR 重建路径（expect.skipFormatOrder 同源开关）官方模板自带字体（微软雅黑/SimSun）走 palette 语义，字体门不适用于官方语料
    var cellXml = xml
      .replace(/<ReportParameterAttr[\s\S]*?<\/ReportParameterAttr>/g, '')
      // 批F：工具栏按钮 widget 域同参数面板豁免（按钮默认字体 SimSun 不属单元格管辖；官方 套打.cpt ToolBars 同域）
      .replace(/<ToolBars[\s\S]*?<\/ToolBars>/g, '')
      .replace(/<O t="CC">[\s\S]*?<\/C>/g, '');
    if (!(expect.skipFormatOrder && /FRFont name="(?!SimHei)/.test(cellXml))) {
      if (/FRFont name="(?!SimHei)/.test(cellXml)) fail('non-SimHei font found');
    }
    // Format 必须在 FRFont 之前（同一样式内）
    if (expect.skipFormatOrder) { /* rawIR: 引擎自序列化 Style 内部序由 FR 负责，此门只管 v2 字符串组装器输出 */ } else if (/<Format class="com\.fr\.base\.CoreDecimalFormat" roundingMode="\d+">\s*<!\[CDATA\[[^\]]*\]\]>\s*<\/Format>\s*<FRFont/.test(xml) === false && /<Format/.test(xml)) fail('Format must precede FRFont');
    return true;
  }

  // 引擎读回后：防静默降级
  function assertRoundTrip(diagXml, spec) {
    var n = spec.columns.length;
    var StringReaderC2 = J('java.io.StringReader');
    var InputSourceC2 = J('org.xml.sax.InputSource');
    var DBF2 = J('javax.xml.parsers.DocumentBuilderFactory').newInstance();
    DBF2.newDocumentBuilder().parse(new InputSourceC2(new StringReaderC2(diagXml)));
    if (!/class="com\.fr\.base\.Formula"/.test(diagXml)) fail('ROUNDTRIP: formula LOST');
    var ds = diagXml.match(/t="DSColumn"/g) || [];
    if (ds.length !== n) fail('ROUNDTRIP: DSColumn cells ' + ds.length + ' != ' + n);
    if (!/=SUM\(/i.test(diagXml)) fail('ROUNDTRIP: SUM formula text LOST');
    if (/style_name=/.test(diagXml)) fail('ROUNDTRIP: named styles appeared');
    return true;
  }

  return { Align: Align, COLORS: COLORS, FONT: FONT, build: build, validate: validate, assertRoundTrip: assertRoundTrip, emu: emu };
})();
