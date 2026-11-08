var SPEC = { outName: 'combo_bubble_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vcombo 柱+气泡', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vcombo', span: 4, heightPt: 380, title: '柱+气泡',
    groups: [
      { plot: 'column', dataset: 'dsA', category: 'month', values: ['Rainfall'] },
      { plot: 'bubble', dataset: 'dsA', x: 'idx', y: 'Temperature', bubbleSize: 'Temperature' }
    ] }
]}], datasets: [ { name: 'dsA', columns: [{name:'month',type:'text'},{name:'idx',type:'number'},{name:'Rainfall',type:'number'},{name:'Temperature',type:'number'}], rows: [['1月',1,10,25],['2月',2,20,8],['3月',3,15,12],['4月',4,30,28]] } ] } };
