// reports/test_vmap.js — D2 载体：区域地图（VanChartMapPlot + VanMapDefinition/areaDefinition）
//   官方语料 doc/Chart/mapfather.cpt 同构：mapType=area、geourl=assets/map/geographic/world/中国.json。
var SPEC = {
  outName: '能力自检_地图',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 120, 120, 120],
      blocks: [
        { type: 'title', text: '区域地图（D2）', span: 4, heightPt: 30 },
        { type: 'header', columns: [
          { label: '省份', name: 'province', type: 'text' },
          { label: '销售额', name: 'amount', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'province', type: 'text' },
          { name: 'amount', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'chart', kind: 'vmap', dataset: 'd', category: 'province', value: 'amount', title: '', span: 4, heightPt: 360 }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'province', type: 'text' }, { name: 'amount', type: 'number' }],
      rows: [['广东省', 280000], ['北京市', 150000], ['上海市', 180000], ['黑龙江省', 60000], ['四川省', 90000]]
    }]
  }
};
