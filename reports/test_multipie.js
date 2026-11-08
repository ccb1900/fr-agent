var SPEC = { outName: 'multipie_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vmultipie 多层饼自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vmultipie', span: 4, dataset: 'dsMP', levels: ['地区','销售员'], value: '销量', heightPt: 360, title: '多层饼' }
]}], datasets: [{ name: 'dsMP', columns: [{name:'地区',type:'text'},{name:'销售员',type:'text'},{name:'销量',type:'number'}], rows: [['华东','张三',100],['华东','李四',80],['华北','王五',60],['华北','赵六',40]] }] } };
