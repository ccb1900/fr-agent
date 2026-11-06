// reports/test_combo.js — D1 载体：组合图 VanChartCustomPlot（柱+线）
//   官方语料 analytics/柱形图变形.cpt：<Plot class="com.fr.plugin.chart.custom.VanChartCustomPlot">
//   + <CustomPlotList> 子 plot 列表；本载体：series=[column,line]，共享 MoreName 绑定两列值。
var SPEC = {
  outName: '能力自检_组合图',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 130, 130],
      blocks: [
        { type: 'title', text: '组合图（D1）：柱+线', span: 3, heightPt: 30 },
        { type: 'header', columns: [
          { label: '生产线', name: 'line', type: 'text' },
          { label: '计划', name: 'planned', type: 'number' },
          { label: '完成', name: 'done', type: 'number' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'line', type: 'text' },
          { name: 'planned', type: 'number', format: '#,##0' },
          { name: 'done', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'chart', kind: 'vcustom', dataset: 'd', category: 'line',
          values: ['planned', 'done'], series: [{ plot: 'column' }, { plot: 'line' }],
          customStyle: 'COMMON_COLUMN_LINE', title: '', heightPt: 320 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'line', type: 'text' }, { name: 'planned', type: 'number' }, { name: 'done', type: 'number' }],
      rows: [['A线', 120, 90], ['B线', 150, 130], ['C线', 90, 80], ['D线', 60, 55]]
    }]
  }
};
