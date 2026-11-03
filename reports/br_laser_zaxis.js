// br_laser_zaxis.js — 数据浏览器·Z轴（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_Z轴'),
  title: '激光数据浏览器 · Z轴 laser_zaxis',
  table: 'laser_zaxis',
  selfCpt: 'fineagent/激光数据浏览器_Z轴_api.cpt',
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
    { name: "stage", len: 6 },
    { name: "result_x", len: 9 },
    { name: "result_y", len: 9 },
    { name: "workpiece_x", len: 13 },
    { name: "workpiece_y", len: 13 },
    { name: "main_prog_no", len: 14 },
    { name: "main_prog_seq", len: 15 },
    { name: "main_prog_block", len: 17 },
    { name: "sub_prog_no", len: 13 },
    { name: "sub_prog_seq", len: 14 },
    { name: "sub_prog_block", len: 16 },
    { name: "machine_x", len: 10 },
    { name: "machine_y", len: 10 },
    { name: "size", len: 5 },
    { name: "score", len: 6 }
  ]
});
