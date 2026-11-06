// probes/coverage_report.js — demo240 能力覆盖率看板（双列：缺口 + 组合稳定证据）
//  动机（r1.md §六改口径）：官方 demo 240 张的能力覆盖不止要"知道缺什么"（logs/_demo_classes.txt 频次总账），
//   还要"证明已支持特性可稳定组合"——所以看板三节：A 缺口总账（类级，按 demo 频次倒序）、
//   B 已实现族组合稳定证据（载体 spec + 门 + 基线）、C feature 标签三色表。
//   非门（exit 恒 0，读失败才 2）：每批收尾跑一次重生成 docs/architecture/coverage.md（幂等覆盖）。
//   分类规则：demo 类名（logs/_demo_classes.txt）在 lib 引擎源码中找全限定名或带引号短名
//   （object.js 走 J('com.fr.X') 与 H+'X' 前缀拼接——后者短名本身就在引号里，同一规则既可命中）。
//   非 com.fr.* 行（XML 层 tag 词）与 com.fr.plugin.cloud/esd/widgettheme 等插件配置类计入"非核心不追"。
// 跑法：
//   "D:\software\FineReport_11.0\jre\bin\java.exe" -cp "D:\software\FineReport_11.0\jre\lib\ext\nashorn.jar" jdk.nashorn.tools.Shell probes/coverage_report.js
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';

function readText(p) {
  var Paths = J('java.nio.file.Paths');
  var bytes = J('java.nio.file.Files').readAllBytes(Paths.get(p));
  return new (J('java.lang.String'))(bytes, 'UTF-8');
}

// ---------- 引擎源码（实现状态唯一依据）----------
var SOURCES = [
  ['lib/object.js', 'engine'],
  ['lib/ir.js', 'contract'],
  ['lib/cpt.js', 'validator'],
  ['lib/report_spec.js', 'spec'],
  ['lib/spec_compiler.js', 'spec'],
  ['lib/spec_validator.js', 'spec'],
  ['features/data_browser/browser.js', 'engine'],
  ['application/contracts.js', 'artifact']
];
var srcText = {};
SOURCES.forEach(function (s) { srcText[s[0]] = readText(ROOT + '/' + s[0]); });
var libAll = '';
SOURCES.forEach(function (s) { libAll += '\n/*@@' + s[0] + '@@*/' + srcText[s[0]]; });

function findFast(tok) { return libAll.indexOf(tok) >= 0; }
// 状态：full=构造级实现；partial=部分/提到；missing=零命中
function classifyToken(tok) {
  if (findFast(tok)) return 'full';
  var short = String(tok).split('.').pop();
  if (new RegExp("['\"]" + short + "['\"]").test(libAll)) return 'full';
  if (findFast(short)) return 'partial';
  return 'missing';
}

// ---------- feature 语义层（demo 普查 tag → 关键 token 组）----------
var PHASE = '(共 13 批：0 看板/A 条件满血/B 图表装饰/C 页眉页脚/D 字典格式/E 事件js/F 填报/G 小扫荡/H 排序/I 地图极端图/J Poly)';
var FAMILIES = [
  { tag: 'sheet',       keys: ['WorkSheet'], batch: '既有', carriers: '全部 spec', readme: '#45' },
  { tag: 'background',  keys: ['ColorBackground', 'NullBackground'], batch: '既有', carriers: '全部 spec', readme: '#45' },
  { tag: 'funcgroup',   keys: ['FunctionGrouper'], batch: '既有', carriers: 'sales_demo.js', readme: '#21/#45' },
  { tag: 'summary',     keys: ['SummaryGrouper'], batch: '既有', carriers: 'db_laser_subtotal.js', readme: '#33' },
  { tag: 'formula',     keys: ['com.fr.base.Formula'], batch: '既有', carriers: 'db_laser_subtotal.js', readme: '#52 A' },
  { tag: 'condition',   keys: ['DefaultHighlight', 'CommonCondition', 'FormulaCondition', 'ListCondition', 'BackgroundHighlightAction', 'ForegroundHighlightAction', 'FRFontHighlightAction', 'RowHeightHighlightAction', 'ColWidthHighlightAction', 'PageHighlightAction'], batch: '既有', carriers: 'reports/test_cellattrs.js', readme: '#45' },
  { tag: 'condActionsExt', keys: ['ValueHighlightAction', 'BorderHighlightAction', 'HyperlinkHighlightAction', 'WidgetHighlightAction'], batch: '批A 已收(2026-11-04)', carriers: 'reports/test_hla2.js', readme: '#72' },
  { tag: 'objCondition(定性)', keys: ['com.fr.data.condition.CommonCondition'], batch: '定性：CommonCondition=其带列参与物,cell 面已覆盖;数据集级过滤仍计缺口', carriers: 'test_cellattrs.js', readme: '#45/#72' },
  { tag: 'html',        keys: ['setShowAsHTML'], batch: '既有', carriers: 'test_cellattrs.js', readme: '#45' },
  { tag: 'richtext',    keys: ['RichText', 'RichChar'], batch: '既有', carriers: 'test_v41.js', readme: '#45' },
  { tag: 'formulaPresent', keys: ['FormulaPresent'], batch: '既有', carriers: 'test_v41.js', readme: '#45' },
  { tag: 'float',       keys: ['FloatElement'], batch: '既有', carriers: 'test_v41.js', readme: '#45' },
  { tag: 'watermark',   keys: ['WatermarkAttr'], batch: '既有', carriers: 'test_v41.js', readme: '#45' },
  { tag: 'toolbar',     keys: ['ToolBarManager', 'com.fr.form.ui.ToolBar', 'com.fr.report.web.button.Export', 'com.fr.report.web.button.page.PageNavi'], batch: '既有', carriers: 'test_v41.js', readme: '#45' },
  { tag: 'writeButtons', keys: ['AppendRowButton', 'DeleteRowButton', 'AppendColumnRow', 'ShowCellValue', 'ImportExcelData'], batch: '批F', carriers: '', readme: '待回填' },
  { tag: 'editor (参数控件族)', keys: ['NumberEditor', 'DateEditor', 'TextArea', 'RadioGroup', 'ComboCheckBox', 'TreeComboBoxEditor', 'IframeEditor', 'TextEditor'], batch: 'v4.2 已收', carriers: 'test_widgets.js', readme: 'v4.2/待回填' },
  { tag: 'dict',        keys: ['CustomDictionary', 'DictPresent', 'DatabaseDictionary', 'TableDataDictionary', 'DynamicSQLDict', 'FormulaDictionary'], batch: '批D(4缺)', carriers: 'test_cellattrs.js', readme: '#45' },
  { tag: 'formats',     keys: ['CoreDecimalFormat', 'SimpleDateFormatThreadSafe', 'TextFormat'], batch: '批D(日期/文本缺)', carriers: 'sales_demo.js', readme: '数字格式既有' },
  { tag: 'chart legacy', keys: ['Bar2DPlot', 'PiePlot', 'LinePlot', 'MoreNameCDDefinition'], batch: '既有', carriers: 'sales_demo_chart.js', readme: '#26' },
  { tag: 'chart Van',   keys: ['VanChartColumnPlot', 'VanChartLinePlot', 'PiePlot4VanChart', 'VanChartGaugePlot', 'VanChartScatterPlot', 'VanChartAreaPlot'], batch: '批I(部分未达)', carriers: 'test_vanchart.js', readme: '#46' },
  { tag: 'chartDeco',   keys: ['AttrTooltip', 'AttrLabelDetail', 'AttrBorder', 'AttrAlpha', 'ConditionAttr', 'TrendLine'], batch: '批B', carriers: '', readme: '待回填' },
  { tag: 'chartdata',   keys: ['MoreNameCDDefinition', 'NameTableData'], batch: '既有', carriers: 'sales_demo_chart.js', readme: '#26' },
  { tag: 'webpage',     keys: ['ReportWebAttr', 'WebPage'], batch: '批E/G(部分)', carriers: 'br_laser_* / test_v41.js', readme: '#45' },
  { tag: 'hyperlink',   keys: ['NameJavaScriptGroup', 'ReportletHyperlink', 'WebHyperlink', 'ParameterJavaScript', 'ReportletHyperlinkDialogAttr', 'Commit2DBJavaScript'], batch: '批E(缺3)', carriers: 'sales_demo_link.js', readme: '#25/#45' },
  { tag: 'jsEvents',    keys: ['JavaScriptImpl', 'Listener'], batch: '批E(部分)', carriers: 'br 导航按钮', readme: '#?/#45' },
  { tag: 'freeze',      keys: ['setRepeatHeaderRowFrom', 'FrozenState', 'RepeatAndCollapsible'], batch: '批G(web冻结缺)', carriers: 'db_laser_subtotal.js', readme: '#31' },
  { tag: 'headerfooter', keys: ['com.fr.report.core.ReportHF', 'FormulaHFElement', 'TextHFElement', 'DateHFElement'], batch: '批C 已收(2026-11-05)', carriers: 'reports/test_pagehf.js', readme: '#73' },
  { tag: 'template marks', keys: ['TemplateIdAttrMark', 'TemplateThemeAttrMark'], batch: '批C 已收(2026-11-05)', carriers: 'reports/test_pagehf.js', readme: '#73' },
  { tag: 'submit (填报)', keys: ['BuiltInSQLSubmiter', 'IntelliDMLConfig', 'VerifyItem', 'ValueVerifier'], batch: '批F', carriers: '', readme: '待回填' },
  { tag: 'reg 校验族',  keys: ['NoneReg', 'PhoneReg', 'IDCardReg'], batch: '批F', carriers: '', readme: '待回填' },
  { tag: 'sort',        keys: ['CellSortAttr'], batch: '批H', carriers: '', readme: '#45 受阻断' },
  { tag: 'subreport',   keys: ['SubReport'], batch: '批G', carriers: '', readme: '待回填' },
  { tag: 'diagonal',    keys: ['Diagonal'], batch: '批G', carriers: '', readme: '待回填' },
  { tag: 'barcode',     keys: ['BarcodePresent'], batch: '批G', carriers: '', readme: '待回填' },
  { tag: 'image',       keys: ['ImageWithSuffix'], batch: '既有(floats 路径)', carriers: 'floats imageFile 规格面', readme: '#45 观察' },
  { tag: 'map',         keys: ['VanChartMapPlot', 'AttrMapLabel', 'VanMapMoreNameCDDefinition'], batch: '批I', carriers: '', readme: '待回填' },
  // specialcharts 收窄（2026-11-05 FVS 不做）：Meter/KPI/CarouselPie 三族物理定义于 FVS bigScreen 插件 → noncore 不再入键；
  //   本族只余核心 jar 的 HeatMap（批I 挂账）+ 已收编 Bubble(#79)
  { tag: 'specialcharts', keys: ['VanChartHeatMapPlot', 'VanChartBubblePlot'], batch: '批I(HeatMap)/FVS三族不追', carriers: '', readme: '#79(bubble)' },
  { tag: 'poly',        keys: ['PolyECBlock', 'PolyWorkSheet'], batch: '批J', carriers: '', readme: '待回填' },
  { tag: 'group (自定义分组)', keys: ['CustomGrouper'], batch: '批G', carriers: '', readme: '待回填' },
  { tag: '局部样式(样式肾上)', keys: ['style_', 'stylesOf'], batch: '既有(引擎内建)', carriers: 'rebuild_basicA.js 20 样式', readme: '#31' }
];

// ---------- 1) feature 标签层加权 ----------
var scanText = readText(ROOT + '/logs/_demo_feature_scan.txt');
var TAGS = {};
scanText.split('\n').forEach(function (ln) {
  var m = ln.replace(/^\uFEFF/, '').match(/\s*(\S+)\s+(\d+)/);
  if (m) TAGS[m[1]] = parseInt(m[2], 10);
});

function famStatus(fam) {
  var hits = [], miss = [];
  fam.keys.forEach(function (k) { (classifyToken(k) === 'full' ? hits : miss).push(k); });
  var st = miss.length === 0 ? 'full' : (hits.length === 0 ? 'missing' : 'partial');
  return { st: st, hits: hits, miss: miss };
}

// ---------- 2) 类级缺口总账 ----------
var classesText = readText(ROOT + '/logs/_demo_classes.txt');
var cls = [];
classesText.split('\n').forEach(function (ln) {
  var m = ln.replace(/^\uFEFF/, '').match(/\s*(\d+)\s+(\S+)/);
  if (m && /^com\./.test(m[2])) cls.push({ n: parseInt(m[1], 10), fq: m[2] });
});
var NONCORE = /^com\.fr\.(esd|plugin\.cloud|widgettheme)\./; // 插件配置/云分析不追
// 收费/移动端不追（2026-11-05 用户拍板终口径="**基本授权有的内容都可以做；额外收费的不做；移动端不做**"）：
//   判据=类物理定义于哪个 jar：WEB-INF/lib fine-* 核心 jar=基本授权自带；plugins/ 插件 jar=插件功能。
//   ① FVS 大屏（收费产品）插件 plugin-com.fr.plugin.bigScreen.v11 / fr-plugin-extendedCharts-4.6.16.jar
//     （448 类）定义 36 个缺口类，全部在下列 14 包；14 包在核心 jar 零交叉（grep -a 实证，注意 jar 清单为
//     ISO-8859 编码必须 grep -a，普通 grep 当二进制静默跳过）。FVS 复核：36 类全随付费大屏产品，无一属基本
//     授权；VanChart 常规图型（柱/线/饼/散点/面积/仪表/雷达/地图/热力/气泡）全在核心 jar，未误伤免费内容。
//   ② com.fr.extended.chart（核心 jar 内 15 类序列化兼容基建）：类在基本授权 jar，但消费者=付费扩展图族
//     （KPI/地球/智慧树等图型只在 FVS 插件），引用它的 25 张 demo 全是扩展图 demo——基建无基本功能图型可挂，随付费族不追。
//   ③ 移动端（用户拍板不做，多数部署需单独移动端授权）：com.fr.report.mobile.* + com.fr.form.ui.mobile.*
//     共 4 类；com.fr.form.ui.reg.MobileReg=手机号校验（表单验证基本功能）不在此列，已 full。
var NONCORE_PAID = /^com\.fr\.plugin\.chart\.(kpi|meter|wisdomtree|globe|catalog|fluid|time|particlecounter|multidata)\.|^com\.fr\.plugin\.chart\.(map\.groupmap|column\.(arccolumn|carouselbar|shapecolumn)|pie\.carouselpie)\.|^com\.fr\.extended\.chart\.|^com\.fr\.(report\.mobile|form\.ui\.mobile)\./;
var SKIP_FURTHER = 0;
var ledger = cls.map(function (c) {
  var cat;
  if (NONCORE.test(c.fq)) { cat = 'noncore'; SKIP_FURTHER++; }
  else if (NONCORE_PAID.test(c.fq)) { cat = 'noncore'; SKIP_FURTHER++; }
  else cat = classifyToken(c.fq);
  return { n: c.n, fq: c.fq, cat: cat };
});
// 'com.fr.' 短名全等命中算 full；只剩非常用词（Formula/Attr 等 XML tag 词）已经是 full 无妨
var MISSING = ledger.filter(function (r) { return r.cat === 'missing'; });
var PARTIAL = ledger.filter(function (r) { return r.cat === 'partial'; });

// ---------- 3) 组合稳定证据（每族：载体 spec 是否在库）---------
var carriersInRepo = [];
var repDir = new java.io.File(ROOT + '/reports').listFiles();
for (var i = 0; i < repDir.length; i++) if (repDir[i].isFile()) carriersInRepo.push(repDir[i].getName());

function carrierHit(list) {
  // list: 'a, b' 形；返回在库标记
  var arr = String(list).split(/[,/]/).map(function (s) { return s.trim(); }).filter(function (s) {
    return /\.js$/.test(s);
  });
  var ok = [], off = [];
  arr.forEach(function (f) { (carriersInRepo.indexOf(f.replace('.js', '.js')) >= 0 ? ok : off).push(f); });
  return { ok: ok, off: off };
}

// ---------- 生成文档 ----------
function tableRow(cells) { return '| ' + cells.join(' | ') + ' |'; }
var A = [], B = [], C = [], D = [];
A.push('## A. 缺口总账（demo 类级，按演示库 240 张 cpt 引用频次倒序；也是批计划排期依据）');
A.push('');
A.push('> r17 对齐口径：**参考批次=排期归属（README 引证），不等于探针已认到实现；实现状态以 状态 列为准**。');
A.push('> 批次↔按键级实认交叉核对见 D 表；**版本包名差异 10 类（First/Previous/Next/Last/PageNavi/Export/Print/FlashPrint/Email/TemplateIdAttrMark）=demo 旧包名 vs 引擎新包名，功能非真缺（#81 已核）**。');
A.push('> 漏账.域 条目=当前无 README 批定义背书，保留显式漏账标记、不硬编归属。');
A.push('');
A.push(tableRow(['demo类', '频次', '状态', '参考批次']));
A.push('|---|---|---|---|');
// 批归属索引：家→键短名全等先查，再按全限定名先查
var IDX = {};
FAMILIES.forEach(function (f) { f.keys.forEach(function (k) { IDX[String(k).split('.').pop()] = f; }); });

// r17 对齐增强：参考批次逐类补全（2026-11-05，README #72/#75/#79/#80/#81 引证；键=全限定名）。
//   纪律：只按 README 写明的批定义归属；没有批定义背书的标 "漏账·<域>(需排)"，不硬编。
//   版本包名差异 10 类=root 坐实：引擎在 web.button(.page).* / iofile.attr.*（object.js 1137-1149/904），
//   demo 记 web.ui.impl.* / iofileattr = 旧包名，功能非真缺（#81 "其中 10 个是版本包名差异非缺类"）。
var BATCH_CLASS = {
  // —— 批B后继·装饰深水区（#600 工单头部点名 4 类）——
  'com.fr.plugin.chart.base.AttrTooltipRichText': '批B 已收(tooltip+vpie label 双路,README #102/#104)',
  'com.fr.base.chart.chartdata.model.NormalDataModel': '引擎内部 DataProcessor 标记(官方 XML 同款已在产物流,无构造面,README #104)',
  'com.fr.chart.base.AttrBorder': '批B 已收(seriesBorder 通道,README #102)',
  'com.fr.plugin.chart.attr.axis.VanChartAxis': '批B axis 实例配置非构造(README #103)',
  'com.fr.plugin.chart.attr.axis.VanChartValueAxis': '批B axis 实例配置非构造(README #103)',
  // —— 批B后继·tooltip/axis/label 深水区（#600 "tooltip/axis/label 装饰深水区"）——
  'com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat': '批B后继·tooltip 深水区(未排)',
  'com.fr.plugin.chart.base.format.AttrTooltipMapValueFormat': '批B后继·tooltip 深水区(未排)',
  'com.fr.plugin.chart.base.format.AttrTooltipSummaryValueFormat': '批B后继·tooltip 深水区(未排)',
  'com.fr.plugin.chart.base.format.AttrTooltipStartAndEndNameFormat': '批B后继·tooltip 深水区(未排)',
  'com.fr.plugin.chart.base.format.AttrTooltipXFormat': '批B后继·tooltip 深水区(未排)',
  'com.fr.plugin.chart.base.format.AttrTooltipSizeFormat': '批B后继·tooltip 深水区(未排)',
  'com.fr.plugin.chart.base.format.AttrTooltipYFormat': '批B后继·tooltip 深水区(未排)',
  'com.fr.plugin.chart.scatter.attr.ScatterAttrTooltip': '批B后继·tooltip 深水区(未排)',
  'com.fr.chart.chartattr.CategoryAxis': '批B axis 实例配置非构造(README #103)',
  'com.fr.chart.chartattr.ValueAxis': '批B axis 实例配置非构造(README #103)',
  'com.fr.plugin.chart.attr.axis.VanChartAlertValue': '批B后继·axis/标记深水区(未排)',
  'com.fr.plugin.chart.base.AttrLabelDetail': '批B后继·label 装饰深水区(未排)',
  // —— 批B后继·图表 attr 装饰域（批B 同域 Attr 类，构串类）——
  'com.fr.plugin.chart.base.AttrSeriesImageBackground': '批B后继·chart attr 装饰(未排)',
  'com.fr.chart.base.AttrBackground': '批B后继·chart attr 装饰(未排)',
  'com.fr.chart.base.AttrContents': '批B后继·chart attr 装饰(未排)',
  'com.fr.plugin.chart.base.AttrBorderWithAlpha': '批B后继·chart attr 装饰(未排)',
  'com.fr.plugin.chart.base.AttrEffect': '批B后继·chart attr 装饰(未排)',
  'com.fr.plugin.chart.base.AttrMarkerAlpha': '批B后继·chart attr 装饰(未排)',
  'com.fr.plugin.chart.base.AttrAreaSeriesFillColorBackground': '批B后继·chart attr 装饰(未排)',
  // —— 批I（地图/极端/热链挂账，#79/#597）——
  'com.fr.plugin.chart.map.attr.AttrMapLabel': '批I(挂账,#79/#597)',
  'com.fr.plugin.chart.map.attr.AttrMapTooltip': '批I(挂账,#79/#597)',
  'com.fr.plugin.chart.map.data.VanMapMoreNameCDDefinition': '批I(挂账,#79/#597)',
  'com.fr.plugin.chart.map.VanChartMapPlot': '批I(挂账,#79/#597 GIS 底图)',
  'com.fr.plugin.chart.map.line.condition.AttrCurve': '批I(挂账, map.line 域,#79)',
  'com.fr.plugin.chart.map.line.condition.AttrLineEffect': '批I(挂账, map.line 域,#79)',
  'com.fr.plugin.chart.heatmap.VanChartHeatMapPlot': '批I(挂账,#79; 核心 heatmap 包全做)',
  'com.fr.chart.web.ChartHyperRelateCellLink': '批I(挂账,#79/#581 图表热链随地图批)',
  'com.fr.plugin.chart.bubble.attr.VanChartAttrBubble': '批I后继·bubble 属性(未排; bubble plot 已收 #79)',
  // —— 批J（Poly 挂账，#80/#586）——
  'com.fr.report.poly.PolyECBlock': '批J(挂账,#80/#586 块面 API 未探全)',
  'com.fr.report.poly.PolyWorkSheet': '批J(挂账,#80/#586 块面 API 未探全)',
  // —— 批F（填报后继，#554/#558/#600）——
  'com.fr.js.Commit2DBJavaScript': '批F(#75 挪填报章,未排)',
  'com.fr.report.write.ValueVerifier': '批F后继·Verifier 族工单(#558/#600)',
  'com.fr.data.VerifyItem': '批F后继·Verifier 族工单(#557 Verifier≠VerifyItem 教案)',
  'com.fr.write.config.DeleteConfig': '批F后继·WriteActor DML 工单(#558/#600)',
  'com.fr.write.config.UpdateConfig': '批F后继·WriteActor DML 工单(#558/#600)',
  'com.fr.report.web.button.write.DeleteColumnRow': '批F后继·write 按钮(未排)',
  'com.fr.report.web.button.write.CustomizeImportExcelData': '批F后继·write 按钮(未排)',
  'com.fr.report.web.button.write.ClearStashedButton': '批F后继·write 按钮(未排)',
  'com.fr.report.web.button.write.StashButton': '批F后继·write 按钮(未排)',
  // —— 批D（字典凭据注入工单，#539/#600）——
  'com.fr.data.impl.DatabaseDictionary': '批D(凭据注入工单,#539)',
  'com.fr.data.impl.DynamicSQLDict': '批D(凭据注入工单,#539)',
  'com.fr.general.date.FineDateFormat': '批D后继·格式域扩项(未排; SimpleDateFormatThreadSafe 已收 #74)',
  // —— 批A（定性不降级，README #45/#515）——
  'com.fr.data.condition.ObjectCondition': '批A(定性:cell 高亮面已覆盖,数据集级过滤仍缺口,#45/#515)',
  // —— 既有·版本包名差异 10 类（#81 已核非真缺；引擎 web.button(.page).* / iofile.attr.*）——
  'com.fr.report.web.ui.impl.page.First': '既有·版本包名差异(引擎=web.button.page.First,#81 已核)',
  'com.fr.report.web.ui.impl.page.Previous': '既有·版本包名差异(引擎=web.button.page.Previous,#81 已核)',
  'com.fr.report.web.ui.impl.page.Next': '既有·版本包名差异(引擎=web.button.page.Next,#81 已核)',
  'com.fr.report.web.ui.impl.page.Last': '既有·版本包名差异(引擎=web.button.page.Last,#81 已核)',
  'com.fr.report.web.ui.impl.page.PageNavi': '既有·版本包名差异(引擎=web.button.page.PageNavi,#81 已核)',
  'com.fr.report.web.ui.impl.Export': '既有·版本包名差异(引擎=web.button.Export,#81 已核)',
  'com.fr.report.web.ui.impl.Print': '既有·版本包名差异(引擎=web.button.Print,#81 已核)',
  'com.fr.report.web.ui.impl.FlashPrint': '既有·版本包名差异(引擎=web.button.FlashPrint,#81 已核)',
  'com.fr.report.web.ui.impl.Email': '既有·版本包名差异(引擎=web.button.Email,#81 已核)',
  'com.fr.base.iofileattr.TemplateIdAttrMark': '既有·版本包名差异(引擎=iofile.attr.TemplateIdAttrMark,#81 已核)',
  // —— 漏账·无 README 批定义背书（保留漏账标记，不硬编归属）——
  'com.fr.chart.chartattr.ChartCommonCondition': '非真缺:chart 条件通道已用 CommonCondition 实证(m7 D_c 全染),变体类同语义(README #105)',
  'com.fr.plugin.chart.custom.VanChartCustomPlot': '批B后继·组合图车道(双轴多plot组合,需批定义显式排期,README #105)',
  'com.fr.form.ui.MultiFileEditor': '编辑器扩项·参数控件族后继(文件上传控件,需 widget kind 批定义,README #105)',
  'com.fr.report.web.button.form.TreeNodeToggleButton': '表单树控件域(需表单树批定义,README #105)',
  'com.fr.form.ui.CustomToolBarButton': '工具条按钮域(自定义JS按钮,需批定义,README #105)',
  'com.fr.data.impl.ExcelTableData': '非真缺:数据集入口边界=SQL/内嵌(数据纪律既定),文件数据集不引入(README #105)',
  'com.fr.data.impl.RecursionTableData': '非真缺:同 ExcelTableData,递归数据集不引入(README #105)',
  'com.fr.chartx.data.DataSetDefinition': '非真缺:chartx legacy 数据接口,现有 chartdata 路已覆盖(README #105)',
  'com.fr.base.io.FileAttrErrorMarker': '待探针确认(疑引擎内部 IO 标记,README #105)'
};
function batchOf(fq) {
  return BATCH_CLASS[fq]
    || (FAMILIES.filter(function (f) { return f.keys.indexOf(fq) >= 0; })[0] || IDX[String(fq).split('.').pop()] || {}).batch
    || '(漏账：批排期时人工归入)';
}
MISSING.forEach(function (r) { A.push(tableRow([r.fq, String(r.n), 'missing', batchOf(r.fq)])); });
PARTIAL.forEach(function (r) { A.push(tableRow([r.fq, String(r.n), 'partial', batchOf(r.fq)])); });
if (!MISSING.length && !PARTIAL.length) A.push(tableRow(['(无)', '0', 'all full', '']));

B.push('## B. 已实现族·组合稳定证据（“已支持特性可稳定组合”，r1.md §六口径）');
B.push('');
B.push(tableRow(['family', '状态', '关键组合载体 spec', '快速门套件', 'README 实证位']));
B.push('|---|---|---|---|---|');
var GATES = 'verify/fast_parse+ir_contract+runresult+browser_sql+report_spec+schema+semantic+planner+sqlbuilder+sqlpath+closure+template+contracts(13) + scan_all_specs + 引擎负门5路 + 字节基线 CBEB42E3/A8EF39AB';
FAMILIES.forEach(function (f) {
  var stv = famStatus(f);
  var ch = carrierHit(f.carriers);
  var carriers = ch.ok.join('、') + (ch.off.length ? (' [计划:' + ch.off.join('、') + ']') : '');
  B.push(tableRow([f.tag, stv.st + (stv.miss.length ? ' (缺: ' + stv.miss.join('+') + ')' : ''), carriers || '—', GATES, f.readme]));
});

C.push('## C. feature 标签层三色表（demo 普查 27 tag → 当前状态；tag 经 ALIAS 并到语义族）');
C.push('');
C.push(tableRow(['tag', 'demo(240)', '状态']));
C.push('|---|---|---|');
var ALIAS = {
  sheet: ['sheet'], background: ['background'], headerfooter: ['headerfooter'],
  condition: ['condition', 'condActionsExt'], funcgroup: ['funcgroup'], webpage: ['webpage'],
  formula: ['formula', 'formulaPresent'], chart: ['chart legacy', 'chart Van', 'chartDeco', 'chartdata'],
  sort: ['sort'], html: ['html'], editor: ['editor (参数控件族)'], dict: ['dict'],
  summary: ['summary'], submit: ['submit (填报)', 'writeButtons', 'reg 校验族'],
  hyperlink: ['hyperlink', 'jsEvents'], chartdata: ['chartdata'], freeze: ['freeze'],
  richtext: ['richtext'], subreport: ['subreport'], float: ['float'], diagonal: ['diagonal'],
  watermark: ['watermark'], map: ['map'], barcode: ['barcode'], image: ['image'],
  group: ['group (自定义分组)'], qrcode: [], gantt: [], meter: ['chart Van', 'specialcharts'],
  filter: [], celllink: ['hyperlink'], proc: [], json: [], tree: [], dscolumn: []
};
var RANK = { missing: 2, partial: 1, full: 0 };
var tagRows = Object.keys(TAGS).filter(function (t) { return TAGS[t] > 0; }).map(function (t) {
  var fams = (ALIAS[t] || []).map(function (an) {
    var f = FAMILIES.filter(function (x) { return x.tag === an; })[0];
    return f ? famStatus(f) : null;
  }).filter(Boolean);
  var worst = null, miss = [];
  fams.forEach(function (s) {
    if (!worst || RANK[s.st] > RANK[worst]) worst = s.st;
    s.miss.forEach(function (m) { miss.push(m); });
  });
  if (!fams.length) worst = 'unplanned';
  return tableRow([t, String(TAGS[t]), (worst || '-') + (miss.length ? ' 0x' + miss.length : '')]);
});
C.push(tagRows.join('\n'));

// ---------- D. 批次↔探针对齐（r17）：批标记是排期归属，键/类级探针实认才是实现状态 ----------
var DCODE_ORDER = ['既有', 'v4.2', '批A', '批B', '批C', '批D', '批E', '批F', '批G', '批H', '批I', '批J', '漏账', '其他'];
function batchCode(lbl) {
  var m = String(lbl).match(/批[A-J]|既有|v4\.2|漏账/);
  return m ? m[0] : '其他';
}
var DMAP = {};
DCODE_ORDER.forEach(function (c) { DMAP[c] = { keyFull: 0, keyMiss: [], tags: [], clsP: 0, clsM: 0, readmes: [] }; });
FAMILIES.forEach(function (f) {
  var d = DMAP[batchCode(f.batch)];
  d.tags.push(f.tag);
  if (f.readme && d.readmes.indexOf(f.readme) < 0) d.readmes.push(f.readme);
  f.keys.forEach(function (k) {
    if (classifyToken(k) === 'full') d.keyFull++;
    else d.keyMiss.push(k);
  });
});
ledger.forEach(function (r) {
  if (r.cat === 'partial') DMAP[batchCode(batchOf(r.fq))].clsP++;
  else if (r.cat === 'missing') DMAP[batchCode(batchOf(r.fq))].clsM++;
});
D.push('## D. 批次↔探针对齐（r17 增强；批标记=排期归属 ≠ 实现状态，按键级/类级实认交叉核对）');
D.push('');
D.push(tableRow(['批次', '覆盖族(tag)', '家族键: full/missing', 'missing 键', '类级账: partial+missing', 'README 位']));
D.push('|---|---|---|---|---|---|');
DCODE_ORDER.forEach(function (c) {
  var d = DMAP[c];
  if (d.keyFull + d.keyMiss.length + d.clsP + d.clsM === 0) return;
  D.push(tableRow([
    c,
    d.tags.join('、') || '—',
    String(d.keyFull) + '/' + String(d.keyMiss.length),
    d.keyMiss.length ? d.keyMiss.join('+') : '—',
    String(d.clsP) + '+' + String(d.clsM),
    d.readmes.join('、') || '—'
  ]));
});

var dateStr = String(new (J('java.util.Date'))());
var HEAD =
  '# demo240 能力覆盖率看板\n\n' +
  '> 由 `probes/coverage_report.js` 生成（' + dateStr + '），幂等重写勿手 edit；状态源=`logs/_demo_classes.txt`+`logs/_demo_feature_scan.txt`+lib/engine 源码。\n' +
  '> 分类：**full**=类名在引擎源码构造/字符串命中；**partial**=部分 token 命中；**missing**=零命中。\n' +
  '> 圈定的不追目标（noncore）：com.fr.esd.*、com.fr.plugin.cloud.*、com.fr.widgettheme.*（插件配置类）。\n' +
  '> 不追范围（2026-11-05 拍板终口径="基本授权有的内容都可以做；额外收费的不做；移动端不做"）：① FVS 大屏付费插件扩展图族 14 包（kpi/meter/wisdomtree/globe/catalog/fluid/time/particlecounter/multidata/map.groupmap/column.arccolumn/column.carouselbar/column.shapecolumn/pie.carouselpie）——类物理定义于 plugin-com.fr.plugin.bigScreen.v11 fr-plugin-extendedCharts jar（缺口账 36 类命中；核心 jar 零交叉）；② com.fr.extended.chart.*（付费扩展图族配套数据集基建，类虽在核心 jar 但消费者全在付费插件）；③ 移动端 com.fr.report.mobile.* + com.fr.form.ui.mobile.*（4 类；MobileReg=手机号校验属基本功能不在其列）。\n\n';

var doc = HEAD + A.join('\n') + '\n\n' + B.join('\n') + '\n\n' + C.join('\n') + '\n\n' + D.join('\n') + '\n';

var Paths = J('java.nio.file.Paths');
var Charsets = J('java.nio.charset.StandardCharsets');
J('java.nio.file.Files').write(Paths.get(ROOT + '/docs/architecture/coverage.md'),
  doc.getBytes(Charsets.UTF_8));

print('COVERAGE: missing=' + MISSING.length + ' partial=' + PARTIAL.length +
  ' ledgerTotal=' + cls.length + ' noncore=' + SKIP_FURTHER);
// r17 对齐统计：漏账残留数（无 README 批定义背书的类；口径=missing+partial 67，full 类不在此对齐范围）
var gaps = ledger.filter(function (r) { return r.cat === 'missing' || r.cat === 'partial'; });
var unacc = gaps.filter(function (r) { return batchOf(r.fq).indexOf('漏账') >= 0; }).length;
print('ALIGN: batchAttributed=' + (gaps.length - unacc) + ' unattributed(漏账)=' + unacc + ' of ' + gaps.length + ' (missing+partial)');
print('TOP10 GAPS:');
MISSING.slice(0, 10).forEach(function (r) { print('  ' + r.n + '  ' + r.fq); });
System.exit(0);
