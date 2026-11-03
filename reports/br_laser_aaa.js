// br_laser_aaa.js — 数据浏览器·评分流水（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；行数 122757 超引擎阈值，SQL 分页。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_评分流水'),
  title: '激光数据浏览器 · 评分流水 laser_aaa',
  table: 'laser_aaa',
  selfCpt: 'fineagent/激光数据浏览器_评分流水_api.cpt',
  modules: BROWSER.MODULES,
  dateCol: 'biz_date',
  timeCol: 'biz_time',
  filterCol: 'stage',
  sqlPaging: true,
  defaults: {
    d1: BROWSER.env('BR_D1', '=TODAY()-6'), d2: BROWSER.env('BR_D2', '=TODAY()'),
    machine: BROWSER.env('BR_MACHINE', ''),
    size: +BROWSER.env('BR_SIZE', '50'), page: +BROWSER.env('BR_PAGE', '1')
  },
  connections: [{
    name: 'ATOM_LIVE',
    driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    url: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false',
    user: 'sa',
    password: load('D:/fineagent/lib/dbpass.js')
  }],
  cols: [
    { name: "file_key", len: 9, type: 'code' },
    { name: "row_number", len: 11, type: 'num', fmt: '#,##0' },
    { name: "biz_date", label: "日期", len: 14 },
    { name: "biz_time", label: "时间", len: 10 },
    { name: "stage", label: "Stage", len: 6, type: 'cent' },
    { name: "result_x", label: "识别结果 X", len: 11, type: 'num', fmt: '#,##0' },
    { name: "result_y", label: "识别结果 Y", len: 11, type: 'num', fmt: '#,##0' },
    { name: "workpiece_x", label: "工件坐标 X", len: 11, type: 'num', fmt: '#,##0' },
    { name: "workpiece_y", label: "工件坐标 Y", len: 11, type: 'num', fmt: '#,##0' },
    { name: "main_prog_no", label: "主程序的程序编号", len: 18, type: 'code' },
    { name: "main_prog_seq", label: "主程序的序列编号", len: 18, type: 'code' },
    { name: "main_prog_block", label: "主程序的程序块编号", len: 20, type: 'code' },
    { name: "sub_prog_no", label: "子程序的程序编号", len: 18, type: 'code' },
    { name: "sub_prog_seq", label: "子程序的序列编号", len: 18, type: 'code' },
    { name: "sub_prog_block", label: "子程序的程序块编号", len: 20, type: 'code' },
    { name: "machine_x", label: "机械坐标 X", len: 11, type: 'num', fmt: '#,##0' },
    { name: "machine_y", label: "机械坐标 Y", len: 11, type: 'num', fmt: '#,##0' },
    { name: "size", label: "尺寸", len: 8, type: 'num', fmt: '#,##0' },
    { name: "score", label: "Score", len: 8, type: 'num', fmt: '#,##0.000' }
  ]
});
