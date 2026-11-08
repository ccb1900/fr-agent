var SPEC = {
  outName: 'area3d_selftest',
  allowNoFormula: true,
  IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
    { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'area3d 3D 面积图自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
    { type: 'space', heightPt: 8 },
    { type: 'chart', kind: 'area3d', span: 4, dataset: 'ds3d', category: '机型', values: ['产量'], heightPt: 340, title: 'area3d 3D 面积图自检' }
  ]}], datasets: [{ name: 'ds3d', columns: [{name:'机型',type:'text'},{name:'产量',type:'number'}], rows: [['A线',120],['B线',150],['C线',90],['D线',200]] }] }
};
