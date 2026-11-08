// test_bubbleattr.js — chart.bubbleAttr 渲染专项载体（2026-11-08）
//   动机：manifest chart.bubbleAttr 已 construction/serialization verified，rendering=pending
//   （批I 只做了 probe_mapdeco XML 断言，未做 PNG 专项目检）。官方同构语料
//   doc/Chart/Bubble/普通气泡图.cpt：VanChartAttrBubble minDiameter=15.0 maxDiameter=70.0
//   shadow=true displayNegative=true。
//   本载体四个 vbubble 臂同数据同尺寸，只差 bubble 参数，用于像素对比：
//     ① 5/15   小直径  ② 30/90 大直径  ③ 15/70 + shadow  ④ 15/70 无 shadow
//   验收：①② 气泡像素面积显著不同（min/maxDiameter 生效）；③ 相对 ④ 有阴影像素（shadow 生效）。
var SPEC = {
  outName: 'bubbleattr_selftest',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [150, 250, 260, 310],
      blocks: [
        {
          type: 'cells', heightPt: 30, items: [
            { c: 0, span: 4, text: 'chart.bubbleAttr 渲染专项：直径 min/max + shadow', st: { bold: true, sizePt: 12, color: 0x000000 } }
          ]
        },
        { type: 'space', heightPt: 6 },
        { type: 'chart', kind: 'vbubble', span: 4, dataset: 'dsBub', seriesName: '机型线', x: '产量', y: '良率', bubbleSize: '库存', heightPt: 240, title: '5/15 小直径', bubble: { minDiameter: 5, maxDiameter: 15 } },
        { type: 'chart', kind: 'vbubble', span: 4, dataset: 'dsBub', seriesName: '机型线', x: '产量', y: '良率', bubbleSize: '库存', heightPt: 240, title: '30/90 大直径', bubble: { minDiameter: 30, maxDiameter: 90 } },
        { type: 'chart', kind: 'vbubble', span: 4, dataset: 'dsBub', seriesName: '机型线', x: '产量', y: '良率', bubbleSize: '库存', heightPt: 240, title: '15/70 阴影', bubble: { minDiameter: 15, maxDiameter: 70, shadow: true, displayNegative: true } },
        { type: 'chart', kind: 'vbubble', span: 4, dataset: 'dsBub', seriesName: '机型线', x: '产量', y: '良率', bubbleSize: '库存', heightPt: 240, title: '15/70 无阴影', bubble: { minDiameter: 15, maxDiameter: 70, shadow: false, displayNegative: true } }
      ]
    }],
    datasets: [{
      name: 'dsBub',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }, { name: '良率', type: 'number' }, { name: '库存', type: 'number' }],
      rows: [['A线', 120, 98, 30], ['B线', 150, 95, 45], ['C线', 90, 99, 20], ['D线', 200, 93, 60]]
    }]
  }
};
