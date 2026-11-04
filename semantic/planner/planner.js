// semantic/planner/planner.js — I4 确定性内核：结构化意图 → ReportSpec + 假设/追问/警告（r2 §4.2）
//   零 load、零 Java、零 com.fr、零全局依赖：所有外部件经 ctx 注入（resolve/validateSpec/capability/caps），
//   既满足 R7 core 红线，又让离线测可喂任意 fake ctx 证伪。planner 只做翻译+编排，校验一处真相仍复用 I1 SpecValidator。
//   三态分流（r2 §4.3）：正确性歧义→unresolvedQuestions（不替用户选、不编造）；能力越权→validationWarnings（deferred 标 owner，不降级）；
//   非正确性默认（版式/宽度/是否合计）→ assumptions（自决，不追问）。仅当全部落地且 spec 合法时 status=ready。
var ReportPlanner = (function () {
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // 解析术语 → 物理列（property/column 目标）或 {aggregate}（I3 指标目标）或 {ambiguous}/{unknown}
  function mapTerm(ctx, term, wantAggregate) {
    var r = ctx.resolve(term);
    if (r.status === 'unknown') return { kind: 'unknown', term: term };
    if (r.status === 'ambiguous') return { kind: 'ambiguous', term: term, candidates: r.candidates };
    var cand = r.candidates[0];
    // 度量若解析到 I3 聚合指标（非可列求和物理列）→ 能力越权，交 capability 判 deferred
    if (cand.target === 'metric') {
      var agg = ctx.capability.metricTargetIsAggregate('metric', ctx.caps);
      return { kind: 'deferred', term: term, reason: agg.reason, owner: agg.owner };
    }
    var raw = cand.column || cand.ref || '';
    var col = String(raw).indexOf('.') >= 0 ? String(raw).split('.').pop() : String(raw);   // 去 table 前缀，取物理列叶名
    return { kind: 'ok', term: term, field: col, label: term };
  }

  function plan(intent, ctx) {
    var assumptions = [], unresolvedQuestions = [], validationWarnings = [];
    if (!intent || typeof intent !== 'object') {
      validationWarnings.push({ term: '(root)', reason: '意图非法', owner: '输入' });
      return { status: 'rejected', reportSpec: null, assumptions: assumptions, unresolvedQuestions: unresolvedQuestions, validationWarnings: validationWarnings };
    }

    // ===== I5：SQL 数据集意图（模型驱动）→ 直通 sql ReportSpec（opt-in；内嵌路径不受影响）=====
    if (intent.dataset && intent.dataset.kind === 'sql') {
      var dsn = intent.dataset;
      if (hasOwn(intent, 'filters')) validationWarnings.push({ feature: 'filters', reason: '非日期筛选暂不接', owner: 'I2/I3' });
      // 模型成员校验（维度/指标名须在模型中；不在→unresolvedQuestions/unknown，不编造）
      function namesIn(list, key) {
        var out = [];
        (list || []).forEach(function (x) {
          var name = typeof x === 'string' ? x : (x && x.term);
          out.push(name);
        });
        return out;
      }
      var dims = namesIn(dsn.dimensions, 'dimensions'), mets = namesIn(dsn.metrics, 'metrics');
      var memberMissing = 0;   // I5.1 P2：模型成员缺失计数——有缺失即不得 ready（语义未决不塞给生成链）
      if (ctx.model) {
        var dset = {}, mset = {};
        (ctx.model.dimensions || []).forEach(function (d) { dset[d.name] = 1; });
        (ctx.model.metrics || []).forEach(function (m) { mset[m.name] = 1; });
        var keepDim = [], keepMet = [];
        dims.forEach(function (dn) { if (dn && hasOwn(dset, dn)) keepDim.push(dn); else { validationWarnings.push({ term: dn, reason: '维度不在模型，未编造', owner: '模型缺口(I3)' }); memberMissing++; } });
        mets.forEach(function (mn) { if (mn && hasOwn(mset, mn)) keepMet.push(mn); else { validationWarnings.push({ term: mn, reason: '指标不在模型，未编造', owner: '模型缺口(I3)' }); memberMissing++; } });
        dims = keepDim; mets = keepMet;
      }
      var sqlSpec = {
        specVersion: '1', outName: intent.outName || 'planner_sql',
        report: { name: intent.reportName || intent.outName || 'planner_sql' },
        dataset: { kind: 'sql', connection: dsn.connection, entity: dsn.entity, dimensions: dims, metrics: mets, dateRange: dsn.dateRange },
        presentation: { type: 'table', showTotal: !(intent.presentation && intent.presentation.showTotal === false) }
      };
      assumptions.push({ key: 'dataset.kind', value: 'sql', why: '模型驱动 SQL 由 sqlbuilder 生成（非自由文本）' });
      var sqlErrs = ctx.validateSpec(sqlSpec);
      // I5.1 P2：成员缺失（幽灵维度/指标）→ 绝不 ready；否则 validateSpec 决定 ready/rejected
      var sqlStatus = memberMissing ? 'rejected' : ((sqlErrs && sqlErrs.length) ? 'rejected' : 'ready');
      if (sqlErrs && sqlErrs.length) sqlErrs.forEach(function (e) { validationWarnings.push({ term: e.path, reason: e.code + ': ' + e.message, owner: 'spec 校验' }); });
      return { status: sqlStatus, reportSpec: sqlStatus === 'ready' ? sqlSpec : null, assumptions: assumptions, unresolvedQuestions: unresolvedQuestions, validationWarnings: validationWarnings };
    }

    // 能力越权键（filters/chart/semantic 源）→ deferred + owner，不降级
    (['filters', 'chart']).forEach(function (feat) {
      if (hasOwn(intent, feat) && intent[feat] != null) {
        var c = ctx.capability.intentFeature(feat, ctx.caps);
        if (c.verdict !== 'supported') validationWarnings.push({ feature: feat, reason: c.reason, owner: c.owner });
      }
    });

    // dimensions（恒 text 列）
    var dims = [];
    (intent.dimensions || []).forEach(function (term) {
      var m = mapTerm(ctx, term, false);
      if (m.kind === 'ok') dims.push({ field: m.field, label: m.label || m.field });
      else if (m.kind === 'ambiguous') unresolvedQuestions.push({ kind: 'dimension', term: m.term, candidates: m.candidates, requiresConfirmation: true });
      else if (m.kind === 'deferred') validationWarnings.push({ term: m.term, reason: m.reason, owner: m.owner });
      else validationWarnings.push({ term: m.term, reason: '未知业务术语，未编造字段', owner: '模型缺口（I3 补映射）' });
    });

    // metrics（v1 sum-only；非 sum 或解析到聚合指标 → deferred，不入 spec）
    var mets = [];
    (intent.metrics || []).forEach(function (mm) {
      var term = mm && mm.term, agg = (mm && mm.aggregation) || 'sum';
      var a = ctx.capability.aggregation(agg, ctx.caps);
      if (a.verdict !== 'supported') { validationWarnings.push({ term: term, reason: a.reason, owner: a.owner }); return; }
      var m = mapTerm(ctx, term, true);
      if (m.kind === 'ok') mets.push({ field: m.field, label: m.label || m.field, aggregation: 'sum', dataType: 'number' });
      else if (m.kind === 'ambiguous') unresolvedQuestions.push({ kind: 'metric', term: m.term, candidates: m.candidates, requiresConfirmation: true });
      else if (m.kind === 'deferred') validationWarnings.push({ term: m.term, reason: m.reason, owner: m.owner });
      else validationWarnings.push({ term: m.term, reason: '未知业务术语，未编造指标', owner: '模型缺口（I3 补映射）' });
    });

    // 非正确性默认（自决不追问，r2 §4.3）
    var showTotal = !(intent.presentation && intent.presentation.showTotal === false);
    assumptions.push({ key: 'presentation.type', value: 'table', why: 'I1 v1 只 table' });
    assumptions.push({ key: 'presentation.showTotal', value: showTotal, why: '含度量默认给合计（可被 presentation.showTotal=false 覆盖）' });
    assumptions.push({ key: 'columnWidth', value: 'default', why: '列宽/字号非正确性，走渲染标尺不点名追问' });

    var rows = intent.rows;
    var spec = {
      specVersion: '1',
      outName: intent.outName || 'planner_out',
      report: { name: intent.reportName || intent.outName || 'planner_out' },
      dimensions: dims,
      metrics: mets,
      dataset: { rows: Array.isArray(rows) ? rows : [] },
      presentation: { type: 'table', showTotal: showTotal }
    };

    // 状态裁决：有未决歧义→ambiguous；否则组 spec 复验，合法→ready，非法/越权→rejected
    var status;
    if (unresolvedQuestions.length) status = 'ambiguous';
    else {
      var errs = ctx.validateSpec(spec);
      if (errs && errs.length) {
        errs.forEach(function (e) { validationWarnings.push({ term: e.path, reason: e.code + ': ' + e.message, owner: 'spec 校验' }); });
        status = 'rejected';
      } else status = 'ready';
    }
    return {
      status: status,
      reportSpec: (status === 'ready') ? spec : null,
      assumptions: assumptions,
      unresolvedQuestions: unresolvedQuestions,
      validationWarnings: validationWarnings
    };
  }

  return { plan: plan };
})();
