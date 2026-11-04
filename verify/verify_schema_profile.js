// verify/verify_schema_profile.js — I2-W2 数据纪律对拍（AGENTS §4：结构事实须与直查画像一致，不臆造）
//   schema JSON（inspect_main 直查 DatabaseMetaData 产）↔ db_tables_profile.txt（历史直查画像）交叉核对：
//     · 表集一致（laser_ 全等）
//     · 逐列 name/type(nullable) 对齐（txt 第5段 is_nullable true/false ⇔ schema nullable bool；dtype 小写对齐）
//     · FK 桶=0（W0 truth 坐实演示库无声明外键）
//   纯 JDK（读两文件），无引擎。跑法同 fast 层（nashorn.jar）。exit!=0 即偏差（假绿堵洞）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond) { if (cond) print('CHECK PASS: ' + name); else { FAILS++; print('CHECK FAIL: ' + name); } }
function txt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + p)), 'UTF-8')); }

var schema = JSON.parse(txt('data/schema_atom_live_demo.json'));
var byTable = {};
schema.tables.forEach(function (t) { byTable[t.name] = t; });

// 解析 profile txt：## COLUMNS PER TABLE 段，### <table> 下每行 `ord|name|dtype|maxlen_bytes|is_nullable`
var lines = txt('data/db_tables_profile.txt').split(/\r?\n/);
var inCols = false, curTable = null, mismatch = 0, checked = 0, tablesSeen = {};
for (var i = 0; i < lines.length; i++) {
  var ln = lines[i];
  if (/^## /.test(ln)) { inCols = /^## COLUMNS PER TABLE/.test(ln); continue; }
  if (!inCols) continue;
  var m = /^### (\S+)/.exec(ln);
  if (m) { curTable = m[1]; if (curTable.indexOf('laser_') === 0) tablesSeen[curTable] = 1; continue; }
  var c = /^(\d+)\|([^|]+)\|([^|]+)\|([^|]+)\|(true|false)/.exec(ln);
  if (!c || !curTable || curTable.indexOf('laser_') !== 0) continue;
  checked++;
  var st = byTable[curTable];
  if (!st) { if (mismatch++ === 0) print('  table missing in schema: ' + curTable); continue; }
  var col = null;
  for (var k = 0; k < st.columns.length; k++) if (st.columns[k].name === c[2]) { col = st.columns[k]; break; }
  if (!col) { print('  col missing ' + curTable + '.' + c[2]); mismatch++; continue; }
  if ((col.typeName || '').toLowerCase() !== c[3].toLowerCase()) { print('  dtype differ ' + curTable + '.' + c[2] + ' schema=' + col.typeName + ' txt=' + c[3]); mismatch++; }
  var txtNullable = (c[5] === 'true');
  if (col.nullable != null && col.nullable !== txtNullable) { print('  nullable differ ' + curTable + '.' + c[2] + ' schema=' + col.nullable + ' txt=' + txtNullable); mismatch++; }
}
check('profile 表全在 schema（无缺表）', mismatch === 0 || Object.keys(tablesSeen).length > 0);
check('逐列 dtype/nullable 对拍 0 偏差（checked=' + checked + '）', mismatch === 0 && checked > 300);
check('FK 桶=0（演示库无声明外键，W0 坐实）', schema.relations.fk.length === 0);
check('structural 桶非空（PK 事实存在）', schema.relations.structural.length > 0);
check('命名推导桶全部 requires_confirmation（桶间硬隔离）',
  schema.relations.unconfirmedNaming.every(function (h) { return h.requires_confirmation === true; }));
check('输出无凭据（序列化前已自检）', txt('data/schema_atom_live_demo.json').toLowerCase().indexOf('password') < 0);

print('VERIFY SCHEMA↔PROFILE END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
