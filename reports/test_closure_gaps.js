// reports/test_closure_gaps.js — 外部审查 v2 对账器暴露的两处"载体不覆盖"补实
//   ① condition.list：when.list 形态（ListCondition 语义）此前全 reports 无载体；
//   ② page.repeatHeaderRow：repeatHeader 键此前全 reports 无载体。
//   本 spec 只做 compile+validate（零引擎门覆盖），键真实存在即可；渲染证据另见各 README 实证。
var SPEC = {
  outName: '能力自检_闭环补隙',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1', widthsPt: [120, 120],
      blocks: [
        { type: 'cells', heightPt: 30, items: [{ c: 0, span: 2, text: 'closure gaps: when.list + repeatHeader' }] },
        { type: 'header', columns: [{ label: '编号', name: 'no', type: 'text' }, { label: '评分', name: 'score', type: 'number' }], heightPt: 24 },
        { type: 'detail', dataset: 'd', columns: [
          { name: 'no', type: 'text' },
          { name: 'score', type: 'number', conditions: [
            { name: '列表条件', when: { list: [{ column: 'score', op: '>', value: 60, valueType: 'number' }] }, then: { bg: 0xE4F5E9 } }
          ] }
        ], heightPt: 24 },
        { type: 'total', label: '合计', span: 1, aggregate: { fn: 'sum', col: 1 }, heightPt: 24 }
      ],
      repeatHeaderRow: true
    }],
    datasets: [{ name: 'd', columns: [{ name: 'no', type: 'text' }, { name: 'score', type: 'number' }], rows: [['A', 80], ['B', 40]] }]
  }
};
