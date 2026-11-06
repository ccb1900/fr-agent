// reports/test_combo_sql.js — D1 重开：组合图 + SQL 数据集（官方 柱形图变形.cpt 同为 ds1/ds2 SQL）
var SPEC = {
  outName: '能力自检_组合图SQL',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 120, 120, 120],
      blocks: [
        { type: 'title', text: '组合图 SQL（D1）', span: 4, heightPt: 30 },
        { type: 'header', columns: [
          { label: '工序', name: 'category', type: 'text' },
          { label: '计划', name: 'planned', type: 'number', format: '#,##0' },
          { label: '完成', name: 'done', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'category', type: 'text' },
          { name: 'planned', type: 'number', format: '#,##0' },
          { name: 'done', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'chart', kind: 'vcustom', dataset: 'd', category: 'category',
          values: ['planned', 'done'], series: [{ plot: 'column' }, { plot: 'line' }],
          customStyle: 'COMMON_COLUMN_LINE', title: '', span: 4, heightPt: 320 }
      ]
    }],
    datasets: [{
      name: 'd', kind: 'sql', connection: 'ATOM_LIVE',
      query: 'SELECT stage AS category, COUNT(*) AS planned, CAST(COUNT(*) * 0.8 AS float) AS done FROM laser_aaa GROUP BY stage'
    }]
  }
};
