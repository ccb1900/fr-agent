// _runresult_selftest.js — ub-mode TDD：runner 结果契约（纯函数，无引擎，无 Java.type）
// 领域模型：一次管线 = 固定 stage 集合 × {pending|running|passed|failed|skipped} + 有序 diagnostics。
//   非法 stage 名 / 非法状态 / 非法跳转 = 写不出来（parse at boundary），不是运行到一半才发现。
//   success 由 stage 推导（一处真相）：任一 failed → false；skipped 不算失败；全 passed（可含 skipped）→ true。
//   toJson 稳定：相同记录两次序列化必逐字相等（Agent 可 diff、幂等）。
var J = function (n) { return Java.type(n); };
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function threw(fn) { try { fn(); return false; } catch (e) { return true; } }

// —— RED：runresult.js 尚未存在，下面 load 必失败（期望本测试以"模块缺失/RunResult 未定义"为由红）
load(ROOT + '/lib/runresult.js');
check('RunResult 已导出', typeof RunResult === 'object' && RunResult !== null);

var STAGES = ['input_load', 'ir_validate', 'object_build', 'cpt_export', 'cpt_validate', 'execute', 'render', 'deploy'];
check('STAGES 常量=期望全序（一处真相）', JSON.stringify(RunResult.STAGES) === JSON.stringify(STAGES));

// begin：全 pending、success=null、diagnostics=[]
var r = RunResult.begin();
check('begin 全 pending', STAGES.every(function (s) { return r.get(s) === 'pending'; }));
check('begin success=null', r.success() === null);
check('begin diagnostics 空', r.diagnostics().length === 0);

// 正常记一条：逐段 passed → success true
var ok = RunResult.begin();
STAGES.forEach(function (s) { ok.pass(s); });
check('全 passed → success true', ok.success() === true);

// failed 一处即 false，且不影响其它 stage 记录
var bad = RunResult.begin();
bad.pass('input_load'); bad.fail('ir_validate'); bad.diag('IR ISSUE: no sheets');
check('failed → success false', bad.success() === false);
check('failed 短路后下游=skipped', bad.get('object_build') === 'skipped' && bad.get('deploy') === 'skipped');
check('诊断按序入列', bad.diagnostics().join('|') === 'IR ISSUE: no sheets');

// skipped 不算失败（生产构建通道：execute/render skipped、其余 passed → 仍 success）
var prod = RunResult.begin();
prod.pass('input_load'); prod.pass('ir_validate'); prod.pass('object_build'); prod.pass('cpt_export'); prod.pass('cpt_validate');
prod.skip('execute'); prod.skip('render'); prod.pass('deploy');
check('build+deploy（execute/render skipped）→ success true', prod.success() === true);

// 边界：非法 stage / 非法状态 = 写不出来
check('未知 stage 名被拒', threw(function () { ok.pass('no_such_stage'); }));
check('set 非法状态被拒', threw(function () { ok.set('execute', 'weird'); }));

// 幂等：同状态重复置位不叠加、结果一致
var idem = RunResult.begin(); idem.pass('ir_validate'); idem.pass('ir_validate');
check('重复 passed 幂等', idem.get('ir_validate') === 'passed');

// toJson 稳定序列化（键序固定 + 值一致）：两个独立构造的同状态记录逐字相等
var a = RunResult.begin(); a.pass('input_load'); a.fail('object_build'); a.diag('boom');
var b = RunResult.begin(); b.pass('input_load'); b.fail('object_build'); b.diag('boom');
check('toJson 确定序（两次相等）', a.toJson() === b.toJson());
check('toJson 合法 JSON 且结构对', (function () {
  var o = JSON.parse(a.toJson());
  return o.stages.object_build === 'failed' && o.success === false && o.diagnostics[0] === 'boom' && Array.isArray(o.order) && o.order[0] === 'input_load';
})());

// finish(code)：把"任一 failed"与显式退出码统一（一处真相，不两头判）
var f = RunResult.begin(); f.pass('input_load'); f.fail('execute');
check('finish 后 success=false', f.finish().success === false);

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
