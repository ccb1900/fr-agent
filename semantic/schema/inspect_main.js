// semantic/schema/inspect_main.js — I2 入口 runner（Nashorn，经 runraw.ps1 跑：classpath 含 mssql-jdbc，不杀 java、不启 FR）
//   职责：读连接（env 覆盖，默认演示库+dbpass 单源凭据）→ SchemaInspector.inspect → Serializer 三桶装配
//   → toJson 前凭据自检（脏则抛拒写）→ UTF-8 落 data/schema_<source>.json → 机器摘要 print（零凭据）。
//   凭据纪律：source 只当文件标签（默认库名 atom_live_demo），绝不含连接串；url/user/password 只在内存。
//   跑法：powershell -File runraw.ps1 -Script semantic/schema/inspect_main.js
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
function genev(k, d) { var v = System.getenv(k); return (v == null || String(v) === '') ? d : String(v); }

load('D:/fineagent/runtime/paths.js');
var R = Paths.root;
load(R + '/semantic/schema/metadata.js');
load(R + '/semantic/schema/relation.js');
load(R + '/semantic/schema/serializer.js');
load(R + '/semantic/schema/inspector.js');

var source = genev('SCHEMA_SOURCE', 'atom_live_demo');
var opts = {
  url: genev('SCHEMA_URL', 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false'),
  user: genev('SCHEMA_USER', 'sa'),
  password: genev('SCHEMA_PASS', load('D:/fineagent/lib/dbpass.js')),
  like: genev('SCHEMA_LIKE', 'laser_%'),
  source: source
};
var outFile = genev('SCHEMA_OUT', Paths.data('schema_' + source + '.json'));
var res, doc, text, FAILS = 0;
try {
  res = SchemaInspector.inspect(opts);
  doc = SchemaSerializer.assemble(res);
  text = SchemaSerializer.toJson(doc);           // 内含凭据自检：脏则抛，绝不落盘
  var P = J('java.nio.file.Paths'), F = J('java.nio.file.Files');
  F.createDirectories(P.get(outFile).getParent());
  F.write(P.get(outFile), J('java.lang.String').valueOf(text).getBytes('UTF-8'));
  var tables = doc.tables.length;
  var views = doc.tables.filter(function (t) { return t.type === 'VIEW'; }).length;
  var pkTables = doc.relations.structural.length;
  var fkCount = doc.relations.fk.length;
  var hintCount = doc.relations.unconfirmedNaming.length;
  print('SCHEMA SUMMARY tables=' + tables + ' views=' + views + ' pkTables=' + pkTables + ' fk=' + fkCount + ' namingHints=' + hintCount + ' coreErrors=' + res.errors.length);
  print('SCHEMA WRITTEN -> ' + outFile);
  if (res.errors.length) { res.errors.slice(0, 10).forEach(function (e) { print('  META ERR: ' + e.code + ' @ ' + e.path + ': ' + e.message); }); FAILS = 1; }
} catch (e) {
  print('SCHEMA FAIL: ' + e);
  FAILS = 1;
}
J('java.lang.System').exit(FAILS);
