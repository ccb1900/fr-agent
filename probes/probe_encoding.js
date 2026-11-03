// probe_encoding.js — 一次性验证：UTF-8 中文文件经 nashorn load() 后字符串完整性（决定注册表文件能否走 UTF-8）
var s = '激光数据浏览器_评分流水';
print('LEN=' + s.length + ' EXPECT=13');
print('CHARS OK? ' + (s.length === 13));
