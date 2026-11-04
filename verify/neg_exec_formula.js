// logs/_exec_fail_probe.js — 证 A：execute 段根因必须进 RESULT.diagnostics（迭代4 修补回归门）
// 无 DB（内嵌小数据），公式 '=SUMPRODUCT(...)' 触发 com.fr.stable.InterpreterError → execute 段失败。
// 期望：RESULT_JSON stages.execute=failed、render/deploy=skipped、success=false、exit=1，
//       且 diagnostics 里含 "EXECUTE FAIL" + "SUMPRODUCT"（Agent 不必翻 run.out 就能定位）。
var SPEC = {
  outName: 'execfail_probe',
  IR: {
    sheets: [{
      name: 's1', widthsPt: [80, 80], blocks: [
        { type: 'cells', heightPt: 24, items: [{ c: 0, span: 2, text: 'probe' }] },
        { type: 'cells', heightPt: 20, items: [{ c: 0, text: 'A', st: {} }, { c: 1, text: 'B', st: {} }] },
        { type: 'cells', heightPt: 20, dataset: 'ds1', items: [
          { c: 0, ds: { column: 'x' }, st: {} },
          { c: 1, formula: '=SUMPRODUCT(A3,A3)', st: {} }
        ] }
      ]
    }],
    datasets: [{ name: 'ds1', columns: [{ name: 'x', type: 'number' }], rows: [[1], [2], [3]] }]
  }
};
