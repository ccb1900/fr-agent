// reports/test_seriesborder.js — seriesBorder 渲染判别载体（2026-11-08，已达成）
//   判别设计：高对比红(0xFF0000)、style=1；柱体默认蓝，PNG 出现红色像素才算画出（属性存在不算）。
//   实验轨迹（证据驱动，最终达成）：
//     ① DefaultAttr+AttrBorder，style=3 → 0 像素（style 越界）
//     ② 命名条件 + AttrBorderWithAlpha      → 0 像素（WithAlpha 引擎不画）
//     ③ AttrBorderWithWidth                  → 0 像素（该类非柱缘宿主）
//     ④ **DefaultAttr+AttrBorder，style=1（官方 lineStyle 一手：563×0/134×1）→ red=596 像素，达成**
//   结论：AttrBorder(color,style 0|1) 走 DefaultAttr 系列条件通道可渲染；alpha 通道不画（IR 已明确拒）。
//   账本：manifest chart.seriesBorder rendering=verified / agentAvailable=true；官方 551 处同构语料。
var SPEC = {
  outName: '能力自检_系列边框',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [700],
      blocks: [
        { type: 'cells', heightPt: 28, items: [{ c: 0, span: 1, text: 'seriesBorder visual: red style=1' }] },
        { type: 'chart', kind: 'vbar', dataset: 'ds', category: '机型', values: ['产量'], heightPt: 300,
          seriesBorder: { color: 0xFF0000, style: 1 } }
      ]
    }],
    datasets: [{
      name: 'ds',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }],
      rows: [['A线', 120], ['B线', 200], ['C线', 160]]
    }]
  }
};
