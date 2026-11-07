// probes/_probe_template.js — 统一反射探针模板（阶段4 批2-①：能力接入管线第一步的固定入口）
//  动机（任务书批2-①）：每接一个 FR 原生能力，第一步都是"这个类的 API 面长什么样"——过去每轮手写
//   一次性探针（probe_r4m14/probe_heatmap/...），靶类、过滤、输出格式各不相同，成本重复付。
//   本模板把这一步固定下来：输入全限定类名（+可选方法前缀过滤），产出 CTOR + setter 面 + 常量/枚举
//   的 API 表，供 IR 键设计/object 构造/官方语料对拍直接引用。
//  跑法（引擎 classpath，与 coverage_report 同款）：
//   "D:\software\FineReport_11.0\jre\bin\java.exe" -Djava.awt.headless=true -Xmx1200m \
//     -cp "D:\software\FineReport_11.0\jre\lib\ext\nashorn.jar;<其余引擎 cp>" jdk.nashorn.tools.Shell \
//     probes/_probe_template.js com.fr.plugin.chart.base.format.AttrTooltipAreaNameFormat set
//  三种 CLI 约定全收（层门/调用方任选，输入完全来自调用方，无内置默认靶——负控不假绿）：
//   1) Shell 的 -- 约定： Shell probes/_probe_template.js -- <fqcn> [filter]
//   2) Shell 裸参数（本构建把脚本名之后的词当"待加载脚本文件"，脚本先于其执行——本模板从自身进程
//      命令行恢复这些词，PowerShell Get-CimInstance 只读查询，无 wmic 依赖）：Shell probes/_probe_template.js <fqcn> [filter]
//   3) 命名式（1/2 均可）：-Class <fqcn> -Method <filter>
//  输出契约（层门/人工共同消费）：
//   == PROBE-TEMPLATE class: <fqcn>   起始行（含 resolved 的 Class 与父类）
//   == CTOR (constructors) ==         构造函数面
//   == METHODS (filter '<f>') ==      方法面（含参数/返回类型，方法名前缀过滤）
//   == CONSTANTS / ENUM ==            public static 常量 + 自身/setter 参数中的枚举类型及其常量
//   找不到类：一行 PROBE-TEMPLATE ERROR ...，exit 1（负控：不存在的类绝不出 API 表）。
//  ASCII-only（PS 5.1 GBK 教训）；ES5。注意：本脚本结束时必须 System.exit——裸参数约定下 Shell 还会
//   尝试把靶类名当脚本文件加载，不主动退出会追加一个与本探针无关的 IOException/非零退出码。
var J = function (n) { return Java.type(n); };

function ownCommandLine() {
  // 只读自省：Get-CimInstance Win32_Process 查自身进程命令行（EncodedCommand 避开引号地狱）。
  var pid = String(java.lang.management.ManagementFactory.getRuntimeMXBean().getName()).split('@')[0];
  var ps = '$c=(Get-CimInstance Win32_Process -Filter "ProcessId=' + pid + '").CommandLine; [Console]::Out.Write("<<<CML" + $c + "CML>>>")';
  var enc = java.util.Base64.getEncoder().encodeToString(new java.lang.String(ps).getBytes('UTF-16LE'));
  var pb = new java.lang.ProcessBuilder(java.util.Arrays.asList('powershell.exe', '-NoProfile', '-EncodedCommand', enc));
  pb.redirectErrorStream(true);
  var p = pb.start();
  var is = p.getInputStream();
  var b, line = '';
  while ((b = is.read()) != -1) { line += String.fromCharCode(b & 0x7f); }
  is.close();
  p.waitFor();
  var m = line.indexOf('<<<CML');
  var e2 = line.lastIndexOf('CML>>>');
  if (m < 0 || e2 <= m) return null;
  return line.substring(m + 6, e2);
}
function argsFromCommandLine() {
  var cl = ownCommandLine();
  if (cl === null) return [];
  var self = '_probe_template.js';
  var i = cl.lastIndexOf(self);
  if (i < 0) return [];
  var rest = ('' + cl.substring(i + self.length)).replace(/"/g, ' ').trim();
  if (!rest) return [];
  return rest.split(/\s+/);
}
var args = (typeof arguments !== 'undefined' && arguments.length) ? arguments.slice(0) : [];
if (!args.length) { args = argsFromCommandLine(); }   // 裸参数约定：脚本先于 Shell 的"文件"加载执行
var fq = null, filter = '';
for (var ai = 0; ai < args.length; ai++) {
  if (args[ai] === '-Class') { fq = args[++ai]; }
  else if (args[ai] === '-Method') { filter = args[++ai] || ''; }
  else if (fq === null) { fq = args[ai]; }
  else if (!filter) { filter = args[ai]; }
}
if (!fq) {
  print('PROBE-TEMPLATE ERROR: no target class given (usage: _probe_template.js -- <fqcn> [methodFilter] | -Class <fqcn> -Method <filter>)');
  java.lang.System.exit(1);
}
var loader = java.lang.Thread.currentThread().getContextClassLoader();
var cls = null;
try {
  cls = J('java.lang.Class').forName(fq, true, loader);
} catch (e) {
  print('PROBE-TEMPLATE ERROR: cannot load class "' + fq + '": ' + e.message);
  java.lang.System.exit(1);   // 负控：不存在的类一行诊断 + 非零退出，绝无 API 表
}
function sig(m) {
  var ps2 = m.getParameterTypes();
  var out = [];
  for (var i = 0; i < ps2.length; i++) out.push(ps2[i].getName());
  var ret = 'new';
  try { if (m.getReturnType) ret = m.getReturnType().getName(); } catch (e0) { ret = 'new'; }   // Constructor 无 getReturnType（Java 8）
  return '(' + out.join(', ') + ') -> ' + ret;
}
var mods = J('java.lang.reflect.Modifier');
print('== PROBE-TEMPLATE class: ' + cls.getName() + ' (super=' + (cls.getSuperclass() ? cls.getSuperclass().getName() : 'none') + ')');
var ctors = cls.getConstructors();
print('== CTOR (constructors) ==');
if (!ctors.length) print('  (no public constructors)');
for (var ci = 0; ci < ctors.length; ci++) print('  ' + sig(ctors[ci]));
print("== METHODS (filter '" + filter + "') ==");
var ms = cls.getMethods();
var listed = 0, enumsToDump = {};
for (var mi = 0; mi < ms.length; mi++) {
  var mn = ms[mi].getName();
  if (filter && mn.indexOf(filter) !== 0) continue;
  print('  ' + mn + sig(ms[mi]));
  listed++;
  var pts = ms[mi].getParameterTypes();
  for (var pi = 0; pi < pts.length; pi++) { if (pts[pi].isEnum()) enumsToDump[pts[pi].getName()] = pts[pi]; }
}
if (!listed) print('  (no public methods match filter)');
print('== CONSTANTS / ENUM ==');
var fs = cls.getFields();
var fc = 0;
for (var fi = 0; fi < fs.length; fi++) {
  var f = fs[fi];
  if (!mods.isStatic(f.getModifiers())) continue;
  var val = '';
  try { val = ' = ' + String(f.get(null)); } catch (e2) { val = ' = <inaccessible>'; }
  print('  static ' + f.getType().getName() + ' ' + f.getName() + val);
  fc++;
}
if (cls.isEnum()) {
  var ecs = cls.getEnumConstants();
  var names = [];
  for (var ei = 0; ei < ecs.length; ei++) names.push(String(ecs[ei]));
  print('  enum constants of ' + cls.getName() + ': ' + names.join(', '));
  fc++;
}
var dumpNames = Object.keys(enumsToDump);
for (var di = 0; di < dumpNames.length; di++) {
  var ec = enumsToDump[dumpNames[di]].getEnumConstants();
  var nm = [];
  for (var ej = 0; ej < ec.length; ej++) nm.push(String(ec[ej]));
  print('  enum constants of setter param type ' + dumpNames[di] + ': ' + nm.join(', '));
  fc++;
}
if (!fc) print('  (no public static constants and no enum-typed setter params)');
print('== PROBE-TEMPLATE END class=' + cls.getName() + ' ctors=' + ctors.length + ' methods=' + listed + ' constants=' + fc);
java.lang.System.exit(0);   // 必须主动退出：否则 Shell 继续把靶类名当脚本文件加载（IOException 非零）
