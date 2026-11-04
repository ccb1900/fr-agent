// semantic/closure/loopguard.js — I5 闭环守卫（r2 §5.2 五上限，纯函数零依赖，可离线证伪）
//   把一次 RunResult 判决翻成下一步动作：done / retry-fix-spec（可修且未越限）/ reject（超限/不可修/环境类失败）。
//   上限：maxFixCount（最大修复次数）、deadlineMs（单次生成时间，elapsed 由调用方注入 now 便于测）、modifiableFields（可改字段白名单）、
//   输出目录（BR_DEPLOYDIR，Agent 无指路径权——outName 已被 I1 路径闸约束，此处仅记 owner 不重复实现）。
//   SQL 查询范围/凭据由既有 ir.js SQL_READONLY + 凭据门 + dbpass 承担，本守卫只裁决"还修不修、能改哪些"。
var LoopGuard = (function () {
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object'; }

  // 失败段 → 是否可由"改 spec"修复。环境/连接/凭据/部署类不可由 spec 修（交人工/环境），非 retry。
  var SPEC_FIXABLE = { ir_validate: 1, object_build: 1, cpt_validate: 1, execute: 1, render: 1, roundtrip: 1 };
  var ENV_FATAL = { runtime_initialize: 1, datasource_connect: 1, deploy: 1 };  // 环境/连接/凭据/部署类失败，非 spec 可修

  function failedStage(res) {
    var st = (res && res.stages) || {}, order = (res && res.order) || Object.keys(st);
    for (var i = 0; i < order.length; i++) if (st[order[i]] === 'failed') return order[i];
    return null;
  }
  // 从 diagnostics 抽 "ISSUE: <CODE> @ <path>: msg" 的 path 作修复目标
  function fixTargets(res, modifiable) {
    var out = [];
    ((res && res.diagnostics) || []).forEach(function (d) {
      var m = /@ ([^\s:]+):/.exec(String(d));
      if (m && out.indexOf(m[1]) < 0) out.push(m[1]);
    });
    if (modifiable && modifiable.length) out = out.filter(function (f) { return modifiable.indexOf(f) >= 0 || modifiable.indexOf('*') >= 0; });
    return out;
  }

  // result: 已 parse 的 RunResult 对象；state:{attempt, elapsedMs}；caps:{maxFixCount, deadlineMs, modifiableFields}
  function nextAction(result, state, caps) {
    state = state || {}; caps = caps || {};
    var attempt = state.attempt || 0, elapsed = state.elapsedMs || 0;
    if (!isObj(result)) return { action: 'reject', attempt: attempt, reason: '无 RESULT 判决（runner 崩在写盘前）', fixTargets: [] };
    if (result.success === true && result.exit === 0) return { action: 'done', attempt: attempt, reason: '全绿', fixTargets: [] };
    if (typeof caps.maxFixCount === 'number' && attempt >= caps.maxFixCount)
      return { action: 'reject', attempt: attempt, reason: '超最大修复次数 maxFixCount=' + caps.maxFixCount + '（r2 §5.2 禁无限循环）', fixTargets: [] };
    if (typeof caps.deadlineMs === 'number' && elapsed > caps.deadlineMs)
      return { action: 'reject', attempt: attempt, reason: '超单次生成时间 deadlineMs=' + caps.deadlineMs + '（r2 §5.2）', fixTargets: [] };
    var fs = failedStage(result);
    if (fs === 'input_load') {
      // 装载/校验拒：若有 SPEC ISSUE 指向可改字段 → 可修；否则 reject（意图/模型缺口非白名单可修）
      var ft0 = fixTargets(result, caps.modifiableFields);
      if (!ft0.length) return { action: 'reject', attempt: attempt, reason: 'input_load 拒且无可改字段指引（意图/模型缺口）', fixTargets: [] };
      return { action: 'retry-fix-spec', attempt: attempt + 1, fixTargets: ft0, reason: '按 SPEC ISSUE 修意图字段' };
    }
    if (fs && hasOwn(ENV_FATAL, fs)) return { action: 'reject', attempt: attempt, reason: '环境/连接/部署类失败(' + fs + ')非 spec 可修，交人工/环境', fixTargets: [] };
    if (!fs || !hasOwn(SPEC_FIXABLE, fs)) return { action: 'reject', attempt: attempt, reason: '失败段不可由 spec 修: ' + fs, fixTargets: [] };
    var ft = fixTargets(result, caps.modifiableFields);
    if (!ft.length) return { action: 'reject', attempt: attempt, reason: '失败(' + fs + ')但无定位到可改字段（白名单内）', fixTargets: [] };
    return { action: 'retry-fix-spec', attempt: attempt + 1, fixTargets: ft, reason: '修 ' + fs + ' 定位字段' };
  }

  return { nextAction: nextAction, failedStage: failedStage, fixTargets: fixTargets };
})();
