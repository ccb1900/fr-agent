// test_funnel.js — chart.vfunnel 漏斗图载体（2026-11-08，非付费 16 图族闭环第 2 个）
//   官方同构：doc/Chart/FunnelPlot/漏斗图.cpt（VanChartFunnelPlot + OneValueCDDefinition
//   seriesName=分类列、valueName=值列、SumFunction）。
var SPEC = {
  outName: 'funnel_selftest',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [150, 250, 260, 310],
      blocks: [
        { type: 'cells', heightPt: 34, items: [
          { c: 0, span: 4, text: 'chart.vfunnel 漏斗图自检（5 阶段）', st: { bold: true, sizePt: 12, color: 0x000000 } }
        ] },
        { type: 'space', heightPt: 8 },
        { type: 'chart', kind: 'vfunnel', span: 4, dataset: 'dsFunnel', category: '阶段', value: '人数', heightPt: 420, title: '招聘漏斗' }
      ]
    }],
    datasets: [{
      name: 'dsFunnel',
      columns: [{ name: '阶段', type: 'text' }, { name: '人数', type: 'number' }],
      rows: [['简历', 500], ['初筛', 320], ['面试', 180], ['复试', 90], ['录用', 40]]
    }]
  }
};
