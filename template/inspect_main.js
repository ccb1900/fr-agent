// template/inspect_main.js — 阶段2 B段：inspect_template 引擎 runner（runraw.ps1 跑；只读，零写入部署面）
//   目标：给外置 Agent 打通 modify 的"模板体检"——读部署 cpt（TEMPLATE_TARGET=fineagent/<name>.cpt），
//   输出 sheet 尺寸 + 逐格文本（补丁定位需要真实格坐标）+ XML 侧数据集名/参数名清单。
//   只读三闸：目标路径白名单（必须 fineagent/ 前缀、禁 ..、必须 .cpt）；不 export 不写回；命名样式不敏感
//   （inspect 不走 readTemplateWorkBook→export 回路，无 README:103 默认化风险）。
//   产出 = runDir/inspect.json（AGENT_RUN_ID 由 fr_agent.ps1 注入）；退出码 0/1。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
load('D:/fineagent/runtime/paths.js');
var R = Paths.root;
load(R + '/template/inspector.js'); load(R + '/template/reader.js');
load(Paths.runtime('bootstrap.js')); Runtime.initialize();    // 激活链：readCpt 相对名可用

function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }
function genv(k, d) { var v = System.getenv(k); return (v == null || String(v) === '') ? d : String(v); }

var runId = String(System.getenv('AGENT_RUN_ID') || 'inspect_' + new Date().getTime());
var runDir = R + '/logs/agent/runs/' + runId;
var FAIL = 0;
var out = { tool: 'inspect_template', runId: runId, ok: false };
try {
  var target = genv('TEMPLATE_TARGET', '');
  // 只读路径闸（与 TemplatePatch sourceCpt 同口径：fineagent/ 下相对名；部署名含中文，白名单按
  //   "无路径分隔/无穿越段" 判，不按 ASCII 集合判）
  if (!/^fineagent\/[^\\\/]+\.cpt$/.test(target) || target.indexOf('..') >= 0) throw new Error('TEMPLATE_TARGET must match fineagent/<name>.cpt (no traversal): ' + target);
  out.target = target;
  var srcAbs = Paths.frWebInf() + '/reportlets/' + target;
  if (!Files.exists(Pth.get(srcAbs))) throw new Error('target not found: ' + target + ' (run -Verb list_reports for available names)');
  out.bytes = +Files.size(Pth.get(srcAbs));

  var srcXml = readUtf(srcAbs);
  // XML 侧清单：数据集名/参数名（引擎无公开枚举 API，XML 一手）
  var dsNames = [], re1 = /<TableData[^>]*name="([^"]+)"/g, m1;
  while ((m1 = re1.exec(srcXml)) != null) if (dsNames.indexOf(m1[1]) < 0) dsNames.push(m1[1]);
  var paramNames = [], re2 = /<Parameter[^>]*name="([^"]+)"/g, m2;
  while ((m2 = re2.exec(srcXml)) != null) if (paramNames.indexOf(m2[1]) < 0) paramNames.push(m2[1]);
  out.datasetNames = dsNames;
  out.parameterNames = paramNames;

  var wb = TemplateReader.readCpt(target);
  var d = TemplateInspector.describe(wb);
  if (d.ok === false) throw new Error('describe failed: ' + JSON.stringify(d.error));
  var CELL_CAP = 4000, dumped = 0, truncated = false;
  out.sheetCount = d.sheetCount;
  out.sheets = [];
  for (var i = 0; i < d.sheetCount; i++) {
    var sd = d.sheets[i];
    var sheet = { index: i, rows: sd.rows, cols: sd.cols, cells: [] };
    for (var r = 0; r < sd.rows; r++) {
      for (var c = 0; c < sd.cols; c++) {
        if (dumped >= CELL_CAP) { truncated = true; break; }
        var ct = TemplateInspector.cellMeta(wb, i, c, r);
        if (ct.ok === false) throw new Error('cellMeta failed: ' + JSON.stringify(ct.error));
        if (ct.text !== '' || ct.type === 'chart') {
          var item = { c: c, r: r, text: ct.text };
          if (ct.type) item.type = ct.type;
          if (ct.formula != null) item.formula = ct.formula;
          if (ct.dsColumn != null) item.dsColumn = ct.dsColumn;
          if (ct.chartClass) item.chartClass = ct.chartClass;
          if (ct.colSpan != null) item.colSpan = ct.colSpan;
          if (ct.rowSpan != null) item.rowSpan = ct.rowSpan;
          sheet.cells.push(item); dumped++;
        }
      }
      if (truncated) break;
    }
    out.sheets.push(sheet);
  }
  out.truncated = truncated;
  out.nextActions = ['craft a PatchSpec {patchVersion,sourceCpt,outName,ops[]} against these real cell coordinates (op whitelist: template/validator.js)', 'run -Verb modify with -Patch <spec file>, then -Verb promote -RunId <this run> to deploy (restore undoes)'];
  out.ok = true;
} catch (e) {
  out.ok = false;
  out.error = String(e);
  FAIL = 1;
}
Files.createDirectories(Pth.get(runDir));
Files.write(Pth.get(runDir + '/inspect.json'), J('java.lang.String').valueOf(JSON.stringify(out, null, 1)).getBytes('UTF-8'));
print('INSPECT ' + (out.ok ? 'OK' : 'FAIL') + ' target=' + (out.target || '(none)') + ' sheets=' + (out.sheetCount == null ? -1 : out.sheetCount) + ' fails=' + FAIL);
exit(FAIL);
