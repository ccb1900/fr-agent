// test_bubbleattr_min.js — bubbleAttr 隔离臂：官方 15/70+shadow 单图（无标题、test_vanchart 同版式）
var SPEC = {
  outName: 'bar_title',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [150, 250, 260, 310],
      blocks: [
        { type: 'cells', heightPt: 34, items: [
          { c: 0, span: 4, text: 'legacy bar 单图带 title 隔离', st: { bold: true, sizePt: 12, color: 0x000000 } }
        ] },
        { type: 'space', heightPt: 8 },
        { type: 'chart', kind: 'bar', span: 4, dataset: 'dsBub', category: '机型', values: ['产量'], heightPt: 240, title: '测试标题' }
      ]
    }],
    datasets: [{
      name: 'dsBub',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }, { name: '良率', type: 'number' }, { name: '库存', type: 'number' }],
      rows: [['A线', 120, 98, 30], ['B线', 150, 95, 45], ['C线', 90, 99, 20], ['D线', 200, 93, 60]]
    }]
  }
};
