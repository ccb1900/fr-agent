// br_laser_mask_gosa.js — 数据浏览器·掩膜GOSA（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_掩膜GOSA'),
  title: '激光数据浏览器 · 掩膜GOSA laser_mask_gosa',
  table: 'laser_mask_gosa',
  selfCpt: 'fineagent/激光数据浏览器_掩膜GOSA_api.cpt',
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
    { name: "file_key", len: 20, type: 'code' },
    { name: "row_number", len: 11, type: 'num', fmt: '#,##0' },
    { name: "biz_date", label: "日期", len: 14 },
    { name: "biz_time", label: "时间", len: 10 },
    { name: "stage", label: "Stage", len: 6, type: 'cent' },
    { name: "max_err_r", label: "最大误差 R", len: 11, type: 'num', fmt: '#,##0.000' },
    { name: "max_err_x", label: "最大误差 X", len: 11, type: 'num', fmt: '#,##0.000' },
    { name: "max_err_y", label: "最大误差 Y", len: 11, type: 'num', fmt: '#,##0.000' },
    { name: "mask_no", label: "光罩No.", len: 8, type: 'code' }
  ]
});
