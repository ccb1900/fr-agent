// probe_dumpA.js — 基本明细汇总表A 真值 dump：ds1(S产品 全量) + 类别字典表
var Class = Java.type('java.lang.Class');
var J = function (n) { return Java.type(n); };
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(),
  new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(),
  new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(),
  new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(Class.forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();

var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var TWBIO = J('com.fr.io.TemplateWorkBookIO');
var calc = J('com.fr.script.Calculator').createCalculator();
var sb = [];
function dumpModel(label, dm) {
  var nR = dm.getRowCount(), nC = dm.getColumnCount();
  sb.push('## ' + label + ' ROWS=' + nR + ' COLS=' + nC);
  var hdr = [];
  for (var c = 0; c < nC; c++) hdr.push(String(dm.getColumnName(c)));
  sb.push('COLS=' + hdr.join('|'));
  for (var r = 0; r < nR; r++) {
    var row = [];
    for (var c2 = 0; c2 < nC; c2++) { var v = dm.getValueAt(r, c2); row.push(v == null ? 'null' : String(v)); }
    sb.push(row.join('|'));
  }
}
var wb = TWBIO.readTemplateWorkBook('demo/basic/基本明细汇总表A.cpt');
var td = wb.getTableData('ds1');
dumpModel('ds1 S产品', td.createDataModel(calc));
// 类别字典表：直构造 DBTableData(连接, 查询)，连接复用 ds1 的
var td2 = new (J('com.fr.data.impl.DBTableData'))(td.getDatabase(), 'SELECT 类别ID, 类别名称 FROM 类别');
dumpModel('dictS 类别', td2.createDataModel(calc));
var OUT = Paths.get('D:/fineagent/sproduct_dump.txt');
var bw = new (J('java.io.BufferedWriter'))(new (J('java.io.OutputStreamWriter'))(Files.newOutputStream(OUT), 'UTF-8'));
bw.write(sb.join('\n')); bw.flush(); bw.close();
print('DUMP END');
J('java.lang.System').exit(0);
