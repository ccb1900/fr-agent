// test_vanchart.js — v4.2 VanChart 插件图表族自检：柱/线/面积/散点/饼/仪表盘
// 走 spec.IR 直通通路，chart 块 kind=vxx 新词汇，PNG 留像素证据。

var SPEC = {
  outName: '能力自检_VanChart',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [150, 250, 260, 310],
      blocks: [
        {
          type: 'cells', heightPt: 34, items: [
            { c: 0, span: 4, text: 'v4.2 VanChart 插件图表族自检（柱形/折线/面积/散点/饼图/仪表盘）', st: { bold: true, sizePt: 12, color: 0x000000 } }
          ]
        },
        { type: 'space', heightPt: 8 },
        { type: 'chart', kind: 'vbar', span: 4, dataset: 'dsVan', category: '机型', values: ['产量', '良率'], axisY: { min: 0, max: 250 }, heightPt: 160 },
        { type: 'chart', kind: 'vline', span: 4, dataset: 'dsVan', category: '机型', values: ['产量', '良率'], heightPt: 160 },
        { type: 'chart', kind: 'varea', span: 4, dataset: 'dsVan', category: '机型', values: ['产量', '良率'], heightPt: 160 },
        { type: 'chart', kind: 'vscatter', span: 4, dataset: 'dsVan', seriesName: '机型线', x: '产量', y: '良率', heightPt: 160 },
        { type: 'chart', kind: 'vpie', span: 4, dataset: 'dsVan', category: '机型', values: ['产量'], heightPt: 170 },
        { type: 'chart', kind: 'vgauge', span: 4, dataset: 'dsVan', category: '机型', values: ['产量'], heightPt: 170 }
      ]
    }],
    datasets: [{
      name: 'dsVan',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }, { name: '良率', type: 'number' }],
      rows: [['A线', 120, 98], ['B线', 150, 95], ['C线', 90, 99], ['D线', 200, 93]]
    }]
  }
};
