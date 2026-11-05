// test_vanchart.js — v4.2 VanChart 插件图表族自检：柱/线/面积/散点/饼/仪表盘
// 批B（README 待回填）追加：装饰层（tooltip/label/marker/lineStyle/trend/stack/条件系列色/alpha/bg/border/axisY.unit 主刻度）
// 散点 bubbleSize 显式（官方 气泡图 bubbleSize 属性同位——购置 #46 大蓝点修复）；vpie legend position 实验块（#46 图例 4 见 3 尝试）。
// 批B渲染端收案（2026-11-06，probe_r4m3/m7/m9-m13 一手）：① stack 必补 plot.setVanChartPlotType(STACK|STACK_BY_PERCENT)
//   （isStackChart 只认它）；② label 必挂命名 ConditionAttr+恒真 ListCondition（DefaultAttr 序列化在渲染无）；
//   ③ 条件系列色正类=AttrBackground+ColorBackground（AttrColor 引擎不染）；④ vpie"图例 4 见 3"=引擎图例区按图表
//   高度分享、不够静默截条（m11 300pt 全出/m12 170pt 只 2 条/setMaxHeight 无效/m13 position=3 横排容量最高）——
//   非实现缺陷，第一 vpie 臂升 260pt 示范给足高度；第二臂 170pt+position=2 留作截断示警样本。
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
        { type: 'chart', kind: 'vscatter', span: 4, dataset: 'dsVan', seriesName: '机型线', x: '产量', y: '良率', bubbleSize: '库存', heightPt: 160 },
        { type: 'chart', kind: 'vpie', span: 4, dataset: 'dsVan', category: '机型', values: ['产量'], heightPt: 340 },  // 批B渲染端收案:图例区随图表高度分享,340pt 下 4 条全出(m11 300 全出/m12 170 只 2/m13 横排 260 仍 3——空间法实证)
        { type: 'chart', kind: 'vgauge', span: 4, dataset: 'dsVan', category: '机型', values: ['产量'], heightPt: 170 },
        { type: 'chart', kind: 'vbubble', span: 4, dataset: 'dsVan', seriesName: '机型线', x: '产量', y: '良率', bubbleSize: '库存', heightPt: 240 },
        { type: 'space', heightPt: 8 },
        {
          type: 'cells', heightPt: 30, items: [
            { c: 0, span: 4, text: '批B 装饰层自检：堆叠+tooltip+label / 线形+标记+趋势线+主刻度 / 条件系列色 / alpha+边框', st: { bold: true, sizePt: 12, color: 0x000000 } }
          ]
        },
        { type: 'space', heightPt: 8 },
        {
          type: 'chart', kind: 'vbar', span: 4, dataset: 'dsVan', category: '机型', values: ['产量', '良率'],
          stack: { stacked: true, stackId: 'S1' },
          tooltip: { muti: false, formats: { series: true, value: '#,##0', percent: true } },
          label: { enable: true, position: 2 },
          alpha: 0.9, heightPt: 240
        },
        {
          type: 'chart', kind: 'vline', span: 4, dataset: 'dsVan', category: '机型', values: ['产量', '良率'],
          marker: { type: 'circle', radius: 5 },
          lineStyle: { type: 'solid', style: 'curve', width: 2 },
          trend: { type: 'linear', name: '产量趋势', pre: 2, after: 2 },
          axisY: { min: 0, max: 260, unit: 50 },
          heightPt: 240
        },
        {
          type: 'chart', kind: 'vbar', span: 4, dataset: 'dsVan', category: '机型', values: ['产量'],
          conditions: [{ name: '柱子超150标红', when: { column: '产量', op: '>', value: 150, valueType: 'number' }, then: { seriesColor: 0xD0392E } }],
          border: { color: -9721345, style: 1 }, bg: 0xF7FAFF,
          heightPt: 240
        },
        {
          type: 'chart', kind: 'vpie', span: 4, dataset: 'dsVan', category: '机型', values: ['产量'],
          legend: { position: 2 },
          heightPt: 240
        }
      ]
    }],
    datasets: [{
      name: 'dsVan',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }, { name: '良率', type: 'number' }, { name: '库存', type: 'number' }],
      rows: [['A线', 120, 98, 30], ['B线', 150, 95, 45], ['C线', 90, 99, 20], ['D线', 200, 93, 60]]
    }]
  }
};
