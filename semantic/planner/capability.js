// semantic/planner/capability.js — I4 能力墙判定单点（纯函数，零 load/零 Java/零 com.fr；r2 §4.3 超出后端能力明确拒）
//   planner 不重造校验，只把"意图片段是否落在 I1 ReportSpec v1 能力内"判成三值 + 归属迭代 owner。
//   caps 由调用方注入（ReportSpec.capabilities()/REJECTED/AGGREGATIONS + I3 metricKinds），避免 planner 直接 load lib/*。
var PlannerCapability = (function () {
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // 聚合口径：I1 v1 sum-only。非 sum → deferred 指向应接管的迭代（ratio/count/avg=I3/I5 语义查询域）。
  function aggregation(agg, caps) {
    if (agg == null || agg === 'sum') return { verdict: 'supported' };
    if (caps && caps.AGG_UNIMPLEMENTED && hasOwn(caps.AGG_UNIMPLEMENTED, agg))
      return { verdict: 'deferred', reason: '聚合 "' + agg + '" 超出 I1 v1 sum-only 能力', owner: 'I3/I5（语义查询预聚合，非列求和）' };
    return { verdict: 'rejected', reason: '未知聚合 "' + agg + '"', owner: '意图输入错误' };
  }

  // 意图级越权键：filters/chart/multiSheet/semanticQuery 各归其主迭代，planner 结构化拒、不静默降级。
  //   2026-11-07 全面闭环：chart 两路已支持（rows+sql 的 presentation.chart）→ supported；
  //   rows 路 filters 仍 deferred（请预筛内嵌），sql 路 filters 走 dataset.filters。
  function intentFeature(key, caps) {
    var OWNERS = { filters: 'I2/I3（rows 路请预筛数据内嵌；sql 路走 dataset.filters）', multiSheet: 'Planner 多 sheet 入口（extraSheets 已由透传支持，intent 顶层 multiSheet 键未定义）', semanticQuery: 'I2/I3' };
    if (hasOwn(OWNERS, key)) return { verdict: 'deferred', reason: key + ' 不是受支持的意图片段', owner: OWNERS[key] };
    return { verdict: 'supported' };
  }

  // I3 指标术语解析到"聚合指标"（countThreshold/ratio/weightedAvg…）→ 非 I1 列求和，deferred 而非降级成 sum。
  function metricTargetIsAggregate(target, caps) {
    if (target === 'metric') return { verdict: 'deferred', reason: '业务术语解析到 I3 聚合指标，非可列求和的物理列', owner: 'I5（生成期走 SQL/rawIR，不入 I1 ReportSpec）' };
    return { verdict: 'supported' };
  }

  return { aggregation: aggregation, intentFeature: intentFeature, metricTargetIsAggregate: metricTargetIsAggregate };
})();
