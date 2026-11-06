// agent/tools/sample_data.js — fr-agent 工具层 verb: sample_data（零引擎、只读 LIMIT 采样；阶段2 B段新增）
//   输入 env AGENT_SAMPLE = JSON 文件路径：{ entity, columns?, limit?, where? }
//     entity  必填——模型实体名（白名单自 models/production/model.json，不接裸表名）
//     columns 可选——模型属性名数组（白名单校验后映射物理列；缺省=实体全部属性）
//     limit   可选——1..200，缺省 20（只读采样上限，防大表全捞）
//     where   可选——单条 { property, op, value }（op ∈ =|<>|>|<|>=|<=；值=数字/受限 token，禁引号注入）
//   SQL 形态（SQL Server）：SELECT <cols> FROM <table> WHERE ... ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH FIRST N ROWS ONLY
//     标识符全部来自模型白名单；值面沿用 sqlbuilder 受控字面量纪律（ISO 日期/数字/纯 token，禁引号分号注释）。
//   连接：SQL_URL/SQL_USER env + lib/dbpass.js（凭据单源，密码不入产物/不入日志）。
//   退出码（与 plan/resolve 对齐）：0=采样成功；1=采样失败（实体不在模型/SQL 错等，诊断+nextActions 落盘）。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');
var runId = runIdOf();
var runDir = runDirOf(runId);

function bail(code, msg, next) {
  writeJson(runDir + '/sample.json', { tool: 'sample_data', runId: runId, ok: false, error: msg, nextActions: next || [] });
  print('{"ok":false,"runId":"' + runId + '","result":"logs/agent/runs/' + runId + '/sample.json"}');
  System.exit(code);
}

var samplePath = System.getenv('AGENT_SAMPLE');
if (!samplePath) bail(2, 'AGENT_SAMPLE required (usage: fr_agent.ps1 -Verb sample_data -Sample <spec JSON file>)', ['write a spec file {entity, columns?, limit?, where?} and pass -Sample <path>', 'entity names come from -Verb discover (entities[].name)']);
var spec = null;
try { spec = JSON.parse(readUtf(absOf(samplePath))); } catch (e) { spec = null; }
if (!spec || typeof spec !== 'object') bail(2, 'sample spec JSON unreadable: ' + samplePath, ['check the file exists and is valid UTF-8 JSON']);

var model = JSON.parse(readUtf('models/production/model.json'));
var ent = null;
(model.entities || []).forEach(function (e) { if (e.name === spec.entity) ent = e; });
if (!ent) {
  var names = (model.entities || []).map(function (e) { return e.name; });
  bail(1, 'unknown entity "' + spec.entity + '" (model whitelist)', ['available entities: ' + names.join(', '), 'use -Verb discover for full property lists']);
}

// 属性→物理列映射（白名单两段：属性名→列名）
var byName = {};
(ent.properties || []).forEach(function (p) { byName[p.name] = p; });
var wanted = spec.columns != null ? spec.columns : (ent.properties || []).map(function (p) { return p.name; });
if (Object.prototype.toString.call(wanted) !== '[object Array]') bail(2, 'columns must be an array of model property names');
var cols = [];
for (var i = 0; i < wanted.length; i++) {
  var p = byName[wanted[i]];
  if (!p) bail(1, 'unknown property "' + wanted[i] + '" on entity ' + ent.name + ' (whitelist: ' + (ent.properties || []).map(function (x) { return x.name; }).join(', ') + ')');
  cols.push(p.column);
}
var table = ent.table;
if (!/^[A-Za-z0-9_\.]+$/.test(table)) bail(1, 'model table name outside charset whitelist (model defect, not user error)');

var limit = spec.limit == null ? 20 : spec.limit;
if (typeof limit !== 'number' || !isFinite(limit) || limit !== Math.floor(limit) || limit < 1 || limit > 200) bail(2, 'limit must be integer 1..200 (read-only sampling cap)');

// where：单条受控字面量（sqlbuilder 同纪律）
var whereSql = '';
if (spec.where != null) {
  var w = spec.where;
  if (!w || typeof w !== 'object') bail(2, 'where must be {property, op, value}');
  var wp = byName[w.property];
  if (!wp) bail(1, 'where.property must be a model property of ' + ent.name + ' (whitelist: ' + Object.keys(byName).join(', ') + ')');
  if (['=', '<>', '>', '<', '>=', '<='].indexOf(w.op) < 0) bail(2, 'where.op must be one of = <> > < >= <=');
  var v = w.value;
  if (typeof v === 'number' && isFinite(v)) v = String(v);
  else if (typeof v === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) v = "'" + v + "'";   // 日期加引号（库内存非补零形态 2026-9-13；纯数字+横杠，注入面为零）
  else if (typeof v === 'string' && /^[A-Za-z0-9_\-@#$%.]+$/.test(v)) v = "'" + v + "'";
  else bail(2, 'where.value must be a finite number, ISO date, or plain token (no quotes/semicolons/comments)');
  whereSql = ' WHERE ' + wp.column + ' ' + w.op + ' ' + v;
}

var url = System.getenv('SQL_URL') || 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false';
var usr = System.getenv('SQL_USER') || 'sa';
var pwd = null;
try { load(ROOT + '/lib/dbpass.js'); pwd = _cred.password; } catch (eP) { pwd = null; }
if (!pwd) bail(1, 'db credentials unavailable (data/db_local.js missing)', ['create data/db_local.js locally (see lib/dbpass.js header); credentials never enter the repo']);

var sql = 'SELECT ' + cols.join(', ') + ' FROM ' + table + whereSql + ' ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH FIRST ' + limit + ' ROWS ONLY';
var rowsOut = [];
var err = null;
try {
  // 驱动装载与 semantic/schema/inspector.js 同规：classpath ServiceLoader（MSSQL jar 在 FR jre/lib/ext），不显式 newInstance
  var conn = J('java.sql.DriverManager').getConnection(url, usr, pwd);
  try {
    conn.setReadOnly(true);
    var st = conn.createStatement();
    var rs = st.executeQuery(sql);
    var meta = rs.getMetaData(), n = meta.getColumnCount();
    var names = [];
    for (var c = 1; c <= n; c++) names.push(String(meta.getColumnLabel(c)));
    while (rs.next()) {
      var row = {};
      for (var c2 = 1; c2 <= n; c2++) row[names[c2 - 1]] = rs.getString(c2);
      rowsOut.push(row);
    }
    rs.close(); st.close();
  } finally { try { conn.close(); } catch (eC) { } }
} catch (eQ) { err = String(eQ); }
if (err) bail(1, 'sample query failed: ' + err, ['check SQL_URL/SQL_USER env + data/db_local.js credentials', 'entity/property names must come from -Verb discover']);

var out = { tool: 'sample_data', runId: runId, ok: true, entity: ent.name, table: table, limit: limit, returned: rowsOut.length, columns: cols, sql: sql, rows: rowsOut,
  nextActions: ['use -Verb plan with a sql dataset (entity=' + ent.name + ') or an embedded rows spec for the real report', 'run -Verb inspect_template before modifying an existing report'] };
writeJson(runDir + '/sample.json', out);
print('{"ok":true,"runId":"' + runId + '","returned":' + rowsOut.length + ',"result":"logs/agent/runs/' + runId + '/sample.json"}');
System.exit(0);
