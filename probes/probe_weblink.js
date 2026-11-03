// probe_weblink.js — 零环境启动，纯类定义审计：WebHyperlink 的构造器/方法/序列化面
var cls = java.lang.Class.forName('com.fr.js.WebHyperlink');
print('FOUND com.fr.js.WebHyperlink');
print('--- 构造器 ---');
for (var i = 0; i < cls.getConstructors().length; i++) print(String(cls.getConstructors()[i]));
print('--- 方法 ---');
var ms = cls.getMethods();
for (var i = 0; i < ms.length; i++) { var n = String(ms[i]); if (/set(URL|TargetFrame|Name)|serialize/i.test(n)) print(n); }
print('--- 抓包官方语料：reportlets 里现存的 <WebHyperlink> 或 URL 型超链 XML 形态 ---');
print('DONE');
