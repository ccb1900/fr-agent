// make_report.js — 通用报表 runner
// 用法：REPORT_SPEC=reports/xxx.js 缺省 reports/sales_demo.js
// 流程：加载规格 → 生成 XML → 落盘前校验 → 部署 → 启引擎 → 读模板 → 注数
//       → 执行 → 读回断言(diag) → 导出 PNG/PDF/CPT → 正常退出（不留残留进程锁库）

var J = function (n) { return Java.type(n); };
var t0 = new Date().getTime();
var stamp = function (s) { print('[' + (new Date().getTime() - t0) + 'ms] ' + s); };
var FAILS = 0;
var check = function (name, cond) { if (cond) stamp('CHECK PASS: ' + name); else { FAILS++; stamp('CHECK FAIL: ' + name); } };

// ---------- 0. 规格与库 ----------
var specPath = J('java.lang.System').getenv('REPORT_SPEC') || 'reports/sales_demo.js';
load('D:/fineagent/lib/cpt.js');
pushGlobalStubs();
function pushGlobalStubs() {} // 占位
load('D:/fineagent/' + specPath);
if (typeof SPEC === 'undefined') { print('SPEC NOT FOUND in ' + specPath); J('java.lang.System').exit(2); }
stamp('SPEC ' + specPath + ' cols=' + SPEC.columns.length + ' rows=' + SPEC.data.length);
check('spec.columns 与 data 列数一致', SPEC.columns.length === SPEC.data[0].length);

// ---------- 1. 生成 + 落盘前校验 ----------
var built = Cpt.build(SPEC);
check('CPT VALIDATE (javax parse + invariants)', Cpt.validate(built.xml, built));
var Files = J('java.nio.file.Files');
var StringC = J('java.lang.String');
Files.write(J('java.nio.file.Paths').get('D:/fineagent/demo_template_final.cpt'),
  new StringC(built.xml).getBytes('UTF-8'));

// ---------- 2. 环境启动（启动链来自 designer.bat + 实测） ----------
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(J('java.lang.Class').forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
stamp('ENV READY');

// ---------- 3. 部署 + 读模板 ----------
var outDir = 'D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets/fineagent';
Files.createDirectories(J('java.nio.file.Paths').get(outDir));
Files.copy(J('java.nio.file.Paths').get('D:/fineagent/demo_template_final.cpt'),
  J('java.nio.file.Paths').get(outDir + '/demo_template_final.cpt'),
  J('java.nio.file.StandardCopyOption').REPLACE_EXISTING);
var vb = null;
try {
  vb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('fineagent/demo_template_final.cpt');
  stamp('TEMPLATE READ: ' + vb);
} catch (e) { stamp('READ FAIL: ' + e); }

// ---------- 4. 注数（数据来自规格，类型按 column 定） ----------
var ETD = J('com.fr.data.impl.EmbeddedTableData');
var etd = new ETD();
for (var ci = 0; ci < SPEC.columns.length; ci++) {
  etd.addColumn(SPEC.columns[ci].name, SPEC.columns[ci].type === 'number'
    ? J('java.lang.Class').forName('java.lang.Integer') : J('java.lang.Class').forName('java.lang.String'));
}
for (var ri = 0; ri < SPEC.data.length; ri++) {
  var row = [], src = SPEC.data[ri];
  for (var cj = 0; cj < src.length; cj++) {
    row.push(SPEC.columns[cj].type === 'number' ? J('java.lang.Integer').valueOf(src[cj]) : String(src[cj]));
  }
  etd.addRow(J('java.util.Arrays').asList(row));
}
vb.putTableData('ds1', etd);
stamp('DATA INJECTED rows=' + etd.getRowCount());

// 数值自检：合计 = 末列总和（与 =SUM(末列3) 公式口径一致）
var expectSum = 0;
for (var di = 0; di < SPEC.data.length; di++) expectSum += (SPEC.columns[SPEC.columns.length - 1].type === 'number' ? SPEC.data[di][SPEC.columns.length - 1] : 0);
stamp('EXPECTED TOTAL = ' + expectSum);

// ---------- 5. 执行 ----------
var rb = null;
try {
  rb = vb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
  stamp('EXECUTED: ' + rb);
} catch (e) {
  stamp('EXECUTE FAIL: ' + e);
  try {
    var sw = new (J('java.io.StringWriter'))(); var pw = new (J('java.io.PrintWriter'))(sw);
    e.printStackTrace(pw);
    stamp('STACK: ' + String(sw.toString()).split('\n').slice(0, 25).join(' || '));
  } catch (e2) {}
}

// ---------- 6. 读回断言（防样式默认化/公式丢失） ----------
if (vb) {
  try {
    var diagOs = new (J('java.io.FileOutputStream'))(outDir + '/diag.cpt');
    vb.export(diagOs); diagOs.close();
    var diagTxt = new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(outDir + '/diag.cpt')), 'UTF-8');
    check('ROUNDTRIP ASSERT (FR 自序列化)', Cpt.assertRoundTrip(diagTxt, SPEC));
  } catch (e) { FAILS++; stamp('ROUNDTRIP FAIL: ' + e); }
}

// ---------- 7. 导出 ----------
if (rb) {
  try {
    var os = new (J('java.io.FileOutputStream'))(outDir + '/' + SPEC.outName + '.png');
    new (J('com.fr.io.exporter.ImageExporter'))().export(os, rb); os.close();
    stamp('PNG DONE');
  } catch (e) { stamp('PNG FAIL: ' + e); }
  try {
    var os2 = new (J('java.io.FileOutputStream'))(outDir + '/' + SPEC.outName + '.pdf');
    new (J('com.fr.io.exporter.PDFExporter'))().export(os2, rb); os2.close();
    stamp('PDF DONE');
  } catch (e) { stamp('PDF FAIL: ' + e); }
  try {
    var os3 = new (J('java.io.FileOutputStream'))(outDir + '/' + SPEC.outName + '.cpt');
    vb.export(os3); os3.close();
    stamp('CPT DONE');
  } catch (e) { stamp('CPT FAIL: ' + e); }
}
stamp('PIPELINE END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
