// semantic/model/evidence.js — I5.5/r6：数据侧唯一性证据的解析、身份绑定、完整性与时效（纯函数，零 IO/零 java）
//   背景（r5/r6 P1）：探针 COUNT(DISTINCT) 只是"某时刻的数据快照"，不等于数据库唯一约束。
//   本件把证据变成结构化契约（evidenceVersion=2）：
//     raw = {
//       evidenceVersion:"2", status:"passed"|"failed",
//       schema:"<逻辑 Schema 名>",
//       sourceFingerprint, modelFingerprint, schemaFingerprint,      ← r6：物理身份/模型/Schema 指纹
//       probedAt:"<ISO-8601>",
//       checks:[{table,column,rows,distinct,unique,relation,relationFingerprint}]
//     }
//   接受条件（全部满足才注入）：
//     ① status=passed 且 version 认；② 三枚指纹与当前连接/模型/Schema 一致；③ probedAt 在时效内；
//     ④ 每条 check 的 relationFingerprint == 当前模型关系指纹（含 name/source/cardinality/from/to）；
//     ⑤ unique=true 且 rows===distinct；⑥ 每条待验证关系有且只有一条 check（缺=missing，重复=duplicates）。
//   任一不满足 → 不注入（validator 会因缺证据拒 JOIN），并给分类原因供 runner 打日志。
var ModelEvidence = (function () {
  var EVIDENCE_VERSION = '2';
  var DEFAULT_MAX_AGE_DAYS = 30;   // 数据快照默认 30 天时效；生产可 env 覆盖（I55_EVIDENCE_MAX_AGE_DAYS）
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isStr(v) { return typeof v === 'string'; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  // ---- 规范形（探针与 runner 必须用同一套，才能算出同一指纹）----
  function canonicalRelation(r) {
    r = r || {};
    return JSON.stringify({
      name: r.name || null, source: r.source || null, cardinality: r.cardinality || null,
      from: { table: (r.from || {}).table || null, column: (r.from || {}).column || null },
      to: { table: (r.to || {}).table || null, column: (r.to || {}).column || null }
    });
  }
  function canonicalModel(model) {
    var rels = ((model && model.relationships) || []).map(canonicalRelation);
    return JSON.stringify({
      modelVersion: (model && model.modelVersion) || null,
      domain: (model && model.domain) || null,
      source: (model && model.source) || null,
      relationships: rels
    });
  }
  function canonicalSchema(schema) {
    var tables = ((schema && schema.tables) || []).map(function (t) {
      return {
        name: t.name,
        columns: (t.columns || []).map(function (c) { return { name: c.name, typeName: c.typeName, jdbcType: c.jdbcType, nullable: c.nullable }; })
          .sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); }),
        primaryKey: (t.primaryKey || []).map(function (k) { return { column: k.column, seq: k.seq }; })
          .sort(function (a, b) { return (+a.seq || 0) - (+b.seq || 0); }),
        indexes: (t.indexes || []).map(function (ix) {
          return { unique: !!ix.unique, columns: (ix.columns || []).map(function (c) { return c.name || c.column || null; }) };
        })
      };
    }).sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
    return JSON.stringify({ tables: tables });
  }
  // 只含连接的非敏感部分（driver + url）；绝不纳入 user/password
  function canonicalSource(conn) {
    conn = conn || {};
    return JSON.stringify({ driver: conn.driver || null, url: conn.url || null });
  }
  function fnv(s, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    var hex = h.toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return hex;
  }
  function hash(s) { return fnv(s, 2166136261) + fnv(s, 2246822519); }   // 16 hex（双种子，防单 32 位碰撞）
  function relationFingerprint(r) { return hash(canonicalRelation(r)); }
  function fingerprints(opts) {
    opts = opts || {};
    return {
      source: hash(canonicalSource(opts.connection)),
      model: hash(canonicalModel(opts.model)),
      schema: hash(canonicalSchema(opts.schema))
    };
  }

  function parse(text) {
    try { var o = JSON.parse(String(text)); return isObj(o) ? o : null; } catch (e) { return null; }
  }

  // 模型里所有需要数据侧唯一性证明的关系（confirmed 且 JOIN-safe 基数）
  function requiredRelations(model) {
    var out = [];
    ((model && model.relationships) || []).forEach(function (r) {
      if (!r || r.source !== 'confirmed') return;
      if (r.cardinality !== 'N:1' && r.cardinality !== '1:1') return;
      var to = r.to || {};
      if (!to.table || !to.column) return;
      out.push({ name: r.name, table: to.table, column: to.column, key: to.table + '.' + to.column });
    });
    return out;
  }
  function findRelation(model, name) {
    var rels = (model && model.relationships) || [];
    for (var i = 0; i < rels.length; i++) if (rels[i] && rels[i].name === name) return rels[i];
    return null;
  }

  // 完整性收口：无论前面因何失败，都要报"哪些待验证关系没有有效证据"（不接受部分证据）
  function finish(out, model) {
    requiredRelations(model).forEach(function (rq) {
      if (!out.unique[rq.key]) out.missing.push(rq.name + ' (' + rq.key + ') 缺少有效证据');
    });
    return out;
  }

  // opts: {fingerprints, model, nowMs, maxAgeDays}
  // 返回 {unique:{'t.c':true}, accepted:[], rejected:[], stale:[], mismatched:[], malformed:[], missing:[], duplicates:[]}
  function filter(raw, opts) {
    var out = { unique: {}, accepted: [], rejected: [], stale: [], mismatched: [], malformed: [], missing: [], duplicates: [] };
    opts = opts || {};
    if (!isObj(raw)) { out.malformed.push('evidence root 非对象'); return finish(out, opts.model); }
    if (String(raw.evidenceVersion) !== EVIDENCE_VERSION) { out.malformed.push('evidenceVersion 不支持: ' + raw.evidenceVersion + '（需 ' + EVIDENCE_VERSION + '，旧证据请重跑探针）'); return finish(out, opts.model); }
    if (raw.status !== 'passed') { out.malformed.push('探针 status=' + raw.status + '（非 passed 的整份证据不可消费）'); return finish(out, opts.model); }
    var fp = opts.fingerprints || {};
    var fpOk = true;
    [['sourceFingerprint', 'source', '物理数据源'], ['modelFingerprint', 'model', '模型'], ['schemaFingerprint', 'schema', 'Schema 快照']].forEach(function (p) {
      if (!isStr(raw[p[0]]) || !raw[p[0]]) { out.malformed.push('缺 ' + p[0]); fpOk = false; return; }
      if (String(raw[p[0]]) !== String(fp[p[1]] || '')) { out.mismatched.push(p[2] + '指纹不匹配（证据=' + raw[p[0]] + ' 当前=' + fp[p[1]] + '）'); fpOk = false; }
    });

    var probedMs = isStr(raw.probedAt) ? Date.parse(raw.probedAt) : NaN;
    if (!isNum(probedMs)) { out.malformed.push('probedAt 缺失/不可解析（需 ISO-8601）'); return finish(out, opts.model); }
    var maxAgeDays = isNum(opts.maxAgeDays) ? opts.maxAgeDays : DEFAULT_MAX_AGE_DAYS;
    var now = isNum(opts.nowMs) ? opts.nowMs : Date.now();
    var ageMs = now - probedMs;
    var fresh = ageMs >= -300000 && ageMs <= maxAgeDays * 86400000;   // 允许 5 分钟时钟漂移
    if (!fresh) out.stale.push('证据已过期/时钟异常: probedAt=' + raw.probedAt + ' ageDays=' + (ageMs / 86400000).toFixed(1) + ' max=' + maxAgeDays);

    var checks = raw.checks;
    if (!Array.isArray(checks) || !checks.length) { out.malformed.push('checks 须非空数组'); return finish(out, opts.model); }

    // 先按关系名分组，抓重复（"有且只有一条"）
    var byRel = {};
    checks.forEach(function (c) { if (isObj(c) && isStr(c.relation)) byRel[c.relation] = (byRel[c.relation] || 0) + 1; });

    checks.forEach(function (c, i) {
      var p = 'checks[' + i + ']';
      if (!isObj(c)) { out.malformed.push(p + ' 非对象'); return; }
      if (!isStr(c.table) || !c.table || !isStr(c.column) || !c.column) { out.malformed.push(p + ' 缺 table/column'); return; }
      if (!isNum(c.rows) || !isNum(c.distinct) || typeof c.unique !== 'boolean') { out.malformed.push(p + ' rows/distinct/unique 形态非法'); return; }
      if (!isStr(c.relation) || !c.relation) { out.malformed.push(p + ' 缺 relation'); return; }
      var key = c.table + '.' + c.column;
      if (byRel[c.relation] > 1) { out.duplicates.push(c.relation + ' 有多条证据（须有且只有一条）'); return; }
      if (!c.unique) { out.rejected.push(key + ': 数据不唯一 rows=' + c.rows + ' distinct=' + c.distinct); return; }
      if (c.rows !== c.distinct) { out.rejected.push(key + ': rows!=distinct 自相矛盾'); return; }
      var rel = findRelation(opts.model, c.relation);
      if (!rel) { out.mismatched.push(key + ': 关系 ' + c.relation + ' 不在模型中'); return; }
      var to = rel.to || {};
      if (to.table !== c.table || to.column !== c.column) { out.mismatched.push(key + ': 证据列与关系 to-side 不符（' + to.table + '.' + to.column + '）'); return; }
      if (!isStr(c.relationFingerprint) || c.relationFingerprint !== relationFingerprint(rel)) {
        out.malformed.push(key + ': 关系指纹不匹配（关系定义已变化，旧证据失效）'); return;
      }
      if (!fpOk) { out.mismatched.push(key + ': 身份/模型/Schema 指纹不匹配'); return; }
      if (!fresh) { out.stale.push(key + ': 过期'); return; }
      out.unique[key] = true;
      out.accepted.push(key + ' (' + c.relation + ', ' + c.rows + '/' + c.distinct + ')');
    });

    // 完整性：每条待验证关系必须有且只有一条被接受的证据
    return finish(out, opts.model);
  }

  return {
    EVIDENCE_VERSION: EVIDENCE_VERSION,
    DEFAULT_MAX_AGE_DAYS: DEFAULT_MAX_AGE_DAYS,
    parse: parse, filter: filter, fingerprints: fingerprints, relationFingerprint: relationFingerprint,
    requiredRelations: requiredRelations
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ModelEvidence;
