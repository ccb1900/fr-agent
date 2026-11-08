var SPEC = { outName: 'drillmap_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vdrillmap 钻取地图自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vdrillmap', span: 4, dataset: 'dsD', heightPt: 380, title: '省钻取',
    bottomArea: '省', bottomValues: ['销量'],
    layerDefs: [ { area: '市', values: ['销量'] }, { area: '县', values: ['销量'] } ]
  }
]}], datasets: [{ name: 'dsD', columns: [{name:'省',type:'text'},{name:'市',type:'text'},{name:'县',type:'text'},{name:'销量',type:'number'}], rows: [['广东省','广州市','天河区',100],['广东省','深圳市','南山区',60],['江苏省','南京市','玄武区',40]] }] } };
