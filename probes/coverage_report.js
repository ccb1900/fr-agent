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
// FVS（FineVis 大屏）扩展图族不追（2026-11-05 用户拍板"涉及 FVS 的不做"）：
//   判据=类物理定义于 FVS 插件 plugin-com.fr.plugin.bigScreen.v11-4.6.16 / fr-plugin-extendedCharts-4.6.16.jar
//   （缺口账 108 类中 36 类命中，全部在下列包内；14 个包在 fine-* 核心 jar 零交叉，常规图表 gauge/heatmap/map 全在核心不受影响）
var NONCORE_FVS = /^com\.fr\.plugin\.chart\.(kpi|meter|wisdomtree|globe|catalog|fluid|time|particlecounter|multidata)\.|^com\.fr\.plugin\.chart\.(map\.groupmap|column\.(arccolumn|carouselbar|shapecolumn)|pie\.carouselpie)\./;
var SKIP_FURTHER = 0;
var ledger = cls.map(function (c) {
  var cat;
  if (NONCORE.test(c.fq)) { cat = 'noncore'; SKIP_FURTHER++; }
  else if (NONCORE_FVS.test(c.fq)) { cat = 'noncore'; SKIP_FURTHER++; }
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
var A = [], B = [], C = [];
A.push('## A. 缺口总账（demo 类级，按演示库 240 张 cpt 引用频次倒序；也是批计划排期依据）');
A.push('');
A.push(tableRow(['demo类', '频次', '状态', '参考批次']));
A.push('|---|---|---|---|');
// 批归属索引：家→键短名全等先查，再按全限定名先查
var IDX = {};
FAMILIES.forEach(function (f) { f.keys.forEach(function (k) { IDX[String(k).split('.').pop()] = f; }); });
function batchOf(fq) {
  var fam = FAMILIES.filter(function (f) { return f.keys.indexOf(fq) >= 0; })[0]
    || IDX[String(fq).split('.').pop()];
  return fam ? fam.batch : '(漏账：批排期时人工归入)';
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

var dateStr = String(new (J('java.util.Date'))());
var HEAD =
  '# demo240 能力覆盖率看板\n\n' +
  '> 由 `probes/coverage_report.js` 生成（' + dateStr + '），幂等重写勿手 edit；状态源=`logs/_demo_classes.txt`+`logs/_demo_feature_scan.txt`+lib/engine 源码。\n' +
  '> 分类：**full**=类名在引擎源码构造/字符串命中；**partial**=部分 token 命中；**missing**=零命中。\n' +
  '> 圈定的不追目标（noncore）：com.fr.esd.*、com.fr.plugin.cloud.*、com.fr.widgettheme.*（插件配置类）。\n' +
  '> FVS 不追（2026-11-05 拍板"涉及 FVS 的不做"）：FineVis 大屏扩展图族 14 包（kpi/meter/wisdomtree/globe/catalog/fluid/time/particlecounter/multidata/map.groupmap/column.arccolumn/column.carouselbar/column.shapecolumn/pie.carouselpie），判据=类物理定义于 plugin-com.fr.plugin.bigScreen.v11 fr-plugin-extendedCharts jar（缺口账 36 类命中；核心 jar 零交叉）。\n\n';

var doc = HEAD + A.join('\n') + '\n\n' + B.join('\n') + '\n\n' + C.join('\n') + '\n';

var Paths = J('java.nio.file.Paths');
var Charsets = J('java.nio.charset.StandardCharsets');
J('java.nio.file.Files').write(Paths.get(ROOT + '/docs/architecture/coverage.md'),
  doc.getBytes(Charsets.UTF_8));

print('COVERAGE: missing=' + MISSING.length + ' partial=' + PARTIAL.length +
  ' ledgerTotal=' + cls.length + ' noncore=' + SKIP_FURTHER);
print('TOP10 GAPS:');
MISSING.slice(0, 10).forEach(function (r) { print('  ' + r.n + '  ' + r.fq); });
System.exit(0);
