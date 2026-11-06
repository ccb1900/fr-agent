// probes/probe_c2_dsrowspan_guard.js — C2 二道防线实机验证（2026-11-06 收口）
//   IR 层已结构化拒 cells item ds+rowSpan（fast_ir_contract C2 断言）；本探针绕过 Ir.validate，
//   直接以 raw IR 调 Obj.build，证明 object DSColumn 分支二道防线 throw 真的触发（fail-closed），
//   即"游标与最终对象一致"的最后一道闸可执行、非死代码。
//   跑法：run.ps1 -Script probes/probe_c2_dsrowspan_guard.js（需 FR 引擎；退出码 0=守卫生效）。
var J = function (n) { return Java.type(n); };
load('lib/ir.js');
load('lib/object.js');

var SPEC = {
  outName: '能力自检_C2守卫',
  allowNoFormula: true,
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [160, 120],
      blocks: [
        { type: 'title', text: 'C2 守卫探针', span: 2, heightPt: 30 },
        // ds + rowSpan：IR validate 会拒；此处直接 Obj.build → 期望 DSColumn 分支 throw
        { type: 'cells', heightPt: 24, dataset: 'd', items: [
          { c: 0, ds: { column: 'line' }, rowSpan: 2 }
        ] }
      ]
    }],
    datasets: [{ name: 'd', columns: [{ name: 'line', type: 'text' }], rows: [['A线'], ['B线']] }]
  }
};

var threw = null;
try {
  Obj.build(SPEC.IR);
} catch (e) {
  threw = String(e && e.message || e);
}
if (threw && threw.indexOf('ds') >= 0 && threw.indexOf('rowSpan') >= 0) {
  print('C2 GUARD OK (Obj.build threw): ' + threw);
  J('java.lang.System').exit(0);
}
print('C2 GUARD FAIL: expected throw mentioning ds+rowSpan, got: ' + threw);
J('java.lang.System').exit(1);
