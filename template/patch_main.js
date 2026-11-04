// template/patch_main.js — I6 端到端 patch runner（runraw.ps1 跑；不杀 java、不启 FineDB 写锁之外资源）
//   编排：读 PatchSpec(env TEMPLATE_PATCH=路径) → TemplateValidator 校 → 命名样式守卫(README:103 读回即损→默认 abort)
//   → 原始件 copy 保留 → readTemplateWorkBook → TemplatePatch.apply(白名单) → export 到 staging（绝不写 fineagent 基线目录）
//   → 再读回 + TemplateDiff 判"未改部分不变"（语义 token diff，不用导出字节 MD5）→ manifest。
//   R0 已证 cell.setValue / putTableData 跨 export 成立；本 runner 是其在受控 staging 上的产品化。
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
load('D:/fineagent/runtime/paths.js');
var R = Paths.root;
load(R + '/template/ops.js'); load(R + '/template/validator.js'); load(R + '/template/locator.js'); load(R + '/template/diff.js');
load(R + '/template/inspector.js'); load(R + '/template/reader.js'); load(R + '/template/patch.js'); load(R + '/template/regression.js');
load(Paths.runtime('bootstrap.js')); Runtime.initialize();    // 激活链：readTemplateWorkBook 相对名可用

function readUtf(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(p)), 'UTF-8')); }
function genv(k, d) { var v = System.getenv(k); return (v == null || String(v) === '') ? d : String(v); }

var patchPath = genv('TEMPLATE_PATCH', 'examples/template-patch/daily_rename.json');
var staging = genv('TEMPLATE_STAGING', R + '/logs/template_staging');
var force = genv('TEMPLATE_FORCE', '') === '1';
Files.createDirectories(Pth.get(staging));

var FAIL = 0;
function fail(m) { print('PATCH REJECT: ' + m); FAIL = 1; }
try {
  var patch = JSON.parse(readUtf(Paths.spec(patchPath)));
  var verrs = TemplateValidator.validate(patch);
  if (verrs.length) { verrs.forEach(function (e) { print('  SPEC ISSUE: ' + e.code + ' @ ' + e.path + ': ' + e.message); }); throw new Error('PatchSpec 校验失败'); }

  var srcAbs = Paths.frWebInf() + '/reportlets/' + patch.sourceCpt;   // reportlets 相对 → 绝对读盘（守卫 + copy）
  if (!Files.exists(Pth.get(srcAbs))) throw new Error('源件不存在: ' + patch.sourceCpt);
  var srcXml = readUtf(srcAbs);
  var ns = TemplateDiff.namedStyles(srcXml);
  if (ns > 0 && !force) throw new Error('源件含命名样式(' + ns + ' 处 style_name=)，readTemplateWorkBook 会默认化→未改部分受损(README:103)；拒绝，除非 TEMPLATE_FORCE=1');
  var baseName = String(patch.sourceCpt).replace(/^.*\//, '').replace(/\.cpt$/, '');
  Files.copy(Pth.get(srcAbs), Pth.get(staging + '/' + baseName + '.orig.cpt'), [J('java.nio.file.StandardCopyOption').REPLACE_EXISTING]);   // 原始件保留

  var wb = TemplateReader.readCpt(patch.sourceCpt);
  // 执行回归前置：SQL 数据集需连接（同 make_api 从 dbpass 本地注入，密码不入产物）
  try { load(Paths.runtime('datasource.js')); } catch (eD) { }
  try {
    var connNames = {};
    (function collect(w) { try { var n = w.getReportCount(); for (var s = 0; s < n; s++) { /* datasets at wb level */ } } catch (e) { } })();
    (patch.ops || []).forEach(function (op) { /* dataset replace may need conn; collect from source later */ });
    if (typeof Runtime !== 'undefined' && Runtime.DataSource) {
      // 从源件读出 sql 数据集连接名（getTableData 名列表不支持枚举→按 op/已知注入 ATOM_LIVE）
      var url = genv('SQL_URL', 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false');
      var usr = genv('SQL_USER', 'sa');
      Runtime.DataSource.register([{ name: 'ATOM_LIVE', driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver', url: url, user: usr, password: load(Paths.lib('dbpass.js')) }], { stamp: function () { }, check: function () { } });
    }
  } catch (eReg) { print('  conn register skip: ' + eReg); }
  // I6.1-C/r5：执行/渲染回归结构化，杜绝"两边都失败且错误串相同→假 PASS"；r5 改为按坐标屏蔽与像素 diff
  function execGrid(w) {
    try {
      var rb = w.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
      var rp = rb.getResultReport(0), rows = [];
      for (var r = 0; r < rp.getRowCount(); r++) {
        var row = [];
        for (var c = 0; c < rp.getColumnCount(); c++) {
          var cel = rp.getCellElement(c, r), txt = '';
          if (cel != null) {
            if (typeof cel.getText === 'function') txt = String(cel.getText());
            else if (typeof cel.getValue === 'function' && cel.getValue() != null) txt = String(cel.getValue());
            else if (typeof cel.toString === 'function') txt = String(cel.toString());
          }
          row.push(txt);
        }
        rows.push(row);
      }
      return { ok: true, rows: rows, error: null };
    } catch (e) { return { ok: false, rows: null, error: String(e) }; }
  }
  function renderPng(w, file) {
    try {
      var rbx = w.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
      var os = new (J('java.io.FileOutputStream'))(file);
      new (J('com.fr.io.exporter.ImageExporter'))().export(os, rbx); os.close();
      var sz = J('java.nio.file.Files').size(Pth.get(file));
      return { ok: sz > 1000, bytes: sz, error: sz > 1000 ? null : 'PNG 过小(疑似空白/未渲染)' };
    } catch (e) { return { ok: false, bytes: -1, error: String(e) }; }
  }
  // r5 P2：像素级 diff（尺寸 + 差异像素数/比例 + 差异包围盒）——不再是"生成即通过"
  function pixelStats(f1, f2) {
    try {
      var i1 = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(f1));
      var i2 = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(f2));
      if (i1 == null || i2 == null) return { ok: false, error: 'PNG 解码失败' };
      var w1 = +i1.getWidth(), h1 = +i1.getHeight(), w2 = +i2.getWidth(), h2 = +i2.getHeight();
      if (w1 !== w2 || h1 !== h2) return { width: w1, height: h1, widthAfter: w2, heightAfter: h2, diffPixels: -1, ratio: 1, bbox: null };
      var diff = 0, minX = w1, minY = h1, maxX = -1, maxY = -1;
      for (var y = 0; y < h1; y++) {
        for (var x = 0; x < w1; x++) {
          if (i1.getRGB(x, y) !== i2.getRGB(x, y)) {
            diff++;
            if (x < minX) minX = x; if (y < minY) minY = y;
            if (x > maxX) maxX = x; if (y > maxY) maxY = y;
          }
        }
      }
      return { width: w1, height: h1, widthAfter: w2, heightAfter: h2, diffPixels: diff, ratio: diff / (w1 * h1), bbox: maxX < 0 ? null : (minX + ',' + minY + ' - ' + maxX + ',' + maxY) };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  var datasetOps = (patch.ops || []).filter(function (o) { return o.op === 'replace_dataset'; });
  var hasDatasetOp = datasetOps.length > 0;
  var before = execGrid(TemplateReader.readCpt(patch.sourceCpt));   // 未改原件执行基线
  var descriptor = TemplateInspector.describe(wb);
  var expected = { added: [], removed: [], ops: patch.ops.slice() };   // I6.1-B：ops 决定允许的结构变化类别
  var changedCells = [], keyCells = [], dsChecks = [];
  patch.ops.forEach(function (op) {
    var res = TemplatePatch.apply(wb, op, descriptor);
    if (res.before.cell) {
      expected.removed.push(res.before.cell.oldText); expected.added.push(res.before.cell.newText);
      changedCells.push({ c: res.before.cell.c, r: res.before.cell.r, oldText: res.before.cell.oldText, newText: res.before.cell.newText });
      keyCells.push({ c: res.before.cell.c, r: res.before.cell.r, expect: res.before.cell.newText });   // r6-C：结果必须反映新值
    }
    if (res.before.dataset) {
      expected.added.push('/*replace_dataset ' + res.before.dataset.name + ' rows=' + res.before.dataset.rowCount + '*/');
      // r5 P1：数据集替换必须按 PatchSpec 逐列名/列型/行数/逐格核对（不再"能执行就 PASS"）
      var dr = TemplateRegression.dataset({ columns: op.columns, rows: op.rows }, TemplateInspector.datasetSnapshot(wb, op.name));
      dsChecks.push({ where: 'in-memory', pass: dr.pass, reason: dr.reason });
    }
  });
  var after = execGrid(wb);   // 打补丁后执行
  var pngBefore = renderPng(TemplateReader.readCpt(patch.sourceCpt), staging + '/_pre.png');
  var pngAfter = renderPng(wb, staging + '/_post.png');

  // 任一执行/渲染/数据集失败 = 回归失败；裁决逻辑在 template/regression.js 纯函数（离线可证）
  var ev = TemplateRegression.execution(before, after, { changedCells: changedCells, keyCells: keyCells, hasDatasetOp: hasDatasetOp });
  var stats = pixelStats(staging + '/_pre.png', staging + '/_post.png');
  var rv = TemplateRegression.render(pngBefore, pngAfter, stats, { maxRatio: 0.05, expectPixelChange: (patch.ops || []).length > 0 });
  print('  execution regression=' + (ev.pass ? 'PASS(' : 'FAIL(') + ev.reason + ') (rows=' + (before.rows ? before.rows.length : -1) + ')');
  print('  render regression=' + (rv.pass ? 'PASS(' : 'FAIL(') + rv.reason + ')');
  if (!ev.pass || !rv.pass) FAIL = 1;
  dsChecks.forEach(function (d) {
    print('  dataset regression(' + d.where + ')=' + (d.pass ? 'PASS(' : 'FAIL(') + d.reason + ')');
    if (!d.pass) FAIL = 1;
  });

  var outAbs = staging + '/' + (patch.outName || (baseName + '.patched.cpt'));
  if (!/\.cpt$/.test(outAbs)) outAbs += '.cpt';
  TemplateReader.exportCpt(wb, outAbs);   // 写回只进 staging，绝不 fineagent 基线目录

  // r5 P1：导出后**再读回**（写回文件 ≠ 内存对象），数据集逐格复核；临时件读完即删，不碰基线
  if (datasetOps.length) {
    var tmpRel = 'fineagent/_r5_verify_' + new Date().getTime() + '.cpt';
    var tmpAbs = Paths.frWebInf() + '/reportlets/' + tmpRel;
    try {
      Files.copy(Pth.get(outAbs), Pth.get(tmpAbs), [J('java.nio.file.StandardCopyOption').REPLACE_EXISTING]);
      var wbOut = TemplateReader.readCpt(tmpRel);
      datasetOps.forEach(function (op) {
        var dr2 = TemplateRegression.dataset({ columns: op.columns, rows: op.rows }, TemplateInspector.datasetSnapshot(wbOut, op.name));
        print('  dataset regression(exported re-read)=' + (dr2.pass ? 'PASS(' : 'FAIL(') + dr2.reason + ')');
        if (!dr2.pass) FAIL = 1;
      });
    } catch (eDs) {
      print('  dataset export re-read FAIL: ' + eDs); FAIL = 1;
    } finally {
      try { Files.deleteIfExists(Pth.get(tmpAbs)); } catch (eDel) { }
    }
  }

  var patchedXml = readUtf(outAbs);
  var d = TemplateDiff.diff(srcXml, patchedXml, expected);
  print('PATCH OK source=' + patch.sourceCpt + ' out=' + outAbs + ' ops=' + patch.ops.length + ' namedStyle=' + ns);
  print('  diff clean(未改部分不变)=' + d.clean + '  added=' + JSON.stringify(d.added) + ' removed=' + JSON.stringify(d.removed));
  if (!d.clean) { print('  UNINTENDED: ' + JSON.stringify(d.unintended)); FAIL = 1; }
  var manifest = { sourceCpt: patch.sourceCpt, out: outAbs, ops: patch.ops.length, namedStyles: ns, diffClean: d.clean, added: d.added, removed: d.removed, structDelta: d.structDelta, execution: ev, render: rv, pixelStats: stats, datasetChecks: dsChecks };
  Files.write(Pth.get(staging + '/manifest.json'), J('java.lang.String').valueOf(JSON.stringify(manifest, null, 1)).getBytes('UTF-8'));
} catch (e) {
  fail('' + e);
}
System.exit(FAIL);
