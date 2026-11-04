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
  // 只含连接的非敏感部分（driver + 规范化 url）；凭据参数先剔除再入哈希（r7 P1）
  var SENSITIVE_PARAMS = /([;?&])(password|pwd|user|username|userid|user name|sslpwd|truststorepassword)\s*=\s*[^;&]*/gi;
  function normalizeUrl(url) {
    var s = String(url == null ? '' : url);
    s = s.replace(SENSITIVE_PARAMS, '');           // 直接剔除，不保留 <redacted> 占位（否则加参数仍改指纹）
    s = s.replace(/([;?&])[;?&]+/g, '$1');         // 折叠悬空分隔符
    s = s.replace(/[;?&]+$/, '');
    s = s.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    return s;
  }
  function canonicalSource(conn) {
    conn = conn || {};
    return JSON.stringify({ driver: conn.driver ? String(conn.driver) : null, url: normalizeUrl(conn.url) });
  }
  // ---- SHA-256（纯 ES5，零 Java 依赖：semantic 核心不引后端类；FNV 只够变更检测，不够身份证据）----
  var SHA_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function utf8Bytes(s) {
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return out;
  }
  function rrot(x, n) { return ((x >>> n) | (x << (32 - n))) | 0; }
  function sha256(s) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var bytes = utf8Bytes(String(s)), l = bytes.length;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(l / 0x20000000);          // (l*8) / 2^32
    var lo = (l * 8) >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    for (var off = 0; off < bytes.length; off += 64) {
      var w = new Array(64), i;
      for (i = 0; i < 16; i++) {
        w[i] = ((bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3]) | 0;
      }
      for (i = 16; i < 64; i++) {
        var s0 = (rrot(w[i - 15], 7) ^ rrot(w[i - 15], 18) ^ (w[i - 15] >>> 3));
        var s1 = (rrot(w[i - 2], 17) ^ rrot(w[i - 2], 19) ^ (w[i - 2] >>> 10));
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = (rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25));
        var ch = ((e & f) ^ ((~e) & g));
        var t1 = (h + S1 + ch + SHA_K[i] + w[i]) | 0;
        var S0 = (rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22));
        var maj = ((a & b) ^ (a & c) ^ (b & c));
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var hex = '';
    for (var j = 0; j < 8; j++) {
      var x = H[j] >>> 0, part = x.toString(16);
      while (part.length < 8) part = '0' + part;
      hex += part;
    }
    return hex;
  }
  function hash(s) { return sha256(s); }
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

  // 完整性收口：以**关系名**为完整性主键（两个关系可指向同一 table.column，不能互相顶替）；
  //   uniqueKeys 只是给 ModelValidator 的注入结果，不承担"某关系已被证明"的语义。
  function finish(out, model) {
    requiredRelations(model).forEach(function (rq) {
      if (!out.acceptedRelations[rq.name]) out.missing.push(rq.name + ' (' + rq.key + ') 缺少有效证据');
    });
    return out;
  }

  // opts: {fingerprints, model, nowMs, maxAgeDays}
  // 返回 {unique:{'t.c':true}, accepted:[], rejected:[], stale:[], mismatched:[], malformed:[], missing:[], duplicates:[]}
  function filter(raw, opts) {
    var out = { unique: {}, accepted: [], acceptedRelations: {}, rejected: [], stale: [], mismatched: [], malformed: [], missing: [], duplicates: [] };
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
      out.acceptedRelations[c.relation] = true;
      out.accepted.push(key + ' (' + c.relation + ', ' + c.rows + '/' + c.distinct + ')');
    });

    // 完整性：每条待验证关系必须有且只有一条被接受的证据
    return finish(out, opts.model);
  }

  return {
    EVIDENCE_VERSION: EVIDENCE_VERSION,
    DEFAULT_MAX_AGE_DAYS: DEFAULT_MAX_AGE_DAYS,
    parse: parse, filter: filter, fingerprints: fingerprints, relationFingerprint: relationFingerprint,
    requiredRelations: requiredRelations, sha256: sha256, normalizeUrl: normalizeUrl
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ModelEvidence;
