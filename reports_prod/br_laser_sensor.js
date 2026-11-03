// br_laser_sensor.js — 数据浏览器·传感器（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；行数 3037228 超引擎阈值，SQL 分页。
// 凭据只在本机 spec 的 connections 段。

load(Paths.feature('data_browser', 'browser.js'));

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_传感器'),
  title: '激光数据浏览器 · 传感器 laser_sensor',
  table: 'laser_sensor',
  selfCpt: 'fineagent/激光数据浏览器_传感器_api.cpt',
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
    { name: "dust_air", label: "Dust Air", len: 9, type: 'num', fmt: '#,##0.000' },
    { name: "table_air", label: "Table Air", len: 10, type: 'num', fmt: '#,##0.000' },
    { name: "prg", label: "PRG.", len: 34, type: 'cent' },
    { name: "block_no", label: "Block No.", len: 10, type: 'code' },
    { name: "r_stage_ftheta_temp", label: "R stage f-theta Temp", len: 22, type: 'num', fmt: '#,##0' },
    { name: "l_stage_ftheta_temp", label: "L stage f-theta Temp", len: 22, type: 'num', fmt: '#,##0' }
  ]
});
