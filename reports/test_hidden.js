// reports/test_hidden.js — C2 载体：隐藏行列（行高/列宽归零）
//   hideRows:[1] hideCols:[1] → 第 2 行（1 基）与第 2 列在渲染中消失；期望 PNG 只剩 A线/C线 两行与 2 列。
var SPEC = {
  outName: '能力自检_隐藏行列',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 120, 120],
      hideRows: [1],
      hideCols: [1],
      blocks: [
        { type: 'title', text: '隐藏行列（C2）', span: 3, heightPt: 30 },
        { type: 'header', columns: [
          { label: '生产线', name: 'line', type: 'text' },
          { label: '计划', name: 'planned', type: 'number', format: '#,##0' },
          { label: '完成', name: 'done', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'line', type: 'text' },
          { name: 'planned', type: 'number', format: '#,##0' },
          { name: 'done', type: 'number', format: '#,##0' }
        ], heightPt: 24 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'line', type: 'text' }, { name: 'planned', type: 'number' }, { name: 'done', type: 'number' }],
      rows: [['A线', 80, 70], ['B线', 40, 35], ['C线', 150, 140]]
    }]
  }
};
