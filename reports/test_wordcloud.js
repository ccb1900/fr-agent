var SPEC = { outName: 'wordcloud_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vwordcloud 词云自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vwordcloud', span: 4, dataset: 'dsWC', wordName: '搜索词', wordValue: 'PV', heightPt: 380, title: '热搜词云' }
]}], datasets: [{ name: 'dsWC', columns: [{name:'搜索词',type:'text'},{name:'PV',type:'number'}], rows: [['报表',100],['数据',80],['帆软',60],['分析',40],['图表',30],['大屏',20]] }] } };
