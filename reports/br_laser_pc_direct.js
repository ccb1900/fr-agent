// br_laser_pc_direct.js — 数据浏览器·PC直写（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_PC直写'),
  title: '激光数据浏览器 · PC直写 laser_pc_direct',
  table: 'laser_pc_direct',
  selfCpt: 'fineagent/激光数据浏览器_PC直写_api.cpt',
  modules: BROWSER.MODULES,
  dateCol: 'biz_date',
  timeCol: 'biz_time',
  filterCol: null,
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
    { name: "prog_path", label: "加工程序", len: 44 },
    { name: "size", label: "尺寸", len: 9, type: 'num', fmt: '#,##0' },
    { name: "search_method", label: "搜索方法", len: 9, type: 'cent' },
    { name: "result_summary", label: "结果概要", len: 9, type: 'num', fmt: '#,##0' },
    { name: "result_detail", label: "结果详细", len: 9, type: 'num', fmt: '#,##0' }
  ]
});
