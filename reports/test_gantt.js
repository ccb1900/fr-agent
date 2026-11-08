var SPEC = { outName: 'gantt_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vgantt 甘特图自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vgantt', span: 4, dataset: 'dsG', taskid: 'id', seriesname: '部门', processname: '流程', starttime: '开始', endtime: '结束', heightPt: 380, title: '项目甘特' }
]}], datasets: [{ name: 'dsG', columns: [{name:'id',type:'text'},{name:'部门',type:'text'},{name:'流程',type:'text'},{name:'开始',type:'text'},{name:'结束',type:'text'}], rows: [['1','研发','开发流程','2026-01-01','2026-01-10'],['2','测试','测试流程','2026-01-08','2026-01-15']] }] } };
