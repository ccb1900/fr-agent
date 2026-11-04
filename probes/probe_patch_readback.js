// probes/probe_patch_readback.js — I6-R0 读回/写回定性探针（runraw，不杀 java、不启 FineDB 写锁之外的资源）
//   r2 §6.1 铁律："必须先做实机探针，不能因 readTemplateWorkBook 能读入模板就认为对象访问能力完整"。
//   对一张自产、无命名样式、内嵌数据的 CPT（fineagent/销售明细_api.cpt）实测：
//     (a) cell.setValue 改标题格 → export → 再 readTemplateWorkBook → 值确实变？（写回跨 export 的唯一悬念）
//     (b) wb.putTableData 换数据集 → export → 再读回 → 列数/类型/值反映新集？（make_report.js 已证 putTableData→export，此复核）
//     (c) sheet.setColumnWidth 读回对象上改列宽 → export → 再读回 → <ColumnWidth> 变？（取证示列宽只有 XML 读口，实测判生死）
//     (d) 命名样式守卫：对一张官方件 XML 文本数 style_name=，量化"历史件读回即损"的现实。
//   结论落 data/template_patch_readback_truth.txt → 冻结 I6 v1 patch op 白名单（探针不过者一律不入）。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
load('D:/fineagent/runtime/paths.js');
load(Paths.runtime('bootstrap.js'));
Runtime.initialize();          // 激活链 + SimpleWork.checkIn(WEB-INF)：readTemplateWorkBook 相对名可用（make_report 同法）
var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var Class = J('java.lang.Class');   // 探针 (b) 用 Class.forName 取列类型（此前漏定义）
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var deploy = Paths.demoDeployDir();          // <FR>/.../reportlets/fineagent（读回靶 + 临时写回件都在这，reportlets 相对名可再读）
var TMP = 'fineagent/_patch_probe.cpt';     // 相对名（写回临时件，探针末尾自清；绝不覆盖基线件）
var out = [];
function log(s) { out.push(s); print(s); }
function readText(file) { try { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(file)), 'UTF-8')); } catch (e) { return ''; } }
function cellVal(ws, c, r) { try { var ce = ws.getCellElement(c, r); if (!ce) return '(nocell)'; var v = ce.getValue(); return v == null ? '(null)' : (v.getClass().getName() + ':' + String(v)); } catch (e) { return '(readfail ' + e + ')'; } }

log('## (a) cell.setValue → export → re-read');
try {
  var wb = TWBIO.readTemplateWorkBook('fineagent/销售明细_api.cpt');
  var sheet = wb.getReport(0);
  var before = cellVal(sheet, 0, 0);
  log('  title(0,0) before=' + before);
  var ce0 = sheet.getCellElement(0, 0);
  ce0.setValue(J('java.lang.String').valueOf('I6_PATCHED_TITLE_临时'));   // 文本格值替换
  var os = new (J('java.io.ByteArrayOutputStream'))(); wb.export(os);
  Files.write(Pth.get(deploy + '/_patch_probe.cpt'), os.toByteArray());   // 临时件（自清）
  var wb2 = TWBIO.readTemplateWorkBook(TMP);
  var after = cellVal(wb2.getReport(0), 0, 0);
  log('  title(0,0) after =' + after);
  log('  VERDICT cell.setValue→export→re-read = ' + (/I6_PATCHED_TITLE/.test(after) ? 'PASS' : 'FAIL'));
} catch (e) { log('  cell.setValue ERR: ' + e); }

log('## (b) putTableData 换数据集 → export → re-read');
try {
  var wb3 = TWBIO.readTemplateWorkBook('fineagent/销售明细_api.cpt');
  var etd = new (J('com.fr.data.impl.EmbeddedTableData'))();
  etd.setDsName('ds1');
  etd.addColumn('probe_col', Class.forName('java.lang.Integer'));
  etd.addColumn('probe_txt', Class.forName('java.lang.String'));
  etd.addRow(J('java.util.Arrays').asList([J('java.lang.Integer').valueOf(123), J('java.lang.String').valueOf('PROBE_ROW')]));
  wb3.putTableData('ds1', etd);
  var os3 = new (J('java.io.ByteArrayOutputStream'))(); wb3.export(os3);
  Files.write(Pth.get(deploy + '/_patch_probe.cpt'), os3.toByteArray());
  var wb4 = TWBIO.readTemplateWorkBook(TMP);
  var td = wb4.getTableData('ds1');
  var cn = td.getColumnCount ? td.getColumnCount() : -1;
  var v = '';
  try { v = String(td.getColumnValues(1)[0]) + '/' + String(td.getColumnValues(0)[0]); } catch (eC) { v = '(valfail ' + eC + ')'; }
  log('  re-read ds1 colCount=' + cn + ' probe=' + v);
  log('  VERDICT putTableData→export→re-read = ' + (cn >= 2 && /PROBE_ROW/.test(v) && /123/.test(v) ? 'PASS' : 'CHECK'));
} catch (e) { log('  putTableData ERR: ' + e); }

log('## (c) setColumnWidth 读回对象 → export → re-read（<ColumnWidth> 变？）');
try {
  var wbA = TWBIO.readTemplateWorkBook('fineagent/销售明细_api.cpt');
  var shA = wbA.getReport(0);
  var widthBefore = (/<ColumnWidth[^>]*>\s*<!\[CDATA\[([^\]]*)\]/.exec(readText(deploy + '/销售明细_api.cpt')) || [, 'n/a'])[1];
  var setOk = 'NO-setter';
  if (typeof shA.setColumnWidth === 'function') { shA.setColumnWidth(0, 9999990); setOk = 'setter-called'; }   // 首列改到极大
  var osC = new (J('java.io.ByteArrayOutputStream'))(); wbA.export(osC);
  Files.write(Pth.get(deploy + '/_patch_probe.cpt'), osC.toByteArray());
  var widthAfter = (/<ColumnWidth[^>]*>\s*<!\[CDATA\[([^\]]*)\]/.exec(readText(deploy + '/_patch_probe.cpt')) || [, 'n/a'])[1];
  log('  before=' + widthBefore.slice(0, 40));
  log('  after =' + widthAfter.slice(0, 40) + ' (' + setOk + ')');
  log('  VERDICT setColumnWidth→export→re-read = ' + (widthAfter !== widthBefore && widthAfter.indexOf('9999990') >= 0 ? 'PASS' : 'FAIL→排除'));
} catch (e) { log('  setColumnWidth ERR: ' + e + ' →排除'); }

log('## (d) 命名样式守卫：官方件 style_name= 计数（只读）');
try {
  var samples = ['demo/basic/DetailsA.cpt', 'reportlets/demo/basic/DetailsA.cpt'];
  var hit = 0, total = 0, probed = '';
  for (var i = 0; i < samples.length; i++) {
    var abs = Paths.frWebInf() + '/reportlets/' + samples[i].replace('reportlets/', '');
    if (!Files.exists(Pth.get(abs))) continue;
    var xml = readText(abs); probed = samples[i];
    hit = (xml.match(/style_name=/g) || []).length; total = (xml.match(/<Style[ >]/g) || []).length; break;
  }
  log('  sample=' + (probed || '(none found)') + ' style_name= hits=' + hit + ' /Style total=' + total);
  log('  命名样式读回即损：' + (hit > 0 ? '该件含命名样式，I6 patch 须默认 abort（README:103）' : '该件无命名样式'));
} catch (e) { log('  named-style probe skip: ' + e); }

// 自清临时件（AGENTS 纪律：探针产物不留部署目录）
try { Files.deleteIfExists(Pth.get(deploy + '/_patch_probe.cpt')); } catch (eCl) { }

log('## END (truth file 无凭据；白名单以 VERDICT 行为准)');
try { Files.write(Pth.get('D:/fineagent/data/template_patch_readback_truth.txt'), J('java.lang.String').valueOf(out.join('\n')).getBytes('UTF-8')); print('TRUTH WRITTEN'); } catch (eW) { print('WRITE FAIL ' + eW); }
System.exit(0);
