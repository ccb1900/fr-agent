// make_api.js — v3.0 runner：spec → FR API 对象图 → wb.export() 即产物
// 差异于 v2（make_report.js）：
//   - 无"生成 XML 字符串"步骤：cpt 由 FR 自己序列化
//   - 数据集自包含（EmbeddedTableData 直接进对象图），无需部署后注数
//   - v2 校验器仍作回归门：Cpt.validate（落盘产物）+ Cpt.assertRoundTrip（自序列化产物）
var J = function (n) { return Java.type(n); };
var Class = Java.type('java.lang.Class');
var t0 = new Date().getTime();
var stamp = function (s) { print('[' + (new Date().getTime() - t0) + 'ms] ' + s); };
var FAILS = 0;
var check = function (name, cond) { if (cond) stamp('CHECK PASS: ' + name); else { FAILS++; stamp('CHECK FAIL: ' + name); } };
// 失败门禁（迭代 1，2026-11-04 用户拍板）：上游任何 FAILS 不得继续——错误产物不执行、不部署、
// 不往部署目录写诊断件，退出码如实反映失败（原实现 CPT 校验失败照跑照部署、部署失败 catch 不计数可致 exit 0）。
var gateAt = function (where) {
  if (FAILS > 0) { stamp('GATE CLOSED at ' + where + ': failures=' + FAILS + ' -> refusing execute/export/deploy'); J('java.lang.System').exit(1); }
};
// 参数默认值 → 执行参数（迭代 1 修复：原只送 editor，date/combo/number/多选等控件默认值不进 execute，
// 执行验证的报表 ≠ 参数面板实际提交的报表）。形态镜像 object.js buildParamAttr 的 widgetValue 口径：
// 文本族控件 widgetValue 均为串形态；number 走数值（整数优先 Integer——SQL ${} 文本替换口径，避免
// "20.0" 打进 TOP/LIMIT 位；面板序列化 Double 属另一层面，接真实数值参数业务前再探针复核）；
// '=…' 公式默认值执行期无法求值 → 显式跳过并留诊断，不伪造值。
function paramDefaults(ir) {
  var out = [];
  if (!ir || !ir.param) return out;
  (ir.param.widgets || []).forEach(function (w) {
    if (!w || w.name == null) return; // label/submit/nav/iframe 不供参数名
    if (w.kind === 'number') {
      var nv = Number(w.value == null ? 0 : w.value); // NumberEditor 面板默认即 0（object.js widgetValue 同口径）
      out.push([w.name, nv === Math.floor(nv) ? J('java.lang.Integer').valueOf(nv) : J('java.lang.Double').valueOf(nv)]);
      return;
    }
    if (w.value == null || w.value === '') return;
    var s = String(w.value);
    if (s.charAt(0) === '=') { stamp('PARAM DEFAULT SKIP (formula not runtime-evaluable): ' + w.name + '=' + s); return; }
    out.push([w.name, s]); // editor/date/combo/textarea/radio/checkbox/combocheck/treecombo 串形态
  });
  return out;
}

// ---------- 0. 规格与库 ----------
// ABR-1 路径单点：唯一装载锚（FR_AGENT_HOME 可重定向整个项目根）；其余路径一律走 runtime/paths.js
load((J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent') + '/runtime/paths.js');
var FR_AGENT_ROOT = Paths.root;   // 兼容读法
var specPath = J('java.lang.System').getenv('REPORT_SPEC') || 'reports/sales_demo.js';
load(Paths.lib('object.js'));
load(Paths.lib('ir.js'));        // v3.1: spec → IR
load(Paths.lib('cpt.js'));       // v2 校验器当回归门
load(Paths.spec(specPath));
if (typeof SPEC === 'undefined') { print('SPEC NOT FOUND in ' + specPath); J('java.lang.System').exit(2); }
if (!SPEC.dsName) SPEC.dsName = 'ds1';
if (SPEC.IR) {
  stamp('SPEC ' + specPath + ' [IR 直通：官方 demo 重建路径]');
} else {
  stamp('SPEC ' + specPath + ' cols=' + SPEC.columns.length + ' rows=' + SPEC.data.length);
  check('spec.columns 与 data 列数一致', SPEC.columns.length === SPEC.data[0].length);
}

// ---------- 1. 环境（ABR-1：runtime 门面，激活链在 runtime/bootstrap.js） ----------
load(Paths.runtime('bootstrap.js'));
load(Paths.runtime('datasource.js'));
Runtime.initialize();
stamp('ENV READY');

// ---------- 1.5 数据连接注册（v3.5 DB 路线；ABR-1：runtime/datasource.js）----------
// spec.connections 里给凭据（本机 spec 文件，cpt 只存连接名）；先真连一次，
// 连不上直接退出——拒绝带着坏连接产出"看起来正常"的空报表。
if (SPEC.connections && SPEC.connections.length) {
  Runtime.DataSource.register(SPEC.connections, { stamp: stamp, check: check });
}

// ---------- 1.6 行数保护阈值钩子（保留机制，spec 需要时显式开）----------
// RelaxationRestrictionConfig 是全局共享配置（持久化 FineDB，设计器同库，README #32 putConnection 同性质）。
// v3.7 决议不再改（千万行场景靠 SQL 分页，全量零触碰）；默认口径 hook 保留备用。
if (SPEC.relaxRowControl) {
  try {
    var RC = J('com.fr.report.restriction.config.RelaxationRestrictionConfig');
    var inst = RC.getInstance();
    var oldMax = inst.getMaxDSRowCount();
    // 总闸全开：openRowControl/opensCellControl 都关（本机唯一大结果集生产者就是数据浏览器； влас其余模板不受常态阈值 8 万行影响）
    inst.setOpenRowControl(false);
    inst.setOpenCellControl(false);
    inst.setMaxDSRowCount(500000);
    inst.setMaxDSCellCount(20000000);
    check('ROW CONTROL REGISTER', !inst.isOpenRowControl() && inst.getMaxDSCellCount() === 20000000);
    stamp('ROW CONTROL: row open=false cell open=false maxDSRow=80000->500000 maxCell=20000000');
  } catch (eR) {
    stamp('ROW CONTROL FAIL: ' + eR);
    J('java.lang.System').exit(5);
  }
}

// ---------- 2. IR 编译 + 对象图构建 ----------
built = null;
try {
  var IR = Ir.compile(SPEC);
  var irErrs = Ir.validate(IR);
  check('IR VALIDATE (blocks/datasets 结构)', irErrs.length === 0);
  if (irErrs.length) {
    irErrs.forEach(function (e) { stamp('IR ISSUE: ' + e); });
    // 审计批 A（README #48）：IR 校验失败即停——保留全部诊断，不产出不合格中间产物。EXIT 9 = IR VALIDATE FAILED
    stamp('IR VALIDATE FAILED: refusing to build');
    J('java.lang.System').exit(9);
  }
  built = Obj.build(IR);
  stamp('ASSEMBLED: styles=' + built.styleCount + ' totalCol=' + built.totalCol + ' rows=' + built.sheets[0].rows);
} catch (e) {
  stamp('ASSEMBLE FAIL: ' + e);
  var sw = new (J('java.io.StringWriter'))(); var pw = new (J('java.io.PrintWriter'))(sw);
  e.printStackTrace(pw); stamp(String(sw.toString()).split('\n').slice(0, 15).join(' || '));
  J('java.lang.System').exit(3);
}
var wb = built.wb;
var Files = J('java.nio.file.Files');

// ---------- 3. 导出产物 cpt（FR 自序列化）+ v2 校验器过回归门 ----------
var localCpt = Paths.root + '/demo_api.cpt';   // ABR-1 路径单点（外部审计批 A：原硬编码绝对路径）
try {
  var osC = new (J('java.io.FileOutputStream'))(localCpt);
  wb.export(osC); osC.close();
  stamp('CPT EXPORTED: ' + localCpt);
  var xmlText = new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(localCpt)), 'UTF-8');
  // rawIR 路径跳过 styleCount 门：引擎序列化会合并相同样式实例（重建 spec 11 → 7 段属正常去重）
  check('CPT VALIDATE (v2 校验器复用于 API 产物)', Cpt.validate(xmlText, { styleCount: SPEC.IR ? null : built.styleCount, skipFormatOrder: !!SPEC.IR, allowNoFormula: !!SPEC.allowNoFormula }));
  // 参数面板结构断言（回归门不认识新段，单独官宣）
  if (IR.param) {
    check('PARAM ATTR SERIALIZED', /<ReportParameterAttr[ >]/.test(xmlText)
      && /<ParameterUI class="com\.fr\.form\.main\.parameter\.FormParameterUI"/.test(xmlText)
      && /WParameterLayout/.test(xmlText)
      && /WAbsoluteLayout\$BoundsWidget/.test(xmlText)
      && /<widgetValue>/.test(xmlText));
    IR.param.widgets.forEach(function (w) {
      if (w.kind === 'label') check('PARAM LABEL TEXT "' + w.text + '"', xmlText.indexOf('CDATA[' + w.text) >= 0);
      if (w.kind === 'submit') check('PARAM BUTTON TEXT "' + w.text + '"', xmlText.indexOf('CDATA[' + w.text) >= 0);
      if (w.kind === 'editor') check('PARAM EDITOR NAME "' + w.name + '"', xmlText.indexOf('name="' + w.name + '"') >= 0);
    });
  }
  // 超链结构断言（v3.2 尾刀：NameJavaScriptGroup + ReportletHyperlink 钻取）
  var linkBlock = null;
  (IR.sheets[0].blocks || []).forEach(function (b) { if (b.type === 'detail' && b.link) linkBlock = b; });
  if (linkBlock) {
    check('LINK SERIALIZED', /NameJavaScriptGroup/.test(xmlText)
      && /ReportletHyperlink/.test(xmlText)
      && xmlText.indexOf('CDATA[' + linkBlock.link.reportlet) >= 0);
    check('LINK NAME "' + (linkBlock.link.name || '钻取') + '"', xmlText.indexOf('name="' + (linkBlock.link.name || '钻取') + '"') >= 0);
  }
  // 图表结构断言（v3.2 图表族：t="CC" 缩写格 + MoreNameCDDefinition 命名引用绑定；v3.3 多系列取 values[0]）
  //   v4.2 Van 序列化形态（能力自检_VanChart_api.cpt 一手）：系列名不落 CDATA，落 valueName="名" 属性
  //   （MoreName/VanChartOneValue 同属性化）——断言两形态都认，legacy CDATA 不受扰。
  var chartBlock = null;
  (IR.sheets[0].blocks || []).forEach(function (b) { if (b.type === 'chart') chartBlock = b; });
  if (chartBlock) {
    var nameIn = function (v) { return xmlText.indexOf('CDATA[' + v) >= 0 || xmlText.indexOf('valueName="' + v + '"') >= 0; };
    var firstVal = (chartBlock.values && chartBlock.values.length) ? chartBlock.values[0] : chartBlock.value;
    check('CHART SERIALIZED', /<O t="CC">/.test(xmlText)
      && /MoreNameCDDefinition/.test(xmlText)
      && /NameTableData/.test(xmlText)
      && xmlText.indexOf('CDATA[' + chartBlock.dataset) >= 0);
    check('CHART DEF CATE "' + chartBlock.category + '"', new RegExp('CategoryName value="' + chartBlock.category + '"').test(xmlText));
    check('CHART DEF VALUE "' + firstVal + '"', nameIn(firstVal));
    if (chartBlock.values && chartBlock.values.length > 1) check('CHART MULTI-SERIES N=' + chartBlock.values.length, nameIn(chartBlock.values[chartBlock.values.length - 1]));
  }
} catch (e) {
  FAILS++; stamp('CPT EXPORT/VALIDATE FAIL: ' + e);
  var sw2 = new (J('java.lang.StringWriter'))(); var pw2 = new (J('java.io.PrintWriter'))(sw2);
  e.printStackTrace(pw2); stamp(String(sw2.toString()).split('\n').slice(0, 15).join(' || '));
}
gateAt('cpt-export-validate');   // 迭代 1 门禁：导出/校验任何 FAIL 不放行后续执行与部署

// ---------- 4. 执行 + 导出 ----------
// 2026-10-28 生产构建通道：BR_DEPLOYDIR 可指向 staging（默认演示服务器部署位不动），BR_TPFX/BR_MODULESET 配套
var outDir = J('java.lang.System').getenv('BR_DEPLOYDIR') || Paths.demoDeployDir();   // ABR-1：默认演示部署位 = FR_HOME 单点
Files.createDirectories(J('java.nio.file.Paths').get(outDir));
var rb = null;
var SKIP_EXEC = J('java.lang.System').getenv('BR_SKIP_EXEC');
if (SKIP_EXEC) {
  // 2026-10-28 生产构建通道（BR_SKIP_EXEC=1）：演示库没有 t_collector_* 前缀表，的正常执行验证只能在生产服务器做。
  // 只烘 SQL + 导出 cpt；PNG/PDF 免产物
  stamp('PROD BUILD: SKIP EXEC');
} else {
  try {
    // 参数面板家族（v3.2）：全部控件默认值作为执行参数（模拟设计器里点"查询"时面板送出的默认值）
    var pmap = new (J('java.util.HashMap'))();
    paramDefaults(typeof IR !== 'undefined' ? IR : null).forEach(function (kv) { pmap.put(kv[0], kv[1]); });
    rb = wb.execute(pmap, new (J('com.fr.stable.PageActor'))());
    stamp('EXECUTED: ' + rb);
  } catch (e) {
    stamp('EXECUTE FAIL: ' + e);
    var sw3 = new (J('java.io.StringWriter'))(); var pw3 = new (J('java.io.PrintWriter'))(sw3);
    e.printStackTrace(pw3); stamp(String(sw3.toString()).split('\n').slice(0, 20).join(' || '));
    FAILS++;
  }
  gateAt('execute');   // 迭代 1 门禁：执行失败不部署
}
gateAt('deploy');
try { var osT = new (J('java.io.FileOutputStream'))(outDir + '/' + SPEC.outName + '_api.cpt'); wb.export(osT); osT.close(); stamp('CPT DEPLOYED'); } catch (e) { stamp('CPT DEPLOY FAIL: ' + e); FAILS++; }
if (rb) {
  var name = SPEC.outName + '_api';
  // v4.2 VanChart 插件族：服务端出图 PainterFactory 需 GeneralContext locale（ResourceHelper.mixLocaleData NPE）。
  // 只在 spec 含 v 图种时临时设 zh_CN，导出后复原，避免动老图数字格式类基线。
  var hasVan = typeof IR !== 'undefined' && (IR.sheets || []).some(function (s) {
    return (s.blocks || []).some(function (b) { return b.type === 'chart' && String(b.kind || '').indexOf('v') === 0 && b.kind !== 'pie' && b.kind !== 'bar'; });
  });
  var loc0 = null;
  try {
    if (hasVan) {
      var GC = J('com.fr.general.GeneralContext'); // 静态方法面（probe_vanchart8）：getLocale()/setLocale(Locale)
      loc0 = GC.getLocale();
      GC.setLocale(new (J('java.util.Locale'))('zh', 'CN'));
      // 一手实证（probe_vanchart15）：裸引导的 ClientI18nProvider$1 无资源注册 → getEntireKV null →
      // ResourceHelper.mixLocaleData NPE → PainterFactory.createFormat 崩 → V8 FR.i18nText 未定义 → PNG 0 字节。
      // 官方注册链 = com.fr.general.I18nResource 单例（静态 init：FineLocaleManager.create() + registerClientProvider），
      // 触发 getInstance() 即接管 provider；fetchI18NJs 实测 OK。
      J('com.fr.general.I18nResource').getInstance();
      stamp('VAN LOCALE zh_CN (was ' + loc0 + '), I18nResource active, clientProvider=' +
        J('com.fr.locale.InterProviderFactory').getClientProvider().getClass().getName());
    }
  } catch (eLoc) { stamp('VAN LOCALE FAIL: ' + eLoc); FAILS++; }
  try { var osP = new (J('java.io.FileOutputStream'))(outDir + '/' + name + '.png'); new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb); osP.close(); stamp('PNG DONE'); } catch (e) { stamp('PNG FAIL: ' + e); FAILS++; }
  try { var osD = new (J('java.io.FileOutputStream'))(outDir + '/' + name + '.pdf'); new (J('com.fr.io.exporter.PDFExporter'))().export(osD, rb); osD.close(); stamp('PDF DONE'); } catch (e) { stamp('PDF FAIL: ' + e); FAILS++; }
  try { if (loc0 != null) J('com.fr.general.GeneralContext').setLocale(loc0); } catch (eL) { }
}
// ---------- 4.5 计算结果栅格 dump（env RESULT_DUMP=路径 时开启；纯诊断，默认关，不动任何产物）----------
// 用途：真库报表的数字验收要对"算完的格"逐格核，而不是只看 PNG 猜。
if (rb && J('java.lang.System').getenv('RESULT_DUMP')) {
  var dumpPath = J('java.lang.System').getenv('RESULT_DUMP');
  try {
    // 一手实证（probe_resultgrid）：wb.execute → PageRWorkBook；取格面在 getResultReport(i)
    //   （com.fr.report.report.ResultReport：getRowCount/getColumnCount + getCellElement(c,r)）
    var RPT = J('java.lang.Class').forName('com.fr.report.report.ResultReport');
    var twoArg = [];
    var RM = RPT.getMethods();
    for (var mi = 0; mi < RM.length; mi++) {
      if (RM[mi].getParameterTypes().length === 2 && /Cell/i.test(RM[mi].getName())) {
        twoArg.push(RM[mi].getName() + '->' + RM[mi].getReturnType().getSimpleName());
      }
    }
    stamp('RESULT REPORT 2-ARG CELL METHODS: ' + twoArg.join(', '));
    var outG = 'RB_CLASS=' + rb.getClass().getName() + ' reports=' + rb.getReportCount() + '\n';
    var probeOnce = false;
    for (var ri = 0; ri < rb.getReportCount(); ri++) {
      var rp = rb.getResultReport(ri);
      outG += '## REPORT ' + ri + ' rows=' + rp.getRowCount() + ' cols=' + rp.getColumnCount() + '\n';
      for (var rg = 0; rg < rp.getRowCount(); rg++) {
        var cells = [];
        for (var cg = 0; cg < rp.getColumnCount(); cg++) {
          var cel = rp.getCellElement(cg, rg);
          if (cel && !probeOnce) { // 一手取格文本面：先反射一次再照着用
            probeOnce = true;
            var CM = cel.getClass().getMethods(), cand = [];
            for (var ci2 = 0; ci2 < CM.length; ci2++) {
              if (CM[ci2].getParameterTypes().length === 0 && /Text|Value|String/.test(CM[ci2].getName())
                && CM[ci2].getDeclaringClass().getName().startsWith('com.fr')) cand.push(CM[ci2].getName());
            }
            stamp('CELL CLASS=' + cel.getClass().getName() + ' TEXT-ISH=' + cand.join(','));
          }
          var txt = '';
          if (cel != null) {
            if (typeof cel.getText === 'function') txt = String(cel.getText());
            else if (typeof cel.getValue === 'function' && cel.getValue() != null) txt = String(cel.getValue());
            else if (typeof cel.toString === 'function') txt = String(cel.toString());
          }
          cells.push(txt);
        }
        outG += cells.join('|') + '\n';
      }
    }
    J('java.nio.file.Files').write(J('java.nio.file.Paths').get(dumpPath),
      J('java.lang.String').valueOf(outG).getBytes('UTF-8'));
    stamp('RESULT DUMP DONE -> ' + dumpPath);
  } catch (eDump) {
    stamp('RESULT DUMP FAIL: ' + eDump);
    var swD = new (J('java.io.StringWriter'))(); eDump.printStackTrace(new (J('java.io.PrintWriter'))(swD));
    stamp(String(swD.toString()).split('\n').slice(0, 6).join(' || '));
  }
}

// ---------- 5. ROUNDTRIP：FR 自序列化再读回断言（防静默降级） ----------
try {
  var diagPath = outDir + '/diag_api.cpt';
  var osDi = new (J('java.io.FileOutputStream'))(diagPath);
  wb.export(osDi); osDi.close();
  var diagTxt = new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(diagPath)), 'UTF-8');
  if (SPEC.columns) check('ROUNDTRIP ASSERT', Cpt.assertRoundTrip(diagTxt, SPEC));
  else check('ROUNDTRIP PARSE (rawIR)', (function () { J('javax.xml.parsers.DocumentBuilderFactory').newInstance().newDocumentBuilder().parse(new (J('org.xml.sax.InputSource'))(new (J('java.io.StringReader'))(diagTxt))); if (!SPEC.allowNoFormula && !/class="com\.fr\.base\.Formula"/.test(diagTxt)) throw 'ROUNDTRIP: formula LOST'; return true; })());
  // 结构对比线索：行高列宽 & 样式行数
  var rh = diagTxt.match(/<RowHeight[^>]*>\s*<!\[CDATA\[([^\]]*)\]/);
  var cw = diagTxt.match(/<ColumnWidth[^>]*>\s*<!\[CDATA\[([^\]]*)\]/);
  stamp('DIAG RowHeight = ' + (rh ? rh[1] : 'n/a'));
  stamp('DIAG ColumnWidth = ' + (cw ? cw[1] : 'n/a'));
  stamp('DIAG Style count = ' + (diagTxt.match(/<Style[ >]/g) || []).length);
} catch (e) { FAILS++; stamp('ROUNDTRIP FAIL: ' + e); }

// ---------- 6. 数值自检（默认路径；rawIR 自带勾稽账，不适用） ----------
var expectSum = 0, lastNum = built.totalCol;
if (SPEC.data) { for (var di = 0; di < SPEC.data.length; di++) expectSum += (lastNum >= 0 ? SPEC.data[di][lastNum] : 0); stamp('EXPECTED TOTAL = ' + expectSum); }

stamp('PIPELINE END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
