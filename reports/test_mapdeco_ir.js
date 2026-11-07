// reports/test_mapdeco_ir.js — 批I 地图装饰族纯 IR 回归载体（scan_all_specs 覆盖 mapLabel/mapTooltip/hotHyperLink/bubble）
//   与 probes/probe_mapdeco.js 同形但不 boot 引擎（scan 零引擎）；真引擎证据见 probe_mapdeco。
var SPEC = {
  outName: '能力自检_地图装饰IR',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [160, 120, 120, 120],
      blocks: [
        { type: 'title', text: '地图装饰族（批I）', span: 4, heightPt: 30 },
        { type: 'header', columns: [
          { label: '省份', name: 'province', type: 'text' },
          { label: '销售额', name: 'amount', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'province', type: 'text' },
          { name: 'amount', type: 'number', format: '#,##0' }
        ], heightPt: 24 },
        { type: 'chart', kind: 'vmap', dataset: 'd', category: 'province', value: 'amount', span: 4, heightPt: 360,
          tooltip: { muti: true, formats: { category: true, value: '#,##0' } },
          mapLabel: { areaLabel: { enable: true, fontPt: 12, color: 0x333333 }, pointLabel: { enable: true } },
          mapTooltip: { areaTooltip: { muti: true, format: '#,##0' }, pointTooltip: { muti: false } },
          hotHyperLink: { target: 'area', items: [{ name: '联动单元格', relateCCName: 'cc1', itemName: '省份', title: '跳转', width: 600, height: 400 }] }
        }
      ]
    }],
    datasets: [{ name: 'd', columns: [{ name: 'province', type: 'text' }, { name: 'amount', type: 'number' }], rows: [['广东省', 280000], ['四川省', 90000]] }]
  }
};
