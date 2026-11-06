// reports/test_barinterval.js — P3 载体：legacy bar + barInterval（无 legend 也应生效）
//   证据面：部署 cpt 的 <VanChartColumnPlotAttr categoryIntervalPercent=...> / legacy plot 序列化值。
var SPEC = {
  outName: '能力自检_barInterval',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [200, 200],
      blocks: [
        { type: 'title', text: 'barInterval 宿主 vbar（P3）', span: 2, heightPt: 30 },
        { type: 'header', columns: [
          { label: '生产线', name: 'line', type: 'text' },
          { label: '计划', name: 'planned', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'line', type: 'text' },
          { name: 'planned', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'chart', kind: 'vbar', dataset: 'd', category: 'line', value: 'planned', barInterval: 25, span: 2, heightPt: 260 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'line', type: 'text' }, { name: 'planned', type: 'number' }],
      rows: [['A线', 80], ['B线', 40]]
    }]
  }
};
