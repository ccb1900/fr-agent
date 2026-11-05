// application/contracts.js — r8 §十一 A1：统一创作契约（纯函数，零 IO/零 java，可离线测）
//   目标：Create（generated）与 Modify（patched）产出**同一种 ReportArtifact**，Agent 只消费它，
//   不再靠解析控制台日志判断成功；失败能定位到 业务/语义/编译/执行/验证 阶段。
//   不做：不重跑引擎、不持有 WorkBook、不替代 RunResult（RunResult 仍是执行事实，本层只做统一封装）。
var ReportArtifact = (function () {
  var ARTIFACT_VERSION = '1';
  var SOURCE_TYPES = { generated: 1, patched: 1, duplicated: 1 };

  function isStr(v) { return typeof v === 'string'; }
  function isArr(v) { return Array.isArray(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function normalizeDiagnostic(d) {
    if (isStr(d)) return { code: 'DIAG', path: '', message: d, stage: null, severity: 'error' };
    d = d || {};
    return {
      code: isStr(d.code) && d.code ? d.code : 'DIAG',
      path: isStr(d.path) ? d.path : '',
      message: isStr(d.message) ? d.message : String(d.message || ''),
      stage: isStr(d.stage) ? d.stage : null,
      severity: (d.severity === 'warn' || d.severity === 'info') ? d.severity : 'error'
    };
  }

  // RunResult（11 段）→ 统一执行视图 + 结构化诊断（不修改原 RunResult 契约/字节）
  function executionFromRunResult(rr) {
    rr = rr || {};
    var stages = isObj(rr.stages) ? rr.stages : null;
    var failed = null;
    if (stages) Object.keys(stages).forEach(function (k) { if (!failed && stages[k] === 'failed') failed = k; });
    return { ok: rr.success === true, exit: typeof rr.exit === 'number' ? rr.exit : null, stages: stages, failedStage: failed, source: 'runresult' };
  }
  function diagnosticsFromRunResult(rr) {
    var out = [];
    ((rr && rr.diagnostics) || []).forEach(function (s) {
      var m = /^([A-Za-z0-9_]+) @ ([^:]+): ([\s\S]*)$/.exec(String(s));
      if (m) out.push({ code: m[1], path: m[2], message: m[3], stage: null, severity: 'error' });
      else out.push({ code: 'DIAG', path: '', message: String(s), stage: null, severity: 'error' });
    });
    var stages = (rr && rr.stages) || {};
    Object.keys(stages).forEach(function (k) {
      if (stages[k] === 'failed') out.push({ code: 'STAGE_FAILED', path: k, message: 'stage ' + k + ' failed', stage: k, severity: 'error' });
    });
    return out;
  }
  // patch.json（patch_main 产物）→ 执行视图 + 诊断
  // r14 P1: FAIL-CLOSED. Patch success REQUIRES manifest present + diffClean===true + execution & render regressions
  //   passed. Missing evidence is NOT evidence of success — the old `mf.diffClean !== false` treated an absent
  //   diffClean (or absent manifest) as pass, so a patch whose manifest.json was missing could still be declared ok.
  function executionFromPatch(pj) {
    pj = pj || {};
    var mf = pj.manifest;
    var ok = pj.ok === true && !!mf && mf.diffClean === true
      && !!mf.execution && mf.execution.pass === true
      && !!mf.render && mf.render.pass === true;
    var failedStage = null;
    if (!ok) {
      failedStage = (pj.ok !== true) ? 'patch'
        : (!mf || mf.diffClean !== true) ? 'diff'
        : 'regression';
    }
    return { ok: ok, exit: typeof pj.exit === 'number' ? pj.exit : null, stages: null, failedStage: failedStage, source: 'patch' };
  }
  function diagnosticsFromPatch(pj) {
    var out = [], mf = (pj && pj.manifest);
    if (pj && pj.ok !== true) out.push({ code: 'PATCH_FAILED', path: 'patch', message: 'patch_main 退出码 ' + (pj.exit == null ? '?' : pj.exit), stage: 'patch', severity: 'error' });
    if (!mf) { out.push({ code: 'MANIFEST_MISSING', path: 'manifest', message: 'patch manifest 缺失——无法证明回归通过，判失败（fail-closed）', stage: 'diff', severity: 'error' }); return out; }
    if (mf.diffClean !== true) out.push({ code: 'DIFF_UNCLEAN', path: 'diff', message: '未改部分出现非预期变化或 diffClean 缺失', stage: 'diff', severity: 'error' });
    ['execution', 'render'].forEach(function (k) {
      if (!mf[k] || mf[k].pass !== true) out.push({ code: 'REGRESSION_' + String(k).toUpperCase(), path: k, message: mf[k] ? String(mf[k].reason || '') : (k + ' 回归证据缺失'), stage: 'regression', severity: 'error' });
    });
    (mf.datasetChecks || []).forEach(function (c) {
      if (c && c.pass === false) out.push({ code: 'DATASET_MISMATCH', path: 'dataset', message: String(c.reason || ''), stage: 'regression', severity: 'error' });
    });
    return out;
  }

  // parts: {sourceType, runId, outName, cptPath, pngPath, pdfPath, execution, validation, preview, diagnostics, spec, patch, staging, createdAt}
  //   runId（r10-A）：每次操作的独立身份——artifactId 唯一化 + 任务目录隔离（logs/agent/runs/{runId}/），防并发/陈旧污染
  function create(parts) {
    parts = parts || {};
    var sourceType = SOURCE_TYPES[parts.sourceType] ? parts.sourceType : 'generated';
    var runId = isStr(parts.runId) && parts.runId ? parts.runId : '';
    return {
      artifactVersion: ARTIFACT_VERSION,
      artifactId: sourceType + ':' + (parts.outName || 'unknown') + '@' + (runId || 'norun'),
      runId: runId,
      sourceType: sourceType,
      outName: parts.outName || null,
      createdAt: parts.createdAt || new Date().toISOString(),
      cptPath: parts.cptPath || null,
      pngPath: parts.pngPath || null,
      pdfPath: parts.pdfPath || null,
      execution: parts.execution || null,
      validation: parts.validation || null,
      preview: parts.preview || null,
      diagnostics: (parts.diagnostics || []).map(normalizeDiagnostic),
      spec: parts.spec || null,
      patch: parts.patch || null,
      staging: parts.staging || null
    };
  }

  // 校验产物契约本身（不是业务验收）：结构非法即 issues，ok=false
  function validate(art) {
    var issues = [];
    function E(path, msg) { issues.push({ code: 'ARTIFACT_INVALID', path: path, message: msg, stage: 'artifact', severity: 'error' }); }
    if (!isObj(art)) { E('artifact', '必须是对象'); return { ok: false, issues: issues }; }
    if (String(art.artifactVersion) !== ARTIFACT_VERSION) E('artifactVersion', '不支持: ' + art.artifactVersion);
    if (!SOURCE_TYPES[art.sourceType]) E('sourceType', '须 generated|patched|duplicated: ' + art.sourceType);
    if (!isStr(art.artifactId) || !art.artifactId) E('artifactId', '必填');
    if (!isStr(art.runId) || !art.runId) E('runId', '必填（r10-A：每次操作独立身份）');
    if (!isStr(art.outName) || !art.outName) E('outName', '必填');
    if (!isStr(art.cptPath) || !art.cptPath) E('cptPath', '必填');
    if (!isObj(art.execution) || typeof art.execution.ok !== 'boolean') E('execution', '须 {ok:bool,...}');
    if (art.sourceType === 'patched' && !isObj(art.patch)) E('patch', 'patched 产物须带 patch 信息');
    if (art.sourceType === 'generated' && !isObj(art.spec)) E('spec', 'generated 产物须带 spec 信息');
    if (!isArr(art.diagnostics)) E('diagnostics', '须数组');
    else art.diagnostics.forEach(function (d, i) {
      if (!isObj(d) || !isStr(d.code) || !isStr(d.message)) E('diagnostics[' + i + ']', '须 {code,message,...}');
    });
    return { ok: issues.length === 0, issues: issues };
  }

  // 业务验收汇总：执行成功 + 通过 validate 时的 checks（若有）
  function acceptance(art) {
    if (!isObj(art)) return { ok: false, reason: 'artifact 缺失' };
    var execOk = !!(art.execution && art.execution.ok);
    var valOk = art.validation ? art.validation.ok === true : null;
    var diagErr = (art.diagnostics || []).some(function (d) { return d.severity === 'error'; });
    var ok = execOk && !diagErr && valOk !== false;
    return { ok: ok, executionOk: execOk, validationOk: valOk, errorDiagnostics: (art.diagnostics || []).filter(function (d) { return d.severity === 'error'; }).length };
  }

  return {
    ARTIFACT_VERSION: ARTIFACT_VERSION,
    create: create, validate: validate, acceptance: acceptance,
    normalizeDiagnostic: normalizeDiagnostic,
    executionFromRunResult: executionFromRunResult, diagnosticsFromRunResult: diagnosticsFromRunResult,
    executionFromPatch: executionFromPatch, diagnosticsFromPatch: diagnosticsFromPatch
  };
})();
