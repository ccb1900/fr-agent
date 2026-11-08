var J=function(n){return Java.type(n);};
var module = J('com.fr.module.tool.ActivatorToolBox').simpleLink(
  new (J('com.fr.config.activator.BaseDBActivator'))(), new (J('com.fr.config.activator.ConfigurationActivator'))(),
  new (J('com.fr.store.StateServiceActivator'))(), new (J('com.fr.report.module.ReportBaseActivator'))(),
  new (J('com.fr.report.RestrictionActivator'))(), new (J('com.fr.report.ReportActivator'))(),
  new (J('com.fr.chart.activator.ChartBaseActivator'))());
var SimpleWork = J('com.fr.workspace.simple.SimpleWork');
SimpleWork.supply(J('java.lang.Class').forName('com.fr.base.operator.common.CommonOperator'), new (J('com.fr.env.operator.CommonOperatorImpl'))());
SimpleWork.checkIn('D:/software/FineReport_11.0/webapps/webroot/WEB-INF');
module.start();
var wb=J('com.fr.io.TemplateWorkBookIO').readTemplateWorkBook('doc/Chart/GanttChart/关联线甘特图.cpt');
var sh=wb.getReport(0);
for(var r=0;r<Math.min(sh.getRowCount(),30);r++) for(var c=0;c<Math.min(sh.getColumnCount(),10);c++) {
  var ce=sh.getCellElement(c,r); if(!ce) continue; var v=ce.getValue(); if(!v || String(v.getClass().getName()).indexOf('ChartCollection')<0) continue;
  var chart=v.getChart(0); var def=chart.getPlot ? null : null; print('cell '+c+','+r+' chart '+chart.getClass().getName());
  var d=chart.getFilterDefinition(); print('DEF '+d.getClass().getName());
  if(d.setDataDefinition){
    var dd=d.getDataDefinition(); print('DATADEF '+dd.getClass().getName());
    print('first='+dd.getFirstProcess()+' series='+dd.getSeriesName()+' start='+dd.getStartTime()+' end='+dd.getEndTime()+' mark='+dd.getMarkTime()+' progress='+dd.getProgress()+' linkID='+dd.getLinkID());
    var td=dd.getTableData(); print('TABLEDATA '+td.getClass().getName()+' name='+(td.getDisplayName?td.getDisplayName():''));
    var cn=td.getColumnNames(); print('cols='+String(cn.join?cn.join(','):cn));
    var ct=td.getColumnTypes(); print('types='+String(ct.join?ct.join(','):ct));
    print('rows='+td.getRowCount());
    for(var q=0;q<Math.min(2,td.getRowCount());q++){var row=td.getRowData(q); print('row '+String(row));}
    var ld=d.getLinkDefinition(); if(ld){var ltd=ld.getTableData(); print('LINKTABLE cols='+String(ltd.getColumnNames().join(','))+' rows='+ltd.getRowCount()); print('link start='+ld.getStartTaskID()+' end='+ld.getEndTaskID()+' type='+ld.getLinkType());}
  }
}
J('java.lang.System').exit(0);
