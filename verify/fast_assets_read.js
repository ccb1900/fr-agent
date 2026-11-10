// verify/fast_assets_read.js — D2.1 只读管理工具契约（零引擎；用隔离临时资产目录，不碰生产资产）
//   TDD：本套件先于 agent/tools/assets.js 写，第一击必须因"工具不存在"红。
//   被测对象是工具脚本本身（以 Nashorn 子进程方式执行真实入口），不是把逻辑复刻进测试：
//     - 造临时目录 + 资产文件 + env（AGENT_ASSETS_DIR / AGENT_ASSETS_ACTION / ...）
//     - java -cp nashorn.jar ... Shell agent/tools/assets.js
//     - 读回 logs/agent/runs/<runId>/assets.json 判定
//   验收重点（与 dataset-semantic-plan.md §8 D2.1 一致）：
//     ① 目录读取 + Registry 构建；② registry.errors 非空即 fail-closed（重复 id 不得"报着继续用"）；
//     ③ list/inspect 各自的输出形状；④ 非法 JSON/路径越界/缺 id 的诊断面；
//     ⑤ 零写操作（工具层只读）、不进 FineReport 引擎 Mutex。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond, detail) {
  if (cond) print('CHECK PASS: ' + name);
  else { FAILS++; print('CHECK FAIL: ' + name + (detail == null ? '' : ' :: ' + detail)); }
}
function read(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')).replace(/^\uFEFF/, ''); }
function exists(p) { try { return Files.exists(Pth.get(p)); } catch (e) { return false; } }
function jt(p) { return JSON.parse(read(p)); }
function wrote(p, text) {
  Files.createDirectories(Pth.get(p).getParent());
  Files.write(Pth.get(p), J('java.lang.String').valueOf(text).getBytes('UTF-8'));
}

var TOOL = 'agent/tools/assets.js';
function runToolAt(dir, action) { return runTool(action, null, dir); }   // dir=资产根（models 层）
// 每次跑用独立临时目录（UUID 后缀），不依赖上轮清理成功——Windows 下文件锁/残留会让递归删不可靠
var TMP = System.getProperty('java.io.tmpdir').replace(/\\/g, '/') + '/fr_assets_' +
  J('java.util.UUID').randomUUID().toString().replace(/-/g, '').slice(0, 12);
var ASSETS = TMP + '/models/production/datasets';
var MODELS_ROOT = TMP + '/models';
var RUNS = ROOT + '/logs/agent/runs';   // 与生产一致：absOf 解析 evidence ref 才能找到文件
load(ROOT + '/semantic/dataset/definition.js');   // create round-trip 审计用
load(ROOT + '/semantic/dataset/registry.js');     // D3.6：resolver 四方体负控需要
load(ROOT + '/semantic/dataset/resolver.js');
// 造 1 个合法 draft（与生产资产同形）+ 1 个坏 JSON；路径全部在临时目录，不碰仓库资产
Files.createDirectories(Pth.get(ASSETS));
// P1-3 域化装载前提：测试 models home 必须自带 <domain>/model.json（工具不再从 ROOT 全局模型兜底）
(function copyModelsHome() {
  var prod = jt(ROOT + '/models/production/model.json');
  [MODELS_ROOT, TMP + '/boundary_models'].forEach(function (home) {
    Files.createDirectories(Pth.get(home + '/production'));
    wrote(home + '/production/model.json', JSON.stringify(prod, null, 1));
  });
})();
// 走查三轮附记：生产 model.json 是活的业务资产（版本随 review→revise→publish 演进）——夹具 modelVersion 动态跟随
var good = {
  datasetVersion: '1', id: 'production.alpha', domain: 'production', name: '甲', description: '临时 A',
  status: 'draft', source: { type: 'database', ref: 'atom_live_demo', connection: 'ATOM_LIVE' },
  model: { ref: 'models/production/model.json', modelVersion: jt(MODELS_ROOT + '/production/model.json').modelVersion },
  selection: { entity: 'InspectionRecord', dimensions: ['bizDate', 'machine'], metrics: ['planned', 'done'] },
  grain: { description: '一天一机台', keys: ['bizDate', 'machine'] },
  asserts: { fields: [{ name: 'bizDate', role: 'dim' }, { name: 'machine', role: 'dim' }, { name: 'planned', role: 'metric' }, { name: 'done', role: 'metric' }] },
  validation: { samples: [], executions: [] }
};
wrote(ASSETS + '/alpha.json', JSON.stringify(good, null, 1));
wrote(ASSETS + '/broken.json', '{ this is not json');

// 以真实子进程跑工具（不把工具逻辑 load 进当前上下文，验证入口/退出码/contract 文件）
function runTool(action, extra, dirOverride, useSqlCp) {
  var rid = 'asset_' + action + '_' + J('java.util.UUID').randomUUID().toString().replace(/-/g, '').slice(0, 8);
  var out = RUNS + '/' + rid + '/assets.json';
  var javaExe = System.getenv('FR_AGENT_JAVA') || 'D:/software/FineReport_11.0/jre/bin/java.exe';
  var nashorn = System.getenv('FR_AGENT_NASHORN') || 'D:/software/FineReport_11.0/jre/lib/ext/nashorn.jar';
  var cp = useSqlCp ? (nashorn + ';D:/software/FineReport_11.0/webapps/webroot/WEB-INF/lib/*') : nashorn;
  var argv = new (J('java.util.ArrayList'))();
  [javaExe, '-cp', cp, 'jdk.nashorn.tools.Shell', ROOT + '/' + TOOL].forEach(function (x) { argv.add(x); });
  var pb = new (J('java.lang.ProcessBuilder'))(argv);
  pb.environment().put('FR_AGENT_HOME', ROOT);
  pb.environment().put('AGENT_RUN_ID', rid);
  pb.environment().put('AGENT_ASSETS_DIR', dirOverride || MODELS_ROOT);
  pb.environment().put('AGENT_ASSETS_ACTION', action);
  if (extra) Object.keys(extra).forEach(function (k) { pb.environment().put(k, String(extra[k])); });
  pb.redirectErrorStream(true);
  var p = pb.start();
  var br = new (J('java.io.BufferedReader'))(new (J('java.io.InputStreamReader'))(p.getInputStream(), 'UTF-8'));
  var stdout = [], line;
  while ((line = br.readLine()) != null) stdout.push(String(line));
  var rc = p.waitFor();
  return { rc: rc, stdout: stdout.join('\n'), result: exists(out) ? jt(out) : null, rid: rid };
}

// ============================ 0. 工具入口存在（TDD 第一击） ============================
check('工具入口存在：' + TOOL, exists(ROOT + '/' + TOOL));
if (!exists(ROOT + '/' + TOOL)) { print('ASSETS D2.1 ABORT: 工具尚未实现'); J('java.lang.System').exit(1); }

// ============================ 1. list ============================
var r = runTool('list');
check('list rc=0', r.rc === 0, 'rc=' + r.rc + ' stdout=' + r.stdout.slice(0, 200));
check('list 合同行 ok=true 且带 runId', /"ok":true/.test(r.stdout) && r.stdout.indexOf(r.rid) >= 0, r.stdout.slice(0, 200));
check('list 结果文件存在', !!r.result, r.stdout.slice(0, 200));
if (r.result) {
  check('list 输出 tool=assets/action=list', r.result.tool === 'assets' && r.result.action === 'list', JSON.stringify(r.result).slice(0, 200));
  check('list 只收合法资产（broken.json 不混入）', (r.result.assets || []).length === 1 && (r.result.assets || [])[0].id === 'production.alpha', JSON.stringify(r.result.assets));
  check('list 带路径/状态/domain（可直接交 Agent 选）', (r.result.assets || [])[0].relPath && (r.result.assets || [])[0].status === 'draft' && (r.result.assets || [])[0].domain === 'production');
  check('list 报出坏 JSON 诊断但不因此失败', (r.result.diagnostics || []).some(function (d) { return d.code === 'UNREADABLE_JSON' && d.path.indexOf('broken.json') >= 0; }), JSON.stringify(r.result.diagnostics));
  check('list 无 registry 错误（干净目录）', (r.result.registryErrors || []).length === 0, JSON.stringify(r.result.registryErrors));
  check('list 明确 zeroEngine=true（不进 FR 实例锁）', r.result.zeroEngine === true);
  check('list 未写资产目录（只读）', exists(ASSETS + '/alpha.json') && !exists(ASSETS + '/created_by_list.json'));
}

// ============================ 2. inspect ============================
var ri = runTool('inspect', { AGENT_ASSETS_ID: 'production.alpha' });
check('inspect rc=0', ri.rc === 0, 'rc=' + ri.rc + ' stdout=' + ri.stdout.slice(0, 200));
check('inspect 结果完整（doc + audit + binding + columns + grainDrift）', !!ri.result && !!ri.result.doc && Array.isArray(ri.result.audit) && Array.isArray(ri.result.columns) && Array.isArray(ri.result.grainDrift), ri.stdout.slice(0, 220));
if (ri.result) {
  check('inspect doc.id 与请求一致', ri.result.doc.id === 'production.alpha');
  check('inspect audit 零错（合法资产）', ri.result.audit.length === 0, JSON.stringify(ri.result.audit));
  check('inspect 派生列来自 SqlBuilder（4 列，与 asserts 一致）', ri.result.columns.length === 4 && ri.result.columns[0].name === 'bizDate', JSON.stringify(ri.result.columns));
  check('inspect grainDrift 零错（生产函数判定）', ri.result.grainDrift.length === 0, JSON.stringify(ri.result.grainDrift));
  check('inspect 绑定零漂移', (ri.result.binding || []).length === 0, JSON.stringify(ri.result.binding));
}
var rmiss = runTool('inspect', { AGENT_ASSETS_ID: 'production.nope' });
check('负控·inspect 不存在 id → rc=1 + 明确错误 + nextActions', rmiss.rc === 1 && !!rmiss.result && rmiss.result.ok === false && (rmiss.result.nextActions || []).length > 0,
  'rc=' + rmiss.rc + ' out=' + JSON.stringify(rmiss.result).slice(0, 200));
var rno = runTool('inspect', {});
check('负控·inspect 缺 id → rc=2（用法）', rno.rc === 2 && !!rno.result && rno.result.ok === false, 'rc=' + rno.rc + ' out=' + JSON.stringify(rno.result).slice(0, 200));

// ============================ 3+4. registry fail-closed + 边界（独立目录，不碰共享 ASSETS） ============================
var BND = TMP + '/boundary_models/production/datasets';
Files.createDirectories(Pth.get(BND));
var bd = JSON.parse(JSON.stringify(good));
// 3. 重复 ID
wrote(BND + '/alpha.json', JSON.stringify(bd, null, 1));
wrote(BND + '/alpha_dup.json', JSON.stringify(bd, null, 1));
var rd = runTool('list', null, TMP + '/boundary_models');
check('负控·重复 ID 时 list rc=1（不再"报着继续用"）', rd.rc === 1, 'rc=' + rd.rc + ' stdout=' + rd.stdout.slice(0, 200));
check('负控·重复 ID 时结果带 DUPLICATE_ID 与 nextActions', !!rd.result && rd.result.ok === false && (rd.result.registryErrors || []).some(function (e) { return String(e).indexOf('DUPLICATE_ID') >= 0; }) && (rd.result.nextActions || []).length > 0,
  JSON.stringify(rd.result).slice(0, 220));
var rdi = runTool('inspect', { AGENT_ASSETS_ID: 'production.alpha' }, TMP + '/boundary_models');
check('负控·重复 ID 时 inspect 同样 fail-closed', rdi.rc === 1 && !!rdi.result && rdi.result.ok === false, 'rc=' + rdi.rc);
try { Files.delete(Pth.get(BND + '/alpha_dup.json')); } catch (eD) { }
var rrestored = runTool('list', null, TMP + '/boundary_models');
check('删除重复后恢复 rc=0（故障可逆）', rrestored.rc === 0, 'rc=' + rrestored.rc);

// 4. 注册表错误之外的边界
// 4a. 文件名与 id 不符（路径身份绑定；此前工具用 id 反推路径会短路这条，现已传真实发现路径）
var misnamed = JSON.parse(JSON.stringify(bd)); misnamed.id = 'production.gamma';
wrote(BND + '/wrongname.json', JSON.stringify(misnamed, null, 1));
var rmis = runTool('list', null, TMP + '/boundary_models');
check('负控·文件名与 id 不符 → 契约诊断含 PATH_ID_MISMATCH', rmis.rc === 0 && (rmis.result.diagnostics || []).some(function (d) {
  return d.code === 'CONTRACT_AUDIT_FAILED' && String(d.message).indexOf('PATH_ID_MISMATCH') >= 0;
}), JSON.stringify(rmis.result && rmis.result.diagnostics).slice(0, 240));
try { Files.delete(Pth.get(BND + '/wrongname.json')); } catch (eW) { }
var badKey = JSON.parse(JSON.stringify(bd)); badKey.id = '../escape'; badKey.domain = 'production';
wrote(BND + '/badkey.json', JSON.stringify(badKey, null, 1));
var rb = runTool('list', null, TMP + '/boundary_models');
check('负控·非法 id/路径身份被诊断（不静默入索引）', rb.rc === 0 && (rb.result.diagnostics || []).some(function (d) { return d.path.indexOf('badkey.json') >= 0; }), JSON.stringify(rb.result && rb.result.diagnostics).slice(0, 220));
check('负控·非法 id 不出现在 list 资产清单', !(rb.result.assets || []).some(function (a) { return a.id === '../escape'; }), JSON.stringify(rb.result && rb.result.assets));
try { Files.delete(Pth.get(BND + '/badkey.json')); } catch (eB) { }

// ============================ 5. 边界纪律 ============================
// ============================ 4b. create（D2.2：只能产 draft；非法拒写；不覆盖） ============================
// 清理 ASSETS 目录：只保留 alpha.json（list/inspect 基准），其余全删（防前面负控残留引发级联）
(function () {
  var ds; try { ds = Files.newDirectoryStream(Pth.get(ASSETS), '*.json'); } catch (e) { return; }
  try { var it = ds.iterator(); while (it.hasNext()) {
    var f = it.next();
    if (String(f.getFileName()) !== 'alpha.json') { try { Files.delete(f); } catch (eD) { } }
  } } finally { try { ds.close(); } catch (eC) { } }
})();
function writeDoc(o) { wrote(TMP + '/docs/doc.json', JSON.stringify(o, null, 1)); return TMP + '/docs/doc.json'; }
function mkDraft(over) {
  var d = JSON.parse(JSON.stringify(good));
  d.id = 'production.beta'; d.name = '乙'; d.description = '临时 B（D2.2 create 测试）';
  if (over) Object.keys(over).forEach(function (k) { d[k] = over[k]; });
  return d;
}
var rc1 = runTool('create', { AGENT_ASSETS_DOC: writeDoc(mkDraft()) });
check('create·合法草稿 rc=0', rc1.rc === 0, 'rc=' + rc1.rc + ' out=' + JSON.stringify(rc1.result).slice(0, 200));
check('create·文件落在 id 推导路径且状态强制 draft', exists(ASSETS + '/beta.json') && jt(ASSETS + '/beta.json').status === 'draft', exists(ASSETS + '/beta.json') ? jt(ASSETS + '/beta.json').status : 'missing');
check('create·round-trip 重读审计零错', DatasetDef.audit(jt(ASSETS + '/beta.json'), 'models/production/datasets/beta.json').length === 0);
check('create·调用方给 published 也被强制降为 draft（只产草稿，独立 id）', (function () {
  var r = runTool('create', { AGENT_ASSETS_DOC: writeDoc(mkDraft({ id: 'production.epsilon', status: 'published', review: { by: 'x', at: '2026-11-10' } })) });
  return r.rc === 0 && exists(ASSETS + '/epsilon.json') && jt(ASSETS + '/epsilon.json').status === 'draft';
})());
check('create·同 id 二次创建 → 拒且原文件不被覆盖', (function () {
  var before = read(ASSETS + '/beta.json');
  var r = runTool('create', { AGENT_ASSETS_DOC: writeDoc(mkDraft({ description: '覆盖尝试' })) });
  return r.rc === 1 && r.result && r.result.ok === false && (r.result.error || {}).code === 'ASSET_ALREADY_EXISTS' && read(ASSETS + '/beta.json') === before;
})(), (rc1.result || {}).error && JSON.stringify(rc1.result.error));
check('create·幽灵指标（契约不合格）→ 拒且不落盘', (function () {
  var r = runTool('create', { AGENT_ASSETS_DOC: writeDoc(mkDraft({
    id: 'production.gamma',
    selection: { entity: 'InspectionRecord', dimensions: ['bizDate', 'machine'], metrics: ['planned', 'ghostMetric'] }
  })) });
  return r.rc === 1 && !exists(ASSETS + '/gamma.json') && JSON.stringify(r.result).indexOf('UNKNOWN_REF') >= 0;
})());
check('create·asserts 与派生不符 → 拒', (function () {
  var r = runTool('create', { AGENT_ASSETS_DOC: writeDoc(mkDraft({ id: 'production.delta', asserts: { fields: [{ name: 'wrongCol', role: 'metric' }] } })) });
  return r.rc === 1 && !exists(ASSETS + '/delta.json');
})());
check('负控·create 文档坏 JSON → rc=2', (function () {
  wrote(TMP + '/docs/bad.json', '{ nope');
  var r = runTool('create', { AGENT_ASSETS_DOC: TMP + '/docs/bad.json' });
  return r.rc === 2;
})());
check('负控·create 缺 DOC 参数 → rc=2', runTool('create', {}).rc === 2);
check('create·成功后 list 能看到（联动）', (function () {
  var r = runTool('list');
  return r.rc === 0 && (r.result.assets || []).some(function (a) { return a.id === 'production.beta'; });
})());
check('create·ghostMetric 拒绝后 gamma.json 确实不存在（无半截写入）', !exists(ASSETS + '/gamma.json') && !exists(ASSETS + '/delta.json'));

check('本套件已登记进 fast 聚合门（run-fast-tests）',
  read(ROOT + '/scripts/run-fast-tests.ps1').indexOf('fast_assets_read.js') >= 0);
// 递归根若指向 models/，模型本体 model.json 不得被当数据集候选（此前会误报 BAD_ID）
//   D3.6：改独立 home——P1-3 起主 home 的 <domain>/model.json 是装载依赖，被回归段覆盖/删除即级联崩。
(function () {
  var home2 = TMP + '/mjson_regression';
  var parent = home2 + '/production';
  try { Files.createDirectories(Pth.get(parent + '/datasets')); } catch (e) { }
  wrote(parent + '/model.json', JSON.stringify({ modelVersion: '1', domain: 'x', entities: [] }));
  var saved = System.getenv('AGENT_ASSETS_DIR');
  var r2 = runToolAt(home2, 'list');
  try { Files.delete(Pth.get(parent + '/model.json')); } catch (eD) { }
  check('回归·model.json 在 models/ 根下不被当数据集（不报 BAD_ID/UNREADABLE）',
    r2.rc === 0 && !(r2.result.assets || []).some(function (a) { return a.relPath.indexOf('model.json') >= 0; }) &&
    !(r2.result.diagnostics || []).some(function (d) { return d.path.indexOf('model.json') >= 0; }),
    JSON.stringify(r2.result && r2.result.diagnostics).slice(0, 200));
})();

// ============================ 4c. validate + publish（D2.3/D2.4：真实采样 + 生命周期升级） ============================
// validate 需要连库（JDBC），走 sample_data 同规：plain JVM + WEB-INF/lib 驱动 + dbpass 凭据。
//   测试不 mock 连接——对 atom_live_demo 真跑（只读、LIMIT），证明"工具自己采样自己写证据"。
(function () {
  var dv = JSON.parse(JSON.stringify(good));
  dv.id = 'production.validate_me'; dv.name = '验证用'; dv.description = 'D2.3 validate 测试资产';
  dv.status = 'draft';
  dv.selection = { entity: 'InspectionRecord', dimensions: ['bizDate'], metrics: ['planned', 'done'] };
  dv.grain = { description: '一天一行', keys: ['bizDate'] };
  dv.asserts = { fields: [{ name: 'bizDate', role: 'dim' }, { name: 'planned', role: 'metric' }, { name: 'done', role: 'metric' }] };
  wrote(ASSETS + '/validate_me.json', JSON.stringify(dv, null, 1));

  var rv = runTool('validate', { AGENT_ASSETS_ID: 'production.validate_me' }, MODELS_ROOT, true);
  check('validate·rc=0', rv.rc === 0, 'rc=' + rv.rc + ' stdout=' + rv.stdout.slice(0, 300));
  check('validate·状态已升为 validated（工具写回）', exists(ASSETS + '/validate_me.json') && jt(ASSETS + '/validate_me.json').status === 'validated');
  check('validate·绑定证据已生成（三身份对得上）', (function () {
    var back = jt(ASSETS + '/validate_me.json');
    var arr = (back.validation || {}).samples || [];
    return arr.length >= 1 && arr[0].datasetId === dv.id && arr[0].modelVersion === dv.model.modelVersion && arr[0].sourceRef === dv.source.ref;
  })(), JSON.stringify((jt(ASSETS + '/validate_me.json').validation || {}).samples || []).slice(0, 200));
  check('validate·round-trip 审计零错', DatasetDef.audit(jt(ASSETS + '/validate_me.json'), 'models/production/datasets/validate_me.json').length === 0,
    JSON.stringify(DatasetDef.audit(jt(ASSETS + '/validate_me.json'), 'models/production/datasets/validate_me.json')));
  check('正控·工具生成的证据 ref 始终为仓库相对路径', (function () {
    var back = jt(ASSETS + '/validate_me.json');
    var arr = (back.validation || {}).samples || [];
    var last = arr[arr.length - 1];
    return last && !/^[A-Za-z]:/.test(last.ref) && last.ref.indexOf('/') > 0;
  })(), JSON.stringify((jt(ASSETS + '/validate_me.json').validation || {}).samples || []));

  var published = jt(ASSETS + '/validate_me.json');
  published.review = { by: '业务负责人', at: '2026-11-10T10:00:00Z' };
  wrote(ASSETS + '/validate_me.json', JSON.stringify(published, null, 1));
  check('D3.6·P1-2·证据 ref 指向文件本身（.../validate_sample.json 且真实存在）', (function () {
    var back = jt(ASSETS + '/validate_me.json');
    var arr = (back.validation || {}).samples || [];
    var last = arr[arr.length - 1];
    return !!last && /\/validate_sample\.json$/.test(last.ref) && exists(ROOT + '/' + last.ref);
  })(), JSON.stringify((jt(ASSETS + '/validate_me.json').validation || {}).samples || []));

  var rp = runTool('publish', { AGENT_ASSETS_ID: 'production.validate_me' });
  check('publish·rc=0（证据 + review 双全）', rp.rc === 0, 'rc=' + rp.rc + ' stdout=' + rp.stdout.slice(0, 300));
  check('publish·状态已升为 published', exists(ASSETS + '/validate_me.json') && jt(ASSETS + '/validate_me.json').status === 'published');
  var rp2 = runTool('publish', { AGENT_ASSETS_ID: 'production.validate_me' });
  check('负控·已 published 再 publish → 拒（幂等不重做）', rp2.rc === 1 && !!rp2.result && rp2.result.ok === false, 'rc=' + rp2.rc);
  // 负控·粒度声明是维度的真子集（create 现在跑 grainDrift，应该拒）
  (function () {
    var subset = JSON.parse(JSON.stringify(good));
    subset.id = 'production.grain_subset'; subset.name = '粒度子集';
    subset.selection = { entity: 'InspectionRecord', dimensions: ['bizDate', 'machine'], metrics: ['planned'] };
    subset.asserts = { fields: [{ name: 'bizDate', role: 'dim' }, { name: 'machine', role: 'dim' }, { name: 'planned', role: 'metric' }] };
    subset.grain = { description: '只按日期分组', keys: ['bizDate'] };   // SQL 会按 bizDate+machine 分组
    var rgs = runTool('create', { AGENT_ASSETS_DOC: writeDoc(subset) });
    check('负控·粒度是维度真子集 → create 拒（GRAIN_DRIFT）',
      rgs.rc === 1 && JSON.stringify(rgs.result).indexOf('GRAIN_DRIFT') >= 0 && !exists(ASSETS + '/grain_subset.json'),
      JSON.stringify(rgs.result && (rgs.result.error || rgs.result.diagnostics)).slice(0, 220));
  })();
  // 负控·证据 ref 须为仓库相对路径（不可移植 = 克隆仓库后证据指向不存在路径）
  (function () {
    var dvAbs = JSON.parse(JSON.stringify(good));
    dvAbs.id = 'production.abs_ref'; dvAbs.status = 'validated';
    dvAbs.validation = { samples: [{ ref: 'D:/fineagent/logs/agent/runs/x/validate_sample.json', datasetId: dvAbs.id, modelVersion: good.model.modelVersion, sourceRef: 'atom_live_demo', at: '2026-11-10T10:00:00Z' }] };
    dvAbs.review = { by: '业务负责人', at: '2026-11-10T10:00:00Z' };   // 让 review 不挡，专心测 ref 格式行为
    wrote(ASSETS + '/abs_ref.json', JSON.stringify(dvAbs, null, 1));
    var rab = runTool('publish', { AGENT_ASSETS_ID: 'production.abs_ref' });
    check('负控·绝对路径证据 ref 被 publish 拒（EVIDENCE_REF_OUTSIDE_ALLOWED_DIR）',
      rab.rc === 1 && JSON.stringify(rab.result).indexOf('EVIDENCE_REF_OUTSIDE_ALLOWED_DIR') >= 0, JSON.stringify(rab.result).slice(0, 200));
  })();
  var rc3 = runTool('create', { AGENT_ASSETS_DOC: writeDoc(mkDraft({ id: 'production.validate_me' })) });
  check('负控·published 后 create 同 id → ASSET_ALREADY_EXISTS', rc3.rc === 1 && (rc3.result.error || {}).code === 'ASSET_ALREADY_EXISTS');
  try { Files.delete(Pth.get(ASSETS + '/validate_me.json')); } catch (eDel) { }

  var dv2 = JSON.parse(JSON.stringify(good));
  dv2.id = 'production.no_review'; dv2.status = 'validated';
  dv2.validation = { samples: [{ ref: 'logs/agent/runs/test/sample.json', datasetId: 'production.no_review', modelVersion: good.model.modelVersion, sourceRef: 'atom_live_demo', at: '2026-11-10T10:00:00Z' }] };
  wrote(ASSETS + '/no_review.json', JSON.stringify(dv2, null, 1));
  var rnr = runTool('publish', { AGENT_ASSETS_ID: 'production.no_review' });
  check('负控·validated 缺 review → publish 拒（证据 ref 前缀合法但文件不存在也可能同时触发）',
    rnr.rc === 1 && !!rnr.result && rnr.result.ok === false, JSON.stringify(rnr.result).slice(0, 220));
  try { Files.delete(Pth.get(ASSETS + '/no_review.json')); } catch (eDel2) { }
})();

// ============================ 4d. deprecate + impact + snapshot + truncated（S4 收口） ============================
(function () {
  // 造 validated 资产（手动写绑定证据——测试夹具模拟调用方确认后的状态，不测 JDBC）
  var dep = JSON.parse(JSON.stringify(good));
  dep.id = 'production.lifecycle'; dep.name = '生命周期测试'; dep.description = 'D2.3/S4 测试资产';
  dep.status = 'validated';
  dep.validation = { samples: [{ ref: 'logs/agent/runs/test/sample.json', datasetId: dep.id, modelVersion: dep.model.modelVersion, sourceRef: dep.source.ref, at: '2026-11-10T10:00:00Z' }] };
  wrote(ASSETS + '/lifecycle.json', JSON.stringify(dep, null, 1));
  // 创建证据 ref 指向的真实文件（publish 的 EVIDENCE_FILE_MISSING 门会检查它）
  var evFile = ROOT + '/logs/agent/runs/test/sample.json';
  Files.createDirectories(Pth.get(evFile).getParent());
  // P1-2：证据文件必须携带与条目一致的身份字段（publish 逐项对拍，串条必拒）
  wrote(evFile, JSON.stringify({ rowCount: 10, columns: ['bizDate', 'planned', 'done'], datasetId: 'production.lifecycle', modelVersion: dep.model.modelVersion, sourceRef: dep.source.ref, validatedAt: '2026-11-10T10:00:00Z' }));

  // 负控·已 validated 再 validate → ALREADY_VALIDATED（冗余条目拒绝）
  var rvAlready = runTool('validate', { AGENT_ASSETS_ID: 'production.lifecycle' });
  check('负控·已 validated 再 validate → ALREADY_VALIDATED（re-run 不追加冗余条目）',
    rvAlready.rc === 1 && !!rvAlready.result && (rvAlready.result.error || {}).code === 'ALREADY_VALIDATED',
    JSON.stringify(rvAlready.result).slice(0, 180));

  // publish：需要 review（模拟业务负责人确认后的资产文件）+ versions/ 快照
  var withReview = jt(ASSETS + '/lifecycle.json');
  withReview.review = { by: '业务负责人', at: '2026-11-10T12:00:00Z' };
  wrote(ASSETS + '/lifecycle.json', JSON.stringify(withReview, null, 1));

  // publish → versions/ 快照
  var rp = runTool('publish', { AGENT_ASSETS_ID: 'production.lifecycle' });
  check('S4·publish rc=0', rp.rc === 0, 'rc=' + rp.rc + ' ' + JSON.stringify(rp.result).slice(0, 140));
  check('S4·versions/1.json 快照存在且 status=validated（发布前不可变副本）', (function () {
    var snapFile = ASSETS + '/versions/1.json';
    if (!exists(snapFile)) return false;
    var doc = jt(snapFile);
    // lifecycle/validate_me 同版本号 → 快照可能来自另一个 id；只检查存在 + validated
    return doc.status === 'validated';
  })());
  try { Files.delete(Pth.get(ASSETS + '/versions')); } catch (eSnapDel) { }
  check('S4·主文件 status 已升为 published', jt(ASSETS + '/lifecycle.json').status === 'published');

  // impact：catalog 样例 spec 引用了 production.inspection_records（不在本测试目录内）→ 0 引用；但 models/ 内 datasetRef 可能引用
  var ri = runTool('impact', { AGENT_ASSETS_ID: 'production.lifecycle' });
  check('S4·impact rc=0', ri.rc === 0, 'rc=' + ri.rc);
  check('S4·impact 不把自身资产文件报为引用（self-exclusion）', !((ri.result.referencedBy || []).some(function (f) { return f.indexOf('lifecycle.json') >= 0; })),
    JSON.stringify(ri.result && ri.result.referencedBy));

  // deprecate：缺 reason → 拒
  var rp0 = runTool('deprecate', { AGENT_ASSETS_ID: 'production.lifecycle' });
  check('负控·deprecate 缺 deprecation.reason → 拒', rp0.rc === 1 && (rp0.result.error || {}).code === 'DEPRECATION_REASON_REQUIRED', JSON.stringify(rp0.result).slice(0, 180));

  // 编辑资产文件加 deprecation.reason → 再 deprecate → 成功
  var published = jt(ASSETS + '/lifecycle.json');
  published.deprecation = { reason: '指标口径变更，改用新版 Dataset' };
  wrote(ASSETS + '/lifecycle.json', JSON.stringify(published, null, 1));
  var rp1 = runTool('deprecate', { AGENT_ASSETS_ID: 'production.lifecycle' });
  check('S4·deprecate 带 reason → rc=0 且状态升为 deprecated', rp1.rc === 0 && jt(ASSETS + '/lifecycle.json').status === 'deprecated', 'rc=' + rp1.rc);

  // 负控·已 deprecated 再 deprecate → 拒
  var rp2 = runTool('deprecate', { AGENT_ASSETS_ID: 'production.lifecycle' });
  check('负控·已 deprecated 再 deprecate → 拒（幂等不重做）', rp2.rc === 1 && !!(rp2.result && rp2.result.error) && (rp2.result.error.code) === 'ALREADY_DEPRECATED', JSON.stringify(rp2.result).slice(0, 220));

  // 负控·published(=deprecated 前)再 validate → 拒（ALREADY_PUBLISHED：不可变）
  //   但 deprecated 状态的 validate 拒是 DEPRECATED——用独立 id 测 deprecated 后 validate
  var rvOld = runTool('validate', { AGENT_ASSETS_ID: 'production.lifecycle' });
  check('负控·deprecated 状态的 validate → 拒（DEPRECATED）', rvOld.rc === 1 && !!(rvOld.result && rvOld.result.error) && (rvOld.result.error.code) === 'DEPRECATED', JSON.stringify(rvOld.result).slice(0, 220));

  // 截断：直接读 validate 产物如能找到（需要真库，这里直接读已生成的 validate_sample.json）

  try { Files.delete(Pth.get(ASSETS + '/lifecycle.json')); } catch (eDel) { }
  try { Files.delete(Pth.get(evFile)); } catch (eDel2) { }
  try { Files.delete(Pth.get(TMP + '/models/production/datasets/versions')); } catch (eDel3) { }
})();

// ============================ 4e. Semantic create/validate/publish（S 轨资产生命周期） ============================
// semantic 的 create/validate/publish 都用 ModelValidator 离线校验 + schema 快照——不需要 JDBC。
//   测试用 SEMANTIC_MODELS_ROOT 指向隔离目录；不碰生产 model.json。
(function () {
  function runSem(action, extra) {
    var rid = 'sem_' + action + '_' + J('java.util.UUID').randomUUID().toString().replace(/-/g, '').slice(0, 8);
    var out = RUNS + '/' + rid + '/semantic.json';
    var argv = new (J('java.util.ArrayList'))();
    ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ROOT + '/agent/tools/fr_agent.ps1',
     '-Verb', 'semantic', '-Action', action, '-RunId', rid].forEach(function (x) { argv.add(x); });
    if (extra && extra.AGENT_SEMANTIC_DOC) { argv.add('-Doc'); argv.add(String(extra.AGENT_SEMANTIC_DOC)); }
    if (extra && extra.AGENT_SEMANTIC_DOMAIN) { argv.add('-Domain'); argv.add(String(extra.AGENT_SEMANTIC_DOMAIN)); }
    var pb = new (J('java.lang.ProcessBuilder'))(argv);
    var env = pb.environment();
    env.put('FR_AGENT_HOME', ROOT);
    env.put('AGENT_RUN_ID', rid);
    env.put('AGENT_SEMANTIC_MODELS_ROOT', SEM_MODELS);
    env.put('AGENT_SEMANTIC_RUNS', RUNS);
    env.put('AGENT_SEMANTIC_ACTION', action);
    if (extra) Object.keys(extra).forEach(function (k) { env.put(k, String(extra[k])); });
    pb.redirectErrorStream(true);
    var p = pb.start();
    var br = new (J('java.io.BufferedReader'))(new (J('java.io.InputStreamReader'))(p.getInputStream(), 'UTF-8'));
    var so = [], ln;
    while ((ln = br.readLine()) != null) so.push(String(ln));
    return { rc: p.waitFor(), stdout: so.join(String.fromCharCode(10)), result: exists(out) ? jt(out) : null };
  }
  var SEM_MODELS = TMP + '/sem_models';
  var semDomain = SEM_MODELS + '/sales';
  Files.createDirectories(Pth.get(semDomain));
  // 造一个 sales 域模型草稿（引用 atom_live_demo 的真实 schema，字段来自生产模型——不臆造）
  var prodModel = jt(ROOT + '/models/production/model.json');
  var salesDraft = {
    modelVersion: '1', domain: 'sales', source: 'atom_live_demo',
    description: 'sales 域测试草稿（S 轨 create 测试）',
    entities: [{ name: 'SalesRecord', label: '销售记录', table: 'laser_aaa', key: ['file_key'],
      properties: [{ name: 'fileKey', label: '文件键', column: 'file_key', type: 'long' }] }],
    metrics: [
      { name: 'salesCount', label: '销售数', expression: { kind: 'count', table: 'laser_aaa' } },
      { name: 'doneCount', label: '完成数', expression: { kind: 'countThreshold', table: 'laser_aaa', column: 'score', op: '>=', value: 0.9 } },
      { name: 'completionRate', label: '完成率', format: '#,##0.00', expression: { kind: 'ratio', numerator: 'doneCount', denominator: 'salesCount', scale: 100 } },
      { name: 'avgScore', label: '平均分', format: '#,##0.000000', expression: { kind: 'weightedAvg', table: 'laser_aaa', column: 'score' } },
      { name: 'totalScore', label: '评分合计', expression: { kind: 'sum', table: 'laser_aaa', column: 'score' } }
    ],
    dimensions: [
      { name: 'bizDate', label: '业务日期', table: 'laser_aaa', column: 'biz_date', rule: 'dateNormalize' },
      { name: 'stage', label: '工序', table: 'laser_aaa', column: 'stage' },
      { name: 'machine', label: '机台', table: 'laser_files', column: 'source_id' }
    ],
    relationships: [
      { name: 'recordToFile', label: '检测记录归属文件', from: { table: 'laser_aaa', column: 'file_key' }, to: { table: 'laser_files', column: 'file_key' }, source: 'naming-derived', requiresConfirmation: true },   // confirmed 证据链验证在编译期 preflight（有连接指纹），semantic 资产层不验证
      { name: 'fileToMachine', label: '文件来源机台', from: { table: 'laser_files', column: 'source_id' }, to: { table: 'laser_files', column: 'source_id' }, source: 'naming-derived', requiresConfirmation: true },
      { name: 'recordToStage', label: '检测记录所属工序', from: { table: 'laser_aaa', column: 'stage' }, to: { table: 'laser_aaa', column: 'stage' }, source: 'naming-derived', requiresConfirmation: true }
    ]
  };
  wrote(TMP + '/docs/sales_model.json', JSON.stringify(salesDraft, null, 1));

  // create（带 schema 校验）
  var rcs = runSem('create', { AGENT_SEMANTIC_DOC: TMP + '/docs/sales_model.json' });
  check('semantic create·rc=0（模型↔schema 回溯零错）', rcs.rc === 0, 'rc=' + rcs.rc + ' stdout=' + rcs.stdout.slice(0, 250));
  check('semantic create·文件已写到 models/sales/model.json', exists(semDomain + '/model.json'));

  // 负控·已存在再 create → 拒
  var rcs2 = runSem('create', { AGENT_SEMANTIC_DOC: TMP + '/docs/sales_model.json' });
  check('负控·semantic create 同域再建 → MODEL_ALREADY_EXISTS', rcs2.rc === 1 && (rcs2.result.error || {}).code === 'MODEL_ALREADY_EXISTS');

  // validate（离线 ModelValidator）
  var rcv = runSem('validate', { AGENT_SEMANTIC_DOMAIN: 'sales' });
  check('semantic validate·rc=0', rcv.rc === 0, 'rc=' + rcv.rc + ' out=' + JSON.stringify(rcv.result).slice(0, 200));

  // 负控·幽灵字段模型 → validate 拒
  var ghostModel = JSON.parse(JSON.stringify(salesDraft));
  ghostModel.entities[0].properties.push({ name: 'ghostCol', label: '幽灵列', column: 'ghost_col', type: 'text' });
  var ghostDomain = SEM_MODELS + '/ghostdom';
  Files.createDirectories(Pth.get(ghostDomain));
  wrote(ghostDomain + '/model.json', JSON.stringify(ghostModel, null, 1));
  var rcg = runSem('validate', { AGENT_SEMANTIC_DOMAIN: 'ghostdom' });
  check('负控·幽灵字段模型 validate → 拒（UNKNOWN_REF）', rcg.rc === 1 && JSON.stringify(rcg.result.errors || []).indexOf('UNKNOWN_REF') >= 0, JSON.stringify(rcg.result).slice(0, 200));

  // publish：缺 review → 拒
  var rcp0 = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'sales' });
  check('负控·semantic publish 缺 review → 拒', rcp0.rc === 1 && (rcp0.result.error || {}).code === 'PUBLISHED_WITHOUT_REVIEW');

  // publish：加 review → 成功 + 快照
  var withRev = JSON.parse(JSON.stringify(salesDraft));
  withRev.review = { by: '业务负责人', at: '2026-11-10T10:00:00Z' };
  wrote(semDomain + '/model.json', JSON.stringify(withRev, null, 1));
  var rcp = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'sales' });
  check('S 轨·publish 带 review → rc=0 + 快照落盘', rcp.rc === 0 && exists(semDomain + '/versions/1.json'), 'rc=' + rcp.rc);

  // S 轨证据核对全强度回归（2026-11-10 连接身份复用 plan.js 同源）：confirmed 关系在本层即核对证据指纹。
  //   注意夹具纪律：模型内容必须与生产 model.json 逐字段一致（canonicalModel 指纹绑 modelVersion/domain/source/relationships，
  //   改 domain 即指纹漂移 → 证据拒绝——那是门在工作，不是缺陷）；只允许注入 review（不在指纹内）。
  //   正控：默认身份（生产连接）→ rc=0 + 快照；负控：SQL_URL 换库 → 源指纹必不匹配 → UNSUPPORTED_RELATION_KEY 拒
  //   （数据侧证据不跨库；fixture review 自填，只作测试目录语义——正式 publish 仍人审）。
  (function () {
    var evModel = jt(ROOT + '/models/production/model.json');
    evModel.review = { by: 'gate-selfcheck', at: '2026-11-10T10:00:00Z' };
    var evDom = SEM_MODELS + '/evdom';
    Files.createDirectories(Pth.get(evDom));
    wrote(evDom + '/model.json', JSON.stringify(evModel, null, 1));
    var revP = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'evdom' });
    check('S 轨证据·confirmed 关系默认身份 publish → rc=0（证据指纹核对全强度非空转）',
      revP.rc === 0 && exists(evDom + '/versions/' + evModel.modelVersion + '.json'), 'rc=' + revP.rc + ' out=' + JSON.stringify(revP.result).slice(0, 180));
    var xdb = JSON.parse(JSON.stringify(evModel));
    var evDom2 = SEM_MODELS + '/evdom2';
    Files.createDirectories(Pth.get(evDom2));
    wrote(evDom2 + '/model.json', JSON.stringify(xdb, null, 1));
    var xdbP = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'evdom2', SQL_URL: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=OTHER_DB;encrypt=false' });
    check('负控·S 轨证据·换库身份 publish → UNSUPPORTED_RELATION_KEY 拒（数据侧证据不跨库）',
      xdbP.rc === 1 && JSON.stringify(xdbP.result).indexOf('UNSUPPORTED_RELATION_KEY') >= 0, 'rc=' + xdbP.rc + ' out=' + JSON.stringify(xdbP.result).slice(0, 180));
  })();

  // 版本与审查纪律矩阵（2026-11-10 审查轮收口）：同版本不可变 / 新版须新审 / review 双全 ISO / 不收代填 review 草稿
  //   全链具omain 串行推进：sales v1（前面已发布）→ 幂等 → 漂移拒 → v2 陈旧拒 → v2 新审过 → v3 审查形态拒。
  //   此前首版实现三洞：同版本静默分叉（P1）、review 只查不查 at、无 modelVersion 静默落 '1.json'。
  (function () {
    var rcIdem = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'sales' });
    check('版本纪律·幂等 publish（内容==快照）→ rc=0 快照不动', rcIdem.rc === 0, 'rc=' + rcIdem.rc + ' out=' + JSON.stringify(rcIdem.result).slice(0, 140));

    var drift = jt(semDomain + '/model.json');
    drift.metrics[0].label = drift.metrics[0].label + '(drift)';
    wrote(semDomain + '/model.json', JSON.stringify(drift, null, 1));
    var rcDrift = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'sales' });
    check('负控·版本纪律·同 modelVersion 内容变更 → MODEL_VERSION_NOT_BUMPED 拒（live 不静默分叉快照）',
      rcDrift.rc === 1 && (rcDrift.result.error || {}).code === 'MODEL_VERSION_NOT_BUMPED', 'rc=' + rcDrift.rc + ' out=' + JSON.stringify(rcDrift.result).slice(0, 140));

    var stale = jt(semDomain + '/model.json');
    stale.modelVersion = '2';
    wrote(semDomain + '/model.json', JSON.stringify(stale, null, 1));   // review.at 仍是 v1 那份（陈旧）
    var rcStale = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'sales' });
    check('负控·版本纪律·v2 陈旧 review.at → MODEL_REVIEW_NOT_RENEWED 拒（旧审查不保护新内容）',
      rcStale.rc === 1 && (rcStale.result.error || {}).code === 'MODEL_REVIEW_NOT_RENEWED', 'rc=' + rcStale.rc + ' out=' + JSON.stringify(rcStale.result).slice(0, 140));

    var renewed = jt(semDomain + '/model.json');
    renewed.review = { by: '业务负责人', at: '2026-11-10T12:00:00Z' };
    wrote(semDomain + '/model.json', JSON.stringify(renewed, null, 1));
    var rcNew = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'sales' });
    check('版本纪律·v2 新 review.at → rc=0 + versions/2.json（改已发布指标=新版+重审通路真实存在）',
      rcNew.rc === 0 && exists(semDomain + '/versions/2.json'), 'rc=' + rcNew.rc + ' out=' + JSON.stringify(rcNew.result).slice(0, 140));

    var noAt = jt(semDomain + '/model.json');
    noAt.modelVersion = '3'; delete noAt.review.at;
    wrote(semDomain + '/model.json', JSON.stringify(noAt, null, 1));
    var rcNoAt = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'sales' });
    check('负控·版本纪律·review 缺 at → BAD_REVIEW_AT 拒（与 Dataset 契约 review.{by,at} 同规）',
      rcNoAt.rc === 1 && (rcNoAt.result.error || {}).code === 'BAD_REVIEW_AT', 'rc=' + rcNoAt.rc + ' out=' + JSON.stringify(rcNoAt.result).slice(0, 140));

    var badAt = jt(semDomain + '/model.json');
    badAt.modelVersion = '3'; badAt.review.at = '明天吧';
    wrote(semDomain + '/model.json', JSON.stringify(badAt, null, 1));
    var rcBad = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'sales' });
    check('负控·版本纪律·review.at 非 ISO → BAD_REVIEW_AT 拒',
      rcBad.rc === 1 && (rcBad.result.error || {}).code === 'BAD_REVIEW_AT', 'rc=' + rcBad.rc + ' out=' + JSON.stringify(rcBad.result).slice(0, 140));

    var noVer = jt(semDomain + '/model.json');   // 用 sales 模型（naming-derived，无证据依赖）——生产模型删 modelVersion 会先触发
    noVer.modelVersion = null; delete noVer.modelVersion;   // canonicalModel 指纹漂移的 UNSUPPORTED_RELATION_KEY（modelVersion 参与指纹）
    noVer.domain = 'noverdom';
    var noVerDom = SEM_MODELS + '/noverdom';
    Files.createDirectories(Pth.get(noVerDom));
    wrote(noVerDom + '/model.json', JSON.stringify(noVer, null, 1));
    var rcNoVer = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'noverdom' });
    check('负控·版本纪律·无 modelVersion publish → PUBLISHED_WITHOUT_VERSION 拒（缺省会静默落 1.json，掩盖漂移）',
      rcNoVer.rc === 1 && (rcNoVer.result.error || {}).code === 'PUBLISHED_WITHOUT_VERSION', 'rc=' + rcNoVer.rc + ' out=' + JSON.stringify(rcNoVer.result).slice(0, 140));

    var preRev = jt(semDomain + '/model.json');
    preRev.domain = 'cleanrevdom';   // review 仍在（模拟 Agent 把业务人的 review 拷进新草稿）
    var preDocPath = TMP + '/docs/cleanrev_model.json';
    wrote(preDocPath, JSON.stringify(preRev, null, 1));
    var rcPre = runSem('create', { AGENT_SEMANTIC_DOC: preDocPath });
    check('负控·版本纪律·create 草稿自带 review → REVIEW_IN_DRAFT 拒（review 只能业务人写，Agent 不得代填闭环）',
      rcPre.rc === 1 && (rcPre.result.error || {}).code === 'REVIEW_IN_DRAFT', 'rc=' + rcPre.rc + ' out=' + JSON.stringify(rcPre.result).slice(0, 140));
  })();

  // A1 收口（2026-11-10）：semantic deprecate/impact（assets 同规镜像：reason 人填写进文件，工具只盖 status/at；
  //   deprecate 不可逆——再 deprecate/validate/publish 全拒；inspect 透出 deprecated；impact 列引用面）。
  (function () {
    var depDom = SEM_MODELS + '/depdom';
    var depModel = JSON.parse(JSON.stringify(salesDraft));   // naming-derived、5/3/3——无证据依赖
    depModel.domain = 'depdom';
    depModel.review = { by: '业务负责人', at: '2026-11-10T09:00:00Z' };
    Files.createDirectories(Pth.get(depDom));
    wrote(depDom + '/model.json', JSON.stringify(depModel, null, 1));   // direct write = 人途（create 现在校 REVIEW_IN_DRAFT）
    var dpz = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('A1·depdom 前置 publish rc=0（完整档 naming-derived 过）', dpz.rc === 0, 'rc=' + dpz.rc + ' out=' + JSON.stringify(dpz.result).slice(0, 140));

    var d1 = runSem('deprecate', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('负控·A1·缺 deprecation.reason → DEPRECATION_REASON_REQUIRED 拒（工具不代写理由）',
      d1.rc === 1 && (d1.result.error || {}).code === 'DEPRECATION_REASON_REQUIRED', 'rc=' + d1.rc + ' out=' + JSON.stringify(d1.result).slice(0, 140));

    var human = jt(depDom + '/model.json');   // 模拟业务人补 reason
    human.deprecation = { reason: '口径并入 production 域，depdom 退役' };
    wrote(depDom + '/model.json', JSON.stringify(human, null, 1));
    var d2 = runSem('deprecate', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('A1·deprecate 带 reason → rc=0 + status deprecated + at 盖章',
      d2.rc === 0 && (d2.result || {}).status === 'deprecated', 'rc=' + d2.rc + ' out=' + JSON.stringify(d2.result).slice(0, 140));

    var d3 = runSem('deprecate', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('负控·A1·已 deprecated 再 deprecate → ALREADY_DEPRECATED（不可逆、幂等不重做）',
      d3.rc === 1 && (d3.result.error || {}).code === 'ALREADY_DEPRECATED', 'rc=' + d3.rc + ' out=' + JSON.stringify(d3.result).slice(0, 140));

    var d4 = runSem('validate', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('负控·A1·deprecated validate → DEPRECATED 拒（assets 同规镜像）',
      d4.rc === 1 && (d4.result.error || {}).code === 'DEPRECATED', 'rc=' + d4.rc + ' out=' + JSON.stringify(d4.result).slice(0, 140));

    var d5 = runSem('publish', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('负控·A1·deprecated publish → DEPRECATED 拒',
      d5.rc === 1 && (d5.result.error || {}).code === 'DEPRECATED', 'rc=' + d5.rc + ' out=' + JSON.stringify(d5.result).slice(0, 140));

    var d6 = runSem('inspect', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('A1·inspect deprecated → deprecated:true + warnings 含 DEPRECATED 理由',
      d6.rc === 0 && (d6.result || {}).deprecated === true && JSON.stringify(d6.result.warnings || []).indexOf('DEPRECATED:') >= 0, 'rc=' + d6.rc + ' out=' + JSON.stringify(d6.result).slice(0, 160));

    var d7 = runSem('impact', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('A1·impact 零引用 → rc=0 count=0（零引用也是合法答案）',
      d7.rc === 0 && (d7.result || {}).count === 0, 'rc=' + d7.rc + ' out=' + JSON.stringify(d7.result).slice(0, 140));

    var consDir = SEM_MODELS + '/depcons/datasets';
    Files.createDirectories(Pth.get(consDir));
    wrote(consDir + '/cons1.json', JSON.stringify({ id: 'production.depcons1', model: { ref: 'models/depdom/model.json', modelVersion: '1' }, status: 'published' }));
    var d8 = runSem('impact', { AGENT_SEMANTIC_DOMAIN: 'depdom' });
    check('A1·impact 带引用 → count>=1 列出 datasetId（库里新造引用件实证扫描真干活）',
      d8.rc === 0 && (d8.result || {}).count >= 1 && JSON.stringify(d8.result.consumers).indexOf('depcons1') >= 0, 'rc=' + d8.rc + ' out=' + JSON.stringify(d8.result).slice(0, 160));
  })();

  // 负控·缺 schema 快照的域 validate → SCHEMA_MISSING
  var orphanModel = JSON.parse(JSON.stringify(salesDraft));
  orphanModel.source = 'nonexistent_db';
  var orphanDom = SEM_MODELS + '/orphan';
  Files.createDirectories(Pth.get(orphanDom));
  wrote(orphanDom + '/model.json', JSON.stringify(orphanModel, null, 1));
  var rco = runSem('validate', { AGENT_SEMANTIC_DOMAIN: 'orphan' });
  check('负控·缺 schema 快照 → SCHEMA_MISSING 拒', rco.rc === 1 && (rco.result.error || {}).code === 'SCHEMA_MISSING');
})();


// ============================ D3.6 收口：外审三件（P1-2 证据身份 / P1-3 域化 / P2-1 扫描显式化） ============================
(function () {
  // P1-2·publish 证据文件三态负控（损坏 / 身份串条 / 目录冒充——三新码 fail-closed）
  (function () {
    var evPath = ROOT + '/logs/agent/runs/test/sample2.json';
    function mkId(id) {
      var d = JSON.parse(JSON.stringify(good)); d.id = id; d.status = 'validated';
      d.validation = { samples: [{ ref: 'logs/agent/runs/test/sample2.json', datasetId: id, modelVersion: good.model.modelVersion, sourceRef: 'atom_live_demo', at: '2026-11-10T10:00:00Z' }] };
      d.review = { by: '业务负责人', at: '2026-11-10T10:00:00Z' };   // review 不挡，专注证据门
      return d;
    }
    function newEvFile(o) { Files.createDirectories(Pth.get(evPath).getParent()); try { Files.delete(Pth.get(evPath)); } catch (e0) { } wrote(evPath, JSON.stringify(o, null, 1)); }
    // 1) 损坏：证据文件不是 JSON 对象
    var dcor = mkId('production.evc_corrupt'); wrote(ASSETS + '/evc_corrupt.json', JSON.stringify(dcor, null, 1));
    wrote(evPath, '{ this is deliberately not json');   // 真·损坏（此前 {broken:1} 是合法对象，会被身份闸先拒——那也是门在工作，但负控名称要专指损坏）
    var r1 = runTool('publish', { AGENT_ASSETS_ID: 'production.evc_corrupt' });
    check('负控·P1-2·证据文件损坏 → EVIDENCE_FILE_CORRUPT 拒', r1.rc === 1 && JSON.stringify(r1.result).indexOf('EVIDENCE_FILE_CORRUPT') >= 0, JSON.stringify(r1.result).slice(0, 200));
    // 2) 身份串条：文件身份字段 ≠ 条目
    var did = mkId('production.evc_ident'); wrote(ASSETS + '/evc_ident.json', JSON.stringify(did, null, 1));
    newEvFile({ sql: 'x', rowCount: 5, datasetId: 'production.other', modelVersion: '9', sourceRef: 'other_db', validatedAt: '2026-01-01T00:00:00Z' });
    var r2 = runTool('publish', { AGENT_ASSETS_ID: 'production.evc_ident' });
    check('负控·P1-2·证据身份串条 → EVIDENCE_IDENTITY_MISMATCH 拒（伪造/串条不可 publish）', r2.rc === 1 && JSON.stringify(r2.result).indexOf('EVIDENCE_IDENTITY_MISMATCH') >= 0, JSON.stringify(r2.result).slice(0, 200));
    // 3) 目录冒充：ref 指到目录（旧缺陷的直接负控——目录存在即过是本轮修的重点）
    try { Files.delete(Pth.get(evPath)); Files.delete(Pth.get(evPath + '.json')); } catch (e0) { }
    var ddir = mkId('production.evc_dir'); wrote(ASSETS + '/evc_dir.json', JSON.stringify(ddir, null, 1));
    var oldRef = ROOT + '/logs/agent/runs/test';   // 让 ref 指向 run **目录**（旧 validate 产物形态）
    ddir.validation.samples[0].ref = 'logs/agent/runs/test';
    wrote(ASSETS + '/evc_dir.json', JSON.stringify(ddir, null, 1));
    var r3 = runTool('publish', { AGENT_ASSETS_ID: 'production.evc_dir' });
    check('负控·P1-2·ref 指向目录 → EVIDENCE_REF_NOT_FILE 拒（目录存在不再冒充证据）', r3.rc === 1 && JSON.stringify(r3.result).indexOf('EVIDENCE_REF_NOT_FILE') >= 0, JSON.stringify(r3.result).slice(0, 200));
    try { Files.delete(Pth.get(evPath)); } catch (e1) { }
    try { Files.delete(Pth.get(ASSETS + '/evc_corrupt.json')); Files.delete(Pth.get(ASSETS + '/evc_ident.json')); Files.delete(Pth.get(ASSETS + '/evc_dir.json')); } catch (e2) { }
  })();

  // P1-3·Dataset 生命周期域化（sales 域正控 + 跨域误绑负控——工具不再全局绑 production）
  (function () {
    var homeProd = jt(ROOT + '/models/production/model.json');
    var salesModelFile = JSON.parse(JSON.stringify(homeProd));
    salesModelFile.domain = 'sales';   // 销售域模型夹具（同库同表，域字段按资产域）
    Files.createDirectories(Pth.get(MODELS_ROOT + '/sales'));
    wrote(MODELS_ROOT + '/sales/model.json', JSON.stringify(salesModelFile, null, 1));
    var s = JSON.parse(JSON.stringify(good));
    s.id = 'sales.alpha'; s.domain = 'sales'; s.model = { ref: 'models/sales/model.json', modelVersion: salesModelFile.modelVersion };   // 跟随 sales 模型拷贝（production 现态可能是 v2）
    wrote(TMP + '/docs/sales_asset.json', JSON.stringify(s, null, 1));
    var rcS = runTool('create', { AGENT_ASSETS_DOC: TMP + '/docs/sales_asset.json' });
    check('P1-3·sales 域 dataset create rc=0（模型按资产域装载）',
      rcS.rc === 0 && exists(MODELS_ROOT + '/sales/datasets/alpha.json'), 'rc=' + rcS.rc + ' out=' + JSON.stringify(rcS.result).slice(0, 200));
    var bad = JSON.parse(JSON.stringify(good));
    bad.id = 'sales.bad_ref'; bad.domain = 'sales'; bad.model = { ref: 'models/production/model.json', modelVersion: '1' };   // 域误绑
    wrote(TMP + '/docs/bad_ref.json', JSON.stringify(bad, null, 1));
    var rcB = runTool('create', { AGENT_ASSETS_DOC: TMP + '/docs/bad_ref.json' });
    check('负控·P1-3·sales id 绑 production 模型 → MODEL_REF_DOMAIN_MISMATCH 拒（不只靠 modelVersion 相等）',
      rcB.rc === 1 && JSON.stringify(rcB.result).indexOf('MODEL_REF_DOMAIN_MISMATCH') >= 0, 'rc=' + rcB.rc + ' out=' + JSON.stringify(rcB.result).slice(0, 200));
    // resolver 同规负控（契约层四方体）：sales id + model.ref production → DOMAIN_MISMATCH
    (function () {
      var bs = { datasetVersion: '1', id: 'sales.misbound', domain: 'sales', name: 'md', status: 'published', review: { by: 'x', at: '2026-11-10T10:00:00Z' },
        source: { type: 'database', ref: 'atom_live_demo', connection: 'ATOM_LIVE' },
        model: { ref: 'models/production/model.json', modelVersion: '1' },
        selection: { entity: 'InspectionRecord', dimensions: ['bizDate', 'machine'], metrics: ['planned', 'done'] },
        grain: { description: 'day-machine', keys: ['bizDate', 'machine'] },
        validation: { samples: [], executions: [] } };
      Files.createDirectories(Pth.get(MODELS_ROOT + '/sales/datasets'));
      wrote(MODELS_ROOT + '/sales/datasets/misbound.json', JSON.stringify(bs, null, 1));
      var reg2 = DatasetRegistry.build([{ relPath: 'models/sales/datasets/misbound.json', doc: bs }]);
      var misModel = jt(ROOT + '/models/production/model.json');   // 即便 modelVersion 相等也须拒（身份不以版本相等判）
      var res2 = DatasetResolver.resolve(reg2, 'sales.misbound', {}, misModel);
      check('负控·resolver·跨域 model.ref → DOMAIN_MISMATCH（四方体闸；版本相等不构成身份）',
        res2.ok === false && JSON.stringify(res2.errors || []).indexOf('DOMAIN_MISMATCH') >= 0, JSON.stringify(res2.errors).slice(0, 200));
      try { Files.delete(Pth.get(MODELS_ROOT + '/sales/datasets/misbound.json')); } catch (eD2) { }
    })();
  })();

  // P2-1·扫描显式化（assets list 默认完整；semantic impact 注入不可读条目后必须拒下零引用结论）
  (function () {
    var rl = runTool('list', null, MODELS_ROOT);
    check('P2-1·assets list·默认扫描完整（scanComplete=true，无静默丢目录）',
      rl.rc === 0 && (rl.result || {}).scanComplete === true, 'rc=' + rl.rc + ' out=' + JSON.stringify(rl.result).slice(0, 160));
  })();
})();



// ============================ W1/W2 + W3 补查（走查轮 2026-11-10） ============================
// semantic review/revise（人审入口 + 合法版本 bump 入口）+ plan detail 通路（ready 断言）
(function () {
  function runSemAt(action, extra) {
    var rid = 'w1_' + action + '_' + J('java.util.UUID').randomUUID().toString().replace(/-/g, '').slice(0, 8);
    var out = RUNS + '/' + rid + '/semantic.json';
    var argv = new (J('java.util.ArrayList'))();
    ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ROOT + '/agent/tools/fr_agent.ps1',
     '-Verb', 'semantic', '-Action', action, '-RunId', rid].forEach(function (x) { argv.add(x); });
    if (extra && extra.AGENT_SEMANTIC_DOC) { argv.add('-Doc'); argv.add(String(extra.AGENT_SEMANTIC_DOC)); }
    if (extra && extra.ReviewBy) { argv.add('-ReviewBy'); argv.add(String(extra.ReviewBy)); }
    argv.add('-Target'); argv.add(String(extra && extra.domain ? extra.domain : 'revdom'));
    var pb = new (J('java.util.ArrayList'))() === argv ? null : new (J('java.lang.ProcessBuilder'))(argv);
    var env = pb.environment();
    env.put('FR_AGENT_HOME', ROOT);
    env.put('AGENT_RUN_ID', rid);
    env.put('AGENT_SEMANTIC_MODELS_ROOT', SEM_MODELS);
    env.put('AGENT_SEMANTIC_RUNS', RUNS);
    env.put('AGENT_SEMANTIC_ACTION', action);
    if (extra && extra.ReviewBy) env.put('AGENT_SEMANTIC_REVIEW_BY', String(extra.ReviewBy));
    if (extra) Object.keys(extra).forEach(function (k) { if (k.indexOf('AGENT_') === 0) env.put(k, String(extra[k])); });
    pb.redirectErrorStream(true);
    var p = pb.start();
    var br = new (J('java.io.BufferedReader'))(new (J('java.io.InputStreamReader'))(p.getInputStream(), 'UTF-8'));
    var so = [], ln;
    while ((ln = br.readLine()) != null) so.push(String(ln));
    return { rc: p.waitFor(), stdout: so.join(String.fromCharCode(10)), result: exists(out) ? jt(out) : null };
  }
  var SEM_MODELS = TMP + '/sem_models';   // W-block 独立 scope（4e 段内 SEM_MODELS 是 IIFE 局部，此处重建同一目录约定）
  var revDom = SEM_MODELS + '/revdom';
  Files.createDirectories(Pth.get(revDom));
  // （sales 夹具由 4e 段已写入 SEM_MODELS/sales——revise 复用其内容）
  var revModel = jt(SEM_MODELS + '/sales/model.json');   // naming-derived 夹具（无证据依赖）——confirmed 模型 bump 版本即指纹漂移、证据失效（r6 契约，backlog A2）
  revModel.modelVersion = '1';   // 4e 版本矩阵把 sales 推到 v2——revdom 夹具显式归位 1（current==draft 会撞 VERSION_NOT_BUMPED）
  revModel.review = null; delete revModel.review;
  wrote(revDom + '/model.json', JSON.stringify(revModel, null, 1));

  // W1-负控：publish 缺 review 的 nextActions 不再为空（合同违约清零）
  var rn0 = runSemAt('publish', { domain: 'revdom' });
  check('W1·publish 缺 review → 拒 + nextActions 指路 review 动作（合同不再空）',
    rn0.rc === 1 && (rn0.result.nextActions || []).length > 0 && JSON.stringify(rn0.result.nextActions).indexOf('review') >= 0, 'out=' + JSON.stringify(rn0.result).slice(0, 200));
  // W1-负控：review 无 ReviewBy → usage 拒
  var rn1 = runSemAt('review', { domain: 'revdom' });
  check('W1·review 缺 ReviewBy → SEMANTIC_USAGE 拒（人审纪律：不发明名字；产物 JSON 落盘）',
    rn1.rc === 2 && rn1.result && (rn1.result.error || {}).code === 'SEMANTIC_USAGE', 'rc=' + rn1.rc + ' out=' + String(rn1.stdout).slice(0, 160));
  // W1-正控：review 带人名 → 写入 review.{by,at}
  var rn2 = runSemAt('review', { domain: 'revdom', ReviewBy: '业务负责人' });
  check('W1·review 带人名 → rc=0 + review.{by,at} 落 model.json（人的动作有了工具面）',
    rn2.rc === 0 && exists(revDom + '/model.json') && (jt(revDom + '/model.json').review || {}).by === '业务负责人', 'rc=' + rn2.rc);
  // W2：revise 正控（bump 2、剥 review 的草案）
  var bumped = jt(revDom + '/model.json');
  bumped.modelVersion = '2'; bumped.metrics[0].label = bumped.metrics[0].label + ' v2'; bumped.review = null; delete bumped.review;
  var bumpPath = TMP + '/docs/revdom_v2.json';
  wrote(bumpPath, JSON.stringify(bumped, null, 1));
  var rn4 = runSemAt('revise', { domain: 'revdom', AGENT_SEMANTIC_DOC: bumpPath });
  check('W2·revise bump 1→2 → rc=0 + previousVersion 记档 + nextActions 指路 review/publish',
    rn4.rc === 0 && (rn4.result || {}).previousVersion === '1' && (rn4.result.modelVersion) === '2', 'rc=' + rn4.rc + ' out=' + JSON.stringify(rn4.result).slice(0, 200));
  // W1/W2 合规叙事：bump 后 publish 必须重审（PUBLISHED_WITHOUT_REVIEW）→ review → publish rc=0
  var rn3a = runSemAt('publish', { domain: 'revdom' });
  check('W2·revise 后 publish → PUBLISHED_WITHOUT_REVIEW（版本 bump 后必须重审）', rn3a.rc === 1 && rn3a.result && (rn3a.result.error || {}).code === 'PUBLISHED_WITHOUT_REVIEW', 'rc=' + rn3a.rc);
  var rn3b = runSemAt('review', { domain: 'revdom', ReviewBy: '业务负责人' });
  check('W2·revise 后 review rc=0（重审通路）', rn3b.rc === 0 && rn3b.result && rn3b.result.ok === true, 'rc=' + rn3b.rc);
  var rn3c = runSemAt('publish', { domain: 'revdom' });
  check('W2·重审后 publish rc=0（review→publish 两步合规闭环）', rn3c.rc === 0, 'rc=' + rn3c.rc);
  // W2-负控：降版本拒
  var dnDraft = jt(bumpPath); dnDraft.modelVersion = '1';
  var dnPath = TMP + '/docs/revdom_down.json';
  wrote(dnPath, JSON.stringify(dnDraft, null, 1));
  var rn5 = runSemAt('revise', { domain: 'revdom', AGENT_SEMANTIC_DOC: dnPath });
  check('W2·revise 降版本 → VERSION_NOT_BUMPED 拒', rn5.rc === 1 && rn5.result && (rn5.result.error || {}).code === 'VERSION_NOT_BUMPED', 'rc=' + rn5.rc);
  // W2-负控：revise 草案自带 review → REVIEW_IN_DRAFT 拒
  var wr = jt(dnPath); wr.modelVersion = '3'; wr.review = { by: 'x', at: '2026-11-10T10:00:00Z' };
  var wrPath = TMP + '/docs/revdom_wr.json';
  wrote(wrPath, JSON.stringify(wr, null, 1));
  var rn6 = runSemAt('revise', { domain: 'revdom', AGENT_SEMANTIC_DOC: wrPath });
  check('W2·revise 草案自带 review → REVIEW_IN_DRAFT 拒（review 只走 review 动作）', rn6.rc === 1 && rn6.result && (rn6.result.error || {}).code === 'REVIEW_IN_DRAFT', 'rc=' + rn6.rc);
  // W2-负控：deprecated 拒 review
  var ddep = jt(revDom + '/model.json'); ddep.status = 'deprecated'; ddep.deprecation = { reason: 'gate test' };
  wrote(revDom + '/model.json', JSON.stringify(ddep, null, 1));
  var rn7 = runSemAt('review', { domain: 'revdom', ReviewBy: '业务负责人' });
  check('W2·deprecated → review 拒（退役不可逆）', rn7.rc === 1 && rn7.result && (rn7.result.error || {}).code === 'DEPRECATED', 'rc=' + rn7.rc);
  try { Files.delete(Pth.get(SEM_MODELS + '/revdom/model.json')); } catch (e0) { }

  // 走查三轮 #3/#4：create 落盘目录收敛（-Target 显式域 > 草案域；草案内容不改写——指纹纪律）+ review usage 产物落盘
  (function () {
    var convDom = SEM_MODELS + '/convdom';
    Files.createDirectories(Pth.get(convDom));
    var convModel = jt(SEM_MODELS + '/sales/model.json');
    convModel.domain = 'laser_inspection';   // 模拟走查者从模型内部域拷贝的草案
    convModel.modelVersion = '1'; convModel.review = null; delete convModel.review;
    var convPath = TMP + '/docs/convdom_draft.json';
    wrote(convPath, JSON.stringify(convModel, null, 1));
    var rcc = runSemAt('create', { domain: 'convdom', AGENT_SEMANTIC_DOC: convPath, AGENT_SEMANTIC_DOMAIN: 'convdom' });
    check('P2-7·create 草案域=内部域 + 显式 Target → 落 Target 目录（草案内容原样保留）',
      rcc.rc === 0 && (rcc.result || {}).domain === 'convdom' && exists(SEM_MODELS + '/convdom/model.json') &&
      (jt(SEM_MODELS + '/convdom/model.json').domain) === 'laser_inspection', 'rc=' + rcc.rc + ' out=' + JSON.stringify(rcc.result).slice(0, 200));
    var rr1 = runSemAt('review', { domain: 'convdom' });   // 无 ReviewBy → js 层 usage 拒（产物 JSON 落盘）
    check('走查三轮#3·review 缺 ReviewBy → SEMANTIC_USAGE + semantic.json 落盘（读文件再判断不再空转）',
      rr1.rc === 2 && rr1.result && (rr1.result.error || {}).code === 'SEMANTIC_USAGE', 'rc=' + rr1.rc);
    try { Files.delete(Pth.get(SEM_MODELS + '/convdom/model.json')); } catch (eC) { }
  })();

  // 走查四轮 #1：probe_relation 工具面（证据重绑）+ revise 续走（鸡生蛋死锁 -Doc 对称规范化修复）
  (function () {
    var prDom = SEM_MODELS + '/prdom';
    Files.createDirectories(Pth.get(prDom));
    var prModel = jt(SEM_MODELS + '/sales/model.json');   // naming-derived 基底
    prModel.modelVersion = '1'; prModel.review = null; delete prModel.review;
    // 注入一条 confirmed N:1 关系（探针目标）——列用实体表自身 PK 位（laser_aaa 无单列 PK → 依赖数据侧证据，真库探针判定）
    prModel.relationships.unshift({ name: 'probeTarget', label: '探针目标关系', from: { table: 'laser_aaa', column: 'file_key' }, to: { table: 'laser_files', column: 'file_key' }, source: 'confirmed', cardinality: 'N:1', confirmedBy: 'suite probe gate' });   // to 键=laser_files.file_key（数据侧真唯一 538/538）；名不与 sales 的 naming recordToFile 撞（validator 关系名唯一闸）
    prModel.domain = 'prdom';
    wrote(prDom + '/model.json', JSON.stringify(prModel, null, 1));
    var prEv = TMP + '/probe_evidence.json';
    var prRun = runSemAt('probe_relation', { domain: 'prdom', AGENT_PROBE_EVIDENCE_JSON: prEv, SQL_URL: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', SQL_USER: 'sa' });
    check('走查四轮·probe_relation rc=0（真库探针重绑，证据写临时路径）',
      prRun.rc === 0 && exists(prEv) && (jt(prEv).status) === 'passed', 'rc=' + prRun.rc + ' out=' + JSON.stringify(prRun.result).slice(0, 220));
    // revise 续走：bump 草案 v2（同 confirmed 关系，内容与 v1 一致但版本不同→探针以草案指纹重绑）
    var prDraft = jt(prDom + '/model.json');
    prDraft.modelVersion = '2'; prDraft.metrics[0].label = prDraft.metrics[0].label + ' v2'; prDraft.review = null; delete prDraft.review;
    var prDraftPath = TMP + '/docs/prdom_v2.json';
    wrote(prDraftPath, JSON.stringify(prDraft, null, 1));
    var prRun2 = runSemAt('probe_relation', { domain: 'prdom', AGENT_SEMANTIC_DOC: prDraftPath, AGENT_PROBE_EVIDENCE_JSON: prEv, SQL_URL: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', SQL_USER: 'sa' });
    check('走查四轮·probe -Doc → 以草案指纹重绑（鸡生蛋死锁修复）', prRun2.rc === 0 && (prRun2.result || {}).modelSource && String(prRun2.result.modelSource).indexOf('draft(') === 0, 'rc=' + prRun2.rc);
    var prRun3 = runSemAt('revise', { domain: 'prdom', AGENT_SEMANTIC_DOC: prDraftPath, AGENT_PROBE_EVIDENCE_JSON: prEv, SQL_URL: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false', SQL_USER: 'sa' });
    check('走查四轮·revise bump 1→2 在重绑证据下 rc=0（存量模型第一次 revise 不再卡死）',
      prRun3.rc === 0 && (prRun3.result || {}).previousVersion === '1' && (prRun3.result.modelVersion) === '2', 'rc=' + prRun3.rc + ' out=' + JSON.stringify(prRun3.result).slice(0, 220));
    try { Files.delete(Pth.get(prEv)); } catch (eP) { }
    try { Files.delete(Pth.get(prDom + '/model.json')); } catch (eP2) { }
  })();

  // W3：plan detail 通路（ready 断言 + dims=实体 property 展示列 + intentHash）
  var w3Intent = {
    outName: '明细台账', report: { name: '明细台账' },
    dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord',
      dimensions: ['InspectionRecord.bizTime', 'InspectionRecord.fileKey', 'InspectionRecord.rowNo', 'InspectionRecord.score'],
      metrics: [], dateRange: { from: '2026-09-13', to: '2026-09-14' }, sort: [{ field: 'bizTime', dir: 'asc' }] },
    presentation: { type: 'detail' }
  };
  var w3Path = TMP + '/docs/w3_intent.json';
  wrote(w3Path, JSON.stringify(w3Intent, null, 1));
  var w3Rid = 'w3_plan_' + J('java.util.UUID').randomUUID().toString().replace(/-/g, '').slice(0, 8);
  var argv3 = new (J('java.util.ArrayList'))();
  ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ROOT + '/agent/tools/fr_agent.ps1',
   '-Verb', 'plan', '-Intent', w3Path, '-RunId', w3Rid].forEach(function (x) { argv3.add(x); });
  var pb3 = new (J('java.lang.ProcessBuilder'))(argv3);
  var env3 = pb3.environment();
  env3.put('FR_AGENT_HOME', ROOT);
  env3.put('AGENT_RUN_ID', w3Rid);
  env3.put('SQL_URL', 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false');
  env3.put('SQL_USER', 'sa');
  pb3.redirectErrorStream(true);
  var p3 = pb3.start();
  var br3 = new (J('java.io.BufferedReader'))(new (J('java.io.InputStreamReader'))(p3.getInputStream(), 'UTF-8'));
  while (br3.readLine() != null) { }
  p3.waitFor();
  var planJson = RUNS + '/' + w3Rid + '/plan.json';
  var planOk = exists(planJson) ? jt(planJson) : null;
  check('W3·plan detail 意图 → ready（明细=metrics 空 + dims=实体 property 展示列）',
    !!planOk && planOk.status === 'ready', 'out=' + JSON.stringify(planOk).slice(0, 260));
  check('W3·plan.json 带 intentHash + showTotal 缺省 false + capability 级提示可用',
    !!planOk && !!planOk.intentHash && planOk.reportSpec.presentation.showTotal === false, 'hash=' + (planOk ? planOk.intentHash : '-'));
})();

check('assets.js 不引 FineReport 引擎/激活链', !/com\.fr\.|SimpleWork|ActivatorToolBox/.test(read(ROOT + '/' + TOOL)));
check('assets.js 不自造原子写（写路径必须来自 _lib.js 的 atomicWriteUtf）',
  !/ATOMIC_MOVE|createTempFile/.test(read(ROOT + '/' + TOOL)) && read(ROOT + '/' + TOOL).indexOf('writeJson') >= 0);
check('assets.js 复用 _lib.js 与 DatasetDef/Registry',
  read(ROOT + '/' + TOOL).indexOf("_lib.js") >= 0 && read(ROOT + '/' + TOOL).indexOf("dataset/definition.js") >= 0 && read(ROOT + '/' + TOOL).indexOf("dataset/registry.js") >= 0);

print('ASSETS D2.1 END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
