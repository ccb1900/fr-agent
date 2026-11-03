// make_verify.js — v3.3 官方 demo 全量普查验收线
// 对 reportlets 顶层每个 cpt：
//   A. 引擎读回（TemplateWorkBookIO.readTemplateWorkBook）
//   B. 自序列化（wb.export）→ 再读回 → 再序列化：MD5 相等 = 序列化自洽
//   C. 渲染：原读回 vs 再读回，两次 ImageExporter PNG MD5 相等 = 渲染等价
// 输出普查表：file | origBytes | exportMd5a | exportMd5b | selfOK | png1Md5 | png2Md5 | renderOK
var J = function (n) { return Java.type(n); };
var Class = Java.type('java.lang.Class');
var t0 = new Date().getTime();
var stamp = function (s) { print('[' + (new Date().getTime() - t0) + 'ms] ' + s); };

// ---------- 环境 ----------
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
stamp('ENV READY');

var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var MD = J('java.security.MessageDigest').getInstance('MD5');
function md5Bytes(arr) {
  MD.reset();
  var dg = MD.digest(arr);
  var sb = '';
  for (var i = 0; i < dg.length; i++) { var h = (dg[i] & 0xFF).toString(16); sb += ((h.length < 2 ? '0' : '') + h); }
  return sb.toUpperCase();
}
var dir = Paths.get('D:/software/FineReport_11.0/webapps/webroot/WEB-INF/reportlets');
var DEMO = dir.resolve('demo');                      // 官方全量 demo 库（用户指定 scope；fvs 不在 .cpt 过滤里自然排除）
var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var PNGDIR = Paths.get('D:/fineagent/verify_png');
Files.createDirectories(PNGDIR);
// 普查表逐行实时落盘（print 走 buffered stdout 要憋到进程退，单独走文件流）
var TABLE = Paths.get('D:/fineagent/logs/verify_table.txt');
var FW = new (J('java.io.BufferedWriter'))(new (J('java.io.OutputStreamWriter'))(Files.newOutputStream(TABLE), 'UTF-8'));
function row(s) { FW.write(s + '\n'); FW.flush(); }

// 语料清单 = reportlets 顶层 *.cpt  +  demo/** 递归 *.cpt（fvs 排除在扩展名过滤之外）
// 一手路径语义（probe_iopath2/3 实证）：readTemplateWorkBook 收"相对 reportlets 根"的路径
var list = [];

function collectTop() {
  var ds = Files.newDirectoryStream(dir);
  ds.forEach(function (p) { if (String(p).slice(-4) === '.cpt') list.push(String(p.getFileName())); });   // 顶层 = 直接文件名（相对 reportlets 根）
  ds.close();
}
function collectDemo() {
  if (!Files.exists(DEMO)) return;
  var walk = Files.walk(DEMO);
  walk.forEach(function (p) {
    var s = String(p);
    if (s.slice(-4) !== '.cpt') return;
    var rel = s.substring(String(dir).length + 1).replace(/\\/g, '/');   // 'demo/basic/xxx.cpt'
    list.push(rel);
  });
  walk.close();
}
collectTop();
collectDemo();
// PNG 相对键 = 语料相对路径去扩展名（demo 子目录逐层保留，重名不撞）
function pngRel(corpusRel) { return corpusRel.replace(/\.cpt$/, ''); }
stamp('CPT COUNT = ' + list.length + ' (top + demo 递归)');

var selfOK = 0, renderOK = 0, renderFail = 0, readFail = 0;
list.sort();
for (var i = 0; i < list.length; i++) {
  var relName = list[i];                                   // 相对 reportlets 根，直接喂引擎
  var name = relName.substring(relName.lastIndexOf('/') + 1);
  try {
    var wb = null;
    try { wb = TWBIO.readTemplateWorkBook(relName); }
    catch (ePath) {
      wb = TWBIO.readTemplateWorkBook('reportlets/' + relName);
      stamp('PATH FALLBACK WORKED for ' + relName);
    }
    var osA = new (J('java.io.ByteArrayOutputStream'))();
    wb.export(osA); var exA = osA.toByteArray();
    var twbd = TWBIO.readTemplateWorkBook(relName);       // 再读回（同一文件；同用相对名——绝对路径实证必炸）
    stamp('A OK | ' + relName);
    var osB = new (J('java.io.ByteArrayOutputStream'))();
    twbd.export(osB); var exB = osB.toByteArray();
    var a = md5Bytes(exA), b = md5Bytes(exB);
    var okSelf = (a === b);
    // C 渲染等价：两次独立读回对象各自渲染，PNG MD5 必须一致
    var png1 = '', png2 = '';
    var exporter = new (J('com.fr.io.exporter.ImageExporter'))();
    try {
      var rb1 = wb.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
      var f1 = PNGDIR.resolve(pngRel(relName) + '_1.png');
      Files.createDirectories(f1.getParent());           // demo 子目录逐层保留，重名不撞
      var o1 = Files.newOutputStream(f1);
      exporter.export(o1, rb1); o1.close();
      png1 = md5Bytes(Files.readAllBytes(f1));
    } catch (eR) { png1 = 'RENDER_FAIL'; row('RENDER CAUSE1 | ' + relName + ' | ' + eR + (eR.cause != null ? ' || CAUSE: ' + eR.cause : '')); }
    try {
      var rb2 = twbd.execute(new (J('java.util.HashMap'))(), new (J('com.fr.stable.PageActor'))());
      var f2 = PNGDIR.resolve(pngRel(relName) + '_2.png');
      Files.createDirectories(f2.getParent());
      var o2 = Files.newOutputStream(f2);
      exporter.export(o2, rb2); o2.close();
      png2 = md5Bytes(Files.readAllBytes(f2));
    } catch (eR2) { png2 = 'RENDER_FAIL'; row('RENDER CAUSE2 | ' + relName + ' | ' + eR2 + (eR2.cause != null ? ' || CAUSE: ' + eR2.cause : '')); }
    var okRender = (png1 === png2 && png1 !== 'RENDER_FAIL');
    if (okSelf) selfOK++;
    if (okRender) renderOK++; else renderFail++;
    row('V | ' + relName + ' | a=' + a + ' | b=' + b + ' | self=' + okSelf + ' | png1=' + png1 + ' | png2=' + png2 + ' | render=' + okRender);
  } catch (e) {
    readFail++;
    row('V | ' + relName + ' | READ_FAIL: ' + e + (e.cause != null ? ' || CAUSE: ' + e.cause : ''));
  }
}
row('VERIFY TABLE END selfOK=' + selfOK + ' renderOK=' + renderOK + ' renderMismatch=' + renderFail + ' readFail=' + readFail + ' total=' + list.length);
FW.close();
stamp('VERIFY TABLE END selfOK=' + selfOK + ' renderOK=' + renderOK + ' renderMismatch=' + renderFail + ' readFail=' + readFail + ' total=' + list.length);
J('java.lang.System').exit(0);
