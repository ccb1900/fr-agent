// reports/test_multisheet.js — A1 载体：多 Sheet（object 每 sheet 独立游标）
//   2026-11-06：旧版 object si>0 直接 throw("预留 v3.2")，实测状态已隔离；IR 接受后应产出两个 <Report> 节点。
var SPEC = {
  outName: '能力自检_多Sheet',
  allowNoFormula: true,
  IR: {
    sheets: [
      {
        name: '汇总', widthsPt: [160, 120, 120],
        blocks: [
          { type: 'title', text: '多 Sheet — 汇总页', span: 3, heightPt: 32 },
          { type: 'header', columns: [
            { label: '生产线', name: 'line', type: 'text' },
            { label: '计划', name: 'planned', type: 'number', format: '#,##0' },
            { label: '完成', name: 'done', type: 'number', format: '#,##0' }
          ], heightPt: 24 },
          { type: 'detail', dataset: 'd', columns: [
            { name: 'line', type: 'text' },
            { name: 'planned', type: 'number', format: '#,##0' },
            { name: 'done', type: 'number', format: '#,##0' }
          ], heightPt: 24 },
          { type: 'total', label: '合计', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 24 }
        ]
      },
      {
        name: '明细', widthsPt: [160, 120, 120],
        blocks: [
          { type: 'title', text: '多 Sheet — 明细页', span: 3, heightPt: 32 },
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
      }
    ],
    datasets: [{
      name: 'd',
      columns: [{ name: 'line', type: 'text' }, { name: 'planned', type: 'number' }, { name: 'done', type: 'number' }],
      rows: [['A线', 1200, 1100], ['B线', 1500, 1400]]
    }]
  }
};
