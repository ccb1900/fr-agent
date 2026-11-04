// agent/tools/preview.js — fr-agent 工具层 verb: preview（零引擎；只读 PNG）
//   输入 env AGENT_PNG（相对仓库根或绝对路径），输出 logs/agent/preview.json：尺寸/字节数/是否像空白。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var p = System.getenv('AGENT_PNG');
if (!p) { print('{"ok":false,"error":"AGENT_PNG required"}'); System.exit(2); }
var abs = /^[A-Za-z]:[\\\/]/.test(p) ? p : (ROOT + '/' + p);
var out = { tool: 'preview', png: abs, exists: false, bytes: 0, width: 0, height: 0, blankish: true };
try {
  out.exists = Files.exists(Pth.get(abs));
  if (out.exists) {
    out.bytes = +Files.size(Pth.get(abs));
    var img = J('javax.imageio.ImageIO').read(new (J('java.io.File'))(abs));
    if (img != null) { out.width = +img.getWidth(); out.height = +img.getHeight(); out.blankish = out.width < 10 || out.height < 10; }
  }
} catch (e) { out.error = String(e); }
var dir = ROOT + '/logs/agent';
Files.createDirectories(Pth.get(dir));
Files.write(Pth.get(dir + '/preview.json'), J('java.lang.String').valueOf(JSON.stringify(out, null, 1)).getBytes('UTF-8'));
print('{"ok":' + (out.exists && out.bytes > 1000 && !out.blankish) + ',"result":"logs/agent/preview.json"}');
System.exit(out.exists && out.bytes > 1000 && !out.blankish ? 0 : 1);
