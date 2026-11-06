// reports/test_total_ratio.js — P1 载体：合计行 ratio（SUM(num)/SUM(den)）
//   计划/完成 = (80+40)/(70+35) = 120/105 = 1.14；格式 0.00。
var SPEC = {
  outName: '能力自检_合计比率',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 120, 120],
      blocks: [
        { type: 'title', text: '合计 ratio 聚合（P1）', span: 3, heightPt: 30 },
        { type: 'header', columns: [
          { label: '生产线', name: 'line', type: 'text' },
          { label: '计划', name: 'planned', type: 'number', format: '0.00' },
          { label: '完成', name: 'done', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'line', type: 'text' },
          { name: 'planned', type: 'number', format: '#,##0' },
          { name: 'done', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'total', label: '计划/完成', span: 1, aggregate: { fn: 'ratio', num: 1, den: 2 }, heightPt: 24 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'line', type: 'text' }, { name: 'planned', type: 'number' }, { name: 'done', type: 'number' }],
      rows: [['A线', 80, 70], ['B线', 40, 35]]
    }]
  }
};
