// probe_inst.js — 实例化验证：FreeButton / form.event.Listener / CustomDictionary / DateEditor 默认格式
var J = function (n) { return Java.type(n); };
function t(n, f) { try { print(n + ' -> OK: ' + f()); } catch (e) { print(n + ' -> FAIL: ' + e.message); } }
t('FreeButton()', function () { var b = new (J('com.fr.form.ui.FreeButton'))(); b.setText('X'); b.setWidgetName('x'); return b.getText(); });
t('Listener()', function () { var l = new (J('com.fr.form.event.Listener'))(); l.setEventName('click'); l.setInvokeOnce(false); l.setAction(new (J('com.fr.js.JavaScriptImpl'))("window.location.href='/a';")); return 'event=' + l.getEventName() + ' action=' + String(l.getAction()); });
t('CustomDictionary(k,v)', function () { var A = new (J('java.lang.String[]'))(2); A[0] = '10'; A[1] = '20'; var d = new (J('com.fr.data.impl.CustomDictionary'))(A, A); return 'size=' + d.size(); });
t('DateEditor()', function () { var d = new (J('com.fr.form.ui.DateEditor'))(); return 'format=' + d.getFormatText() + ' | default=' + String(d.getWidgetValue()); });
print('DONE');
