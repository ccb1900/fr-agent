// reports/test_visual_deco.js — §5步4 视觉验证专项：seriesImage(vbar) + legacy axisX(bar)
//   每项独立 PNG 目检：① seriesImage 图片是否真的画在柱上；② legacy axisX 公共键(fontPt)是否落 ValueAxis/CategoryAxis。
//   seriesImage.image 用 logs/_r4m9_off.png（管线产物，非空小图，稳定存在）。
var SPEC = {
  outName: '能力自检_视觉装饰',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [700],
      blocks: [
        { type: 'cells', heightPt: 30, items: [{ c: 0, span: 1, text: 'P1 visual: seriesImage + legacy axisX' }] },
        { type: 'chart', kind: 'vbar', dataset: 'ds', category: '机型', values: ['产量'], heightPt: 320,
          seriesImage: { image: 'logs/_r4m9_off.png' } },
        { type: 'chart', kind: 'bar', dataset: 'ds', category: '机型', values: ['产量'], heightPt: 320,
          axisX: { fontPt: 14 }, axisY: { fontPt: 14 } }
      ]
    }],
    datasets: [{
      name: 'ds',
      columns: [{ name: '机型', type: 'text' }, { name: '产量', type: 'number' }],
      rows: [['A线', 120], ['B线', 200], ['C线', 160]]
    }]
  }
};
