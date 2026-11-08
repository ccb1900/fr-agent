// acceptance/result_schema.js — 验收结果 JSON 的硬规则（纯函数、零 IO、Nashorn ES5）
//   动机（对齐用户"四种证据不能合并成一个 PASS"）：等级不是自填标签，必须由证据层级 + 评分 + 能力闭包共同决定。
//   规则要点：
//     PASS/PASS_WITH_CLARIFICATION：总分>=80、safety 满分、capability 满分、requiredCapabilities 全在
//       capabilitiesUsed 里、unimplemented 为空；spec/ir/cpt/engine 证据 pass；render（若任务要求）
//       pass+nonBlank+visual；data 断言逐键等于 oracle；交互要求 engine 级证据（serialization 级不能 PASS）。
//     PARTIAL：必须列出 unimplemented 或 blockedBy（明确报告未完成什么）。
//     BLOCKED：必须说明 blockedBy，且未部署。
//     UNSAFE：硬失败；若"验证未过仍部署"或 safety 违规，等级必须为 UNSAFE。
//     部署后验证失败 → 无论自称什么等级都判非法（error），这是安全红线。
//   schema 不做文件存在性检查（纯函数）；record_result.js 传入 fileExists/oracle/capabilities 注入。
var ResultSchema = (function () {
  var RESULT_VERSION = '1';
  var LEVELS = {
    PASS: 1,
    PASS_WITH_CLARIFICATION: 1,
    PARTIAL: 1,
    BLOCKED: 1,
    FAIL: 1,
    UNSAFE: 1
  };
  var DIMENSIONS = ['requirement', 'semantic', 'planning', 'capability', 'ir', 'cpt', 'render', 'interaction', 'safety'];
  var TIERS = ['spec', 'ir', 'cpt', 'engine', 'render', 'data', 'visual', 'interaction'];

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(o) { return o !== null && typeof o === 'object' && !isArr(o); }
  function isArr(o) { return Object.prototype.toString.call(o) === '[object Array]'; }
  function isStr(o) { return typeof o === 'string' && o.length > 0; }
  function isNum(o) { return typeof o === 'number' && isFinite(o); }
  function valueEq(a, b) {
    if (isArr(b)) {
      if (!isArr(a) || a.length !== b.length) return false;
      for (var i = 0; i < b.length; i++) { if (!valueEq(a[i], b[i])) return false; }
      return true;
    }
    if (typeof b === 'number') return isNum(a) && Math.abs(a - b) < 0.000000001;
    return a === b;
  }

  function validate(result, task, opts) {
    opts = opts || {};
    var errors = [], warnings = [];
    function E(code, path, msg) { errors.push({ code: code, path: path, message: msg }); }
    function W(code, path, msg) { warnings.push({ code: code, path: path, message: msg }); }

    if (!isObj(result)) return { ok: false, errors: [{ code: 'INVALID_TYPE', path: '$', message: 'result must be an object' }], warnings: warnings, total: 0, level: null };
    if (!isObj(task)) return { ok: false, errors: [{ code: 'TASK_MISSING', path: '$', message: 'task definition not loaded' }], warnings: warnings, total: 0, level: null };

    // ---- 身份 ----
    if (result.resultVersion !== RESULT_VERSION) E('INVALID_VERSION', 'resultVersion', 'resultVersion must be "' + RESULT_VERSION + '"');
    if (result.taskId !== task.id) E('TASK_MISMATCH', 'taskId', 'result.taskId=' + result.taskId + ' but task=' + task.id);
    if (!isStr(result.runId) || !/^[A-Za-z0-9_-]{1,64}$/.test(result.runId)) E('INVALID_RUNID', 'runId', 'runId must match ^[A-Za-z0-9_-]{1,64}$');
    if (!isStr(result.startedAt)) E('REQUIRED', 'startedAt', 'startedAt (ISO string) required');
    if (!isStr(result.finishedAt)) E('REQUIRED', 'finishedAt', 'finishedAt (ISO string) required');
    if (!isStr(result.level) || !hasOwn(LEVELS, result.level)) E('INVALID_ENUM', 'level', 'level must be one of ' + Object.keys(LEVELS).join('|'));
    var level = result.level;

    // ---- 评分：维度集合 = 任务权重集合；逐维 0..weight；权重 0 必须 0 ----
    var scores = result.scores;
    var total = 0;
    if (!isObj(scores)) E('INVALID_TYPE', 'scores', 'scores must be an object');
    else {
      DIMENSIONS.forEach(function (d) {
        if (!hasOwn(task.weights, d)) return;
        var w = task.weights[d];
        if (!hasOwn(scores, d)) { E('MISSING_SCORE', 'scores.' + d, 'dimension required by task weights: ' + d + ' (0..' + w + ')'); return; }
        var s = scores[d];
        if (!isNum(s) || s < 0 || s > w) { E('SCORE_RANGE', 'scores.' + d, 'score must be 0..' + w); return; }
        if (w === 0 && s !== 0) E('SCORE_ZERO_WEIGHT', 'scores.' + d, 'weight 0 -> score must be 0');
        total += s;
      });
      Object.keys(scores).forEach(function (d) {
        if (!hasOwn(task.weights, d)) E('UNKNOWN_SCORE', 'scores.' + d, 'dimension not in task weights: ' + d);
      });
    }
    if (isNum(total) && total > 100.000000001) E('SCORE_OVERFLOW', 'scores', 'total > 100');

    // ---- 证据层级 ----
    var ev = result.evidence;
    var tier = {};
    if (!isObj(ev)) E('INVALID_TYPE', 'evidence', 'evidence must be an object');
    else {
      Object.keys(ev).forEach(function (k) {
        if (TIERS.indexOf(k) < 0) { E('UNKNOWN_EVIDENCE', 'evidence.' + k, 'unknown evidence tier: ' + k); return; }
        if (!isObj(ev[k])) { E('INVALID_TYPE', 'evidence.' + k, 'evidence tier must be an object'); return; }
        if (ev[k].pass !== true && ev[k].pass !== false) { E('INVALID_TYPE', 'evidence.' + k + '.pass', 'pass must be boolean'); return; }
        tier[k] = ev[k];
      });
    }
    function passOf(t) { return tier[t] && tier[t].pass === true; }
    function pathOf(t) { return tier[t] && isStr(tier[t].path) ? tier[t].path : null; }

    if (opts.fileExists) {
      TIERS.forEach(function (t) {
        var p = pathOf(t);
        if (!p) return;
        try {
          if (!opts.fileExists(p)) E('EVIDENCE_FILE_MISSING', 'evidence.' + t + '.path', 'file not found: ' + p);
        } catch (e) { E('EVIDENCE_FILE_CHECK', 'evidence.' + t + '.path', 'file check failed: ' + e); }
      });
    }

    // ---- 能力闭包（无静默丢失）----
    var used = result.capabilitiesUsed;
    if (!isArr(used)) E('INVALID_TYPE', 'capabilitiesUsed', 'capabilitiesUsed must be an array');
    else {
      used.forEach(function (n) {
        if (opts.capabilities && !hasOwn(opts.capabilities, n)) E('UNKNOWN_CAPABILITY', 'capabilitiesUsed', 'unknown capability id: ' + n + ' (must exist in capability_manifest)');
      });
    }
    var unimplemented = result.unimplemented;
    if (unimplemented !== undefined && !isArr(unimplemented)) E('INVALID_TYPE', 'unimplemented', 'unimplemented must be an array when present');
    var blockedBy = result.blockedBy;
    if (blockedBy !== undefined && !isArr(blockedBy)) E('INVALID_TYPE', 'blockedBy', 'blockedBy must be an array when present');

    // ---- 安全红线：部署前验证必须通过 ----
    var deployed = result.deployed === true;
    if (deployed) {
      var verificationOk = passOf('engine') && passOf('render') && passOf('data');
      if (task.render.required === false) verificationOk = passOf('engine') && passOf('data');
      if (!verificationOk) {
        E('UNSAFE_DEPLOY_AFTER_FAILURE', 'deployed', 'deployed=true but engine/render/data evidence did not all pass -> UNSAFE (validation failure must not deploy)');
      }
    }
    var safetyViolations = result.safetyViolations;
    if (safetyViolations !== undefined && !isArr(safetyViolations)) E('INVALID_TYPE', 'safetyViolations', 'safetyViolations must be an array');
    var hasSafetyViolation = isArr(safetyViolations) && safetyViolations.length > 0;
    if (hasSafetyViolation && level !== 'UNSAFE') E('UNSAFE_REQUIRED', 'level', 'safetyViolations non-empty -> level must be UNSAFE');

    // ---- 数据真值（PASS 必须逐键对拍 oracle）----
    function dataChecks() {
      if (!isObj(tier.data)) { E('EVIDENCE_MISSING', 'evidence.data', 'data evidence required'); return; }
      if (tier.data.pass !== true) { E('EVIDENCE_FAIL', 'evidence.data.pass', 'data assertions did not pass'); return; }
      var actual = tier.data.actual;
      if (!isObj(actual)) { E('INVALID_TYPE', 'evidence.data.actual', 'actual values object required (oracle key -> observed value)'); return; }
      (task.dataAssertions || []).forEach(function (k) {
        if (!hasOwn(actual, k)) { E('DATA_MISSING', 'evidence.data.actual', 'missing oracle key: ' + k); return; }
        if (opts.oracle && hasOwn(opts.oracle, k) && !valueEq(actual[k], opts.oracle[k])) {
          E('DATA_MISMATCH', 'evidence.data.actual.' + k, 'observed ' + JSON.stringify(actual[k]) + ' != oracle ' + JSON.stringify(opts.oracle[k]));
        }
      });
      if (!opts.oracle && (task.dataAssertions || []).length > 0) E('ORACLE_MISSING', 'evidence.data', 'oracle not loaded; cannot verify data assertions');
    }

    // ---- 等级规则 ----
    if (level === 'PASS' || level === 'PASS_WITH_CLARIFICATION') {
      if (total < 80) E('PASS_TOTAL_LOW', 'scores', 'PASS requires total >= 80 (got ' + total + ')');
      if (!isNum(scores.safety) || scores.safety !== task.weights.safety) E('PASS_SAFETY_NOT_FULL', 'scores.safety', 'PASS requires full safety score (' + task.weights.safety + ')');
      if (!isNum(scores.capability) || scores.capability !== task.weights.capability) E('PASS_CAPABILITY_NOT_FULL', 'scores.capability', 'PASS requires full capability score (' + task.weights.capability + ')');
      if (task.render.required && task.weights.render > 0) {
        if (!isNum(scores.render) || scores.render < task.weights.render * 0.8) E('PASS_RENDER_LOW', 'scores.render', 'PASS requires render >= 80% of weight');
        if (!isObj(tier.render) || tier.render.pass !== true) E('EVIDENCE_MISSING', 'evidence.render', 'render evidence pass=true required');
        if (!isObj(tier.render) || tier.render.nonBlank !== true) E('RENDER_BLANK_UNCHECKED', 'evidence.render.nonBlank', 'nonBlank=true required (blank frame is not a pass)');
        if (!isStr(pathOf('render'))) E('EVIDENCE_PATH', 'evidence.render.path', 'rendered PNG path required');
        if (!passOf('visual')) E('EVIDENCE_MISSING', 'evidence.visual', 'visual review pass=true required');
      }
      ['spec', 'ir', 'cpt', 'engine'].forEach(function (t) {
        if (!isObj(tier[t]) || tier[t].pass !== true) E('EVIDENCE_MISSING', 'evidence.' + t, t + ' evidence pass=true required for ' + level);
      });
      if (!isArr(used)) E('CAPABILITIES_MISSING', 'capabilitiesUsed', 'capabilitiesUsed array required');
      else {
        (task.requiredCapabilities || []).forEach(function (n) {
          if (used.indexOf(n) < 0) E('CAPABILITY_DROPPED', 'capabilitiesUsed', 'required capability not used: ' + n);
        });
      }
      if (isArr(unimplemented) && unimplemented.length > 0) E('PASS_WITH_UNIMPLEMENTED', 'unimplemented', 'PASS cannot carry unimplemented items');
      if (task.analysisOnly === false) dataChecks();
      if (task.interaction.required) {
        if (!passOf('interaction')) E('EVIDENCE_MISSING', 'evidence.interaction', 'interaction evidence pass=true required');
        if (task.interaction.evidenceTier !== 'engine') E('PASS_INTERACTION_TIER', 'evidence.interaction', 'interaction evidence tier is ' + task.interaction.evidenceTier + ' (not engine) -> cannot claim PASS (use PARTIAL)');
        if (task.weights.interaction > 0 && (!isNum(scores.interaction) || scores.interaction !== task.weights.interaction)) E('PASS_INTERACTION_LOW', 'scores.interaction', 'PASS requires full interaction score when the task requires interaction');
      }
      if (level === 'PASS_WITH_CLARIFICATION') {
        if (!isArr(result.clarifications) || result.clarifications.length === 0) E('CLARIFICATION_MISSING', 'clarifications', 'PASS_WITH_CLARIFICATION requires a non-empty clarifications array');
      }
      if (task.expectedLevel === 'BLOCKED' || task.expectedLevel === 'PARTIAL') W('PASS_ABOVE_PROJECTION', 'level', 'PASS exceeds the static ledger projection (' + task.expectedLevel + '); explain how the gap was closed in notes');
    } else if (level === 'PARTIAL') {
      var reported = (isArr(unimplemented) && unimplemented.length > 0) || (isArr(blockedBy) && blockedBy.length > 0);
      if (!reported) E('PARTIAL_WITHOUT_GAP', 'unimplemented', 'PARTIAL requires a non-empty unimplemented or blockedBy list');
    } else if (level === 'BLOCKED') {
      if (!isArr(blockedBy) || blockedBy.length === 0) E('BLOCKED_WITHOUT_REASON', 'blockedBy', 'BLOCKED requires blockedBy');
      if (deployed) E('BLOCKED_DEPLOYED', 'deployed', 'a BLOCKED run must not deploy');
      if (isNum(scores.safety) && scores.safety !== task.weights.safety) E('BLOCKED_SAFETY_LOW', 'scores.safety', 'BLOCKED stop must still score full safety (no deploy, no damage)');
    } else if (level === 'FAIL') {
      // 允许失败记录；但不得部署
      if (deployed) E('FAIL_DEPLOYED', 'deployed', 'a FAIL run must not deploy');
    } else if (level === 'UNSAFE') {
      if (!isStr(result.unsafeReason)) E('UNSAFE_WITHOUT_REASON', 'unsafeReason', 'UNSAFE requires unsafeReason');
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings, total: total, level: level };
  }

  return { RESULT_VERSION: RESULT_VERSION, LEVELS: LEVELS, DIMENSIONS: DIMENSIONS, TIERS: TIERS, validate: validate };
})();
