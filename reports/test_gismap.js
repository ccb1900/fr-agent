var SPEC = { outName: 'gismap_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'gismap 地址三点', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'gismap', span: 4, dataset: 'dsG', address: '坐标', addressName: '城市', addressType: false, value: '销量', heightPt: 380, title: '地址三点' }
]}], datasets: [{ name: 'dsG', columns: [{name:'城市',type:'text'},{name:'坐标',type:'text'},{name:'销量',type:'number'}], rows: [['北京','北京市',100],['上海','上海市',80],['广州','广东省广州市',60]] }] } };
