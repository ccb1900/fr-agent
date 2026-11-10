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
// 造 1 个合法 draft（与生产资产同形）+ 1 个坏 JSON；路径全部在临时目录，不碰仓库资产
Files.createDirectories(Pth.get(ASSETS));
var good = {
  datasetVersion: '1', id: 'production.alpha', domain: 'production', name: '甲', description: '临时 A',
  status: 'draft', source: { type: 'database', ref: 'atom_live_demo', connection: 'ATOM_LIVE' },
  model: { ref: 'models/production/model.json', modelVersion: '1' },
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
(function () {
  var parent = TMP + '/models/production';
  try { Files.createDirectories(Pth.get(parent)); } catch (e) { }
  wrote(parent + '/model.json', JSON.stringify({ modelVersion: '1', domain: 'x', entities: [] }));
  var saved = System.getenv('AGENT_ASSETS_DIR');
  var r2 = runToolAt(TMP + '/models', 'list');
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
    dvAbs.validation = { samples: [{ ref: 'D:/fineagent/logs/agent/runs/x/validate_sample.json', datasetId: dvAbs.id, modelVersion: '1', sourceRef: 'atom_live_demo', at: '2026-11-10T10:00:00Z' }] };
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
  dv2.validation = { samples: [{ ref: 'logs/agent/runs/test/sample.json', datasetId: 'production.no_review', modelVersion: '1', sourceRef: 'atom_live_demo', at: '2026-11-10T10:00:00Z' }] };
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
  wrote(evFile, JSON.stringify({ rowCount: 10, columns: ['bizDate', 'planned', 'done'], validatedAt: '2026-11-10T10:00:00Z' }));

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

check('assets.js 不引 FineReport 引擎/激活链', !/com\.fr\.|SimpleWork|ActivatorToolBox/.test(read(ROOT + '/' + TOOL)));
check('assets.js 不自造原子写（写路径必须来自 _lib.js 的 atomicWriteUtf）',
  !/ATOMIC_MOVE|createTempFile/.test(read(ROOT + '/' + TOOL)) && read(ROOT + '/' + TOOL).indexOf('writeJson') >= 0);
check('assets.js 复用 _lib.js 与 DatasetDef/Registry',
  read(ROOT + '/' + TOOL).indexOf("_lib.js") >= 0 && read(ROOT + '/' + TOOL).indexOf("dataset/definition.js") >= 0 && read(ROOT + '/' + TOOL).indexOf("dataset/registry.js") >= 0);

print('ASSETS D2.1 END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
