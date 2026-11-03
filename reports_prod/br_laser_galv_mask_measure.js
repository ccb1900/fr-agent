// br_laser_galv_mask_measure.js — 数据浏览器·振镜掩膜（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load(Paths.feature('data_browser', 'browser.js'));

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_振镜掩膜'),
  title: '激光数据浏览器 · 振镜掩膜 laser_galv_mask_measure',
  table: 'laser_galv_mask_measure',
  selfCpt: 'fineagent/激光数据浏览器_振镜掩膜_api.cpt',
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
    { name: "mask_no", label: "光罩编号", len: 9, type: 'code' },
    { name: "mode", label: "模式", len: 11, type: 'cent' },
    { name: "tol_mm", label: "许容?(mm)", len: 10, type: 'cent' },
    { name: "zl_max_err_r", label: "ZL最大误差 R", len: 14 },
    { name: "zl_max_err_x", label: "ZL最大误差 X", len: 14 },
    { name: "zl_max_err_y", label: "ZL最大误差 Y", len: 14 },
    { name: "zr_max_err_r", label: "ZR最大误差 R", len: 14 },
    { name: "zr_max_err_x", label: "ZR最大误差 X", len: 14 },
    { name: "zr_max_err_y", label: "ZR最大误差 Y", len: 14 }
  ]
});
