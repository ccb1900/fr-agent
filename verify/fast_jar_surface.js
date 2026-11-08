// verify/fast_jar_surface.js — jar 级引擎面对账门（2026-11-08；无引擎，只读数据文件）
//   动机（用户："demo cpt 没有 jar 覆盖全面，应该有针对 jar 的分析"）：demo 语料不是引擎面。
//   data/jar_surface_analysis.json（build_jar_surface.ps1 扫描核心 jar 产出）+ 
//   data/jar_surface_classifications.json（每个 Plot 类的定性）把"引擎里有哪些图"钉成账：
//   ①每个 Plot/Plot4VanChart 类都必须被分类（unclassified/stale 为空），否则 jar 面存在盲区；
//   ②supported 的每个类都必须在 jar inventory 里可解析，且与 engine_class_map 的能力映射一致；
//   ③Ir.capabilities().chart 的每个 legacy/vanChart kind 都必须有 engine_class_map 精确条目，
//     且其类出现在 supported 清单里（能力词表与引擎类面对上）；
//   ④unsupported 的每个类都必须写明原因（不允许"未解释的缺口"）。
var J = function (n) { return Java.type(n); };
var Files = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
function src(p) { return String(new (J('java.lang.String'))(Files.readAllBytes(P.get(ROOT + '/' + p)), 'UTF-8')); }
var FAILS = 0;
function check(name, cond, detail) {
  if (cond) print('CHECK PASS: ' + name);
  else { FAILS++; print('CHECK FAIL: ' + name + (detail ? ' :: ' + detail : '')); }
}
load(ROOT + '/lib/ir.js');
var surface = JSON.parse(src('data/jar_surface_analysis.json'));
var clsMap = JSON.parse(src('data/jar_surface_classifications.json'));
var emap = JSON.parse(src('data/engine_class_map.json'));
var inv = JSON.parse(src('data/jar_class_inventory.json'));
var ic = Ir.capabilities();

var classes = surface.classes || [];
var supported = classes.filter(function (c) { return c.status === 'supported'; });
var base = classes.filter(function (c) { return c.status === 'base'; });
var unsupported = classes.filter(function (c) { return c.status === 'unsupported'; });
var total = classes.length;

check('jar 面已分类：unclassified 为空', Array.isArray(surface.unclassified) && surface.unclassified.length === 0, (surface.unclassified || []).join(', '));
check('jar 面分类表无陈旧条目（stale 为空）', Array.isArray(surface.stale) && surface.stale.length === 0, (surface.stale || []).join(', '));
check('jar 面计数自洽（supported+base+unsupported=总数）', supported.length + base.length + unsupported.length === total && total === surface.plotClassCount, 'total=' + total + ' count=' + surface.plotClassCount);
check('jar 面规模门槛（核 jar Plot 类 >= 50，防扫描面缩水）', surface.plotClassCount >= 50, 'plots=' + surface.plotClassCount);
check('supported 图类都有能力名', supported.every(function (c) { return c.cap && c.cap.length > 0; }), JSON.stringify(supported.filter(function (c) { return !c.cap; })));
check('supported 图类都在核心 jar 可解析', supported.every(function (c) { return !!inv.resolved[c['class']]; }), JSON.stringify(supported.filter(function (c) { return !inv.resolved[c['class']]; })));
check('unsupported 图类都写明原因', unsupported.every(function (c) { return c.reason && c.reason.length > 0; }), JSON.stringify(unsupported.filter(function (c) { return !c.reason; })));

// 付费口径（2026-11-08 用户追问）：付费族=FVS bigScreen 14 包 / com.fr.extended.chart.* / 移动端；
//   扫描根不含付费插件 jar，且每个类必须有 license/family 定性。付费类不得出现在 supported/unsupported
//   （付费=排除，不是"未来缺口"）。
var PAID = /^(com\.fr\.plugin\.bigScreen\.|com\.fr\.extended\.chart\.|com\.fr\.report\.mobile\.|com\.fr\.form\.ui\.mobile\.)/;
var licCounts = {}, famCounts = {};
classes.forEach(function (c) {
  licCounts[c.license || 'missing'] = (licCounts[c.license || 'missing'] || 0) + 1;
  famCounts[c.family || 'missing'] = (famCounts[c.family || 'missing'] || 0) + 1;
});
check('付费口径：扫描面无付费插件前缀类', classes.every(function (c) { return !PAID.test(c['class']); }), classes.filter(function (c) { return PAID.test(c['class']); }).map(function (c) { return c['class']; }).join(', '));
check('付费口径：每类都有 license 定性（basic|paid|unknown）', classes.every(function (c) { return c.license === 'basic' || c.license === 'paid' || c.license === 'unknown'; }), JSON.stringify(licCounts));
check('付费口径：每类都有 family 定性（current|base|legacy|van）', classes.every(function (c) { return c.family === 'current' || c.family === 'base' || c.family === 'legacy' || c.family === 'van'; }), JSON.stringify(famCounts));
check('付费口径：supported 类不得标 paid', supported.every(function (c) { return c.license !== 'paid'; }), JSON.stringify(supported.filter(function (c) { return c.license === 'paid'; })));
check('付费口径：unsupported 类不得标 paid（付费=排除，不是未来缺口）', unsupported.every(function (c) { return c.license !== 'paid'; }), JSON.stringify(unsupported.filter(function (c) { return c.license === 'paid'; })));
check('付费口径：账本带 paidPrefixes 政策', !!(clsMap.licensePolicy && Array.isArray(clsMap.licensePolicy.paidPrefixes) && clsMap.licensePolicy.paidPrefixes.length >= 4), JSON.stringify(clsMap.licensePolicy || null));

// 能力词表 <-> 引擎类面：Ir 的每个 chart kind 都要有精确 map 条目，且类在 supported 清单里
var kinds = (ic.chart.legacy || []).concat(ic.chart.vanChart || []);
var kindProblems = [];
kinds.forEach(function (k) {
  var cap = 'chart.' + k;
  var entry = emap.exact && emap.exact[cap];
  if (!entry) { kindProblems.push(cap + ': no engine_class_map exact entry'); return; }
  var isSupportedClass = supported.some(function (c) { return c['class'] === entry['class']; });
  if (!isSupportedClass) kindProblems.push(cap + ': class ' + entry['class'] + ' not in supported jar-surface list');
  if (!inv.resolved[entry['class']]) kindProblems.push(cap + ': class ' + entry['class'] + ' not in jar inventory');
});
check('Ir 图型词表与 jar 图类面一一对上（' + kinds.length + ' kinds）', kindProblems.length === 0, kindProblems.join(' | '));

// 反向：每个 supported 类都必须有一个 kind 能力映射到它（不允许"支持了类但没能力名"）
var capsMapped = {};
Object.keys(emap.exact || {}).forEach(function (cap) { capsMapped[emap.exact[cap]['class']] = cap; });
var orphan = supported.filter(function (c) { return !capsMapped[c['class']]; }).map(function (c) { return c['class']; });
check('supported 图类都有能力映射（无孤立类）', orphan.length === 0, orphan.join(', '));

// 分类表与 surface 一致（同一真相，两处读）
var tableNames = Object.keys(clsMap.classes || {});
check('分类表条目数与 jar 面类数一致', tableNames.length === total, 'table=' + tableNames.length + ' surface=' + total);

print('JAR-SURFACE SUMMARY plots=' + total + ' supported=' + supported.length + ' base=' + base.length + ' unsupported=' + unsupported.length + ' kinds=' + kinds.length + ' license=' + JSON.stringify(licCounts) + ' family=' + JSON.stringify(famCounts));
print('SELFTEST END, failures=' + FAILS);
J('java.lang.System').exit(FAILS ? 1 : 0);
