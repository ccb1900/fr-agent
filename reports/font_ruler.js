// reports/font_ruler.js — 字号标尺：attr 20 与 attr 40 两行数字，渲染后墨高px 正面定 size 单位
// 跑法：$env:REPORT_SPEC='reports/font_ruler.js'; run.ps1 -Script make_api.js
// 验收：PNG 里两带数字的墨高比应=2:1；绝对 pt 由"列宽总和/PNG宽"定尺度后反推，
//       用来判定 size attr 与 pt 的换算是 ÷4 还是 ÷8（用户 6.5/4.5 事故的正名实验）
var SPEC = {
  outName: 'font_ruler',
  allowNoFormula: true,
  dsName: 'ds1',
  connections: [],
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [300, 300],
      paper: { width: Math.round(654 * 12700), height: Math.round(400 * 12700), top: 190500, left: 190500, bottom: 190500, right: 190500 },
      blocks: [
        { type: 'cells', heightPt: 60, items: [{ c: 0, span: 1, text: 'A档 网页16px(12pt) 2026-09-13 12:34 样例', st: { sizePt: 12, align: 2, bold: false } }] },
        { type: 'cells', heightPt: 60, items: [{ c: 0, span: 1, text: 'B档 网页14px(10.5pt) 2026-09-13 12:34 样例', st: { sizePt: 10.5, align: 2, bold: false } }] },
        { type: 'cells', heightPt: 60, items: [{ c: 0, span: 1, text: 'C档 网页12px(9pt) 2026-09-13 12:34 样例', st: { sizePt: 9, align: 2, bold: false } }] },
        { type: 'cells', heightPt: 60, items: [{ c: 0, span: 1, text: '表头示例 14pt 加粗', st: { sizePt: 14, align: 2, bold: true } }] }
      ]
    }],
    datasets: [{ name: 'ds1', columns: [{ name: 'x' }], rows: [['1']] }]
  }
};
