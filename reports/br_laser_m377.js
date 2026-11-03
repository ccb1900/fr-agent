// br_laser_m377.js — 数据浏览器·377机型（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_377机型'),
  title: '激光数据浏览器 · 377机型 laser_m377',
  table: 'laser_m377',
  selfCpt: 'fineagent/激光数据浏览器_377机型_api.cpt',
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
    { name: "stage_no", label: "stageNo.", len: 9, type: 'code' },
    { name: "mask_no", label: "maskNo.", len: 8, type: 'code' },
    { name: "r_xerr", label: "R-Xerr", len: 12, type: 'num', fmt: '#,##0.000' },
    { name: "r_yerr", label: "R-Yerr", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "r_circularity", label: "R-circulity", len: 13, type: 'num', fmt: '#,##0.000' },
    { name: "l_xerr", label: "L-Xerr", len: 12, type: 'num', fmt: '#,##0.000' },
    { name: "l_yerr", label: "L-Yerr", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "l_circularity", label: "L-circulity", len: 13, type: 'num', fmt: '#,##0.000' },
    { name: "light_a_r", label: "light A-R", len: 10, type: 'num', fmt: '#,##0' },
    { name: "light_b_r", label: "light B-R", len: 10, type: 'num', fmt: '#,##0' },
    { name: "light_a_l", label: "light A-L", len: 10, type: 'num', fmt: '#,##0' },
    { name: "light_b_l", label: "light B-L", len: 10, type: 'num', fmt: '#,##0' }
  ]
});
