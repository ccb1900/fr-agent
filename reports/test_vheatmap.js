// reports/test_vheatmap.js — D2 热力图载体（2026-11-07）
//   官方语料 doc/Chart/HeatMap/热力地图.cpt 同构：VanChartHeatMapPlot(point) + 中国.json + VanMapDefinition/pointDefinition。
//   heat 四参缺省=官方 网页热力图.cpt 35/45/0/70（object 层落缺省，IR 层 heat 可省）。
//   R0 证据：probes/probe_heatmap.js（javap 方法面 + 官方无头渲染 RENDER-OK logs/_heatmap_official.png 529KB）。
var SPEC = {
  outName: '能力自检_热力图',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 120, 120],
      blocks: [
        { type: 'title', text: '热力图（D2）', span: 3, heightPt: 30 },
        { type: 'header', columns: [
          { label: '省份', name: 'province', type: 'text' },
          { label: '热度', name: 'heatValue', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'province', type: 'text' },
          { name: 'heatValue', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'chart', kind: 'vheatmap', dataset: 'd', category: 'province', value: 'heatValue',
          geoUrl: 'assets/map/geographic/world/中国.json', zoom: 0, title: '', span: 3, heightPt: 360,
          heat: { radius: 35, blur: 45, minOpacity: 0, maxOpacity: 70 } }
      ]
    }],
    datasets: [{
      name: 'd',
      columns: [{ name: 'province', type: 'text' }, { name: 'heatValue', type: 'number' }],
      rows: [['广东省', 95], ['北京市', 80], ['上海市', 88], ['黑龙江省', 40], ['四川省', 62]]
    }]
  }
};
