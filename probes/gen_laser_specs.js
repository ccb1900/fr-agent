// gen_laser_specs.js — 全库 laser 表 → 26 个浏览器 spec + 模块注册表（UTF-8 新建文件，零触碰既有文件）
// 数据纪律：列名/类型/格式/日期范围全部来自 data/db_laser_tables.json（probe_profile_all.js 直查产出）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files');
var Charsets = J('java.nio.charset.StandardCharsets');
function readTxt(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(J('java.nio.file.Paths').get(p, [])), 'UTF-8')); }
function writeUtf8(p, s) {
  var pf = J('java.nio.file.Paths').get(p).toAbsolutePath().getParent();
  Files.createDirectories(pf);
  var w = new (J('java.io.OutputStreamWriter'))(new (J('java.io.FileOutputStream'))(p), 'UTF-8');
  w.write(s); w.close();
}

var LABELS = {
  laser_aaa: '评分流水', laser_aaa_gosa: 'GOSA误差', laser_alm_log: '报警日志', laser_cnd_selct: '条件选择',
  laser_energy_measure: '能量测量', laser_files: '文件登记', laser_files_bak_20261020: '文件备份',
  laser_files_file_key_seq: '文件键序', laser_galv_mask_measure: '振镜掩膜', laser_glv_cnd_send: '条件下发',
  laser_length: '长度数据', laser_m307: '307机型', laser_m370: '370机型', laser_m377: '377机型',
  laser_mainte1: '维护记录', laser_mask_gosa: '掩膜GOSA', laser_pc_direct: 'PC直写',
  laser_proc_state: '工序状态', laser_pwr: '功率计', laser_pwrmulti: '功率计多路', laser_sensor: '传感器',
  laser_sin_statis: '正弦统计', laser_sinsyuku: '伸缩计测', laser_table: '平台数据',
  laser_twin_scale_dsp: '双标尺', laser_zaxis: 'Z轴'
};

var data = JSON.parse(readTxt('D:/fineagent/data/db_laser_tables' + (java.lang.System.getenv('BR_PROFILE') === 'prod' ? '_prod' : '') + '.json'));
// 2026-10-28 双轨：BR_PROFILE=prod 读 data/db_laser_tables_prod.json（生产 t_collector 直查画像），spec 写入 reports_prod/
// （demo spec 是已验收基线，绝不共用文件）；表键统一归一 laser_*（t_collector_ 前缀只是库名实况，构建期由 BR_TPFX 拼）
var SPECDIR = 'D:/fineagent/reports' + (java.lang.System.getenv('BR_MODULESET') === 'prod' ? '_prod' : '');
var normKey = function (tb) { return tb.replace(/^t_collector_/, ''); };
// 日期列是否原生 date/datetime 型（laser_files.collection_date）→ 浏览器不用 CASE 表达式、直接裸列
function isNativeDate(t) {
  var dc = t.dateCol;
  if (!dc) return false;
  for (var k = 0; k < t.cols.length; k++) if (t.cols[k].name === dc) {
    var d = String(t.cols[k].dtype || '').toLowerCase();
    return d === 'date' || d === 'datetime' || d === 'datetime2';
  }
  return false;
}

// #4 列→现场表头映射（2026-10-28 用户口径）：laser_prod_mssql.toml [[formats]] columns 段，
// column=库列名 → name=现场中文表头。只取"表头显示名"，SQL 列名/类型仍以直查画像为准（事实源分离）。
var CNMAP = {};
(function () {
  var sec = '', fmtName = null, tblShort = null;
  TOML_LINES = readTxt('D:/fineagent/laser_prod_mssql.toml').split(/\r?\n/);
  for (var i = 0; i < TOML_LINES.length; i++) {
    var ln = TOML_LINES[i];
    if (/^\[\[/.test(ln)) { sec = ln.trim(); fmtName = null; tblShort = null; continue; }
    if (sec !== '[[formats]]') continue;
    var nf = /^name = "([^"]+)"/.exec(ln);
    if (nf && fmtName == null) { fmtName = nf[1]; continue; }
    var tf = /^table = "([^"]+)"/.exec(ln);
    if (tf) { tblShort = normKey(tf[1]); continue; }
    if (ln.indexOf('column = ') >= 0 && tblShort) {
      var cf = /name = "([^"]+)"[^{]*?column = "([^"]+)"/.exec(ln);
      if (cf && !CNMAP[tblShort]) CNMAP[tblShort] = {};
      if (cf) CNMAP[tblShort][cf[2]] = cf[1];
    }
  }
})();
// 抽验：aaa biz_date→日期、m377 r_xerr 映射、pwrmulti measured_energy_15、glv 短表头缺位列
print('CNMAP aaa=' + (CNMAP.laser_aaa && CNMAP.laser_aaa.biz_date) +
  ' r_xerr=' + (CNMAP.laser_m377 && CNMAP.laser_m377.r_xerr) +
  ' me15=' + (CNMAP.laser_pwrmulti && CNMAP.laser_pwrmulti.measured_energy_15) +
  ' good=' + (CNMAP.laser_zaxis && CNMAP.laser_zaxis.pro_sheet));
print('CNMAP tables=' + Object.keys(CNMAP).length);

// 列定型（对 probe 分类做惯例修正）：日期/时间列→纯文本；编号后缀→code 禁千分位；数值→fmt 按样本小数位
// 2026-10-28 生产实测教训（传感器/评分流水面板截图）：code/num 家族以前只按数据位数定宽，
//   表头 10+ 字符就被压成 5 字符宽拦腰断行（row_numb er）；且画像若来自 demo，生产列型/位数一变全失配
//   （file_key 17 位翻 3 行、prg 变路径长文字母竖排）。
// 统一公式（v2.1，2026-10-28 用户口径"不许点名补丁，公式要通用"）：len = max(数据宽×外推, 表头宽×粗体, 类别下限)，
//   只设类别上限防失控。四项通用修正：
//   a) 样本 ×1.2 外推——画像是历史切片，生产未来数据只会更长（负号/更长的路径/更大位数）；
//   b) effLen 全角感知——中文/全角字符占 2 半角位（name.length 直数等于腰斩，中文列名/中文值全窄一半）；
//   c) 表头 ×1.1——表头加粗（style=1）实际墨宽多 ~10%；
//   d) num 列 +1 负号位——maxInt 不含负值场景，负号没占位就折行。
function effLen(s) {
  var w = 0;
  for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2e7f ? 2 : 1;
  return w;
}
function colSpec(c, t, lbl) {
  var name = c.name;
  var shown = lbl || name;                       // #4 现场表头（toml 映射）优先；未在映射里的基建列用列名
  var hd = Math.ceil(effLen(shown) * 1.1); // 表头是一条文案，参与反算（不许断行）；粗体 +10% 并入
  // 数据宽：样本拆分（' | '）最长项（effLen 全角感知）×1.2 外推 +1；生产独有长文列的 minw 下限并轨
  var dw = 0;
  if (c.sample && c.sample.indexOf(' | ') >= 0) {
    var parts = c.sample.split(' | ');
    for (var i = 0; i < parts.length; i++) {
      var w = effLen(parts[i]);
      if (w > dw) dw = w;
    }
    dw = Math.ceil(dw * 1.2) + 1;
  }
  if (c.minw && c.minw > dw) dw = c.minw;
  if (name === t.dateCol) return { name: name, label: lbl, len: Math.max(14, hd) };
  if (name === t.timeCol) return { name: name, label: lbl, len: Math.max(10, hd) };
  if (c.kind === 'num' && name !== 'row_number' && /(no|seq|block|key|_code|_id|_prog)$/i.test(name)) {
    return { name: name, label: lbl, len: Math.max(6, Math.min(22, Math.max(c.maxInt, 4) + 2), hd, dw), type: 'code' };
  }
  if (c.kind === 'num') {
    var fmt = c.maxDec > 0 ? '#,##0.' : '#,##0';
    for (var i = 0; i < c.maxDec; i++) fmt += '0';
    var disp = c.maxInt + (c.maxInt > 3 ? Math.floor((c.maxInt - 1) / 3) : 0) + (c.maxDec > 0 ? 1 + c.maxDec : 0) + 1 + 2;
    return { name: name, label: lbl, len: Math.min(40, Math.max(5, disp, hd, dw)), fmt: fmt, type: 'num' };
  }
  if (c.kind === 'cent') return { name: name, label: lbl, len: Math.max(2, Math.min(34, dw || 0), hd), type: 'cent' };
  // code/文本：样本（已外推）/下限/表头取大 +1
  return { name: name, label: lbl, len: Math.min(44, Math.max(3, dw + 1, hd)) };
}

// #2 键序表移出导航（2026-10-28 用户口径）：laser_files_file_key_seq 纯技术文件键序流水，
//   无业务查阅价值（file_key 18 位原生 bigint 自带序），移出导航不删表。
var SEQ_TABLE = 'laser_files_file_key_seq';

var mods = [];
var made = 0;
for (var i = 0; i < data.length; i++) {
  var t = data[i];
  var key = normKey(t.table);
  if (key === SEQ_TABLE) { print('SKIP(seq excluded from nav) ' + t.table); continue; }
  var label = LABELS[key];
  if (!label) { print('SKIP(no label) ' + t.table); continue; }
  mods.push({ key: key, cpt: 'fineagent/激光数据浏览器_' + label + '_api.cpt', label: label });
  var colNames = t.cols.map(function (c) { return c.name; });
  var hasStage = colNames.indexOf('stage') >= 0;

  var spec =
'// br_laser_' + key.replace(/^laser_/, '') + '.js — 数据浏览器·' + label + '（画像源 ' + (SPECDIR.indexOf('_prod') >= 0 ? 'DB_LASER_TABLES_PROD.json' : 'db_laser_tables.json') + '）\n' +
'// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；' + (t.rows > 80000 ? '行数 ' + t.rows.toLocaleString() + ' 超引擎阈值，SQL 分页。\n' : '统一 SQL 分页口径（全库统一导航/面板交互）。\n') +
'// 凭据只在本机 spec 的 connections 段。\n\n' +
"load('D:/fineagent/lib/browser.js');\n\n" +
'var SPEC = BROWSER.spec({\n' +
"  outName: BROWSER.env('BR_OUT', '激光数据浏览器_" + label + "'),\n" +
"  title: '激光数据浏览器 · " + label + ' ' + key + "',\n" +
"  table: '" + key + "',\n" +
"  selfCpt: 'fineagent/激光数据浏览器_" + label + "_api.cpt',\n" +
'  modules: BROWSER.MODULES,\n' +
(t.dateCol ? "  dateCol: '" + t.dateCol + "'," + (t.timeCol ? "\n  timeCol: '" + t.timeCol + "'," : '') + '\n' : '') +
(isNativeDate(t) ? '  dateNative: true,\n' : '') +
'  filterCol: ' + (hasStage ? "'stage'" : 'null') + ',\n' +
'  sqlPaging: true,\n' +
'  defaults: {\n' +
"    d1: BROWSER.env('BR_D1', '=TODAY()-6'), d2: BROWSER.env('BR_D2', '=TODAY()'),\n" +
"    machine: BROWSER.env('BR_MACHINE', ''),\n" +
"    size: +BROWSER.env('BR_SIZE', '50'), page: +BROWSER.env('BR_PAGE', '1')\n" +
'  },\n' +
'  connections: [{\n' +
"    name: 'ATOM_LIVE',\n" +
"    driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',\n" +
"    url: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false',\n" +
"    user: 'sa',\n" +
"    password: load('D:/fineagent/lib/dbpass.js')\n" +
'  }],\n' +
'  cols: [\n' +
t.cols.map(function (c) {
  // #4 表头 label：CNMAP[key][列名] → toml 现场中文表头；映射缺位（基建列）不写 label
  var s = colSpec(c, t, CNMAP[key] ? CNMAP[key][c.name] : null);
  return '    { name: ' + JSON.stringify(s.name) +
    (s.label != null ? ', label: ' + JSON.stringify(s.label) : '') +
    (s.len ? ', len: ' + s.len : '') +
    (s.type ? ", type: '" + s.type + "'" : '') +
    (s.fmt ? ", fmt: '" + s.fmt + "'" : '') + ' }';
}).join(',\n') + '\n' +
'  ]\n' +
'});\n';
  writeUtf8(SPECDIR + '/br_laser_' + key.replace(/^laser_/, '') + '.js', spec);
  made++;
}

// 模块注册表两套（UTF-8）：demo=全 26 表（演示部署位 reportlets/fineagent/，固定）；prod=25 表（无备份表）
// 2026-10-28 用户拍板生产目录 = mkwh/激光钻孔机台LOG：prod 注册表/viewlet 路径默认烘该子目录，
//   可用 BR_CPTDIR 覆盖（'.' = reportlets 根）；demo 走 BR_CPTDIR_DEMO（默认 fineagent，别动——演示服务器就放那）
var trimDir = function (d, def) { if (d == null || String(d) === '') return def; return String(d).replace(/^\.$/, '').replace(/[\\\/]+$/, ''); };
var DIRPFX_DEMO = trimDir(java.lang.System.getenv('BR_CPTDIR_DEMO'), 'fineagent');
var DIRPFX_PROD = trimDir(java.lang.System.getenv('BR_CPTDIR'), 'mkwh/激光钻孔机台LOG');
var withDir = function (m, pfx) { return { key: m.key, cpt: (pfx ? pfx + '/' : '') + m.cpt.replace(/^fineagent\//, ''), label: m.label }; };
// 注册表只在 demo 模式（BR_PROFILE 未设）下重写：prod 画像驱动的轮次 mods 只有 25 表，覆写会把演示注册表踩丢一张
if (!java.lang.System.getenv('BR_PROFILE')) {
var modsSrc = '// 自动生成（gen_laser_specs.js）：全库浏览器模块注册表（演示=reportlets/fineagent/）\nvar LASER_MODULES = ' + JSON.stringify(mods.map(function (m) { return withDir(m, DIRPFX_DEMO); }), null, 1).replace(/"/g, "'") + ';\n';
writeUtf8('D:/fineagent/data/db_laser_modules.js', modsSrc);
var modsProd = mods.filter(function (m) { return m.key !== 'laser_files_bak_20261020'; });
var modsProdSrc = '// 自动生成（gen_laser_specs.js）：生产模块注册表（t_collector_ 前缀集，25 表无备份表，reportlets/mkwh/激光钻孔机台LOG/）\nvar LASER_MODULES = ' + JSON.stringify(modsProd.map(function (m) { return withDir(m, DIRPFX_PROD); }), null, 1).replace(/"/g, "'") + ';\n';
writeUtf8('D:/fineagent/data/db_laser_modules_prod.js', modsProdSrc);
print('CPTDIR demo=' + DIRPFX_DEMO + ' prod=' + DIRPFX_PROD);
}

print('GENERATED specs=' + made + ' modules=' + mods.length);
