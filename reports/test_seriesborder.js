// reports/test_seriesborder.js — seriesBorder 渲染判别载体（2026-11-08）
//   目标：验证 chart.seriesBorder 是否真的在 PNG 上画出柱缘框。判别设计：高对比红(0xFF0000)、
//   粗线(style=3)、alpha=1.0；柱体默认蓝，PNG 出现红色像素才算画出（属性存在不算）。
//   **2026-11-08 三次挂载实验全阴性**（像素判定，sampled red=0）：
//     ① DefaultAttr.addDataSeriesCondition(AttrBorder)             —— 0 红像素
//     ② ConditionAttrList 命名 ConditionAttr + CATEGORY_INDEX + AttrBorderWithAlpha —— 0
//     ③ 同上挂载 + AttrBorderWithWidth(setLineWidth(3))             —— 0
//   结论：本版引擎的 data-series 条件通道不画柱缘描边（官方语料 AttrBorder 均属 GI 图框；
//   AttrBorderWithWidth 在 240 demo 语料零命中）。渲染维持 pending，agentAvailable=false。
//   本载体保留为可复现实验：将来换引擎/找到正确宿主时重跑并看红色像素。
var SPEC = {
  outName: '能力自检_系列边框',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [700],
      blocks: [
        { type: 'cells', heightPt: 28, items: [{ c: 0, span: 1, text: 'seriesBorder visual: red style=3 alpha=1' }] },
        { type: 'chart', kind: 'vbar', dataset: 'ds', category: '机型', values: ['产量'], heightPt: 300,
          seriesBorder: { color: 0xFF0000, style: 3, alpha: 1.0 } }
      ]
    }],
    datasets: [{
      name: 'ds',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }],
      rows: [['A线', 120], ['B线', 200], ['C线', 160]]
    }]
  }
};
