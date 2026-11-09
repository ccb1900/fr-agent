// verify/fast_parse.js — 分层验证·快速层：全管线 JS 的 parse 门（new Function 只编译不执行）
//   Nashorn 专有 API（Java.type/com.fr.）都在函数体内，parse 不触发；语法错即 fail。
//   无引擎依赖（只 nashorn.jar），每次改任意 lib/runner 先跑此层。
var J = function (n) { return Java.type(n); };
var F = J('java.nio.file.Files'), P = J('java.nio.file.Paths');
var ROOT = J('java.lang.System').getenv('FR_AGENT_HOME') || 'D:/fineagent';
var FILES = ['make_api.js', 'lib/ir.js', 'lib/object.js', 'lib/object_core.js', 'lib/object_chart.js', 'lib/cpt.js', 'lib/runresult.js',
  'lib/report_spec.js', 'lib/spec_validator.js', 'lib/spec_compiler.js', 'lib/isodate.js',
  'semantic/schema/metadata.js', 'semantic/schema/relation.js', 'semantic/schema/serializer.js',
  'semantic/schema/inspector.js', 'semantic/schema/inspect_main.js',
  'semantic/model/vocab.js', 'semantic/model/registry.js', 'semantic/model/validator.js', 'semantic/model/resolver.js', 'semantic/model/evidence.js',
  'semantic/preflight.js',
  'semantic/dataset/definition.js', 'semantic/dataset/registry.js',
  'semantic/planner/capability.js', 'semantic/planner/planner.js', 'semantic/query/sqlbuilder.js', 'semantic/closure/loopguard.js',
  'agent/tools/discover.js', 'agent/tools/resolve.js', 'agent/tools/validate.js', 'agent/tools/preview.js', 'agent/tools/assets.js',
  'application/contracts.js', 'application/create_report.js', 'application/modify_report.js',
  'verify/compare_paths.js',
  'template/ops.js', 'template/validator.js', 'template/locator.js', 'template/diff.js', 'template/regression.js',
  'template/inspector.js', 'template/reader.js', 'template/patch.js', 'template/patch_main.js',  'runtime/paths.js', 'runtime/bootstrap.js', 'runtime/datasource.js', 'features/data_browser/browser.js'];
var FAILS = 0;
FILES.forEach(function (f) {
  try {
    new Function(String(new (J('java.lang.String'))(F.readAllBytes(P.get(ROOT + '/' + f)), 'UTF-8')));
    print('PARSE OK: ' + f);
  } catch (e) { FAILS++; print('PARSE FAIL: ' + f + ' -> ' + e); }
});
print('PARSE SUITE END, failures=' + FAILS);
J('java.lang.System').exit(FAILS > 0 ? 1 : 0);
