// semantic/planner/termnorm.js — r14 P2: Planner 工具层术语归一（纯函数，零 java/零 IO，可离线测）
//   候选契约（semantic/model/registry.js 一手）：{ target: 'property'|'column'|'metric'|'dimension', ref, column?, confidence }。
//   planner 的 SQL 路成员校验按"维度名/指标名"（即 target=dimension/metric 的 ref）比对，故归一只在这两类下取 ref；
//   property/column 不是 planner 成员名、ambiguous/unknown 不是 resolved —— 一律原样透传，绝不臆造含义不明的 name（r14 §三 P2）。
var TermNorm = (function () {
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // canonicalMember(cand) -> 规范模型成员名（dimension/metric 的 ref），否则 null
  function canonicalMember(cand) {
    if (!cand || typeof cand !== 'object') return null;
    if (cand.target === 'dimension' || cand.target === 'metric') return cand.ref;
    return null;
  }

  // normalizeList(list, resolveFn): list 元素为字符串或 {term,...}；resolved 且规范成员名可取 -> 替换 term 为规范名；
  //   其余（ambiguous/unknown/property/column/无匹配）原样返回，交 planner 走 unresolved/不编造语义。
  function normalizeList(list, resolveFn) {
    if (!Array.isArray(list)) return list;
    return list.map(function (raw) {
      var t = (raw && typeof raw === 'object') ? raw.term : raw;
      if (t == null) return raw;
      var r = resolveFn(String(t));
      if (r && r.status === 'resolved' && r.candidates && r.candidates.length) {
        var name = canonicalMember(r.candidates[0]);
        if (name) {
          if (raw && typeof raw === 'object') {
            var o = JSON.parse(JSON.stringify(raw));
            o.term = name;
            return o;
          }
          return name;
        }
      }
      return raw;
    });
  }

  return { canonicalMember: canonicalMember, normalizeList: normalizeList };
})();
