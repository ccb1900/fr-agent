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

  // W3（走查 P1-3）：detail 模式的列词归一——display column 允许 property/column 候选（明细表把实体 properties 上报表）。
  //   去重原则：property 候选与 column 候选 column 值相同时视为同一列（同实体别名混候选），直接采纳；
  //   column 值不同的候选并存 → ambiguous（不改判，plan 层交 unresolved——不编造）。
  //   结构：返回 { ok, dims?: [{term,label?,widthPt?}], ambiguous?: [{term, candidates}] , unknown?: [] }。
  function normalizeDetailColumns(list, resolveFn) {
    var dims = [], ambiguous = [], unknown = [];
    if (!Array.isArray(list)) return { ok: false, ambiguous: [], unknown: [], dims: [] };
    list.forEach(function (raw) {
      var t = (raw && typeof raw === 'object') ? raw.term : raw;
      if (t == null || String(t) === '') { unknown.push(String(t)); return; }
      var r = resolveFn(String(t));
      // W4：candidates[].ref（Entity.prop / 表.列）就是 Intent 可粘回的语法——detail 归一对前缀形同样可解：
      //   裸名 unknown 时剥「Entity.」前缀再 resolve 一次（registry terms 键=裸属性名/列名）。
      if (r && r.status === 'unknown' && String(t).indexOf('.') > 0) {
        var lastSeg = String(t).split('.').pop();
        var r2 = resolveFn(lastSeg);
        if (r2 && r2.status !== 'unknown') r = r2;
      }
      var cands = (r && r.candidates) || [];
      var usable = cands.filter(function (c) { return c && (c.target === 'property' || c.target === 'column'); });
      if (!usable.length) {
        if (r && r.status === 'unknown') unknown.push(String(t));
        else ambiguous.push({ term: String(t), candidates: cands });
        return;
      }
      var byCol = {};
      usable.forEach(function (c) { var ck = String(c.column || c.ref); byCol[ck] = byCol[ck] || c; });
      var uniqCols = Object.keys(byCol);
      if (uniqCols.length > 1) { ambiguous.push({ term: String(t), candidates: usable }); return; }
      var pick = usable.filter(function (c) { return c.target === 'property'; })[0] || usable[0];
      var ref = pick.ref;
      var out;
      if (raw && typeof raw === 'object') {
        out = {}; for (var ok2 in raw) if (Object.prototype.hasOwnProperty.call(raw, ok2)) out[ok2] = raw[ok2];
        out.term = ref;
      } else out = ref;
      dims.push(out);
    });
    return { ok: ambiguous.length === 0 && unknown.length === 0, dims: dims, ambiguous: ambiguous, unknown: unknown };
  }

  return { canonicalMember: canonicalMember, normalizeList: normalizeList, normalizeDetailColumns: normalizeDetailColumns };
})();
