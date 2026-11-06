// probes/probe_b3_catches.js — B-复审B-3：object.js 静默 catch 可触发性判定（零引擎 boot，纯反射面）
//   纪律（backlog:109）：先证明某 catch 真实可触发，再决定留痕升级；不可触发则探针证据+关闭不 action。
//   覆盖六处守卫的可抛调用：
//     :345 TableDataColumn.createColumn(columnName) —— IR strOpt 放行空串（ir.js:92 只查 isStr），
//          ds:{column:''} 可合法过 Ir.validate → 若 createColumn('') 抛 = 真实可触达的静默丢绑定路径
//     :397 MapMarkerType.COMMON —— 类存在性（引擎版本面）
//     :400 ZoomLevel.parseInt(zoom) —— IR 闸整数 0..21（ir.js:975）；仅 raw Obj.build 直入可给边界值
//     :405 ViewCenter.setLongitude/setLatitude —— IR 数值闸；raw 直入可给 null
//     :537/:688 AttrLineStyle.setLineStyle(2) —— 字面 int，仅类缺失面
var J = function (n) { return Java.type(n); };
var out = [];
function rec(name, fn) {
  try { var r = fn(); out.push(name + ' -> OK' + (r === undefined ? '' : ' ret=' + String(r))); }
  catch (e) { out.push(name + ' -> THROW ' + String(e).split('\n')[0]); }
}
var TDC = J('com.fr.general.data.TableDataColumn');
rec('TDC.createColumn(null)', function () { return TDC.createColumn(null); });
rec('TDC.createColumn("")', function () { return TDC.createColumn(''); });
rec('TDC.createColumn(123)', function () { return TDC.createColumn(J('java.lang.Integer').valueOf(123)); });
rec('TDC.createColumn("x")', function () { return String(TDC.createColumn('x')); });
var ZL = J('com.fr.plugin.chart.type.ZoomLevel');
rec('ZL.parseInt(null)', function () { return String(ZL.parseInt(null)); });
rec('ZL.parseInt(-1)', function () { return String(ZL.parseInt(J('java.lang.Integer').valueOf(-1))); });
rec('ZL.parseInt(2.5)', function () { return String(ZL.parseInt(J('java.lang.Double').valueOf(2.5))); });
rec('ZL.parseInt(0)', function () { return String(ZL.parseInt(J('java.lang.Integer').valueOf(0))); });
rec('ZL.parseInt(99)', function () { return String(ZL.parseInt(J('java.lang.Integer').valueOf(99))); });
rec('MapMarkerType.COMMON', function () { return String(J('com.fr.plugin.chart.type.MapMarkerType').COMMON); });
rec('AttrLineStyle.setLineStyle(2)', function () { var a = new (J('com.fr.chart.base.AttrLineStyle'))(); a.setLineStyle(2); return 'set'; });
var VC = J('com.fr.plugin.chart.base.ViewCenter');
rec('ViewCenter.setLongitude(null)', function () { var v = new VC(); v.setLongitude(null); return 'set'; });
rec('ViewCenter.setLongitude(106.2)', function () { var v = new VC(); v.setLongitude(106.2); return 'set'; });
for (var i = 0; i < out.length; i++) print('B3CATCH ' + out[i]);
print('B3CATCH END');
// —— 追加：setColumn(null)/setColumn(空名列)（try 内第二半；columnName 缺省/null 路径）
var DSC = J('com.fr.report.cell.cellattr.core.group.DSColumn');
rec('DSC.setColumn(null)', function () { var d = new DSC(); d.setColumn(null); return 'set'; });
rec('DSC.setColumn(createColumn(null))', function () { var d = new DSC(); d.setColumn(TDC.createColumn(null)); return 'set'; });
rec('DSC.setColumn(createColumn(""))', function () { var d = new DSC(); d.setColumn(TDC.createColumn('')); return 'set'; });
rec('DSC.setColumnName(null)', function () { var d = new DSC(); d.setColumnName(null); return 'set'; });
for (var j = out.length - 4; j < out.length; j++) print('B3CATCH ' + out[j]);
print('B3CATCH END2');
var threwN = out.filter(function (l) { return l.indexOf('-> THROW') >= 0; }).length;
print('B3CATCH VERDICT: ' + (threwN ? 'TRIGGERABLE(' + threwN + ')' : 'ALL-UNTRIGGERABLE (guarded calls total for every reachable input; classes present; per backlog discipline close without action)'));
