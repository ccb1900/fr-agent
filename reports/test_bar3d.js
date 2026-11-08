// test_bar3d.js — bar3d 3D 柱形图载体（2026-11-08，legacy 图族闭环实验）
var SPEC = {
  outName: 'bar3d_selftest',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [150, 250, 260, 310],
      blocks: [
        { type: 'cells', heightPt: 34, items: [
          { c: 0, span: 4, text: 'bar3d 3D 柱形图自检', st: { bold: true, sizePt: 12, color: 0x000000 } }
        ] },
        { type: 'space', heightPt: 8 },
        { type: 'chart', kind: 'bar3d', span: 4, dataset: 'ds3d', category: '机型', values: ['产量'], heightPt: 340, title: '3D 柱形图' }
      ]
    }],
    datasets: [{
      name: 'ds3d',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }],
      rows: [['A线', 120], ['B线', 150], ['C线', 90], ['D线', 200]]
    }]
  }
};
