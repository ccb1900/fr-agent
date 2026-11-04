// semantic/model/evidence.js — I5.5/r5：数据侧唯一性证据的解析、绑定与时效（纯函数，零 IO/零 java）
//   背景（r5 P1）：探针 COUNT(DISTINCT) 只是"某时刻的数据快照"，不等于数据库唯一约束；
//   旧实现只做两段文本匹配就注入证据 → 数据源/新鲜度/关系归属全无约束。本件把证据变成结构化契约：
//     raw = { schema:"<schema source>", probedAt:"<ISO-8601>", checks:[{table,column,rows,distinct,unique,relation}] }
//   接受条件（全部满足）：schema 源匹配 + probedAt 可解析且在时效内 + unique=true 且 rows===distinct +
//     check.relation 指向 model 中 to-side 恰为 table.column 的 confirmed 关系。
//   任何一条不满足 → 不注入（validator 会因缺证据拒 JOIN），并给出结构化原因供 runner 打日志。
var ModelEvidence = (function () {
  var DEFAULT_MAX_AGE_DAYS = 30;   // 数据快照默认 30 天时效；生产可 env 覆盖（I55_EVIDENCE_MAX_AGE_DAYS）
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isStr(v) { return typeof v === 'string'; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function parse(text) {
    try { var o = JSON.parse(String(text)); return isObj(o) ? o : null; } catch (e) { return null; }
  }

  // model 里是否存在 name === relationName 且 to.table/to.column 恰为 table/column 的关系
  function relationMatches(model, relationName, table, column) {
    var rels = (model && model.relationships) || [];
    for (var i = 0; i < rels.length; i++) {
      var r = rels[i];
      if (!r || r.name !== relationName) continue;
      var to = r.to || {};
      if (to.table === table && to.column === column) return true;
    }
    return false;
  }

  // opts: {schemaSource, model, nowMs, maxAgeDays}
  // 返回 {unique:{'t.c':true}, accepted:[], rejected:[], stale:[], mismatched:[], malformed:[]}
  function filter(raw, opts) {
    var out = { unique: {}, accepted: [], rejected: [], stale: [], mismatched: [], malformed: [] };
    opts = opts || {};
    if (!isObj(raw)) { out.malformed.push('evidence root 非对象'); return out; }
    if (!isStr(raw.schema) || !raw.schema) out.malformed.push('缺 schema 源标识');
    var probedMs = isStr(raw.probedAt) ? Date.parse(raw.probedAt) : NaN;
    if (!isNum(probedMs)) out.malformed.push('probedAt 缺失/不可解析（需 ISO-8601）');
    if (out.malformed.length) return out;

    var srcOk = String(raw.schema) === String(opts.schemaSource);
    if (!srcOk) out.mismatched.push('schema 源不匹配: 证据=' + raw.schema + ' 期望=' + opts.schemaSource);

    var maxAgeDays = isNum(opts.maxAgeDays) ? opts.maxAgeDays : DEFAULT_MAX_AGE_DAYS;
    var now = isNum(opts.nowMs) ? opts.nowMs : Date.now();
    var ageMs = now - probedMs;
    var fresh = ageMs >= -300000 && ageMs <= maxAgeDays * 86400000;   // 允许 5 分钟时钟漂移
    if (!fresh) out.stale.push('证据已过期/时钟异常: probedAt=' + raw.probedAt + ' ageDays=' + (ageMs / 86400000).toFixed(1) + ' max=' + maxAgeDays);

    var checks = raw.checks;
    if (!Array.isArray(checks) || !checks.length) { out.malformed.push('checks 须非空数组'); return out; }
    checks.forEach(function (c, i) {
      var p = 'checks[' + i + ']';
      if (!isObj(c)) { out.malformed.push(p + ' 非对象'); return; }
      if (!isStr(c.table) || !c.table || !isStr(c.column) || !c.column) { out.malformed.push(p + ' 缺 table/column'); return; }
      if (!isNum(c.rows) || !isNum(c.distinct) || typeof c.unique !== 'boolean') { out.malformed.push(p + ' rows/distinct/unique 形态非法'); return; }
      if (!isStr(c.relation) || !c.relation) { out.malformed.push(p + ' 缺 relation（证据不绑模型关系即不可采信）'); return; }
      var key = c.table + '.' + c.column;
      if (!c.unique) { out.rejected.push(key + ': 数据不唯一 rows=' + c.rows + ' distinct=' + c.distinct); return; }
      if (c.rows !== c.distinct) { out.rejected.push(key + ': rows!=distinct 自相矛盾'); return; }
      if (!srcOk) { out.mismatched.push(key + ': 数据源不匹配'); return; }
      if (!fresh) { out.stale.push(key + ': 过期'); return; }
      if (!relationMatches(opts.model, c.relation, c.table, c.column)) {
        out.mismatched.push(key + ': 关系 ' + c.relation + ' 在模型中不存在或 to-side 不匹配');
        return;
      }
      out.unique[key] = true;
      out.accepted.push(key + ' (' + c.relation + ', ' + c.rows + '/' + c.distinct + ')');
    });
    return out;
  }

  return { parse: parse, filter: filter, DEFAULT_MAX_AGE_DAYS: DEFAULT_MAX_AGE_DAYS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ModelEvidence;
