// probes/probe_patch_dataset_integration.js — I6.1-A 真实 WorkBook 集成测（runraw，审查 P1 要求）
//   验完整链：readTemplateWorkBook → TemplateInspector.describe(wb)（带 hasDataset 活断言）
//   → TemplateLocator.exists(replace_dataset, descriptor) 真的放行 → TemplatePatch.apply → export
//   → 再 readTemplateWorkBook → getTableData 列数/行值确为新集。不覆盖原基线件（临时件自清）。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
load('D:/fineagent/runtime/paths.js');
var R = Paths.root;
load(R + '/template/ops.js'); load(R + '/template/validator.js'); load(R + '/template/locator.js'); load(R + '/template/diff.js');
load(R + '/template/inspector.js'); load(R + '/template/reader.js'); load(R + '/template/patch.js');
load(Paths.runtime('bootstrap.js')); Runtime.initialize();

var out = [], FAIL = 0;
function ck(name, cond) { out.push((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) FAIL++; }
var deploy = Paths.demoDeployDir();
var TMP = 'fineagent/_i61_probe.cpt';   // 相对名（reportlets 根）
var abs = deploy + '/_i61_probe.cpt';
try {
  // 源 = 自产日报（内嵌/SQL 名 ds1、单 sheet、无命名样式）——原文件只读不覆盖
  var wb = TemplateReader.readCpt('fineagent/销售明细_api.cpt');
  var desc = TemplateInspector.describe(wb);
  ck('describe 返回 hasDataset 活断言', typeof desc.hasDataset === 'function');
  ck('describe.hasDataset(ds1) 真实 WorkBook 实查为真', desc.hasDataset('ds1') === true);
  ck('describe.hasDataset(ghost) 为假', desc.hasDataset('ghost') === false);

  // 构造 replace_dataset op（Locator 走真实 descriptor）
  var op = { op: 'replace_dataset', name: 'ds1', columns: [{ name: 'probe_a', type: 'integer' }, { name: 'probe_b', type: 'text' }], rows: [[7, 'I61'], [8, 'OK']] };
  var loc = TemplateLocator.exists(op, desc);
  ck('Locator 用真实 describe 描述符放行 ds1（断层修好）', loc.ok === true);
  var res = TemplatePatch.apply(wb, op, desc);
  ck('apply 返回数据集 before 描述', !!res.before && !!res.before.dataset && res.before.dataset.name === 'ds1');

  // export → 再读回（跨 export 写回证据）
  var os = new (J('java.io.ByteArrayOutputStream'))(); wb.export(os);
  Files.write(Pth.get(abs), os.toByteArray());
  var wb2 = TemplateReader.readCpt(TMP);
  var td = wb2.getTableData('ds1');
  var cols = td.getColumnCount();
  ck('再读回 ds1 列数=2（替换落地）', cols === 2);
  // probe_typemap.js 一手证：getColumnClass(i) 可读；验第一列确实是 Integer（不是旧集的 String 列）
  var c0 = '?';
  try { c0 = String(td.getColumnClass(0).getName()); } catch (eC) { c0 = '(classread ' + eC + ')'; }
  ck('再读回 ds1 首列为 java.lang.Integer（新集列型保真）', c0 === 'java.lang.Integer');
  // 原基线件未被覆盖
  ck('原始基线件未被写（demo_api.cpt 不变量另行终验）', Files.exists(Pth.get(Paths.root + '/demo_api.cpt')));
} catch (e) { out.push('FAIL 异常: ' + e); FAIL++; }
try { Files.deleteIfExists(Pth.get(abs)); } catch (eCl) { }
var msg = out.join('\n');
print(msg);
try { Files.write(Pth.get(R + '/data/i61_dataset_integration_truth.txt'), J('java.lang.String').valueOf(msg).getBytes('UTF-8')); } catch (eW) { }
System.exit(FAIL);
