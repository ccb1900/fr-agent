// _mini_v8.js — j2v8 单点隔离测试：不起 FR 环境，只 createV8Runtime + release。
// 若此脚本原生崩 → j2v8/系统态已坏，与 FR 引擎、与我们的代码无关；若正常 → 组合态问题。
var J = function (n) { return Java.type(n); };
print('MINI_START');
var V8 = J('com.eclipsesource.v8.V8');
var v8 = V8.createV8Runtime();
print('ISOLATE_CREATED');
v8.release();
print('RELEASED_OK');
J('java.lang.System').exit(0);
