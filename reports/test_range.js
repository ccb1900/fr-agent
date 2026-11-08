var SPEC = { outName: 'range_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'range 区间图自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'range', span: 4, dataset: 'dsR', category: '类别', values: ['低','高'], heightPt: 380, title: '区间' }
]}], datasets: [{ name: 'dsR', columns: [{name:'类别',type:'text'},{name:'低',type:'number'},{name:'高',type:'number'}], rows: [['A',10,20],['B',15,30],['C',5,25],['D',20,40]] }] } };
