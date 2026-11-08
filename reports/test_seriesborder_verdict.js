// 定性裁定专用：seriesBorder 高对比度（红/粗/不透明）——若仍无可见框则判引擎墙
var SPEC = {
  outName: '能力自检_border裁定',
  allowNoFormula: true,
  IR: { sheets: [{ name: 'sheet1', widthsPt: [400], blocks: [
    { type: 'title', text: 'seriesBorder 裁定', span: 1, heightPt: 30 },
    { type: 'header', columns: [{ label: '线', name: 'line', type: 'text' }], heightPt: 20 },
    { type: 'detail', dataset: 'd', columns: [{ name: 'line', type: 'text' }], heightPt: 20 },
    { type: 'chart', kind: 'vbar', dataset: 'd', category: 'line', value: 'n', span: 1, heightPt: 320,
      seriesBorder: { color: 0xFF0000, style: 1 } }
  ] }], datasets: [{ name: 'd', columns: [{ name: 'line', type: 'text' }, { name: 'n', type: 'number' }], rows: [['A', 100], ['B', 200]] }] }
};
