var J = function (n) { return Java.type(n); };
var CLS = function (n) { return Java.type('java.lang.Class').forName(n); };
function t(label, fn) { try { print(label + ' :: ' + fn()); } catch (e) { print(label + ' MISS :: ' + e.message); } }

var g = J('com.fr.general.FRFont').getInstanceFromFRSize('SimHei', 1, 84);
t('fromFRSize(84).getSize2D', function () { return g.getSize2D(); });
t('fromFRSize(84).getFRSize', function () { return g.getFRSize(); });
t('fromFRSize(84).getSize', function () { return g.getSize(); });
t('black', function () { return g.getForeground(); });

[10.5, 21, 42].forEach(function (sz) {
  t('getInstance(size=' + sz + ').getSize2D', function () {
    return J('com.fr.general.FRFont').getInstance('SimHei', 1, sz).getSize2D();
  });
  t('getInstance(size=' + sz + ').getFRSize', function () {
    return J('com.fr.general.FRFont').getInstance('SimHei', 1, sz).getFRSize();
  });
});

t('getInstance(42) === fromFRSize(84)', function () {
  return J('com.fr.general.FRFont').getInstance('SimHei', 1, 42) === g;
});
t('getInstance(42) twice same', function () {
  return J('com.fr.general.FRFont').getInstance('SimHei', 1, 42) === J('com.fr.general.FRFont').getInstance('SimHei', 1, 42);
});
t('getInstance(42,Color) distinct + fg', function () {
  var red = new (J('java.awt.Color'))(192, 0, 0);
  var a = J('com.fr.general.FRFont').getInstance('SimHei', 1, 42, red);
  var b = J('com.fr.general.FRFont').getInstance('SimHei', 1, 42);
  return 'a===b? ' + (a === b) + ' a.fg=' + a.getForeground() + ' b.fg=' + b.getForeground() + ' a.size=' + a.getSize2D() + ' a.fr=' + a.getFRSize();
});
t('getInstance(42,Color) twice same', function () {
  var red = new (J('java.awt.Color'))(192, 0, 0);
  return J('com.fr.general.FRFont').getInstance('SimHei', 1, 42, red) === J('com.fr.general.FRFont').getInstance('SimHei', 1, 42, red);
});
print('PROBE_FONT4_DONE');
