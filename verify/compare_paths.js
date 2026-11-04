// verify/compare_paths.js — r8 A2：新旧创作路径对照工具（零引擎，读两份产物做对拍）
//   输入 env：
//     AGENT_GRID_A / AGENT_GRID_B   RESULT_DUMP 栅格
//     AGENT_PNG_A  / AGENT_PNG_B    PNG 绝对路径
//     AGENT_RES_A  / AGENT_RES_B    RunResult JSON
//   输出 logs/agent/a2_compare.json：{grid:{equal,diffs}, totals:{a,b}, png:{equal,shaA,shaB,bytes}, run:{okA,okB,stagesA,stagesB}}
//   数值按十进制字符串规范化比较（不丢精度），文本严格比较。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), Pth = J('java.nio.file.Paths');
var System = J('java.lang.System');
var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
function readUtf(abs) { return String(new (J('java.lang.String'))(Files.readAllBytes(Pth.get(abs)), 'UTF-8')).replace(/^\uFEFF/, ''); }
function exists(abs) { return Files.exists(Pth.get(abs)); }
function sha256(abs) {
  var md = J('java.security.MessageDigest').getInstance('SHA-256');
  var dig = md.digest(Files.readAllBytes(Pth.get(abs)));
  var hex = '';
  for (var i = 0; i < dig.length; i++) { var h = (dig[i] & 255).toString(16); if (h.length < 2) h = '0' + h; hex += h; }
  return hex;
}
function canon(s) {
  s = String(s == null ? '' : s).trim();
  var m = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return s;
  var ip = m[2].replace(/^0+/, '') || '0';
  var fp = (m[3] || '').replace(/0+$/, '');
  if (ip === '0' && fp === '') return '0';
  return (m[1] === '-' ? '-' : '') + ip + (fp ? '.' + fp : '');
}
function parseGrid(abs) {
  if (!exists(abs)) return null;
  return readUtf(abs).split('\n').filter(function (l) {
    return l.indexOf('|') >= 0 && l.indexOf('RB_CLASS=') !== 0 && l.indexOf('## REPORT') !== 0;
  }).map(function (l) { return l.split('|'); });
}
var A = System.getenv('AGENT_GRID_A'), B = System.getenv('AGENT_GRID_B');
var ga = parseGrid(A || ''), gb = parseGrid(B || '');
var out = { tool: 'compare_paths', gridA: A, gridB: B, grid: { equal: false, rowsA: ga ? ga.length : 0, rowsB: gb ? gb.length : 0, diffs: [] },
  totals: { a: null, b: null },
  png: { equal: false, shaA: null, shaB: null, bytesA: 0, bytesB: 0 },
  run: { okA: null, okB: null, stagesA: null, stagesB: null } };
if (ga && gb) {
  var equal = ga.length === gb.length;
  var diffs = [];
  for (var r = 0; r < Math.min(ga.length, gb.length); r++) {
    var len = Math.max(ga[r].length, gb[r].length);
    for (var c = 0; c < len; c++) {
      if (canon(ga[r][c]) !== canon(gb[r][c])) {
        equal = false;
        if (diffs.length < 10) diffs.push({ r: r, c: c, a: ga[r][c], b: gb[r][c] });
      }
    }
  }
  out.grid.equal = equal; out.grid.diffs = diffs;

  // 数据区对照（A2 真正要证明的）：按日期键对齐明细行 + 合计行数值；标题/脚注/表头差异单独记
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s).trim()); }
  function isTotal(row) { return row && /合计|总计/.test(String(row[0])); }
  function detailMap(g) { var m = {}; g.forEach(function (row) { var k = canon(row[0]); if (isDate(k)) m[k] = row; }); return m; }
  function totalsOf(g) { for (var i = g.length - 1; i >= 0; i--) if (isTotal(g[i])) return g[i]; return null; }
  var da = detailMap(ga), db = detailMap(gb);
  var ka = Object.keys(da).sort(), kb = Object.keys(db).sort();
  var dataDiffs = [], dataEqual = ka.join(',') === kb.join(',');
  ka.forEach(function (k) {
    if (!db[k]) return;
    var ra = da[k], rb = db[k], n = Math.max(ra.length, rb.length);
    for (var c = 1; c < n; c++) {   // c0 是日期键，已对齐
      if (canon(ra[c]) !== canon(rb[c])) {
        dataEqual = false;
        if (dataDiffs.length < 10) dataDiffs.push({ key: k, c: c, a: ra[c], b: rb[c] });
      }
    }
  });
  var ta = totalsOf(ga), tb = totalsOf(gb);
  var na = [], nb = [];
  (ta || []).forEach(function (x) { var n = Number(canon(x)); if (isFinite(n) && canon(x) !== '') na.push(n); });
  (tb || []).forEach(function (x) { var n = Number(canon(x)); if (isFinite(n) && canon(x) !== '') nb.push(n); });
  var totalEqual = na.length === nb.length && na.every(function (v, i) { return v === nb[i]; });
  out.data = {
    equal: dataEqual && totalEqual, detailEqual: dataEqual,
    daysA: ka.length, daysB: kb.length, diffs: dataDiffs,
    totalA: na, totalB: nb, totalEqual: totalEqual,
    structureNote: '标题/表头/脚注/行数差异按结构差异记录，不参与数据等价判定'
  };
  out.totals.a = na; out.totals.b = nb;
}
var pa = System.getenv('AGENT_PNG_A'), pb = System.getenv('AGENT_PNG_B');
if (pa && pb && exists(pa) && exists(pb)) {
  out.png.shaA = sha256(pa); out.png.shaB = sha256(pb);
  out.png.bytesA = +Files.size(Pth.get(pa)); out.png.bytesB = +Files.size(Pth.get(pb));
  out.png.equal = out.png.shaA === out.png.shaB;
}
function rr(abs) { try { return JSON.parse(readUtf(abs)); } catch (e) { return null; } }
var ra = rr(System.getenv('AGENT_RES_A') || ''), rb = rr(System.getenv('AGENT_RES_B') || '');
out.run.okA = ra ? ra.success === true : null; out.run.okB = rb ? rb.success === true : null;
out.run.stagesA = ra ? ra.stages : null; out.run.stagesB = rb ? rb.stages : null;
var dir = ROOT + '/logs/agent';
Files.createDirectories(Pth.get(dir));
Files.write(Pth.get(dir + '/a2_compare.json'), J('java.lang.String').valueOf(JSON.stringify(out, null, 1)).getBytes('UTF-8'));
var ok = !!(out.run.okA && out.run.okB && out.data && out.data.equal);
print('{"ok":' + ok + ',"result":"logs/agent/a2_compare.json","dataEqual":' + (out.data ? out.data.equal : false) + ',"pngEqual":' + out.png.equal + '}');
System.exit(ok ? 0 : 1);
