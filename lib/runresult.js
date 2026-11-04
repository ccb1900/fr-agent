// lib/runresult.js — Runner 结果契约（迭代 4 地基：现成 Agent 的稳定机器可读裁决）
//   纯数据模型，零运行时依赖（不 import、不引引擎类）——与 ir.js 同红线，可离线单测。
//   设计（ub-mode：Model the Domain / Type System Discipline / Make Operations Idempotent）：
//     · 一次管线 = 固定 stage 全序 × 状态域 {pending|running|passed|failed|skipped} + 有序 diagnostics；
//     · 非法 stage / 非法状态 = 写不出来（set 处 parse 边界一次），不是跑一半炸；
//     · success 由 stage 推导（一处真相）：任一 failed→false；skipped 不算失败；全 passed(可含 skipped)→true；
//       有 pending/running 未定→null（未完）；
//     · fail 自动把下游 pending 置 skipped（短路显式化，Agent 一眼看出哪段没跑）；
//     · toJson 逐字确定（键序=STAGES 全序）→ 幂等、可 diff、崩溃重跑同结果。
var RunResult = (function () {
  // 一处真相：stage 全序（Runner 与 Agent 都读这个表）
  var STAGES = ['input_load', 'ir_validate', 'object_build', 'cpt_export', 'cpt_validate', 'execute', 'render', 'deploy'];
  var STATUS = { pending: 1, running: 1, passed: 1, failed: 1, skipped: 1 };

  function stageIdx(stage) {
    var i = STAGES.indexOf(stage);
    if (i < 0) throw new Error('[RunResult] unknown stage: ' + stage);
    return i;
  }

  function begin() {
    var st = {};
    STAGES.forEach(function (s) { st[s] = 'pending'; });
    var diags = [];

    function set(stage, status) {
      var i = stageIdx(stage);
      if (!Object.prototype.hasOwnProperty.call(STATUS, status)) throw new Error('[RunResult] bad status: ' + status);
      st[stage] = status;
      if (status === 'failed') { // 短路：下游未跑的段记为 skipped（因果显式，非隐藏崩溃）
        for (var j = i + 1; j < STAGES.length; j++) if (st[STAGES[j]] === 'pending') st[STAGES[j]] = 'skipped';
      }
    }

    function success() {
      var failed = 0, settled = 0;
      STAGES.forEach(function (s) {
        if (st[s] === 'failed') failed++;
        if (st[s] === 'passed' || st[s] === 'skipped') settled++;
      });
      if (failed > 0) return false;
      if (settled === STAGES.length) return true;
      return null;
    }

    function snapshot() {
      var stages = {};
      STAGES.forEach(function (s) { stages[s] = st[s]; }); // 固定键序 → 确定序列化
      return { success: success(), stages: stages, order: STAGES.slice(), diagnostics: diags.slice() };
    }

    return {
      get: function (s) { stageIdx(s); return st[s]; },  // stageIdx 校验合法性（未知抛）；按名取值
      set: set,
      run: function (s) { set(s, 'running'); },
      pass: function (s) { set(s, 'passed'); },
      fail: function (s) { set(s, 'failed'); },
      skip: function (s) { set(s, 'skipped'); },
      diag: function (m) { diags.push(String(m)); },
      diagnostics: function () { return diags.slice(); },
      success: success,
      snapshot: snapshot,
      finish: snapshot,               // 幂等：只产快照、不改状态，重复调用同结果
      toJson: function () { return JSON.stringify(snapshot()); }
    };
  }

  return { begin: begin, STAGES: STAGES };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RunResult;
