// probe_restore_limits.js — 把 RelaxationRestrictionConfig 恢复 FR 默认口径（撤销 v3.7 实验）
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
var inst = J('com.fr.report.restriction.config.RelaxationRestrictionConfig').getInstance();
inst.setOpenRowControl(true);
inst.setMaxDSRowCount(80000);
inst.setOpenCellControl(true);
inst.setMaxDSCellCount(2000000);
print('RESTORED: openRowControl=' + inst.isOpenRowControl() + ' maxDSRowCount=' + inst.getMaxDSRowCount()
  + ' openCellControl=' + inst.isOpenCellControl() + ' maxDSCellCount=' + inst.getMaxDSCellCount());
J('java.lang.System').exit(0);
