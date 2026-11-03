// reports/rebuild_first.js — v3.3 重建：官方 demo/NewbieGuide/第一张报表
//
// 目标：IR → 对象图 → FR 自序列化 → 渲染 PNG vs 官方 PNG make_pixel_diff <5%
// 数据真源：frdemo_sales_dump.txt（引擎一手执行官方模板 ds1 同查询 dump，零臆造）
//   华东 5 销售员 × 5 产品行合计勾稽 = 9818（账平）
// 形态考古（first_cpt_copy.txt）：
//   官方 4 声明列横向扩展 = 8 渲染列：A地区(216.2pt) B销售员(204pt) C..G产品(226.77pt×5) H销售总量(226.77pt)
//   行高：标题114(2×57) 表头(斜线)165 明细79.37 总计79.37 空隔57 图表684(12×57)
//   样式：字-13725210 标题字-13945534 表头/角底-1707524 边框统一-13725210 全居中
//         标题32pt(FRSize128) 表头24(96) 正文21(84)；明细A/B用表头样式(加粗+底)，C..H正文(常规无边底)
//   斜线角格文本：'     产品|   销售员|       地区'（IsBackSlash=false）
//   图表：柱形 5 分类(销售员)×5 系列(产品)，图例位4=右，图表格无边框

var PRODUCTS = ['苹果汁', '牛奶', '柳橙汁', '巧克力', '牛肉干'];

// 华东 5 销售员 × 5 产品（dump 原顺序首现序：孙林/金士鹏/张珊/孙阳/袁成洁）
var SALES = [ // [销售员, 苹果汁, 牛奶, 柳橙汁, 巧克力, 牛肉干]
  ['孙林',   140, 431, 176, 333, 789],
  ['金士鹏', 290, 635, 500, 420, 156],
  ['张珊',   300, 324, 340, 318, 289],
  ['孙阳',   120, 644, 540, 256, 562],
  ['袁成洁', 220, 343, 563, 583, 546]
];

// 宽表行：地区 + 销售员 + 5 产品 + 行合计（整数加法勾稽，非臆造）
var WIDE_ROWS = [], CHART_ROWS = [];
for (var i = 0; i < SALES.length; i++) {
  var s = SALES[i];
  var rowTotal = s[1] + s[2] + s[3] + s[4] + s[5];
  WIDE_ROWS.push(['华东', s[0], s[1], s[2], s[3], s[4], s[5], rowTotal]);
  CHART_ROWS.push([s[0], s[1], s[2], s[3], s[4], s[5]]);
}

// 几何真源：官方 XML EMU 直除（226.77165 = 2880000/12700 等）
var W_A = 2743200 / 12700, W_B = 2590800 / 12700, W_PROD = 2880000 / 12700;
var H_TITLE = 723900 * 2 / 12700;      // 标题两行合并 114pt
var H_HEAD = 2095500 / 12700;          // 165pt
var H_ROW = 1008000 / 12700;           // 79.37pt
var H_SPACE = 723900 / 12700;          // 57pt
var H_CHART = 723900 * 12 / 12700;     // 684pt（官方图表格 rs=12 合并 12 个 57pt 行）

var SPEC = {
  outName: '第一张报表',
  IR: {
    palette: { text: -13725210, titleText: -13945534, headerBg: -1707524, border: -13725210 },
    sheets: [{
      name: 'sheet1',
      widthsPt: [W_A, W_B, W_PROD, W_PROD, W_PROD, W_PROD, W_PROD, W_PROD],
      blocks: [
        { type: 'title', text: '地区销售概况', span: 8, heightPt: H_TITLE, sizePt: 32, align: 0 },
        {
          type: 'header', heightPt: H_HEAD,
          corner: { text: '     产品|   销售员|       地区', span: 2, align: 0, sizePt: 24 },
          columns: [
            { label: PRODUCTS[0], align: 0, sizePt: 22 },
            { label: PRODUCTS[1], align: 0, sizePt: 22 },
            { label: PRODUCTS[2], align: 0, sizePt: 22 },
            { label: PRODUCTS[3], align: 0, sizePt: 22 },
            { label: PRODUCTS[4], align: 0, sizePt: 22 },
            { label: '销售总量', align: 0, sizePt: 22 }
          ]
        },
        {
          type: 'detail', dataset: 'ds1', heightPt: H_ROW,
          columns: [
            { name: '地区', type: 'text', align: 0, sizePt: 22, bold: true, bg: -1707524 },
            { name: '销售员', type: 'text', align: 0, sizePt: 22, bold: true, bg: -1707524 },
            { name: PRODUCTS[0], type: 'number', align: 0, format: '', sizePt: 21 },
            { name: PRODUCTS[1], type: 'number', align: 0, format: '', sizePt: 21 },
            { name: PRODUCTS[2], type: 'number', align: 0, format: '', sizePt: 21 },
            { name: PRODUCTS[3], type: 'number', align: 0, format: '', sizePt: 21 },
            { name: PRODUCTS[4], type: 'number', align: 0, format: '', sizePt: 21 },
            { name: '销售总量', type: 'number', align: 0, format: '', sizePt: 21 }
          ]
        },
        {
          type: 'total', heightPt: H_ROW,
          label: '总计：', labelSpan: 2, labelAlign: 0, labelSizePt: 22,
          sumCols: [
            { col: 2, formula: '=SUM(C3)', align: 0, bold: false, bg: null, format: '', sizePt: 21 },
            { col: 3, formula: '=SUM(D3)', align: 0, bold: false, bg: null, format: '', sizePt: 21 },
            { col: 4, formula: '=SUM(E3)', align: 0, bold: false, bg: null, format: '', sizePt: 21 },
            { col: 5, formula: '=SUM(F3)', align: 0, bold: false, bg: null, format: '', sizePt: 21 },
            { col: 6, formula: '=SUM(G3)', align: 0, bold: false, bg: null, format: '', sizePt: 21 },
            { col: 7, formula: '=SUM(H3)', align: 0, bold: false, bg: null, format: '', sizePt: 21 }
          ]
        },
        { type: 'space', heightPt: H_SPACE },
        {
          type: 'chart', kind: 'bar', span: 8, heightPt: H_CHART,
          title: '', dataset: 'ds2', category: '销售员',
          values: PRODUCTS, legend: { position: 4, visible: true, bold: false, fontPt: 12 }, noBorder: true,
          axisY: { min: 0, max: 1000 }, barInterval: 40
        }
      ]
    }],
    datasets: [
      {
        name: 'ds1',
        columns: [
          { name: '地区', type: 'text' }, { name: '销售员', type: 'text' },
          { name: PRODUCTS[0], type: 'number' }, { name: PRODUCTS[1], type: 'number' },
          { name: PRODUCTS[2], type: 'number' }, { name: PRODUCTS[3], type: 'number' },
          { name: PRODUCTS[4], type: 'number' }, { name: '销售总量', type: 'number' }
        ],
        rows: WIDE_ROWS
      },
      {
        name: 'ds2',
        columns: [
          { name: '销售员', type: 'text' },
          { name: PRODUCTS[0], type: 'number' }, { name: PRODUCTS[1], type: 'number' },
          { name: PRODUCTS[2], type: 'number' }, { name: PRODUCTS[3], type: 'number' },
          { name: PRODUCTS[4], type: 'number' }
        ],
        rows: CHART_ROWS
      }
    ]
  }
};
