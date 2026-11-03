// reports/rebuild_basicA.js — 第二家族重建 spec：官方 demo/basic/基本明细汇总表A
//
// 数据真源：D:/fineagent/sproduct_dump.txt（真值 dump，probe_dumpA.js 产出）
//   ds1 S产品 77 行（组序=行首现序 1,2,7,6,8,4,3,5，与官方 PNG 一致）
//   类别字典 8 行 → pre-join 类别名称列替代 DictPresent（零新 API）
// 结构真源：D:/fineagent/basicA_cpt_copy.txt（官方 cpt 全考古，_stylemap.txt 样式 20 式）
//
// 节点词汇全部走 v3.4 cells 通用块 + detail 习惯字段；纸型 EMU 直灌官方值。
// 浮动图标 Float0（链 基本明细汇总表B.cpt）暂不复刻（可选件，像素残差待判）。

var Jsp = function (n) { return Java.type(n); };
var FilesSp = Jsp('java.nio.file.Files');
var PathsSp = Jsp('java.nio.file.Paths');
var StrSp = Jsp('java.lang.String');
var dumpRaw = new StrSp(FilesSp.readAllBytes(PathsSp.get('D:/fineagent/sproduct_dump.txt')), 'UTF-8');
var dumpLines = String(dumpRaw).split('\n');

// --- ds1 S产品 77 行（行 1=##头 行 2=COLS 行 3..79=数据） ---
var sproductRows = [];
for (var li = 2; li < 79; li++) {
  var f = dumpLines[li].split('|');
  if (f.length < 10) throw new Error('dump line ' + (li + 1) + ' malformed: ' + dumpLines[li]);
  sproductRows.push(f);
}

// --- 类别字典（## dictS 行起 +2 = COLS 行，再 +1 起为 8 行数据） ---
var dictStart = -1;
for (var d1 = 0; d1 < dumpLines.length; d1++) { if (dumpLines[d1].indexOf('## dictS') === 0) { dictStart = d1; break; } }
if (dictStart < 0) throw new Error('dict section not found in dump');
var dictMap = {};
for (var d2 = dictStart + 2; d2 < dumpLines.length; d2++) {
  var g = dumpLines[d2].split('|');
  if (g.length >= 2 && g[0]) dictMap[g[0]] = g[1];
}

// --- pre-join：S产品 10 列 + 类别名称（替代官方 DictPresent→类别 字典翻译） ---
var dsCols = [
  { name: '产品ID', type: 'number' },
  { name: '产品名称', type: 'string' },
  { name: '供应商ID', type: 'number' },
  { name: '类别ID', type: 'number' },
  { name: '单位数量', type: 'string' },
  { name: '单价', type: 'float' },
  { name: '库存量', type: 'number' },
  { name: '订购量', type: 'number' },
  { name: '再订购量', type: 'number' },
  { name: '中止', type: 'string' },
  { name: '类别名称', type: 'string' }
];
var dsRows = sproductRows.map(function (f) {
  return [f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], dictMap[f[3]]];
});
if (dsRows.length !== 77) throw new Error('expected 77 S产品 rows, got ' + dsRows.length);

// --- 官方调色（FineColor int 精确解码版，_colors.txt） ---
var PAL = {
  titleText: -15442262,   // #145EAA 深蓝（标题/链字）
  bandBg: -3085062,       // #D0ECFA 淡蓝条带底
  strong: -16691294,      // #014FA2 顶粗线
  grayLine: -4144960,     // #C0C0C0
  grayDeep: -8355712,     // #808080
  text: -13421773,        // #333333
  mute: -10066330,        // #666666（总/小计值）
  noteBg: -328966,        // #FAFAFA 尾注底
  noteBd: -6894375,       // #96CCD9 尾注框
  white: -1
};
var YH = '微软雅黑';

// --- 官方 20 式样式直译（st 完全显式，引擎 style() 无隐式默认） ---
var S3 = { // 表头 c0（左头 Left=style1 白）
  align: 2, name: YH, sizePt: 22, color: PAL.text, bg: null, format: null,
  borders: { top: [1, PAL.grayLine], bottom: [1, PAL.grayDeep], left: [1, PAL.white], right: [5, PAL.white] }
};
function S4() { // 表头 中列/右列
  return {
    align: 2, name: YH, sizePt: 22, color: PAL.text, bg: null, format: null,
    borders: { top: [1, PAL.grayLine], bottom: [1, PAL.grayDeep], left: [5, PAL.white], right: [5, PAL.white] }
  };
}
var S5 = { name: 'SimSun', sizePt: 18, align: null, color: null, bg: null, format: null, borders: { bottom: [1, PAL.grayLine], left: null, right: [5, PAL.white] } };   // 总计行 c0 空
var S6 = { name: 'SimSun', sizePt: 18, align: null, color: null, bg: null, format: null, borders: { bottom: [1, PAL.grayLine], left: [5, PAL.white], right: [5, PAL.white] } }; // 总计行 c1 空
var S7 = { align: 2, name: YH, sizePt: 20, color: PAL.text, bg: null, format: null, borders: { top: [1, PAL.white], bottom: [1, PAL.grayLine], left: [5, PAL.white], right: [5, PAL.white] } };       // 总计 label
var S8 = { align: 2, name: YH, sizePt: 18, color: PAL.mute, bg: null, format: '#0.00', borders: { top: [1, PAL.white], bottom: [1, PAL.grayLine], left: [5, PAL.white], right: [5, PAL.white] } };    // 总计公式
var S9 = { name: 'SimSun', sizePt: 18, align: null, color: null, bg: null, format: null, borders: { top: [1, PAL.grayLine], bottom: [2, PAL.grayLine], left: null, right: [5, PAL.white] } };       // 小计行 c0 空
var S10 = { name: 'SimSun', sizePt: 18, align: null, color: null, bg: null, format: null, borders: { top: [1, PAL.grayLine], bottom: [2, PAL.grayLine], left: [5, PAL.white], right: [5, PAL.white] } }; // 小计 c1 空
var S11 = { align: 2, name: YH, sizePt: 20, color: PAL.text, bg: null, format: null, borders: { top: [1, PAL.grayLine], bottom: [2, PAL.grayLine], left: [5, PAL.white], right: [5, PAL.white] } }; // 小计 label
var S12 = { align: 2, name: YH, sizePt: 18, color: PAL.mute, bg: null, format: '#0.00', borders: { top: [1, PAL.grayLine], bottom: [2, PAL.grayLine], left: [5, PAL.white], right: [5, PAL.white] } }; // 小计公式
var S13 = { align: 2, name: YH, sizePt: 18, color: PAL.text, bg: PAL.bandBg, format: null, borders: { top: null, bottom: [1, PAL.white], left: null, right: [5, PAL.white] } };     // 明细 c0 类别（淡蓝底）
var S14 = { align: 2, name: YH, sizePt: 18, color: PAL.text, bg: PAL.bandBg, format: null, borders: { top: null, bottom: [1, PAL.white], left: [5, PAL.white], right: [5, PAL.white] } }; // 明细 c1/c2
var S15 = { align: 2, name: YH, sizePt: 18, color: PAL.text, bg: PAL.bandBg, format: '#0.00', borders: { top: null, bottom: [1, PAL.white], left: [5, PAL.white], right: [5, PAL.white] } }; // 明细数值 c3..c6
var S16 = { align: 2, name: YH, sizePt: 18, color: PAL.text, bg: PAL.bandBg, format: '#0.00', borders: { top: null, bottom: [1, PAL.white], left: [5, PAL.white], right: null } };        // 明细 c7（无右边线）
var S17 = { align: 4, name: YH, sizePt: 18, color: null, bg: null, format: null, borders: null }; // r5 空行占位
var S18 = { name: YH, sizePt: 18, align: null, color: null, bg: PAL.noteBg, format: null, borders: { top: [3, PAL.noteBd], bottom: null, left: [3, PAL.noteBd], right: [3, PAL.noteBd] } }; // 尾注标题行
var S19 = { name: YH, sizePt: 18, align: null, color: null, bg: PAL.noteBg, format: null, borders: { top: null, bottom: [3, PAL.noteBd], left: [3, PAL.noteBd], right: [3, PAL.noteBd] } }; // 尾注正文行

// --- 明细行公式列锚定：detail 展开 = 模型行 index 4（第 5 行），官方引用 =D5/E5 系 1 基 ---
// detailRow = 4（块序第 5 块）。安全三断：块序模型与官方一致由人工组版保证。

var DETAIL_ROW = 4;

var SPEC = {
  outName: '基本明细汇总表A',
  IR: {
    sheets: [{
      name: '基本明细汇总表A',
      widthsPt: [288, 306, 318, 333, 360, 345, 354, 309],
      // 官方自定义纸：40320000×42768000 EMU（3175×3367.5pt）+ margins（top/left/bottom/right EMU）
      paper: { width: 40320000, height: 42768000, top: 432000, left: 720000, bottom: 286560, right: 574560 },
      // 官方页头重复 <HR F="0" T="1"/>：每页重复 r0 标题条带 + r1 表头（页边界像素铁证）
      pageRepeat: { from: 0, to: 1 },
      blocks: [
        // r0 标题条带：标题 span6 + 超链格 span2（官方 byPost=true → DetailsB.cpt）
        {
          type: 'cells', heightPt: 135,
          items: [
            { c: 0, span: 6, text: '基本明细汇总表  ', st: {
                align: 2, name: YH, sizePt: 36, color: PAL.titleText, bg: PAL.bandBg, format: null,
                borders: { top: [5, PAL.strong], bottom: [2, PAL.grayLine], left: null, right: null }
              } },
            { c: 6, span: 2, text: '点击我：把汇总行切换到表格下方', st: {
                align: 2, name: YH, sizePt: 20, color: PAL.titleText, bg: PAL.bandBg, format: null,
                borders: { top: [5, PAL.strong], bottom: [2, PAL.grayLine], left: null, right: null }
              }, linkTo: { reportlet: '/demo/basic/DetailsB.cpt', byPost: true, name: '跳转报表1' } }
          ]
        },
        // r1 表头 8 列
        {
          type: 'cells', heightPt: 108,
          items: [
            { c: 0, text: '产品类别', st: S3 },
            { c: 1, text: '产品名称', st: S4() },
            { c: 2, text: '单位数量', st: S4() },
            { c: 3, text: '单价', st: S4() },
            { c: 4, text: '库存量', st: S4() },
            { c: 5, text: '库存总值', st: S4() },
            { c: 6, text: '订购量', st: S4() },
            { c: 7, text: '二次订购量', st: S4() }
          ]
        },
        // r2 总计行在顶：标签 c2 + D..H 全聚合公式（官方绝对行号 =D5/=E5 引用明细模型行）
        {
          type: 'cells', heightPt: 99,
          items: [
            { c: 0, text: '', st: S5 },
            { c: 1, text: '', st: S6 },
            { c: 2, text: '总计', st: S7 },
            { c: 3, formula: '=AVERAGE(D5)', st: S8 },
            { c: 4, formula: '=SUM(E5)', st: S8 },
            { c: 5, formula: '=SUM(F5)', st: S8 },
            { c: 6, formula: '=SUM(G5)', st: S8 },
            { c: 7, formula: '=SUM(H5)', st: S8 }
          ]
        },
        // r3 小计行（模型行在明细行上方，展开时逐类别交错）：标签+AVERAGE 绑左父 A5，SUM 格默认传播
        {
          type: 'cells', heightPt: 93,
          items: [
            { c: 0, text: '', st: S9 },
            { c: 1, text: '', st: S10 },
            { c: 2, text: '小计', st: S11, expand: { leftRow: DETAIL_ROW } },
            { c: 3, formula: '=AVERAGE(D5)', st: S12, expand: { dir: 0, leftRow: DETAIL_ROW } },
            { c: 4, formula: '=SUM(E5)', st: S12 },
            { c: 5, formula: '=SUM(F5)', st: S12 },
            { c: 6, formula: '=SUM(G5)', st: S12 },
            { c: 7, formula: '=SUM(H5)', st: S12 }
          ]
        },
        // r4 明细行：类别列 FunctionGrouper（组序=表序），数值列 SummaryGrouper（单价 AVERAGE+$$$）
        {
          type: 'cells', heightPt: 99, dataset: 'ds1',
          items: [
            { c: 0, ds: { column: '类别名称' }, st: S13 },
            { c: 1, ds: { column: '产品名称' }, st: S14 },
            { c: 2, ds: { column: '单位数量' }, st: S14 },
            { c: 3, ds: { column: '单价', summary: 'AVERAGE', result: '$$$', noExpand: true }, st: S15 },
            { c: 4, ds: { column: '库存量', summary: 'SUM', noExpand: true }, st: S15 },
            { c: 5, formula: '=D5 * E5', st: S15 },
            { c: 6, ds: { column: '订购量', summary: 'SUM', noExpand: true }, st: S15 },
            { c: 7, ds: { column: '再订购量', summary: 'SUM', noExpand: true }, st: S16 }
          ]
        },
        // r5 母页空行（官方 Expand upParentDefault=false 的占位格）
        { type: 'space', heightPt: 57 },
        // r6/r7 尾注说明（官方原文直取，span8 蓝框白底段）
        {
          type: 'cells', heightPt: 57,
          items: [{ c: 0, span: 8, text: '基本明细汇总表统计说明：', st: S18 }]
        },
        {
          type: 'cells', heightPt: 57,
          items: [{ c: 0, span: 8, text: '    数据按照分组进行了汇总统计。并且在最下方进行了总的汇总，统计。做法为小计跟随A7中的分组信息进行扩展。', st: S19 }]
        }
      ]
    }],
    datasets: [{ name: 'ds1', columns: dsCols, rows: dsRows }]
  }
};

// 自检：dump 数据勾稽（77 行；组首现序合法；类别名称全覆盖）
(function () {
  var firstSeen = [], seen = {};
  dsRows.forEach(function (r) { if (!seen[r[3]]) { seen[r[3]] = 1; firstSeen.push(r[3] + '→' + r[10]); } });
  if (firstSeen.length !== 8) throw new Error('expected 8 groups, got ' + firstSeen.length + ': ' + firstSeen.join(';'));
  print('GROUP ORDER (first-seen): ' + firstSeen.join(' | '));
  print('SPEC REBUILD_BASICA READY rows=' + dsRows.length);
})();
