// verify/e2e_catalog_report.js — D3.5 引擎级端到端（catalog spec vs 内联 spec 产物逐字节等价）
//   前提：make_api 的 catalog resolver 支持 AGENT_CATALOG_MODELS_ROOT env override（可测试性设计）。
//   流程：
//     ① 临时 models 根造 published Dataset（复用生产契约形态，指向 atom_live_demo）
//     ② 写 catalog spec + 等价内联 spec（同一份选择/日期区间）
//     ③ 两次 fr_agent create（真 FR 引擎）→ 产物 cpt/png
//     ④ cpt 字节 MD5 逐字节对比（catalog 解析产物 == 内联产物）
//     ⑤ 故障注入：draft 资产 → create 拒（NOT_PUBLISHED）
//   不碰生产 assets（AGENT_CATALOG_MODELS_ROOT 指向临时目录）；不伪造生产 review（测试资产自填）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FAILS = 0;
function check(name, cond, detail) {
  if (cond) print('CHECK PASS: ' + name);
  else { FAILS++; print('CHECK FAIL: ' + name + (detail == null ? '' : ' :: ' + detail)); }
}
function read(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }
function wrote(p, text) { Files.createDirectories(Pth.get(p).getParent()); Files.write(Pth.get(p), J('java.lang.String').valueOf(text).getBytes('UTF-8')); }
function exists(p) { try { return Files.exists(Pth.get(p)); } catch (e) { return false; } }
function md5(p) {
  var md = J('java.security.MessageDigest').getInstance('MD5');
  var digest = md.digest(J('java.nio.file.Files').readAllBytes(Pth.get(p)));
  var sb = '';
  for (var i = 0; i < digest.length; i++) { var b = digest[i] & 255; sb += (b < 16 ? '0' : '') + J('java.lang.Integer').toHexString(b); }
  return sb.toUpperCase();
}

load(ROOT + '/semantic/dataset/definition.js');
load(ROOT + '/semantic/dataset/registry.js');

var TMP = System.getProperty('java.io.tmpdir').replace(/\\/g, '/') + '/fr_e2e_' +
  J('java.util.UUID').randomUUID().toString().replace(/-/g, '').slice(0, 12);
var CATROOT = TMP + '/models';
var DS_DIR = CATROOT + '/production/datasets';

// ① published Dataset（真实契约形态）
var dsDoc = {
  datasetVersion: '1', id: 'production.e2e_daily', domain: 'production',
  name: '端到端日报', description: 'D3.5 引擎端到端测试资产（临时目录，不影响生产）',
  status: 'published', review: { by: 'test-owner', at: '2026-11-10T10:00:00Z' },
  source: { type: 'database', ref: 'atom_live_demo', connection: 'ATOM_LIVE' },
  model: { ref: 'models/production/model.json', modelVersion: '1' },
  selection: { entity: 'InspectionRecord', dimensions: ['bizDate', 'machine'], metrics: ['planned', 'done', 'completionRate'] },
  grain: { description: '一天一机台', keys: ['bizDate', 'machine'] },
  validation: { samples: [{ ref: 'logs/agent/runs/e2e/sample.json', datasetId: 'production.e2e_daily', modelVersion: '1', sourceRef: 'atom_live_demo', at: '2026-11-10T10:00:00Z' }] }
};
wrote(DS_DIR + '/e2e_daily.json', JSON.stringify(dsDoc, null, 1));
var prodModel = read(ROOT + '/models/production/model.json');
wrote(CATROOT + '/production/model.json', prodModel);

// ② 两份 spec：catalog 形态 / 内联 sql 形态（同一选择 + 同一日期）
var scope = { dateRange: { from: '2026-09-13', to: '2026-09-22' } };
var catalogSpec = {
  specVersion: '1', outName: 'E2E_CATALOG', report: { name: '端到端等价测试' },
  dimensions: dsDoc.selection.dimensions, metrics: dsDoc.selection.metrics,
  dataset: { kind: 'catalog', ref: 'production.e2e_daily', dateRange: scope.dateRange },
  presentation: { type: 'table', showTotal: true }
};
var inlineSpec = {
  specVersion: '1', outName: 'E2E_INLINE', report: { name: '端到端等价测试' },
  dimensions: dsDoc.selection.dimensions, metrics: dsDoc.selection.metrics,
  dataset: { kind: 'sql', connection: 'ATOM_LIVE', entity: 'InspectionRecord',
    dimensions: dsDoc.selection.dimensions, metrics: dsDoc.selection.metrics, dateRange: scope.dateRange },
  presentation: { type: 'table', showTotal: true }
};
wrote(ROOT + '/logs/agent/runs/_e2e_cat_spec.json', JSON.stringify(catalogSpec, null, 1));
wrote(ROOT + '/logs/agent/runs/_e2e_inline_spec.json', JSON.stringify(inlineSpec, null, 1));

// ③ 真引擎 create 两次（走 fr_agent 生产同路径 run.ps1 -NoKill：classpath = engine_launch 全套）
function frCreate(specRel, tag) {
  var rid = 'e2e_' + tag;
  var argv = new (J('java.util.ArrayList'))();
  ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ROOT + '/run.ps1',
   '-Script', 'make_api.js', '-NoKill'].forEach(function (x) { argv.add(x); });
  var pb = new (J('java.lang.ProcessBuilder'))(argv);
  var env = pb.environment();
  env.put('FR_AGENT_HOME', ROOT);
  env.put('AGENT_RUN_ID', rid);
  env.put('REPORT_SPEC', specRel);
  env.put('AGENT_CATALOG_MODELS_ROOT', CATROOT);
  env.put('FR_AGENT_RESULT', ROOT + '/logs/agent/runs/' + rid + '/runresult.json');
  env.put('FR_AGENT_JAVA_PIDFILE', ROOT + '/logs/agent/runs/' + rid + '/java.pid');
  env.put('RESULT_DUMP', ROOT + '/logs/agent/runs/' + rid + '/grid.txt');
  pb.redirectErrorStream(true);
  var p = pb.start();
  var br = new (J('java.io.BufferedReader'))(new (J('java.io.InputStreamReader'))(p.getInputStream(), 'UTF-8'));
  var out = [], line;
  while ((line = br.readLine()) != null) out.push(String(line));
  var rc = p.waitFor();
  return { rc: rc, stdout: out.join('\n'), rid: rid };
}

var rCat = frCreate('logs/agent/runs/_e2e_cat_spec.json', 'cat');
var rInline = frCreate('logs/agent/runs/_e2e_inline_spec.json', 'inline');

check('端到端·catalog spec 真引擎 create rc=0', rCat.rc === 0, 'rc=' + rCat.rc + ' tail=' + rCat.stdout.slice(-400));
check('端到端·内联 spec 真引擎 create rc=0', rInline.rc === 0, 'rc=' + rInline.rc + ' tail=' + rInline.stdout.slice(-400));

// ④ 产物逐字节对比（不同 outName → 两个部署文件；IR 不含 outName → 字节应全等）
var FR_DEPLOY = 'D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent';
var catCpt = FR_DEPLOY + '/E2E_CATALOG_api.cpt';
var inlCpt = FR_DEPLOY + '/E2E_INLINE_api.cpt';
if (rCat.rc === 0 && rInline.rc === 0 && exists(catCpt) && exists(inlCpt)) {
  check('端到端·cpt 产物 MD5 逐字节等价（catalog == 内联，不同 outName 同 IR）',
    md5(catCpt) === md5(inlCpt), md5(catCpt) + ' vs ' + md5(inlCpt));
} else {
  check('端到端·产物文件缺失（引擎跑失败）', false, 'cat=' + catCpt + ' exists=' + exists(catCpt) + ' inl=' + exists(inlCpt));
}

// ⑤ 故障注入：draft 资产 → create 拒
(function () {
  var draftSpec = JSON.parse(JSON.stringify(catalogSpec));
  draftSpec.outName = 'E2E_DRAFT_NEG';
  var draftDoc = JSON.parse(JSON.stringify(dsDoc));
  draftDoc.id = 'production.e2e_draft'; draftDoc.status = 'draft';
  wrote(DS_DIR + '/e2e_draft.json', JSON.stringify(draftDoc, null, 1));
  draftSpec.dataset = { kind: 'catalog', ref: 'production.e2e_draft', dateRange: scope.dateRange };
  wrote(ROOT + '/logs/agent/runs/_e2e_draft_spec.json', JSON.stringify(draftSpec, null, 1));
  var rDraft = frCreate('logs/agent/runs/_e2e_draft_spec.json', 'draftneg');
  check('负控·draft 资产的 catalog spec → 真引擎 create 拒（NOT_PUBLISHED）',
    rDraft.rc !== 0 && rDraft.stdout.indexOf('NOT_PUBLISHED') >= 0, 'rc=' + rDraft.rc + ' tail=' + rDraft.stdout.slice(-250));
  try { Files.delete(Pth.get(DS_DIR + '/e2e_draft.json')); } catch (eD) { }
})();

// 清理测试产物（run 目录保留供 postmortem，仅删两份 spec + 部署产物）
try { Files.delete(Pth.get(ROOT + '/logs/agent/runs/_e2e_cat_spec.json')); } catch (e) { }
try { Files.delete(Pth.get(ROOT + '/logs/agent/runs/_e2e_inline_spec.json')); } catch (e) { }
try { Files.delete(Pth.get(ROOT + '/logs/agent/runs/_e2e_draft_spec.json')); } catch (e) { }

print('E2E CATALOG END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
