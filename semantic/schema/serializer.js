// semantic/schema/serializer.js — I2 纯函数核心：标准化 schema 文档组装 + 落盘前凭据自检（零 java）
//   输出形态贴近 r2 §2.2，但列名/键取本管线归一口径；无采样字段（I2 v1 不采样，非法态不可表达）。
//   凭据纪律镜像（README #54/#55）：source 必须是裸库标签（禁连接串），且整棵树递归扫过 assertClean
//   ——任何 key/value 命中凭据词（password/secret/token 或 'jdbc:'/'://'）即拒绝，绝不写盘。
var SchemaSerializer = (function () {
  var SECRET_KEYS = /^(password|passwd|secret|token|credential|user|username|url|jdbcurl)$/i;
  var SECRET_VALS = /(password|passwd|secret|token|credential)/i;
  var URLISH = /(jdbc:|:\/\/)/i;

  function isObj(v) { return !!v && typeof v === 'object'; }

  // 表按名排序、列已按 ordinal（metadata 排过）；relations 三桶各自稳定
  function assemble(input) {
    var tables = (input.tables || []).slice().sort(function (a, b) {
      return String(a.name) < String(b.name) ? -1 : (String(a.name) > String(b.name) ? 1 : 0);
    });
    return {
      specVersion: '1',
      source: input.source,
      dialect: input.dialect || null,
      capturedAt: input.capturedAt || null,
      tables: tables.map(function (t) {
        return {
          name: t.name, schema: t.schema || null, type: t.type || 'TABLE',
          columns: t.columns || [],
          primaryKey: t.primaryKey || [],
          foreignKeys: (t.foreignKeys || []),
          indexes: t.indexes || []
        };
      }),
      relations: {
        structural: (input.relations && input.relations.structural) || [],
        fk: (input.relations && input.relations.fk) || [],
        unconfirmedNaming: (input.relations && input.relations.unconfirmedNaming) || []
      }
    };
  }

  // 递归收集凭据违例路径（key 名命中 SECRET_KEYS，或值含 url/jdbc 或凭据词）
  function scan(node, path, hits) {
    if (Array.isArray(node)) { node.forEach(function (x, i) { scan(x, path + '[' + i + ']', hits); }); return; }
    if (isObj(node)) {
      Object.keys(node).forEach(function (k) {
        if (SECRET_KEYS.test(k)) hits.push('KEY@' + (path ? path + '.' : '') + k);
        scan(node[k], (path ? path + '.' : '') + k, hits);
      });
      return;
    }
    if (typeof node === 'string') {
      if (URLISH.test(node) || SECRET_VALS.test(node)) hits.push('VAL@' + path + '=' + node.slice(0, 24));
    }
  }
  function assertClean(doc) { var hits = []; scan(doc, '', hits); return hits; }

  // 序列化：先断言无凭据，有违例直接抛（调用方据此拒绝写盘），绝不用脏 doc 落文件
  function toJson(doc) {
    var hits = assertClean(doc);
    if (hits.length) throw new Error('[schema] credential gate: refusing to serialize, ' + hits.length + ' hits: ' + hits.slice(0, 5).join(' ; '));
    return JSON.stringify(doc, null, 1);
  }

  return { assemble: assemble, assertClean: assertClean, toJson: toJson };
})();
