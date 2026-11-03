// br_laser_table.js — 数据浏览器·平台数据（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；行数 124451 超引擎阈值，SQL 分页。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_平台数据'),
  title: '激光数据浏览器 · 平台数据 laser_table',
  table: 'laser_table',
  selfCpt: 'fineagent/激光数据浏览器_平台数据_api.cpt',
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
    { name: "rz_mm", label: "RZ(mm)", len: 9, type: 'num', fmt: '#,##0.0000' },
    { name: "rx_mm", label: "RX(mm)", len: 10, type: 'num', fmt: '#,##0.0000' },
    { name: "ry_mm", label: "RY(mm)", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "lz_mm", label: "LZ(mm)", len: 9, type: 'num', fmt: '#,##0.0000' },
    { name: "lx_mm", label: "LX(mm)", len: 10, type: 'num', fmt: '#,##0.0000' },
    { name: "ly_mm", label: "LY(mm)", len: 11, type: 'num', fmt: '#,##0.0000' },
    { name: "rz_ave", label: "RZ-ave", len: 9, type: 'num', fmt: '#,##0.0000' },
    { name: "lz_ave", label: "LZ-ave", len: 9, type: 'num', fmt: '#,##0.0000' },
    { name: "rz_range", label: "RZ-range", len: 9, type: 'num', fmt: '#,##0.0000' },
    { name: "lz_range", label: "LZ-range", len: 9, type: 'num', fmt: '#,##0.0000' },
    { name: "prog_path", label: "加工程序", len: 44 },
    { name: "rzax_mm", label: "RZax(mm)", len: 9 },
    { name: "lzax_mm", label: "LZax(mm)", len: 9 },
    { name: "base_wk_mm", label: "BASEwk(mm)", len: 11 },
    { name: "ref_wk_pct", label: "REFwk(%)", len: 9 },
    { name: "rz_wk_mm", label: "RZwk(mm)", len: 9 },
    { name: "lz_wk_mm", label: "LZwk(mm)", len: 9 },
    { name: "prg_start_time", label: "PRG START TIME", len: 16 }
  ]
});
