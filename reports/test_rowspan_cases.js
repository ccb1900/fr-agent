// reports/test_rowspan_cases.js — R3-0 回归载体：rowSpan 行游标/IR 校验/后续块不重叠
//   场景：① rowSpan=2 且后续 item 不显式给 r（游标必须按 rowSpan 推进，否则下一 block 覆盖合并区）
//        ② rowSpan=3 显式 r 混合 ③ 后续 detail/total 不与合并区重叠 ④ 单行 cells 零回归
//   期望布局（修复后）：title r0 ｜ cells-A r1-2（rowSpan=2）｜ cells-B r3 ｜ detail r4-5 ｜ total r6
var SPEC = {
  outName: '能力自检_rowSpan游标',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [160, 120, 120],
      blocks: [
        { type: 'title', text: 'rowSpan 游标回归', span: 3, heightPt: 30 },
        // 场景1：rowSpan=2，本块其余 item 无 r → 块应占两行
        { type: 'cells', heightPt: 24, items: [
          { c: 0, rowSpan: 2, text: '生产线', st: { bold: true, align: 0, bg: 0xEEF3FA } },
          { c: 1, text: '计划', st: { bold: true, align: 0, bg: 0xEEF3FA } },
          { c: 2, text: '完成', st: { bold: true, align: 0, bg: 0xEEF3FA } }
        ] },
        // 场景1b/3：紧随其后的块若游标只 +1，会在合并区第二行落下覆盖格（缺陷复现点）
        { type: 'cells', heightPt: 24, items: [
          { c: 0, text: '副表头', st: { bold: true, align: 0 } }
        ] },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'line', type: 'text' },
          { name: 'planned', type: 'number', format: '#,##0' },
          { name: 'done', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'total', label: '合计', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 24 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'line', type: 'text' }, { name: 'planned', type: 'number' }, { name: 'done', type: 'number' }],
      rows: [['A线', 1200, 1100], ['B线', 1500, 1400]]
    }]
  }
};
