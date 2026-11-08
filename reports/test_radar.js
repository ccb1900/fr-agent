// test_radar.js — chart.vradar 载体（2026-11-08，非付费 16 图族闭环第 1 个）
//   官方同构：doc/Chart/NewRadarChart/CustomRadar.cpt（VanChartRadarPlot + MoreNameCDDefinition
//   category + ChartSummaryColumn），数据 5 类目 × 1 系列。
var SPEC = {
  outName: 'radar_selftest',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [150, 250, 260, 310],
      blocks: [
        { type: 'cells', heightPt: 34, items: [
          { c: 0, span: 4, text: 'chart.vradar 雷达图自检（5 类目 × 1 系列）', st: { bold: true, sizePt: 12, color: 0x000000 } }
        ] },
        { type: 'space', heightPt: 8 },
        { type: 'chart', kind: 'vradar', span: 4, dataset: 'dsRadar', category: '品牌', values: ['时速'], heightPt: 320, title: '各品牌时速' }
      ]
    }],
    datasets: [{
      name: 'dsRadar',
      columns: [{ name: '品牌', type: 'text' }, { name: '时速', type: 'number' }],
      rows: [['A', 120], ['B', 150], ['C', 90], ['D', 200], ['E', 170]]
    }]
  }
};
