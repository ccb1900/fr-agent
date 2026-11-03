// br_laser_energy_measure.js — 数据浏览器·能量测量（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_能量测量'),
  title: '激光数据浏览器 · 能量测量 laser_energy_measure',
  table: 'laser_energy_measure',
  selfCpt: 'fineagent/激光数据浏览器_能量测量_api.cpt',
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
    { name: "file_key", len: 20, type: 'code' },
    { name: "row_number", len: 11, type: 'num', fmt: '#,##0' },
    { name: "biz_date", label: "日期", len: 14 },
    { name: "biz_time", label: "时间", len: 10 },
    { name: "base_energy_mj", label: "基准能量(mJ)", len: 14, type: 'num', fmt: '#,##0.000' },
    { name: "tolerance_pct", label: "容许范围(%)", len: 13, type: 'num', fmt: '#,##0.00' },
    { name: "zl_measured_energy_mj", label: "ZL测量能量(mJ)", len: 16, type: 'num', fmt: '#,##0.000' },
    { name: "zr_measured_energy_mj", label: "ZR测量能量(mJ)", len: 16, type: 'num', fmt: '#,##0.000' }
  ]
});
