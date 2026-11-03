// br_laser_m370.js — 数据浏览器·370机型（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load(Paths.feature('data_browser', 'browser.js'));

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_370机型'),
  title: '激光数据浏览器 · 370机型 laser_m370',
  table: 'laser_m370',
  selfCpt: 'fineagent/激光数据浏览器_370机型_api.cpt',
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
    { name: "camera_type", label: "摄像头类型", len: 11, type: 'cent' },
    { name: "offset_x", label: "偏置 X", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "offset_y", label: "偏置 Y", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "offset_z", label: "偏置 Z", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "prog_path", label: "加工程序", len: 25 }
  ]
});
