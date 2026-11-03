// probe_http_ab.js — delayPlaying true/false A/B：op=view 首屏 HTML 是否内嵌数据行（文件层，零 GUI）
var J = function (n) { return Java.type(n); };
function fetchText(url) {
  var u = new (J('java.net.URL'))(url);
  var co = u.openConnection();
  co.setConnectTimeout(4000); co.setReadTimeout(45000);
  var is = co.getInputStream();
  var sc = new (J('java.util.Scanner'))(is, 'UTF-8').useDelimiter('\\A');
  var s = sc.hasNext() ? sc.next() : '';
  is.close(); return s;
}
function enc(p) { return java.net.URLEncoder.encode(p, 'UTF-8'); }
var base = 'http://127.0.0.1:8075/webroot/decision/view/report?viewlet=';
var tests = [
  ['A delayPlaying=true (现网产物)', enc('fineagent/激光数据浏览器_评分流水_api.cpt')],
  ['B delayPlaying=false (试验副本)', enc('fineagent/ABTEST_评分流水.cpt')]
];
for (var i = 0; i < tests.length; i++) {
  var url = base + tests[i][1] + '&op=view';
  try {
    var h = fetchText(url);
    // 数据痕迹：真实行值在 HTML 中应有日期 '2026-9-1x' 与 file_key 数字串
    var hasVal = h.indexOf('2026-9-1') >= 0;
    var hasRows = h.indexOf('397') >= 0 || h.indexOf('5490') >= 0;
    var hasBar = h.indexOf('共') >= 0 && h.indexOf('页') >= 0;
    print(tests[i][0] + ' len=' + h.length + ' 内嵌日期值=' + (hasVal ? 'Y' : 'N') + ' 行值/总数=' + (hasRows ? 'Y' : 'N') + ' 分页带=' + (hasBar ? 'Y' : 'N'));
    // 找 '共' 附近的切片看首屏语义
    var k = h.indexOf('共');
    if (k >= 0) print('   切片: ' + h.substring(k - 60, k + 60).replace(/\s+/g, ' '));
  } catch (e) { print(tests[i][0] + ' FETCH FAIL: ' + String(e.message).substring(0, 90)); }
}
print('DONE');
