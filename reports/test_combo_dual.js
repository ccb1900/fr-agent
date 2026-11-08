var SPEC = { outName: 'combo_dual_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vcombo 双数据集组合（柱+线）', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vcombo', span: 4, heightPt: 380, title: '双数据集柱+线',
    groups: [
      { plot: 'column', dataset: 'dsA', category: 'month', values: ['Rainfall'] },
      { plot: 'line', dataset: 'dsB', category: 'month', values: ['Temperature'] }
    ] }
]}], datasets: [
  { name: 'dsA', columns: [{name:'month',type:'text'},{name:'Rainfall',type:'number'}], rows: [['1月',10],['2月',20],['3月',15],['4月',30]] },
  { name: 'dsB', columns: [{name:'month',type:'text'},{name:'Temperature',type:'number'}], rows: [['1月',5],['2月',8],['3月',12],['4月',18]] }
] } };
