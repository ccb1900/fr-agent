// reports/test_merge_header.js — 能力矩阵 P0 载体：合并行(rowSpan)/多层表头 + 合并列(span)
//   2026-11-06：IR cells item 新增 rowSpan（object putCell spanR 直通；demo 240 张里 rs>1 1364 处、cs>1 5757 处）。
//   形态：title → cells 双层表头（r 绝对行号；c0/c3 跨两行，c1 span=2 跨两列 + 子表头）→ detail 4 列数据。
//   跑法：REPORT_SPEC=reports/test_merge_header.js run.ps1 -Script make_api.js（末轮默认 spec 回补铁证）
var SPEC = {
  outName: '能力自检_合并表头',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [160, 150, 150, 130],
      blocks: [
        { type: 'title', text: '合并行/多层表头自检（rowSpan+span）', span: 4, heightPt: 32 },
        { type: 'cells', heightPt: 26, items: [
          { c: 0, r: 1, rowSpan: 2, text: '生产线', st: { bold: true, align: 0, bg: 0xEEF3FA } },
          { c: 1, r: 1, span: 2, text: '生产情况', st: { bold: true, align: 0, bg: 0xEEF3FA } },
          { c: 3, r: 1, rowSpan: 2, text: '良率(%)', st: { bold: true, align: 0, bg: 0xEEF3FA } },
          { c: 1, r: 2, text: '计划', st: { bold: true, align: 0, bg: 0xEEF3FA } },
          { c: 2, r: 2, text: '完成', st: { bold: true, align: 0, bg: 0xEEF3FA } }
        ] },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'line', type: 'text' },
          { name: 'planned', type: 'number', format: '#,##0' },
          { name: 'done', type: 'number', format: '#,##0' },
          { name: 'rate', type: 'float', format: '0.00' }
        ], heightPt: 26 },
        { type: 'total', label: '合计', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 26 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'line', type: 'text' }, { name: 'planned', type: 'number' }, { name: 'done', type: 'number' }, { name: 'rate', type: 'float' }],
      rows: [['A线', 1200, 1100, 91.67], ['B线', 1500, 1400, 93.33], ['C线', 900, 870, 96.67]]
    }]
  }
};
