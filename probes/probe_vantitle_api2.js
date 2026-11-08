var J = function (n) { return Java.type(n); };
var c = J('com.fr.plugin.chart.attr.VanChartTitle');
var ctors = c.class.getConstructors();
print('CTORS ' + ctors.length);
for (var i = 0; i < ctors.length; i++) {
  var ps = ctors[i].getParameterTypes(); var a = [];
  for (var j = 0; j < ps.length; j++) a.push(ps[j].getName());
  print('  (' + a.join(',') + ')');
}
var ms = c.class.getMethods();
['setTitleVisible', 'setTitleVisble', 'setMaxHeight', 'setPosition', 'setUseHtml', 'setFloating', 'setLimitSize', 'setTextObject', 'setTextAttr'].forEach(function (nm) {
  for (var i = 0; i < ms.length; i++) {
    if (ms[i].getName() !== nm) continue;
    var ps = ms[i].getParameterTypes(); var a = [];
    for (var j = 0; j < ps.length; j++) a.push(ps[j].getName());
    print(nm + '(' + a.join(',') + ') -> ' + ms[i].getReturnType().getName());
  }
});
J('java.lang.System').exit(0);
