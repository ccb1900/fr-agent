// reports/test_total_agg.js — P1 载体：合计行非 sum 聚合（sumCols 逐格 fn）
//   计划列=AVERAGE(B3) → (80+40)/2=60；完成列=COUNT(C3) → 2；第三列=MIN(D3) → 35。
var SPEC = {
  outName: '能力自检_合计聚合',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 120, 120, 120],
      blocks: [
        { type: 'title', text: '合计非 sum 聚合（P1）', span: 4, heightPt: 30 },
        { type: 'header', columns: [
          { label: '生产线', name: 'line', type: 'text' },
          { label: '计划', name: 'planned', type: 'number', format: '#,##0' },
          { label: '完成', name: 'done', type: 'number', format: '#,##0' },
          { label: '最低', name: 'low', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'line', type: 'text' },
          { name: 'planned', type: 'number', format: '#,##0' },
          { name: 'done', type: 'number', format: '#,##0' },
          { name: 'low', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'total', label: '合计', span: 1, sumCols: [
          { col: 1, fn: 'avg', format: '#,##0.0' },
          { col: 2, fn: 'count', format: '#,##0' },
          { col: 3, fn: 'min', format: '#,##0' }
        ], heightPt: 24 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'line', type: 'text' }, { name: 'planned', type: 'number' }, { name: 'done', type: 'number' }, { name: 'low', type: 'number' }],
      rows: [['A线', 80, 70, 50], ['B线', 40, 35, 35]]
    }]
  }
};
