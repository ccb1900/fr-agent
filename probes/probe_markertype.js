// probe_markertype.js — 2026-11-08：MarkerType 枚举常量（标签边框 shape 用；官方 shapeType=RectangularMarker）
var J = function (n) { return Java.type(n); };
try {
  var MT = J('com.fr.plugin.chart.marker.type.MarkerType');
  var cs = MT.class.getEnumConstants();
  if (cs) { for (var i = 0; i < cs.length; i++) print('CONST ' + String(cs[i].name())); }
  else print('NO ENUM CONSTANTS');
} catch (e) { print('ERR ' + e); }
