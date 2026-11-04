// probes/probe_relation_unique.js — I5.5/r5 关系目标键唯一性实机探针（runraw，只读）
//   r5 P1：数据探针只是"某时刻的快照"，必须绑定 schema 源 + 目标列 + 模型关系 + 探测时间，并由 runner 判时效。
//   本探针遍历 model 中 confirmed N:1/1:1 关系的 to-side 键，逐一 COUNT(*) vs COUNT(DISTINCT)，
//   产出结构化证据 data/i55_relation_unique_truth.json（runner 消费）+ 人类可读 .txt（留痕）。
//   注意：数据侧唯一 ≠ 数据库唯一约束；长期保证需 DB 约束或 SQL 层处理重复键（README r5 条目）。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var ROOT = 'D:/fineagent';
function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }
var model = JSON.parse(readUtf(ROOT + '/models/production/model.json'));

// 只取 confirmed 且 JOIN-safe 基数（N:1/1:1）的关系；to-side 去重（同一键可被多关系引用）
var targets = [], seen = {};
(model.relationships || []).forEach(function (r) {
  if (!r || r.source !== 'confirmed') return;
  if (r.cardinality !== 'N:1' && r.cardinality !== '1:1') return;
  var to = r.to || {};
  if (!to.table || !to.column) return;
  var key = to.table + '.' + to.column;
  if (seen[key]) return;
  seen[key] = 1;
  targets.push({ relation: r.name, table: to.table, column: to.column });
});

var IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;   // 标识符白名单（模型文件仍按不可信输入处理，防拼接注入）
var conn = J('java.sql.DriverManager').getConnection(
  'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', 'sa', load(ROOT + '/lib/dbpass.js'));
var out = [], checks = [];
try {
  var q = conn.createStatement();
  targets.forEach(function (t) {
    if (!IDENT.test(t.table) || !IDENT.test(t.column)) { out.push('SKIP ' + t.table + '.' + t.column + ' 非白名单标识符'); return; }
    var rs = q.executeQuery('SELECT COUNT(*) AS n, COUNT(DISTINCT ' + t.column + ') AS d FROM ' + t.table);
    while (rs.next()) {
      var n = +rs.getLong('n'), d = +rs.getLong('d');   // 数值化，避免 Java Long 对象身份比较误判
      var unique = (n === d && d > 0);
      checks.push({ table: t.table, column: t.column, rows: n, distinct: d, unique: unique, relation: t.relation });
      out.push(t.table + '.' + t.column + ' relation=' + t.relation + ' rows=' + n + ' distinct=' + d + ' unique=' + unique);
    }
    rs.close();
  });
  q.close();
} catch (e) { out.push('PROBE FAIL: ' + e); }
conn.close();

var raw = { schema: model.source || 'atom_live_demo', probedAt: new (J('java.util.Date'))().toInstant().toString(), checks: checks, note: '数据快照证据；不是数据库唯一约束，runner 按 schema 源/关系归属/时效过滤' };
out.push('VERDICT ' + (checks.length && checks.every(function (c) { return c.unique; }) ? 'PASS' : 'FAIL') + ' checks=' + checks.length);
var msg = out.join('\n');
print(msg);
try { Files.write(Pth.get(ROOT + '/data/i55_relation_unique_truth.json'), J('java.lang.String').valueOf(JSON.stringify(raw, null, 1)).getBytes('UTF-8')); } catch (eW) { }
try { Files.write(Pth.get(ROOT + '/data/i55_relation_unique_truth.txt'), J('java.lang.String').valueOf(msg).getBytes('UTF-8')); } catch (eW2) { }
System.exit(0);
