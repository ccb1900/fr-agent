// semantic/model/resolver.js — I3 语义映射解析：业务术语 → 候选（零 java，离线可测）
//   r2 §3.3 铁律：置信度只作排序，不替代业务确认——
//     · 唯一候选 → status=resolved（仍不"悄悄选"，只是无歧义）
//     · 多候选   → status=ambiguous + requiresConfirmation=true（按 confidence 降序排，但不替用户拍板）
//     · 无候选   → status=unknown + candidates=[]（不臆造字段，对齐 §4"不允许静默编造业务指标"）
var ModelResolver = (function () {
  var RANK = { high: 3, medium: 2, low: 1 };
  function byConfidenceDesc(a, b) { return (RANK[b.confidence] || 0) - (RANK[a.confidence] || 0); }

  function resolve(idx, term) {
    var list = ((idx.terms && idx.terms[String(term)]) || []).slice().sort(byConfidenceDesc);
    if (!list.length) {
      return { term: term, status: 'unknown', candidates: [], requiresConfirmation: false, note: '无匹配，不臆造（须先补模型映射）' };
    }
    if (list.length === 1) {
      return { term: term, status: 'resolved', candidates: list, requiresConfirmation: false };
    }
    // 多候选 = 业务歧义（如"评分"→指标 平均分 vs 属性 score）：暴露、排序，但交回人类确认
    return { term: term, status: 'ambiguous', candidates: list, requiresConfirmation: true };
  }

  return { resolve: resolve };
})();
