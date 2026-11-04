// semantic/preflight.js — r6-D：模型驱动 SQL 的编译前置检查器（纯函数，零 IO/零 java）
//   职责（且仅此）：把"载入的 model / schema / evidence + 当前物理连接身份"合成一次前置裁决：
//     ① 指纹（物理数据源 + 模型关系 + Schema 快照）与证据绑定；
//     ② ModelValidator 模型↔Schema 回溯校验（注入唯一性证据）；
//     ③ 证据完整性（每条待验证关系有且只有一条有效证据）。
//   不接管：ReportSpec 校验（lib/spec_validator）、SQL 生成（semantic/query/sqlbuilder）、实际数据库连接。
//   调用方须先 load: model/vocab.js、model/validator.js、model/evidence.js（保持本件零依赖）。
var SemanticPreflight = (function () {
  function run(opts) {
    opts = opts || {};
    var diagnostics = [];
    function push(code, path, message, severity) { diagnostics.push({ code: code, path: path, message: message, severity: severity || 'error' }); }
    var model = opts.model, schema = opts.schema;
    if (!model) push('PREFLIGHT_MODEL_MISSING', 'model', '模型缺失');
    if (!schema) push('PREFLIGHT_SCHEMA_MISSING', 'schema', 'Schema 快照缺失（先跑 semantic/schema/inspect_main.js）');
    if (!model || !schema) return { ok: false, diagnostics: diagnostics, context: {} };

    var fp = ModelEvidence.fingerprints({ connection: opts.connection, model: model, schema: schema });
    var ev = ModelEvidence.filter(opts.evidenceRaw, {
      fingerprints: fp, model: model, nowMs: opts.nowMs, maxAgeDays: opts.maxAgeDays
    });

    var mvErrs = ModelValidator.validate(model, schema, { uniqueKeyEvidence: ev.unique });
    mvErrs.forEach(function (e) { push(e.code, e.path, e.message); });

    ev.accepted.forEach(function (s) { push('EVIDENCE_ACCEPTED', 'evidence', s, 'info'); });
    [['EVIDENCE_MALFORMED', ev.malformed], ['EVIDENCE_REJECTED', ev.rejected], ['EVIDENCE_STALE', ev.stale],
     ['EVIDENCE_MISMATCH', ev.mismatched], ['EVIDENCE_DUPLICATE', ev.duplicates]].forEach(function (p) {
      p[1].forEach(function (s) { push(p[0], 'evidence', s, 'warn'); });
    });
    // 缺证据是错误（JOIN 不能建立在"没有证据"上）；其余证据异常是警告（只有真正导致缺失时才阻断）
    ev.missing.forEach(function (s) { push('EVIDENCE_MISSING', 'evidence', s); });

    return {
      ok: !diagnostics.some(function (d) { return d.severity === 'error'; }),
      diagnostics: diagnostics,
      context: { model: model, schema: schema, uniqueKeyEvidence: ev.unique, evidence: ev, fingerprints: fp }
    };
  }
  return { run: run };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SemanticPreflight;
