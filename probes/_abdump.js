var J = function (n) { return Java.type(n); };
var co = new (J('java.net.URL'))('http://127.0.0.1:8075/webroot/decision/view/report?viewlet=' +
  J('java.net.URLEncoder').encode('fineagent/激光数据浏览器_评分流水_api.cpt', 'UTF-8') + '&op=view').openConnection();
co.setReadTimeout(60000);
var sc = new (J('java.util.Scanner'))(co.getInputStream(), 'UTF-8').useDelimiter('\\A');
var h = sc.hasNext() ? sc.next() : '';
var w = new (J('java.io.OutputStreamWriter'))(new (J('java.io.FileOutputStream'))('D:/fineagent/logs/_view_shell.html'), 'UTF-8');
w.write(h); w.close();
print('SAVED len=' + h.length);
