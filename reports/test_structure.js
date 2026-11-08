var SPEC = { outName: 'structure_selftest', allowNoFormula: true, IR: { sheets: [{ name: 'sheet1', widthsPt: [150,250,260,310], blocks: [
  { type: 'cells', heightPt: 34, items: [{ c:0, span:4, text: 'vstructure 结构图自检', st: { bold:true, sizePt:12, color:0x000000 } }] },
  { type: 'space', heightPt: 8 },
  { type: 'chart', kind: 'vstructure', span: 4, dataset: 'dsST', nodeId: '部门ID', parentId: '上级ID', nodeName: '部门名称', nodeValue: 'value', heightPt: 380, title: '组织架构' }
]}], datasets: [{ name: 'dsST', columns: [{name:'部门ID',type:'text'},{name:'上级ID',type:'text'},{name:'部门名称',type:'text'},{name:'value',type:'number'}], rows: [['1','','总部',100],['2','1','研发',60],['3','1','销售',40],['4','2','测试',20]] }] } };
