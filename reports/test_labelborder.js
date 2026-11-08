// reports/test_labelborder.js — 标签边框新能力判别载体（2026-11-08）
//   形态：官方 268/268 一手（labelDetail > AttrBorderWithShape，lineStyle=0/1，shapeType=RectangularMarker）。
//   判别：vbar 标签（已证可渲染）配红边框 style=1 → PNG 出现红色像素（标签框）即达成。
var SPEC = {
  outName: '能力自检_标签边框',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [700],
      blocks: [
        { type: 'cells', heightPt: 28, items: [{ c: 0, span: 1, text: 'labelBorder visual: red style=1' }] },
        { type: 'chart', kind: 'vbar', dataset: 'ds', category: '机型', values: ['产量'], heightPt: 300,
          label: { enable: true, position: 0, border: { color: 0xFF0000, style: 1, shape: 'rect' } } }
      ]
    }],
    datasets: [{
      name: 'ds',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }],
      rows: [['A线', 120], ['B线', 200], ['C线', 160], ['D线', 80]]
    }]
  }
};
