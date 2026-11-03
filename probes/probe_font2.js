var J = function (n) { return Java.type(n); };
var g = J('com.fr.general.FRFont').getInstanceFromFRSize('SimHei', 1, 84);
var c = g.clone();
print('same = ' + (g === c));
print('before g.fg = ' + g.getForeground());
c.setForeground(new (J('java.awt.Color'))(192, 0, 0));
print('after clone-mutate g.fg = ' + g.getForeground());
var d = J('com.fr.general.FRFont').getInstanceFromFRSize('SimHei', 1, 84);
print('fresh fg = ' + d.getForeground());
