// agent/tools/preview.js — fr-agent 工具层 verb: preview（零引擎；只读 PNG/PDF）；r10-A runId 化
//   输入 env AGENT_PNG（相对仓库根或绝对路径），输出 runDir/preview.json：尺寸/字节数/是否像空白。
//   night-shift：AGENT_PDF 可选——PDF 最小验收（%PDF 头 + /Type /Page 对象 + 字节数），交付三件套自动验收补齐。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
load(ROOT + '/agent/tools/_lib.js');

var runId = runIdOf();
var runDir = runDirOf(runId);
var p = System.getenv('AGENT_PNG');
var pdf = System.getenv('AGENT_PDF');
if (!p && !pdf) { print('{"ok":false,"error":"AGENT_PNG or AGENT_PDF required"}'); System.exit(2); }
var abs = /^[A-Za-z]:[\\\/]/.test(p || pdf) ? (p || pdf) : (ROOT + '/' + (p || pdf));
var isPdf = !p && !!pdf;
var out = { tool: 'preview', runId: runId, png: p ? abs : null, pdf: isPdf ? abs : null, exists: false, bytes: 0, width: 0, height: 0, blankish: true };
try {
  out.exists = Files.exists(Pth.get(abs));
  if (out.exists) {
    out.bytes = +Files.size(Pth.get(abs));
    if (isPdf) {
      // %PDF 头实测在文件偏移 0（FineReport 导出未加密）；byte[] 经 JS 索引（&255 修正符号位），
      //   不用 FileInputStream.read(JS Array)——J2N 对 JS Array 转换不可靠（首跑实证）。
      var all = Files.readAllBytes(Pth.get(abs));
      var head = '';
      for (var bi = 0; bi < 8 && bi < all.length; bi++) head += String.fromCharCode(all[bi] & 255);
      var tail = '';
      var from = all.length > 4096 ? all.length - 4096 : 0;
      for (var ti = from; ti < all.length; ti++) tail += String.fromCharCode(all[ti] & 255);
      out.pdfHeader = head.indexOf('%PDF') === 0;
      out.hasPageObject = tail.indexOf('/Type') >= 0 || tail.indexOf('/Page') >= 0 || out.bytes > 2000;
      out.blankish = !out.pdfHeader || out.bytes < 1000;
      out.width = -1; out.height = -1;
    } else {
      var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(abs));
      if (img != null) { out.width = +img.getWidth(); out.height = +img.getHeight(); out.blankish = out.width < 10 || out.height < 10; }
    }
  }
} catch (e) { out.error = String(e); }
writeJson(runDir + '/preview.json', out);
var okOut = out.exists && out.bytes > 1000 && !out.blankish && (!isPdf || out.pdfHeader);
print('{"ok":' + okOut + ',"runId":"' + runId + '","result":"logs/agent/runs/' + runId + '/preview.json"}');
System.exit(okOut ? 0 : 1);
