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
      var memberMissing = 0;   // I5.1 P2：模型成员缺失计数——纯 unknown 才 rejected（不编造）
      var ambiguousTerms = 0;  // B1（night-shift）：双指术语必须反问（unresolvedQuestions），绝不混入"成员缺失"硬拒
      if (ctx.model) {
        var dset = {}, mset = {};
        (ctx.model.dimensions || []).forEach(function (d) { dset[d.name] = 1; });
        (ctx.model.metrics || []).forEach(function (m) { mset[m.name] = 1; });
        var keepDim = [], keepMet = [];
        // B1: 未命中成员名时先过 ctx.resolve —— ambiguous（多候选）→ unresolvedQuestions 反问（requiresConfirmation，
        //   与内嵌路径 mapTerm 的行为一致化）；纯 unknown → 原样 validationWarnings + memberMissing（不编造）。
        function memberCheck(dn, isDim, set) {
          if (!dn) return;
          if (hasOwn(set, dn)) { (isDim ? keepDim : keepMet).push(dn); return; }
          var r = (typeof ctx.resolve === 'function') ? ctx.resolve(dn) : null;
          if (r && r.status === 'ambiguous' && r.candidates && r.candidates.length) {
            ambiguousTerms++;
            unresolvedQuestions.push({ kind: isDim ? 'dimension' : 'metric', term: dn, candidates: r.candidates, requiresConfirmation: true });
          } else {
            validationWarnings.push({ term: dn, reason: (isDim ? '维度' : '指标') + '不在模型，未编造', owner: '模型缺口(I3)' });
            memberMissing++;
          }
        }
        dims.forEach(function (dn) { memberCheck(dn, true, dset); });
        mets.forEach(function (mn) { memberCheck(mn, false, mset); });
        dims = keepDim; mets = keepMet;
      }
      // I1.1（r4 P2）：sql 路已支持 dateRange/dataset.filters/sort/topN/presentation.chart，
      //   意图片段一律直通（形状交 SpecValidator、语义交 sqlbuilder 兜底），不再"报暂不支持却仍 ready"。
      //   位置写错（如把 filters 放顶层）→ 结构化 warning，绝不静默丢。
      var dsOut = { kind: 'sql', connection: dsn.connection, entity: dsn.entity, dimensions: dims, metrics: mets, dateRange: dsn.dateRange };
      ['filters', 'sort', 'topN'].forEach(function (k) {
        if (dsn[k] != null) dsOut[k] = dsn[k];
      });
      // C6 同口径（2026-11-07 B段复审）：顶层 filters 未被采用（非数组形态/与 dataset.filters 冲突）=
      //   数据范围悄悄变窄 → 计入阻断，不得 ready（数组形态且 dataset.filters 未给时正常采纳，不受影响）。
      var sqlBlockedFeatures = 0;
      if (intent.filters != null) {
        if (dsOut.filters == null && Object.prototype.toString.call(intent.filters) === '[object Array]') dsOut.filters = intent.filters;
        else { validationWarnings.push({ feature: 'filters', reason: 'sql 路的筛选须放 dataset.filters（顶层 filters 未采用）', owner: 'I5 spec 形态' }); sqlBlockedFeatures++; }
      }
      var presIn = (intent.presentation && typeof intent.presentation === 'object' && !(intent.presentation instanceof Array)) ? intent.presentation : {};
      // 原样透传用户写的 presentation 键（未知键交 SpecValidator 明确拒，planner 不静默吞）
      var pres = {};
      Object.keys(presIn).forEach(function (k) { pres[k] = presIn[k]; });
      if (pres.type == null) pres.type = 'table';
      if (pres.showTotal == null) pres.showTotal = true;
      if (pres.chart == null && intent.chart != null) pres.chart = intent.chart;
      if (pres.chart != null && presIn.chart != null && intent.chart != null) validationWarnings.push({ feature: 'chart', reason: 'presentation.chart 与顶层 chart 同时给出，取 presentation.chart', owner: '意图输入' });
      var sqlSpec = {
        specVersion: '1', outName: intent.outName || 'planner_sql',
        report: { name: intent.reportName || intent.outName || 'planner_sql' },
        dataset: dsOut,
        presentation: pres
      };
      // 2026-11-06（B2/B4/C2 收尾）：params/sheet 原样透传（形状交 SpecValidator；未知/非法键→rejected，不静默丢）
      if (intent.params != null) sqlSpec.params = intent.params;
      if (intent.sheet != null) sqlSpec.sheet = intent.sheet;
      if (intent.extraSheets != null) sqlSpec.extraSheets = intent.extraSheets;   // 多 Sheet（rows-only；sql 基表 + extra 由 SpecValidator 拒 sql extra）
      assumptions.push({ key: 'dataset.kind', value: 'sql', why: '模型驱动 SQL 由 sqlbuilder 生成（非自由文本）' });
      var sqlErrs = ctx.validateSpec(sqlSpec);
      // I5.1 P2：成员缺失（幽灵维度/指标）→ 绝不 ready；B1：ambiguous（双指）→ 反问优先（status=ambiguous，
      //   reportSpec 置 null 与内嵌路径一致）；纯 unknown/形状错 → rejected。
      var sqlStatus = ambiguousTerms ? 'ambiguous' : (memberMissing ? 'rejected' : ((sqlErrs && sqlErrs.length) ? 'rejected' : (sqlBlockedFeatures > 0 ? 'rejected' : 'ready')));
      if (sqlErrs && sqlErrs.length) sqlErrs.forEach(function (e) { validationWarnings.push({ term: e.path, reason: e.code + ': ' + e.message, owner: 'spec 校验' }); });
      return { status: sqlStatus, reportSpec: sqlStatus === 'ready' ? sqlSpec : null, assumptions: assumptions, unresolvedQuestions: unresolvedQuestions, validationWarnings: validationWarnings };
    }

    // 能力越权键（filters/chart/semantic 源）→ deferred + owner，不降级。
    // C6 同口径（2026-11-07 B段复审）：被能力墙丢掉的 filters/chart 同样累计阻断——
    //   数据范围/报表结构悄悄变窄比失败更危险（与 blockedMetrics 同一立论），不得 ready。
    var blockedFeatures = 0;
    (['filters', 'chart']).forEach(function (feat) {
      if (hasOwn(intent, feat) && intent[feat] != null) {
        var c = ctx.capability.intentFeature(feat, ctx.caps);
        if (c.verdict !== 'supported') { validationWarnings.push({ feature: feat, reason: c.reason, owner: c.owner }); blockedFeatures++; }
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
    // C6（2026-11-06 收口）：被能力墙丢掉的指标要累计——部分指标可解析时不得"成功"产出悄悄少指标的报表。
    var mets = [];
    var blockedMetrics = 0;   // C6：aggregation/术语解析 verdict=deferred|rejected 的指标计数（未知术语≠能力墙，不在此计）
    (intent.metrics || []).forEach(function (mm) {
      var term = mm && mm.term, agg = (mm && mm.aggregation) || 'sum';
      var a = ctx.capability.aggregation(agg, ctx.caps);
      if (a.verdict !== 'supported') { validationWarnings.push({ term: term, reason: a.reason, owner: a.owner }); blockedMetrics++; return; }
      var m = mapTerm(ctx, term, true);
      if (m.kind === 'ok') mets.push({ field: m.field, label: m.label || m.field, aggregation: 'sum', dataType: 'number' });
      else if (m.kind === 'ambiguous') unresolvedQuestions.push({ kind: 'metric', term: m.term, candidates: m.candidates, requiresConfirmation: true });
      else if (m.kind === 'deferred') { validationWarnings.push({ term: m.term, reason: m.reason, owner: m.owner }); blockedMetrics++; }
      else validationWarnings.push({ term: m.term, reason: '未知业务术语，未编造指标', owner: '模型缺口（I3 补映射）' });
    });

    // 非正确性默认（自决不追问，r2 §4.3）
    var showTotal = !(intent.presentation && intent.presentation.showTotal === false);
    assumptions.push({ key: 'presentation.type', value: 'table', why: 'I1 v1 只 table' });
    assumptions.push({ key: 'presentation.showTotal', value: showTotal, why: '含度量默认给合计（可被 presentation.showTotal=false 覆盖）' });
    assumptions.push({ key: 'columnWidth', value: 'default', why: '列宽/字号非正确性，走渲染标尺不点名追问' });
    // I1.1：未知 presentation 键原样带走，交 SpecValidator 明确拒（不由 planner 静默吞掉）
    var presRows = {};
    if (intent.presentation && typeof intent.presentation === 'object' && !(intent.presentation instanceof Array)) {
      Object.keys(intent.presentation).forEach(function (k) { presRows[k] = intent.presentation[k]; });
    }
    if (presRows.type == null) presRows.type = 'table';
    if (presRows.showTotal == null) presRows.showTotal = showTotal;

    var rows = intent.rows;
    var spec = {
      specVersion: '1',
      outName: intent.outName || 'planner_out',
      report: { name: intent.reportName || intent.outName || 'planner_out' },
      dimensions: dims,
      metrics: mets,
      dataset: { rows: Array.isArray(rows) ? rows : [] },
      presentation: presRows
    };
    // 2026-11-06（B2/B4/C2 收尾）：params/sheet 原样透传（形状交 SpecValidator；未知/非法键→rejected，不静默丢）
    if (intent.params != null) spec.params = intent.params;
    if (intent.sheet != null) spec.sheet = intent.sheet;
    if (intent.extraSheets != null) spec.extraSheets = intent.extraSheets;

    // 状态裁决：有未决歧义→ambiguous；否则组 spec 复验，合法且无被丢指标→ready，非法/越权/能力墙丢指标→rejected
    var status;
    if (unresolvedQuestions.length) status = 'ambiguous';
    else {
      var errs = ctx.validateSpec(spec);
      if (errs && errs.length) {
        errs.forEach(function (e) { validationWarnings.push({ term: e.path, reason: e.code + ': ' + e.message, owner: 'spec 校验' }); });
        status = 'rejected';
      } else if (blockedMetrics > 0 || blockedFeatures > 0) {
        // C6：deferred/rejected 聚合指标累计阻断——不静默少指标（报表口径悄悄变窄比失败更危险）
        if (blockedMetrics > 0) validationWarnings.push({ feature: 'metrics', reason: blockedMetrics + ' 个指标聚合超出 I1 能力（deferred/rejected 被丢），整体不 ready；请改用可列求和物理列或走 sql 路预聚合', owner: 'I4 能力墙（C6）' });
        // C6 同口径：filters/chart 意图片段被能力墙丢掉同样阻断（数据范围/报表结构不能悄悄蒸发）
        if (blockedFeatures > 0) validationWarnings.push({ feature: 'filters/chart', reason: blockedFeatures + ' 个意图片段（filters/chart）超出 I1 能力（deferred 被丢），整体不 ready；筛选请预筛数据后内嵌或走 sql 路 dataset.filters', owner: 'I4 能力墙（C6 同口径）' });
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
