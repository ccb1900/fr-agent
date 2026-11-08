var SPEC = { outName: 'combo_stack_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vcombo 堆积柱+折线', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vcombo', span: 4, heightPt: 380, title: '堆积柱+线', stacked: true,
    groups: [
      { plot: 'column', dataset: 'dsA', category: 'month', values: ['A','B'] },
      { plot: 'line', dataset: 'dsA', category: 'month', values: ['Total'] }
    ] }
]}], datasets: [ { name: 'dsA', columns: [{name:'month',type:'text'},{name:'A',type:'number'},{name:'B',type:'number'},{name:'Total',type:'number'}], rows: [['1月',10,5,15],['2月',20,8,28],['3月',15,12,27],['4月',30,10,40]] } ] } };
