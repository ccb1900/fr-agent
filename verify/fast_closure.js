// verify/fast_closure.js — I5 闭环守卫离线契约测（纯函数，喂合成 RunResult 判决；零引擎）
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function threw(fn) { try { fn(); return false; } catch (e) { return true; } }
check('PARSE loopguard', (function () { try { new Function(String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/semantic/closure/loopguard.js')), 'UTF-8'))); return true; } catch (e) { print('' + e); return false; } })());
load(ROOT + '/semantic/closure/loopguard.js');

function rr(failedStage, diags) {
  var order = ['input_load', 'runtime_initialize', 'datasource_connect', 'ir_validate', 'object_build', 'cpt_export', 'cpt_validate', 'execute', 'render', 'deploy', 'roundtrip'];
  var stages = {}; order.forEach(function (s) { stages[s] = 'passed'; });
  if (failedStage) stages[failedStage] = 'failed';
  return { success: !failedStage && true, exit: failedStage ? 1 : 0, stages: stages, order: order, diagnostics: diags || [] };
}

// done
check('全绿→done', LoopGuard.nextAction({ success: true, exit: 0, stages: {}, order: [], diagnostics: [] }, { attempt: 0 }, { maxFixCount: 3 }).action === 'done');
// retry-fix-spec（ir_validate 有定位字段）
var a1 = LoopGuard.nextAction(rr('ir_validate', ['IR ISSUE: INVALID_ENUM @ metrics[0].aggregation: bad']), { attempt: 0 }, { maxFixCount: 3 });
check('ir 失败+定位字段→retry attempt+1', a1.action === 'retry-fix-spec' && a1.attempt === 1 && a1.fixTargets.indexOf('metrics[0].aggregation') >= 0);
// 可改字段白名单过滤：目标不在白名单→reject(无可改字段)
var a2 = LoopGuard.nextAction(rr('ir_validate', ['IR ISSUE: X @ dataset.rows[0]: msg']), { attempt: 0 }, { maxFixCount: 3, modifiableFields: ['dimensions[0].field'] });
check('定位字段被白名单滤空→reject', a2.action === 'reject' && /可改字段/.test(a2.reason));
// 白名单命中→retry
var a3 = LoopGuard.nextAction(rr('object_build', ['IR ISSUE: Y @ dimensions[0].field: msg']), { attempt: 1 }, { maxFixCount: 3, modifiableFields: ['dimensions[0].field'] });
check('白名单命中→retry', a3.action === 'retry-fix-spec' && a3.attempt === 2);
// maxFixCount 上限（禁无限循环 r2 §5.2）
var a4 = LoopGuard.nextAction(rr('ir_validate', ['IR ISSUE: Z @ dimensions[0].field: msg']), { attempt: 3 }, { maxFixCount: 3 });
check('达 maxFixCount→reject exhausted', a4.action === 'reject' && /maxFixCount/.test(a4.reason));
// deadline（单次生成时间）
var a5 = LoopGuard.nextAction(rr('execute', ['IR ISSUE: W @ metrics[0].field: msg']), { attempt: 0, elapsedMs: 5000 }, { maxFixCount: 3, deadlineMs: 3000 });
check('超 deadline→reject timeout', a5.action === 'reject' && /deadline|时间/.test(a5.reason));
// 环境/连接/部署类不可由 spec 修 → reject
check('datasource_connect 失败→reject env', LoopGuard.nextAction(rr('datasource_connect', []), { attempt: 0 }, { maxFixCount: 3 }).action === 'reject');
check('deploy 失败→reject env', LoopGuard.nextAction(rr('deploy', ['SECRET GATE DENY']), { attempt: 0 }, { maxFixCount: 3 }).action === 'reject');
// input_load 有 SPEC ISSUE 定位→可修；无则 reject
check('input_load+定位字段→retry', LoopGuard.nextAction(rr('input_load', ['SPEC ISSUE: REQUIRED @ outName: msg']), { attempt: 0 }, { maxFixCount: 3 }).action === 'retry-fix-spec');
check('input_load 无定位→reject', LoopGuard.nextAction(rr('input_load', ['LOAD FAIL: nope']), { attempt: 0 }, { maxFixCount: 3 }).action === 'reject');
// 抗炸 + 确定序
check('抗炸：垃圾入参不抛', threw(function () { LoopGuard.nextAction(null, null, null); LoopGuard.nextAction(42, {}, {}); }) === false);
var r = rr('ir_validate', ['IR ISSUE: Q @ dimensions[0].field: m']);
check('确定序（两次全等）', JSON.stringify(LoopGuard.nextAction(r, { attempt: 0 }, { maxFixCount: 3 })) === JSON.stringify(LoopGuard.nextAction(r, { attempt: 0 }, { maxFixCount: 3 })));

print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
