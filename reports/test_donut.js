var SPEC = {
  outName: 'donut_selftest',
  allowNoFormula: true,
  IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
    { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'donut 环形图自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
    { type: 'space', heightPt: 8 },
    { type: 'chart', kind: 'donut', span: 4, dataset: 'ds3d', category: '机型', values: ['产量'], heightPt: 340, title: 'donut 环形图自检' }
  ]}], datasets: [{ name: 'ds3d', columns: [{name:'机型',type:'text'},{name:'产量',type:'number'}], rows: [['A线',120],['B线',150],['C线',90],['D线',200]] }] }
};
