var SPEC = { outName: 'meter_simple_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'meter simple 主题自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'meter', theme: 'simple', span: 4, dataset: 'dsM', seriesName: '产量', value: '产量', heightPt: 380, title: '简约仪表' }
]}], datasets: [{ name: 'dsM', columns: [{name:'机型',type:'text'},{name:'产量',type:'number'}], rows: [['A线',80]] }] } };
