// probes/probe_relation_unique.js — I5.5/r6 关系目标键唯一性探针（runraw，只读，原子）
//   r6 要求：
//     ① 与 Runner 使用同一套连接配置（SQL_DRIVER/SQL_URL/SQL_USER + dbpass），指纹才对得上；
//     ② 证据绑定物理数据源 + 模型关系（全定义指纹）+ Schema 快照指纹 + probedAt；
//     ③ 原子性：任一关系探测失败 → status=failed、exit(1)，绝不产出可消费的部分证据；
//     ④ 每条待验证关系一条 check（重复/缺失由 Runner 侧 ModelEvidence 拒绝）。
//   产物：data/i55_relation_unique_truth.json（机器消费）+ .txt（人类留痕）。
//   注意：数据侧唯一 ≠ 数据库唯一约束；长期保证需 DB 约束或 SQL 层处理重复键。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = 'D:/fineagent';
function genv(k, d) { var v = System.getenv(k); return (v == null || String(v) === '') ? d : String(v); }
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }
load(ROOT + '/semantic/model/evidence.js');

var out = [], checks = [], errors = [];
var model = null, schema = null, fp = null, status = 'passed';
try {
  model = JSON.parse(readUtf(ROOT + '/models/production/model.json'));
  var schemaName = 'schema_' + (model.source || 'atom_live_demo') + '.json';
  schema = JSON.parse(readUtf(ROOT + '/data/' + schemaName));
} catch (eLoad) {
  status = 'failed'; errors.push('load model/schema: ' + eLoad);
}

var connCfg = {
  driver: genv('SQL_DRIVER', 'com.microsoft.sqlserver.jdbc.SQLServerDriver'),
  url: genv('SQL_URL', 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false'),
  user: genv('SQL_USER', 'sa')
};
var targets = model ? ModelEvidence.requiredRelations(model) : [];
if (!targets.length && status === 'passed') out.push('NOTE 模型无 confirmed N:1/1:1 关系，无需探针');

if (status === 'passed' && targets.length) {
  fp = ModelEvidence.fingerprints({ connection: connCfg, model: model, schema: schema });
  var conn = null;
  try {
    conn = J('java.sql.DriverManager').getConnection(connCfg.url, connCfg.user, load(ROOT + '/lib/dbpass.js'));
    var q = conn.createStatement();
    var IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;   // 标识符白名单（防拼接注入）
    targets.forEach(function (t) {
      if (!IDENT.test(t.table) || !IDENT.test(t.column)) { status = 'failed'; errors.push(t.name + ': 非白名单标识符 ' + t.table + '.' + t.column); return; }
      try {
        var rs = q.executeQuery('SELECT COUNT(*) AS n, COUNT(DISTINCT ' + t.column + ') AS d FROM ' + t.table);
        var got = false;
        while (rs.next()) {
          var n = +rs.getLong('n'), d = +rs.getLong('d');   // 数值化，避免 Java Long 对象身份比较误判
          var unique = (n === d && d > 0);
          checks.push({
            table: t.table, column: t.column, rows: n, distinct: d, unique: unique,
            relation: t.name, relationFingerprint: ModelEvidence.relationFingerprint((function () {
              var rels = model.relationships || [];
              for (var i = 0; i < rels.length; i++) if (rels[i].name === t.name) return rels[i];
              return null;
            })())
          });
          out.push(t.table + '.' + t.column + ' relation=' + t.name + ' rows=' + n + ' distinct=' + d + ' unique=' + unique);
          got = true;
        }
        rs.close();
        if (!got) { status = 'failed'; errors.push(t.name + ': 查询无结果行'); }
      } catch (eQ) {
        status = 'failed'; errors.push(t.name + ': ' + eQ);
      }
    });
    q.close();
  } catch (eConn) {
    status = 'failed'; errors.push('connect: ' + eConn);
  } finally {
    if (conn != null) { try { conn.close(); } catch (eC) { } }
  }
  // 任一 check 不唯一也算失败（证据整体不可用）
  checks.forEach(function (c) { if (!c.unique) { status = 'failed'; errors.push(c.relation + ': 数据不唯一 rows=' + c.rows + ' distinct=' + c.distinct); } });
}

var raw = {
  evidenceVersion: ModelEvidence.EVIDENCE_VERSION,
  status: status,
  schema: model ? (model.source || 'atom_live_demo') : null,
  sourceFingerprint: fp ? fp.source : null,
  modelFingerprint: fp ? fp.model : null,
  schemaFingerprint: fp ? fp.schema : null,
  probedAt: new (J('java.util.Date'))().toInstant().toString(),
  checks: checks,
  error: errors.length ? errors.join(' | ') : null,
  note: '数据快照证据（不是 DB 唯一约束）；Runner 按物理源/模型关系/Schema 指纹 + 时效 + 完整性过滤'
};
out.push('VERDICT ' + (status === 'passed' ? 'PASS' : 'FAIL') + ' checks=' + checks.length + '/' + targets.length);
if (errors.length) out.push('ERRORS ' + errors.join(' | '));
var msg = out.join('\n');
print(msg);
try {
  Files.write(Pth.get(ROOT + '/data/i55_relation_unique_truth.json'), J('java.lang.String').valueOf(JSON.stringify(raw, null, 1)).getBytes('UTF-8'));
  Files.write(Pth.get(ROOT + '/data/i55_relation_unique_truth.txt'), J('java.lang.String').valueOf(msg).getBytes('UTF-8'));
} catch (eW) { print('WRITE FAIL ' + eW); status = 'failed'; }
System.exit(status === 'passed' ? 0 : 1);
