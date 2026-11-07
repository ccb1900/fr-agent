// probes/probe_mapdeco.js — 批I 地图族 R0（阶段4 首靶族，probes 先行纪律：先证构造+序列化，渲染 PNG 随附）
//   靶类（coverage 缺口锚点，API 面=probes/_probe_template.js 一手；语料=demo/chart/按钮式图表切换.cpt、
//   demo/analytics/financial/资产负债联动图表.cpt 一手）：
//     com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat   — 地图 tooltip 类目名格式槽（首靶）
//     com.fr.plugin.chart.base.format.AttrTooltipMapValueFormat   — 地图 tooltip 值格式槽
//     com.fr.plugin.chart.map.attr.AttrMapLabel                    — 地图专属标签条件件（area/point label）
//     com.fr.plugin.chart.map.attr.AttrMapTooltip                  — 地图专属提示条件件（area/point/line tooltip）
//     com.fr.chart.web.ChartHyperRelateCellLink                    — 图表热链（NameJavaScriptGroup 宿主）
//     com.fr.plugin.chart.bubble.attr.VanChartAttrBubble           — 气泡属性（min/max/shadow/displayNegative）
//   本探针：①Ir.validate 闸 ②Obj.build+applyDeco 真构造 ③wb.export 后逐类 XML 断言 ④真引擎渲染 PNG。
//   跑法：run.ps1 -Script probes/probe_mapdeco.js（按管线惯例杀 java、需 FR 引擎）。
//   退出码：断言全过=0，有 FAIL=1（渲染失败单独计 RENDER 级，不降级 XML 结论）。
var J = function (n) { return Java.type(n); };
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
// boot 序列照抄 probe_heatmap（EntityDao/图表 XML 绑定需 ConfigurationActivator/ChartBaseActivator 先启）
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(J('java.lang.Class').forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
load(ROOT + '/runtime/paths.js');
load(Paths.lib('object.js'));
load(Paths.lib('ir.js'));
var FAILS = 0;
function check(name, cond, extra) { if (cond) { print('MAPDECO PASS: ' + name); } else { FAILS++; print('MAPDECO FAIL: ' + name + (extra ? ' :: ' + extra : '')); } }

var DS = { name: 'd', columns: [{ name: 'province', type: 'text' }, { name: 'amount', type: 'number' }], rows: [['广东省', 280000], ['四川省', 90000]] };
// sheet 结构照官方 IR 契约（title 打头 + header + detail；chart 块追加其后）——test_vmap 同构
var IR = { sheets: [{ name: 'sheet1', widthsPt: [160, 120, 120, 120], blocks: [
  { type: 'title', text: '地图族探针（批I）', span: 4, heightPt: 30 },
  { type: 'header', columns: [
    { label: '省份', name: 'province', type: 'text' },
    { label: '销售额', name: 'amount', type: 'number', format: '#,##0' }], heightPt: 24 },
  { type: 'detail', dataset: 'd', columns: [
    { name: 'province', type: 'text' },
    { name: 'amount', type: 'number', format: '#,##0' }], heightPt: 24 },
  { type: 'chart', kind: 'vmap', dataset: 'd', category: 'province', value: 'amount', span: 4, heightPt: 360,
    tooltip: { muti: true, formats: { category: true, value: '#,##0' } },
    mapLabel: { areaLabel: { enable: true, fontPt: 12, color: 0x333333 }, pointLabel: { enable: true } },
    mapTooltip: { areaTooltip: { muti: true, format: '#,##0' }, pointTooltip: { muti: false } },
    hotHyperLink: { target: 'area', items: [{ name: '联动单元格', relateCCName: 'cc1', itemName: '省份', title: '跳转', width: 600, height: 400 }] }
} ] }], datasets: [DS] };
var irErrs = Ir.validate(IR);
check('IR validate clean (map family)', irErrs.length === 0, JSON.stringify(irErrs).substring(0, 300));
var built = null, decoN = -1;
try {
  built = Obj.build(IR);
  decoN = built.applyDeco();
  check('Obj.build + applyDeco', decoN >= 1, 'decoN=' + decoN);
} catch (e) { check('Obj.build + applyDeco', false, '' + e); }
// vbubble：bubble 属性件
var IR2 = { sheets: [{ name: 'sheet1', widthsPt: [160, 120, 120, 120], blocks: [
  { type: 'title', text: '气泡属性探针（批I）', span: 4, heightPt: 30 },
  { type: 'header', columns: [
    { label: '省份', name: 'province', type: 'text' },
    { label: '销售额', name: 'amount', type: 'number', format: '#,##0' }], heightPt: 24 },
  { type: 'detail', dataset: 'd', columns: [
    { name: 'province', type: 'text' },
    { name: 'amount', type: 'number', format: '#,##0' }], heightPt: 24 },
  { type: 'chart', kind: 'vbubble', dataset: 'd', x: 'amount', y: 'amount', span: 4, heightPt: 300,
    bubble: { minDiameter: 5, maxDiameter: 30, shadow: false, displayNegative: false } } ] }], datasets: [DS] };
var irErrs2 = Ir.validate(IR2);
check('IR validate clean (bubble)', irErrs2.length === 0, JSON.stringify(irErrs2).substring(0, 300));
var built2 = null;
try {
  built2 = Obj.build(IR2);
  built2.applyDeco();
  check('Obj.build bubble', true);
} catch (e) { check('Obj.build bubble', false, '' + e); }
// kind 闸负控：mapLabel 挂 vbar 必须被 IR 结构化拒（不静默丢）
var IRBAD = { sheets: [{ name: 'sheet1', widthsPt: [160, 120, 120, 120], blocks: [
  { type: 'title', text: '负控', span: 4, heightPt: 30 },
  { type: 'header', columns: [{ label: '省份', name: 'province', type: 'text' }, { label: '销售额', name: 'amount', type: 'number' }], heightPt: 24 },
  { type: 'detail', dataset: 'd', columns: [{ name: 'province', type: 'text' }, { name: 'amount', type: 'number' }], heightPt: 24 },
  { type: 'chart', kind: 'vbar', dataset: 'd', category: 'province', value: 'amount', span: 4, heightPt: 200,
    mapLabel: { areaLabel: { enable: true } } } ] }], datasets: [DS] };
var badErrs = Ir.validate(IRBAD);
check('IR refuses mapLabel on vbar (structured reject)', badErrs.length > 0 && JSON.stringify(badErrs).indexOf('INVALID_SHAPE') >= 0, JSON.stringify(badErrs).substring(0, 200));
// 热链缺 relateCCName 负控
var IRBAD2 = { sheets: [{ name: 'sheet1', widthsPt: [160, 120, 120, 120], blocks: [
  { type: 'title', text: '负控', span: 4, heightPt: 30 },
  { type: 'header', columns: [{ label: '省份', name: 'province', type: 'text' }, { label: '销售额', name: 'amount', type: 'number' }], heightPt: 24 },
  { type: 'detail', dataset: 'd', columns: [{ name: 'province', type: 'text' }, { name: 'amount', type: 'number' }], heightPt: 24 },
  { type: 'chart', kind: 'vmap', dataset: 'd', category: 'province', value: 'amount', span: 4, heightPt: 200,
    hotHyperLink: { target: 'area', items: [{ name: 'x' }] } } ] }], datasets: [DS] };
var badErrs2 = Ir.validate(IRBAD2);
check('IR requires hotHyperLink relateCCName', badErrs2.length > 0 && JSON.stringify(badErrs2).indexOf('relateCCName') >= 0, JSON.stringify(badErrs2).substring(0, 200));

// XML 断言（真引擎自序列化）
if (built) {
  try {
    var cptPath = ROOT + '/logs/_mapdeco_probe.cpt';
    var os = new (J('java.io.FileOutputStream'))(cptPath);
    built.wb.export(os); os.close();
    var xmlText = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(cptPath)), 'UTF-8');
    check('XML AttrTooltipAreaNameFormat (category slot subclass)', xmlText.indexOf('com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat') >= 0);
    check('XML AttrTooltipMapValueFormat (value slot subclass)', xmlText.indexOf('com.fr.plugin.chart.base.format.AttrTooltipMapValueFormat') >= 0);
    check('XML AttrMapLabel condition', xmlText.indexOf('com.fr.plugin.chart.map.attr.AttrMapLabel') >= 0);
    check('XML AttrMapLabel areaLabel child', xmlText.indexOf('<areaLabel') >= 0);
    check('XML AttrMapTooltip condition', xmlText.indexOf('com.fr.plugin.chart.map.attr.AttrMapTooltip') >= 0);
    check('XML ChartHyperRelateCellLink hot link', xmlText.indexOf('com.fr.chart.web.ChartHyperRelateCellLink') >= 0);
    check('XML NameJavaScriptGroup host', xmlText.indexOf('NameJavaScriptGroup') >= 0);
    check('XML relateCCName value carried', xmlText.indexOf('cc1') >= 0);
  } catch (e2) { check('export + XML assert', false, '' + e2); }
}
if (built2) {
  try {
    var cptPath2 = ROOT + '/logs/_mapdeco_probe_bubble.cpt';
    var os2 = new (J('java.io.FileOutputStream'))(cptPath2);
    built2.wb.export(os2); os2.close();
    var xmlText2 = new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(cptPath2)), 'UTF-8');
    check('XML VanChartAttrBubble condition', xmlText2.indexOf('com.fr.plugin.chart.bubble.attr.VanChartAttrBubble') >= 0);
  } catch (e3) { check('export bubble + XML assert', false, '' + e3); }
}
// 真引擎渲染（渲染结论仍以 PNG 人工目检为准——AGENTS 交付核对面；manifest rendering 不因此自动升层）
try {
  var rb = built.wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  var osP = new (J('java.io.FileOutputStream'))(ROOT + '/logs/_mapdeco_probe.png');
  new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb);
  osP.close();
  print('MAPDECO RENDER-OK logs/_mapdeco_probe.png');
} catch (e4) { print('MAPDECO RENDER-FAIL: ' + e4); }
print('MAPDECO END fails=' + FAILS);
J('java.lang.System').exit(FAILS ? 1 : 0);
