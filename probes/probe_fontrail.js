// probe_fontrail.js — 引擎读回部署 cpt：逐格打印 FRFont 名/frSize（设计器/导出/读回同一引擎 = 事实源）
// 只读，不渲染不改产物；回答"42 到底代表几 pt / 设计器 6.5 从哪来"
var J = function (n) { return Java.type(n); };
var ClassT = J('java.lang.Class');
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(ClassT.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();

var wb = J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('fineagent/激光数据浏览器_评分流水_api.cpt');
print('READBACK OK: ' + (wb == null ? 'null' : wb.getClass().getName()));

// 枚举 CellElement：走 WorkBook 的 sheet → WorkSheet(解析后) 的 CellElementList
var rep = wb.getReport('sheet1') || wb.getReport(0);
print('REPORT: ' + (rep == null ? 'null' : rep.getClass().getName()));
// WorkSheet 接口：getReport() 元素遍历——用 CellElement 遍历器？直接反射找 getCellElement(col,row)
var cls = rep.getClass();
var ms = cls.getMethods();
var getCell = null, sizeM = [];
for (var i = 0; i < ms.length; i++) {
  var n = String(ms[i].getName());
  if (n === 'getCellElement' && getCell == null) getCell = ms[i];
}
print('getCellElement found: ' + (getCell != null));

// 行列规模：RowHeight CDATA 长度 = 行数；列数用 ColumnWidth
// 直接试 0..10 行 × 0..21 列
for (var r = 0; r <= 10; r++) {
  var rowstr = [];
  for (var c = 0; c <= 21; c++) {
    var ce = null;
    try { ce = getCell.invoke(rep, J('java.lang.Integer').valueOf(c), J('java.lang.Integer').valueOf(r)); } catch (e) { try { ce = getCell.invoke(rep, J('java.lang.Integer').valueOf(r), J('java.lang.Integer').valueOf(c)); } catch (e2) {} }
    if (ce == null) { rowstr.push('        .        '); continue; }
    try {
      var st = ce.getStyle();
      if (st == null) { rowstr.push('        nul       '); continue; }
      var f = st.getFRFont();
      var nm = f == null ? '-' : String(f.getName());
      var fs = f == null ? -1 : (f.getFRSize ? f.getFRSize() : -999);
      var s2 = -1; try { var d = f.getSize2D(); s2 = Math.round(d * 10) / 10; } catch (e3) {}
      rowstr.push(nm.substring(0, 3) + ':' + fs + '/' + s2);
    } catch (e4) { rowstr.push('        err       '); }
  }
  print('r' + r + ' | ' + rowstr.join(' | '));
}
J('java.lang.System').exit(0);
