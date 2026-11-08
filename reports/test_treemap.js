var SPEC = { outName: 'treemap_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vtreemap 树图自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vtreemap', span: 4, dataset: 'dsTM', levels: ['地区','产品'], value: '销量', seriesName: '', heightPt: 380, title: '市场树图' }
]}], datasets: [{ name: 'dsTM', columns: [{name:'地区',type:'text'},{name:'产品',type:'text'},{name:'销量',type:'number'}], rows: [['华东','手机',100],['华东','平板',80],['华北','手机',60],['华北','平板',90],['华南','手机',70],['华南','平板',50]] }] } };
