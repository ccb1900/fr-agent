var SPEC = { outName: 'combo_area_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vcombo 柱+面积组合', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vcombo', span: 4, heightPt: 380, title: '柱+面积',
    groups: [
      { plot: 'column', dataset: 'dsA', category: 'month', values: ['Rainfall'] },
      { plot: 'area', dataset: 'dsA', category: 'month', values: ['Temperature'] }
    ] }
]}], datasets: [ { name: 'dsA', columns: [{name:'month',type:'text'},{name:'Rainfall',type:'number'},{name:'Temperature',type:'number'}], rows: [['1月',10,25],['2月',20,8],['3月',15,12],['4月',30,28]] } ] } };
