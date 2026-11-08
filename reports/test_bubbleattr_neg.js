// test_bubbleattr_neg.js — chart.bubbleAttr displayNegative 专项（含负 bubbleSize 值）
//   true  = 负值以灰色气泡显示（官方 普通气泡图.cpt displayNegative=true 同构）
//   false = 负值隐藏
//   验收：两臂 PNG 像素不同；true 多出灰色气泡，false 只剩正值蓝气泡。
var SPEC = {
  outName: 'bubbleattr_neg',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [150, 250, 260, 310],
      blocks: [
        { type: 'cells', heightPt: 34, items: [
          { c: 0, span: 4, text: 'bubbleAttr displayNegative：true 显示负值灰泡 / false 隐藏', st: { bold: true, sizePt: 12, color: 0x000000 } }
        ] },
        { type: 'space', heightPt: 8 },
        { type: 'chart', kind: 'vbubble', span: 4, dataset: 'dsBubNeg', seriesName: '机型线', x: '产量', y: '良率', bubbleSize: '库存', heightPt: 240, title: 'displayNegative=true', bubble: { minDiameter: 15, maxDiameter: 70, shadow: false, displayNegative: true } },
        { type: 'chart', kind: 'vbubble', span: 4, dataset: 'dsBubNeg', seriesName: '机型线', x: '产量', y: '良率', bubbleSize: '库存', heightPt: 240, title: 'displayNegative=false', bubble: { minDiameter: 15, maxDiameter: 70, shadow: false, displayNegative: false } }
      ]
    }],
    datasets: [{
      name: 'dsBubNeg',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }, { name: '良率', type: 'number' }, { name: '库存', type: 'number' }],
      rows: [['A线', 120, 98, -30], ['B线', 150, 95, 45], ['C线', 90, 99, -20], ['D线', 200, 93, 60]]
    }]
  }
};
