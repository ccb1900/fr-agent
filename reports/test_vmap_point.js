// reports/test_vmap_point.js — D2 点地图（mapType=point，geometry 同中国）
var SPEC = {
  outName: '能力自检_点地图',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 120, 120, 120],
      blocks: [
        { type: 'title', text: '点地图（D2）', span: 4, heightPt: 30 },
        { type: 'header', columns: [
          { label: '省份', name: 'province', type: 'text' },
          { label: '销售额', name: 'amount', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'province', type: 'text' },
          { name: 'amount', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'chart', kind: 'vmap', mapType: 'point', dataset: 'd', category: 'province', value: 'amount', title: '', span: 4, heightPt: 360 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'province', type: 'text' }, { name: 'amount', type: 'number' }],
      rows: [['广东省', 280000], ['北京市', 150000], ['上海市', 180000], ['黑龙江省', 60000], ['四川省', 90000]]
    }]
  }
};
