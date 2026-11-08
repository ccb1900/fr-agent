// test_box.js — chart.vbox 箱线图载体（2026-11-08，非付费 16 图族闭环第 3 个）
//   官方同构：doc/Chart/BoxPlot/分组箱型图.cpt（VanChartBoxPlot + VanBoxTableDefinition
//   detailed=true + VanBoxMoreNameCDDefinition(category + 3 个 ChartSummaryColumn)）。
//   箱线语义：同一分类内多行样本，每个系列一个箱；本载体=1 组 × 3 系列 × 7 样本 → 3 个箱。
var SPEC = {
  outName: 'box_selftest',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [150, 250, 260, 310],
      blocks: [
        { type: 'cells', heightPt: 34, items: [
          { c: 0, span: 4, text: 'chart.vbox 箱线图自检（3 系列 × 7 样本）', st: { bold: true, sizePt: 12, color: 0x000000 } }
        ] },
        { type: 'space', heightPt: 8 },
        { type: 'chart', kind: 'vbox', span: 4, dataset: 'dsBox', category: '组', values: ['A', 'B', 'C'], heightPt: 340, title: '分组箱线图', axisY: { min: 0, max: 50, unit: 10 } }
      ]
    }],
    datasets: [{
      name: 'dsBox',
      columns: [{ name: '组', type: 'text' }, { name: 'A', type: 'number' }, { name: 'B', type: 'number' }, { name: 'C', type: 'number' }],
      rows: [
        ['G', 10, 20, 5],
        ['G', 12, 22, 9],
        ['G', 14, 24, 13],
        ['G', 16, 26, 17],
        ['G', 18, 28, 21],
        ['G', 20, 30, 25],
        ['G', 30, 40, 35]
      ]
    }]
  }
};
