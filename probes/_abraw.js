// _abraw.js — 抓 op=view 壳 HTML，列出内容加载相关的 URL/调用痕迹
var J = function (n) { return Java.type(n); };
var u = new (J('java.net.URL'))('http://127.0.0.1:8075/webroot/decision/view/report?viewlet=' +
  J('java.net.URLEncoder').encode('fineagent/激光数据浏览器_评分流水_api.cpt', 'UTF-8') + '&op=view');
var co = u.openConnection(); co.setReadTimeout(60000);
var sc = new (J('java.util.Scanner'))(co.getInputStream(), 'UTF-8').useDelimiter('__END__');
var h = sc.hasNext() ? sc.next() : '';
print('len=' + h.length);
var m = /<title>[^<]*/.exec(h); print('title: ' + (m ? m[0] : '?'));
var mm, c = 0;
var re = /(?:src|src_path|href|action|url)[=: 请\"\s(]*([^\"'\s<>)]{10,90})/g;
while ((mm = /(?:src|href|action|url)[=:\s\"(']+([^\"')\s<>]{10,90})/g.exec(h)) !== null) {
  var v = mm[1];
  if (/report|view|trans|load|page|op=/i.test(v)) print('CALL: ' + v.substring(0, 100));
  if (c++ > 100) break;
}
// 关键词邻近切片
['viewlet', 'delayPlaying', 'showWindow', 'refresh', 'reportPage', 'op=view', 'paramsTemplate'].forEach(function (kw) {
  var i = h.indexOf(kw);
  if (i >= 0) print('KW ' + kw + ': ' + h.substring(i - 50, i + 110).replace(/\s+/g, ' '));
});
print('DONE');
