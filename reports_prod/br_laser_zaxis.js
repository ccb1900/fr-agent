// br_laser_zaxis.js — 数据浏览器·Z轴（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；行数 91245 超引擎阈值，SQL 分页。
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
    { name: "zr_axis", label: "ZR轴", len: 5 },
    { name: "zl_axis", label: "ZL轴", len: 5 },
    { name: "prog_path", label: "加工程序", len: 25 },
    { name: "plan_begin", label: "计划开始", len: 9 },
    { name: "plan_status", label: "计划状态", len: 9 },
    { name: "ld_dir", label: "LdDir", len: 6 },
    { name: "loadin_dir", label: "搬入方向", len: 9 },
    { name: "sch_sheet", label: "SCH SHEET", len: 10 },
    { name: "pro_sheet", label: "PRO SHEET", len: 10 },
    { name: "unpro_sheet", label: "UNPRO SHEET", len: 13 },
    { name: "prg_start_time", label: "PRG START TIME", len: 16 }
  ]
});
