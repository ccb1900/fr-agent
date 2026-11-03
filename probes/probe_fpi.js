// probe_fpi.js — FormParameterUI 全方法面：找 setDelayDisplayContent / Display 布尔的真实 API
var J = function (n) { return Java.type(n); };
var cls = java.lang.Class.forName('com.fr.form.main.parameter.FormParameterUI');
var ms = cls.getMethods();
for (var i = 0; i < ms.length; i++) {
  var s = String(ms[i]);
  if (/hashCode|toString\(\)|getClass\(|clone|equals\(|wait\(|notifyAll/.test(s)) continue;
  if (/Delay|Display|Attributes|XML|setN|setD/i.test(s)) print(s);
}
print('--- 构造器 ---');
var cs = cls.getConstructors();
for (var i = 0; i < cs.length; i++) print(String(cs[i]));
print('DONE');
