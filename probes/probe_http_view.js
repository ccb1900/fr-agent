// probe_http_view.js — HTTP 层抓 op=view 首屏 HTML（文件层取证，不碰 GUI）：判定首屏是否内嵌数据行
var J = function (n) { return Java.type(n); };
function fetchText(url) {
  var u = new (J('java.net.URL'))(url);
  var co = u.openConnection();
  co.setConnectTimeout(4000); co.setReadTimeout(30000);
  var is = co.getInputStream();
  var sc = new (J('java.util.Scanner'))(is, 'UTF-8').useDelimiter('\\A');
  var s = sc.hasNext() ? sc.next() : '';
  is.close(); return s;
}
var base = 'http://127.0.0.1:8075';
var urls = [
  base + '/webroot/decision/view/report?viewlet=' + java.net.URLEncoder.encode('fineagent/激光数据浏览器_评分流水_api.cpt', 'UTF-8') + '&op=view',
];
for (var i = 0; i < urls.length; i++) {
  try {
    var h = fetchText(urls[i]);
    print('URL ' + i + ' len=' + h.length);
    print('  含查询按钮: ' + (h.indexOf('查询') >= 0 ? 'Y' : 'N'));
    print('  含分页信息(共/页): ' + ((h.indexOf('共') >= 0 && h.indexOf('页') >= 0) ? 'Y' : 'N'));
    var dataMarks = 0;
    ['2026-9-1', '2026-09-1', 'L |', '308', 'file_key'].forEach(function (m) { if (h.indexOf(m) >= 0) dataMarks++; });
    print('  数据痕迹标记数: ' + dataMarks);
    print('  Oops/错误: ' + (h.indexOf('Oops') >= 0 || h.indexOf('出错了') >= 0 ? 'Y' : 'N'));
  } catch (e) { print('URL ' + i + ' FETCH FAIL: ' + String(e.message).substring(0, 80)); }
}
print('DONE');
