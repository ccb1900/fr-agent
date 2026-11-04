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
var RR = null;   // I0-02：结果契约记录器——RunResult.begin() 于 runresult 库装载后立即位（先于 spec 装载），一切出口经 finishRun
var check = function (name, cond) { if (cond) stamp('CHECK PASS: ' + name); else { FAILS++; stamp('CHECK FAIL: ' + name); } };
// 失败门禁（迭代 1，2026-11-04 用户拍板）：上游任何 FAILS 不得继续——错误产物不执行、不部署、
// 不往部署目录写诊断件，退出码如实反映失败（原实现 CPT 校验失败照跑照部署、部署失败 catch 不计数可致 exit 0）。
// 迭代 4：门禁触发经 finishRun 统一落 RESULT_JSON（stage 定位 + 诊断入列），退出码仍 = 1（权威裁决不变）。
var gateAt = function (where) {
  if (FAILS > 0) {
    stamp('GATE CLOSED at ' + where + ': failures=' + FAILS + ' -> refusing execute/export/deploy');
    if (RR) { RR.diag('GATE CLOSED at ' + where); finishRun(1); }
    J('java.lang.System').exit(1);
  }
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
load(Paths.lib('runresult.js')); // 迭代 4 地基：机器可读结果契约（纯模块，零运行时依赖）——先载，RR 尽早就位
// 迭代 4：RR 只观察 stage 与诊断，绝不进对象图/字节路径（wb/export/Cpt 从不读它）→ 字节基线不受影响。
//   退出码 = 权威裁决；RESULT_JSON 的 stages 定位失败段、diagnostics 带因；BR_SKIP_EXEC 下 execute/render=skipped。
RR = RunResult.begin();
var RESULT_FILE = J('java.lang.System').getenv('FR_AGENT_RESULT') || (Paths.root + '/logs/last_run.json');
function writeRunResult(code) {
  var snap = RR.snapshot();
  if (code != null) { snap.exit = code; snap.success = (code === 0); } else { snap.exit = null; }  // I0-02：初始快照无码 → success 保持契约推导值（null=未完）
  var json = JSON.stringify(snap);
  print('RESULT_JSON ' + json);
  try {
    var P = J('java.nio.file.Paths'), F = J('java.nio.file.Files');
    F.createDirectories(P.get(RESULT_FILE).getParent());
    F.write(P.get(RESULT_FILE), J('java.lang.String').valueOf(json).getBytes('UTF-8'));
  } catch (eW) { print('RESULT WRITE FAIL: ' + eW); }
}
function finishRun(code) { writeRunResult(code); J('java.lang.System').exit(code); }
// I0-01：IR 校验项 = {code,path,message}（lib/ir.js 契约）；旧串形态兼容直传（防御，不该出现）
function irErrText(e) {
  return (e && typeof e === 'object') ? (e.code + ' @ ' + e.path + ': ' + e.message) : String(e);
}
// I0-02 陈旧假绿堵洞：RR 就位即写初始快照（success=null）——此后无论怎么崩，last_run.json 不可能留着上一轮的 success:true
writeRunResult(null);
try {
  load(Paths.lib('object.js'));
  load(Paths.lib('ir.js'));        // v3.1: spec → IR
  load(Paths.lib('cpt.js'));       // v2 校验器当回归门
  if (/\.json$/i.test(specPath)) {
    // ---------- I1（r2.md）Runner JSON 模式：ReportSpec.json → 校验 → 编译 ReportIR ----------
    //   产物包成 SPEC={outName, IR}，下游完全复用 rawIR 直通路（Ir.compile 深拷+补版本、build/导出/部署/门禁零改动）；
    //   旧 .js spec 走原 load() 路径一行不动（新旧入口互不破坏，r2 §1.3）。
    //   凭据面：JSON 结构上无处放 connections（天然满足"Agent 不接触密码"）；目录由 BR_DEPLOYDIR env 控，spec 无权指路径。
    load(Paths.lib('report_spec.js'));
    load(Paths.lib('spec_validator.js'));
    load(Paths.lib('spec_compiler.js'));
    var rsText = String(new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(Paths.spec(specPath))), 'UTF-8'));
    var rs = null;
    try { rs = JSON.parse(rsText); } catch (eJson) { throw new Error('REPORTSPEC JSON parse failed: ' + eJson); }
    var rsErrs = SpecValidator.validate(rs);
    if (rsErrs.length) {
      rsErrs.forEach(function (e) { var t = irErrText(e); stamp('SPEC ISSUE: ' + t); RR.diag('SPEC ISSUE: ' + t); });
      RR.fail('input_load'); stamp('SPEC VALIDATE FAILED: refusing to compile/build'); finishRun(2);
    }
    var compiledIR;
    if (rs.dataset && rs.dataset.kind === 'sql') {
      // I5 模型驱动 SQL：载 model + sqlbuilder，编译成含 kind:sql 数据集的 cells IR；连接名→凭据本地注入
      load(Paths.lib('report_spec.js'));
      load(Paths.semantic('query/sqlbuilder.js'));
      function genv(k, d) { var v = J('java.lang.System').getenv(k); return (v == null || String(v) === '') ? d : String(v); }
      var modelPath = genv('SCHEMA_MODEL', 'models/production/model.json');
      var modelObj = JSON.parse(String(new (J('java.lang.String'))(J('java.nio.file.Files').readAllBytes(J('java.nio.file.Paths').get(Paths.spec(modelPath))), 'UTF-8')));
      compiledIR = SpecCompiler.compile(rs, { model: modelObj, SqlBuilder: SqlBuilder });
      SPEC = { outName: rs.outName, IR: compiledIR };
      // 凭据本地注入：sql 数据集引用的连接名 → 非敏感 driver/url + dbpass 密码合成 SPEC.connections（密码只在本机、绝不入 JSON/cpt）
      var connNames = {};
      (compiledIR.datasets || []).forEach(function (d) { if (d.kind === 'sql' && d.connection) connNames[d.connection] = 1; });
      if (Object.keys(connNames).length) {
        var drv = genv('SQL_DRIVER', 'com.microsoft.sqlserver.jdbc.SQLServerDriver');
        var url = genv('SQL_URL', 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false');
        var usr = genv('SQL_USER', 'sa');
        SPEC.connections = Object.keys(connNames).map(function (nm) { return { name: nm, driver: drv, url: url, user: usr, password: load(Paths.lib('dbpass.js')) }; });
        stamp('I5 SQL 注入连接（名=' + Object.keys(connNames).join(',') + '，密码走 dbpass 本地，不入产物）');
      }
    } else {
      SPEC = { outName: rs.outName, IR: SpecCompiler.compile(rs) };
    }
    stamp('REPORTSPEC ' + specPath + ' [I1 JSON 入口 → rawIR 直通]');
  } else {
    load(Paths.spec(specPath));
  }
} catch (eLoad) {
  stamp('LOAD FAIL: ' + eLoad);
  RR.fail('input_load'); RR.diag('LOAD FAIL: ' + eLoad);
  finishRun(2);
}
if (typeof SPEC === 'undefined') { print('SPEC NOT FOUND in ' + specPath); RR.fail('input_load'); RR.diag('SPEC NOT FOUND: ' + specPath); finishRun(2); }
if (!SPEC.dsName) SPEC.dsName = 'ds1';
if (SPEC.IR) {
  stamp('SPEC ' + specPath + ' [IR 直通：官方 demo 重建路径]');
} else {
  stamp('SPEC ' + specPath + ' cols=' + SPEC.columns.length + ' rows=' + SPEC.data.length);
  check('spec.columns 与 data 列数一致', SPEC.columns.length === SPEC.data[0].length);
}

// I0-02：input_load 判定前移——坏输入即裁决收口（退出码 1 不变），不再带病深入环境段
RR.set('input_load', FAILS > 0 ? 'failed' : 'passed');   // spec 装载 + 列数一致检查（check() 已计 FAILS）
if (FAILS > 0) { RR.diag('INPUT LOAD: failures=' + FAILS); finishRun(1); }

// ---------- 1. 环境（ABR-1：runtime 门面，激活链在 runtime/bootstrap.js） ----------
// I0-02 逃逸路 1（审计）：Runtime.initialize 原为裸调用——炸了不产 JSON、last_run.json 残留上次 success:true。
// 现在 runtime_initialize 段内收口：失败 = failed + 根因入诊断 + finishRun(3)（3=构建/初始化异常，码表语义不变）。
try {
  load(Paths.runtime('bootstrap.js'));
  load(Paths.runtime('datasource.js'));
  Runtime.initialize();
  RR.pass('runtime_initialize');
  stamp('ENV READY');
} catch (eInit) {
  stamp('RUNTIME INIT FAIL: ' + eInit);
  var swI = new (J('java.io.StringWriter'))(); eInit.printStackTrace(new (J('java.io.PrintWriter'))(swI));
  RR.diag('RUNTIME INIT FAIL: ' + String(swI.toString()).split('\n').slice(0, 6).join(' || '));
  RR.fail('runtime_initialize');
  finishRun(3);
}

// ---------- 1.5 数据连接注册（v3.5 DB 路线；ABR-1：runtime/datasource.js）----------
// spec.connections 里给凭据（本机 spec 文件，cpt 只存连接名）；先真连一次，
// 连不上即契约收口——拒绝带着坏连接产出"看起来正常"的空报表。
// I0-02 逃逸路 2（审计）：datasource.js 原裸 System.exit(4) 绕过结果契约；现上抛由 runner 统一收（退出码 4 语义不变）。
try {
  if (SPEC.connections && SPEC.connections.length) {
    var failsBeforeDs = FAILS;
    Runtime.DataSource.register(SPEC.connections, { stamp: stamp, check: check });
    RR.set('datasource_connect', FAILS > failsBeforeDs ? 'failed' : 'passed');
    if (FAILS > failsBeforeDs) { RR.diag('DB CONNECTION REGISTER FAILED'); finishRun(4); }
  } else {
    RR.skip('datasource_connect');   // 无 connections 的 spec：显式 skipped（三值裁决，不是漏记）
  }
} catch (eDb2) {
  stamp(String(eDb2));
  RR.diag('DB CONNECTION FAIL: ' + eDb2);
  RR.fail('datasource_connect');
  finishRun(4);
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
    // I0-02 逃逸路 3（审计）：原裸 exit(5) 无 JSON；现经 runtime_initialize 段裁决（本段属环境准备类，
    //   退出码 5=行数保护钩子异常语义不变；stages 定位 + diagnostics 带根因）
    stamp('ROW CONTROL FAIL: ' + eR);
    RR.diag('ROW CONTROL FAIL: ' + eR);
    RR.fail('runtime_initialize');
    finishRun(5);
  }
}

// ---------- 2. IR 编译 + 对象图构建 ----------
built = null;
try {
  var IR = Ir.compile(SPEC);
  var irErrs = Ir.validate(IR);
  check('IR VALIDATE (blocks/datasets 结构)', irErrs.length === 0);
  if (irErrs.length) {
    // I0-01：错误结构契约 {code,path,message(JSON 路径)}；序列化行 = IR ISSUE: <CODE> @ <path>: <message>
    irErrs.forEach(function (e) {
      var t = irErrText(e);
      stamp('IR ISSUE: ' + t); RR.diag('IR ISSUE: ' + t);
    });
    // 审计批 A（README #48）：IR 校验失败即停——保留全部诊断，不产出不合格中间产物。EXIT 9 = IR VALIDATE FAILED
    RR.fail('ir_validate');
    stamp('IR VALIDATE FAILED: refusing to build');
    finishRun(9);   // 迭代 4：经结果契约落 JSON（退出码 9 语义不变）
  }
  RR.pass('ir_validate');
  built = Obj.build(IR);
  RR.pass('object_build');
  stamp('ASSEMBLED: styles=' + built.styleCount + ' totalCol=' + built.totalCol + ' rows=' + built.sheets[0].rows);
} catch (e) {
  stamp('ASSEMBLE FAIL: ' + e);
  RR.diag('ASSEMBLE FAIL: ' + e);
  RR.set(RR.get('ir_validate') === 'passed' ? 'object_build' : 'ir_validate', 'failed');   // compile 炸=IR 段，build 炸=构建段
  var sw = new (J('java.io.StringWriter'))(); var pw = new (J('java.io.PrintWriter'))(sw);
  e.printStackTrace(pw); stamp(String(sw.toString()).split('\n').slice(0, 15).join(' || '));
  finishRun(3);
}
var wb = built.wb;
var Files = J('java.nio.file.Files');

// ---------- 3. 导出产物 cpt（FR 自序列化）+ v2 校验器过回归门 ----------
var localCpt = Paths.root + '/demo_api.cpt';   // ABR-1 路径单点（外部审计批 A：原硬编码绝对路径）
var failsBeforeStage3 = FAILS;                  // 迭代 4：cpt 校验段（含 PARAM/LINK/CHART 断言）以 FAILS 增量判 passed/failed
try {
  var osC = new (J('java.io.FileOutputStream'))(localCpt);
  wb.export(osC); osC.close();
  RR.pass('cpt_export');
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
  FAILS++; stamp('CPT EXPORT/VALIDATE FAIL: ' + e); RR.diag('CPT EXPORT/VALIDATE FAIL: ' + e);
  var sw2 = new (J('java.io.StringWriter'))(); var pw2 = new (J('java.io.PrintWriter'))(sw2);
  e.printStackTrace(pw2); stamp(String(sw2.toString()).split('\n').slice(0, 15).join(' || '));
}
RR.set('cpt_validate', FAILS > failsBeforeStage3 ? 'failed' : 'passed');   // 迭代 4：失败自动把下游 execute/render/deploy 置 skipped
gateAt('cpt-export-validate');   // 迭代 1 门禁：导出/校验任何 FAIL 不放行后续执行与部署

// ---------- 4. 执行 + 导出 ----------
// 2026-10-28 生产构建通道：BR_DEPLOYDIR 可指向 staging（默认演示服务器部署位不动），BR_TPFX/BR_MODULESET 配套
var outDir = J('java.lang.System').getenv('BR_DEPLOYDIR') || Paths.demoDeployDir();   // ABR-1：默认演示部署位 = FR_HOME 单点
try { Files.createDirectories(J('java.nio.file.Paths').get(outDir)); } catch (eDir) {
  // I0-02：目录都开不出来 = 部署必败，早收口（不白带后段；deploy 段 failed 定位）
  stamp('OUTDIR FAIL: ' + eDir); RR.diag('OUTDIR FAIL: ' + eDir); RR.fail('deploy'); finishRun(1);
}
var rb = null;
var SKIP_EXEC = J('java.lang.System').getenv('BR_SKIP_EXEC');
if (SKIP_EXEC) {
  // 2026-10-28 生产构建通道（BR_SKIP_EXEC=1）：演示库没有 t_collector_* 前缀表，的正常执行验证只能在生产服务器做。
  // 只烘 SQL + 导出 cpt；PNG/PDF 免产物
  stamp('PROD BUILD: SKIP EXEC');
  RR.skip('execute'); RR.skip('render');   // 迭代 4：验证等级=构建+校验+部署，执行/出图显式 skipped
} else {
  try {
    // 参数面板家族（v3.2）：全部控件默认值作为执行参数（模拟设计器里点"查询"时面板送出的默认值）
    var pmap = new (J('java.util.HashMap'))();
    paramDefaults(typeof IR !== 'undefined' ? IR : null).forEach(function (kv) { pmap.put(kv[0], kv[1]); });
    rb = wb.execute(pmap, new (J('com.fr.stable.PageActor'))());
    stamp('EXECUTED: ' + rb);
  } catch (e) {
    stamp('EXECUTE FAIL: ' + e);
    RR.diag('EXECUTE FAIL: ' + e);   // 迭代4修补：execute 根因（如 InterpreterError no function）进 RESULT.diagnostics，Agent 不必翻 run.out
    var sw3 = new (J('java.io.StringWriter'))(); var pw3 = new (J('java.io.PrintWriter'))(sw3);
    e.printStackTrace(pw3); stamp(String(sw3.toString()).split('\n').slice(0, 20).join(' || '));
    FAILS++;
  }
  RR.set('execute', rb ? 'passed' : 'failed');
  gateAt('execute');   // 迭代 1 门禁：执行失败不渲染、不部署
}
// ---------- 4.4 渲染（I0-02：render 前置于 deploy——审计缺口"渲染失败照样已部署"堵洞） ----------
var failsBeforeRender = FAILS;   // 迭代 4：render 段（PNG/PDF）以 FAILS 增量判 passed/failed
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
  } catch (eLoc) { stamp('VAN LOCALE FAIL: ' + eLoc); RR.diag('VAN LOCALE FAIL: ' + eLoc); FAILS++; }
  try { var osP = new (J('java.io.FileOutputStream'))(outDir + '/' + name + '.png'); new (J('com.fr.io.exporter.ImageExporter'))().export(osP, rb); osP.close(); stamp('PNG DONE'); } catch (e) { stamp('PNG FAIL: ' + e); RR.diag('PNG FAIL: ' + e); FAILS++; }
  try { var osD = new (J('java.io.FileOutputStream'))(outDir + '/' + name + '.pdf'); new (J('com.fr.io.exporter.PDFExporter'))().export(osD, rb); osD.close(); stamp('PDF DONE'); } catch (e) { stamp('PDF FAIL: ' + e); RR.diag('PDF FAIL: ' + e); FAILS++; }
  try { if (loc0 != null) J('com.fr.general.GeneralContext').setLocale(loc0); } catch (eL) { }
}
if (rb) RR.set('render', FAILS > failsBeforeRender ? 'failed' : 'passed');   // 迭代 4：出图段裁决
// ---------- 4.9 部署（I0-02：置于 execute/render 裁决之后——上游全绿才把 cpt 写进部署目录） ----------
gateAt('deploy');
var deployed = false;
try { var osT = new (J('java.io.FileOutputStream'))(outDir + '/' + SPEC.outName + '_api.cpt'); wb.export(osT); osT.close(); deployed = true; stamp('CPT DEPLOYED'); } catch (e) { stamp('CPT DEPLOY FAIL: ' + e); RR.diag('CPT DEPLOY FAIL: ' + e); FAILS++; }
RR.set('deploy', deployed ? 'passed' : 'failed');
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
    // I0-02 审计缺口 5：原完全静默。dump 属可选诊断通道（默认关），不计 FAILS 扰动产物裁决，但必须进契约留痕
    RR.diag('RESULT DUMP FAIL: ' + eDump);
  }
}

// ---------- 5. ROUNDTRIP：FR 自序列化再读回断言（防静默降级） ----------
// I0-02 审计缺口 4：roundtrip 独立成段——原实现可能 10 段全 passed 却 success:false/exit:1，段层无法定位
var failsBeforeRT = FAILS;
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
} catch (e) { FAILS++; stamp('ROUNDTRIP FAIL: ' + e); RR.diag('ROUNDTRIP FAIL: ' + e); }
RR.set('roundtrip', FAILS > failsBeforeRT ? 'failed' : 'passed');

// ---------- 5.9 凭据自动门（I0-04；AGENTS §4"交付前 grep 凭据 0 命中"从人工纪律升级为管线硬门） ----------
// 扫描面 = 本轮写入部署目录的产物（主 cpt + 渲染件 + diag 件）；token 源 = SPEC.connections 的 user/password
//   实值（凭据本只在本机 spec，此门防的是"SQL/标题文本把它们抄进产物"事故）+ 通用词 password。
//   命中 → 撤回件 + deploy 段 failed + FAILS++（退出码非 0；泄漏面绝不留部署目录）。短 token（<4 字符，如 'sa'）
//   跳过防误伤——真库凭据用户均 ≥4，通用 'password' 兜底；日志只报第几个 token，不落密钥明文。
(function () {
  var mainCpt = outDir + '/' + SPEC.outName + '_api.cpt';
  var targets = [mainCpt, outDir + '/' + SPEC.outName + '_api.png', outDir + '/' + SPEC.outName + '_api.pdf', outDir + '/diag_api.cpt'];
  var toks = ['password'];
  (SPEC.connections || []).forEach(function (cc) {
    if (cc.user && String(cc.user).length >= 4) toks.push(String(cc.user));
    if (cc.password && String(cc.password).length >= 4) toks.push(String(cc.password));
  });
  var hits = 0;
  targets.forEach(function (fp) {
    var pth = J('java.nio.file.Paths').get(fp);
    if (!J('java.nio.file.Files').exists(pth)) return;
    var low;
    try { low = String(new (J('java.lang.String'))(Files.readAllBytes(pth), 'UTF-8')).toLowerCase(); }
    catch (eRd) { return; }   // 二进制读失败不判（主面是文本级 cpt/png 元数据）
    var hitTok = -1;
    for (var ti = 0; ti < toks.length; ti++) {
      if (low.indexOf(String(toks[ti]).toLowerCase()) >= 0) { hitTok = ti; break; }
    }
    if (hitTok >= 0) {
      hits++;
      stamp('SECRET GATE DENY: token#' + (hitTok + 1) + ' found in ' + fp);
      RR.diag('SECRET GATE DENY: credential token found in ' + fp + ' -> artifact retracted');
      try { J('java.nio.file.Files').deleteIfExists(pth); } catch (eDel2) { RR.diag('SECRET GATE RETRACT FAIL: ' + eDel2); }
    }
  });
  if (hits) { RR.set('deploy', 'failed'); FAILS++; }
  else stamp('SECRET GATE: deployed artifacts clean (' + toks.length + ' tokens)');
})();

// ---------- 6. 数值自检（默认路径；rawIR 自带勾稽账，不适用） ----------
var expectSum = 0, lastNum = built.totalCol;
if (SPEC.data) { for (var di = 0; di < SPEC.data.length; di++) expectSum += (lastNum >= 0 ? SPEC.data[di][lastNum] : 0); stamp('EXPECTED TOTAL = ' + expectSum); }

stamp('PIPELINE END, failures=' + FAILS);
finishRun(FAILS > 0 ? 1 : 0);   // 迭代 4：收尾经结果契约落 RESULT_JSON（stages 定位 + 诊断；exit code 仍权威）
