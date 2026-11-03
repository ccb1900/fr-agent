// test_v41.js — lib 能力自检第二轮：富文本 / 公式显示 / 悬浮元素 / 水印 / 工具栏
// 走 spec.IR 直通通路（v3.3），只为把新 IR 词汇跑到 cpt 里并留像素证据。

var SPEC = {
  outName: '能力自检_族二',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [140, 200, 200, 120],
      floats: [
        {
          name: 'FloatNote',
          text: '悬浮文本块（FloatElement）',
          leftPt: 4, topPt: 190, widthPt: 220, heightPt: 34,
          style: { bold: true, sizePt: 10, color: 0x1F4E79, border: 0x1F4E79 }
        }
      ],
      blocks: [
        {
          type: 'cells', heightPt: 40, items: [
            { c: 0, span: 4, text: 'v4.1 能力自检（富文本 / 公式显示 / 浮层 / 水印 / 工具栏）', st: { bold: true, sizePt: 12, color: 0x000000 } }
          ]
        },
        { type: 'space', heightPt: 10 },
        {
          type: 'cells', heightPt: 44, items: [
            { c: 0, text: '富文本', st: { bold: true, sizePt: 10 } },
            {
              c: 1, span: 3, rich: [
                { text: '同一格内 ', sizePt: 10 },
                { text: '红色加粗', bold: true, color: 0xC00000, sizePt: 10 },
                { text: ' 与 ', sizePt: 10 },
                { text: '蓝色小字', color: 0x1F4E79, sizePt: 8 },
                { text: ' 混排（RichChar 分段）', sizePt: 10 }
              ]
            }
          ]
        },
        {
          type: 'cells', heightPt: 44, items: [
            { c: 0, text: '公式显示', st: { bold: true, sizePt: 10 } },
            { c: 1, text: '（本格显示 =ROW() 结果）', presentFormula: '=ROW()', st: { sizePt: 10 } },
            { c: 2, text: '字典后置' }
          ]
        },
        {
          type: 'cells', heightPt: 44, items: [
            { c: 0, text: '条件属性', st: { bold: true, sizePt: 10 } },
            {
              c: 1, text: '整行条件（>0 全部命中）', st: { sizePt: 10 },
              conditions: [{ name: '自检条件', when: { formula: 'row() > 0' }, then: { bg: 0xE4F5E9, color: 0x1E7B34 } }]
            }
          ]
        }
      ]
    }],
    datasets: [{ name: 'ds1', columns: [{ name: 'k', type: 'text' }], rows: [['x']] }]
  },
  watermark: { text: 'fineagent v4.1', fontSize: 18, color: -14277082, hGap: 200, vGap: 100 },
  toolbar: { buttons: ['export', 'print', 'email', 'first', 'previous', 'pageNavi', 'next', 'last'] }
};
