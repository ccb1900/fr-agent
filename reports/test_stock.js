var SPEC = { outName: 'stock_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'stock K线图自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'stock', span: 4, dataset: 'dsS', cateTime: 'date', openString: 'open', highString: 'high', lowString: 'low', closeString: 'close', volumnString: '', heightPt: 380, title: 'K线' }
]}], datasets: [{ name: 'dsS', columns: [{name:'date',type:'text'},{name:'open',type:'number'},{name:'high',type:'number'},{name:'low',type:'number'},{name:'close',type:'number'}], rows: [['2026-01-01',10,20,5,15],['2026-01-02',15,25,10,20],['2026-01-03',20,30,15,25],['2026-01-04',22,35,20,28]] }] } };
