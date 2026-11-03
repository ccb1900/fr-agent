// br_laser_proc_state.js — 数据浏览器·工序状态（画像源 db_laser_tables.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；统一 SQL 分页口径（全库统一导航/面板交互）。
// 凭据只在本机 spec 的 connections 段。

load('D:/fineagent/lib/browser.js');

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_工序状态'),
  title: '激光数据浏览器 · 工序状态 laser_proc_state',
  table: 'laser_proc_state',
  selfCpt: 'fineagent/激光数据浏览器_工序状态_api.cpt',
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
    { name: "stage", label: "Stage", len: 6, type: 'cent' },
    { name: "prg_filename", label: "PRG. FILENAME", len: 41 },
    { name: "cond_file", label: "条件文件", len: 30 },
    { name: "start_time", label: "START.TIME", len: 12 },
    { name: "end_time", label: "END.TIME", len: 12 },
    { name: "proc_time", label: "PROC.TIME", len: 10, type: 'num', fmt: '#,##0' },
    { name: "end_block", label: "END.BLOCK", len: 10, type: 'code' },
    { name: "via_hole", label: "VIA.HOLE", len: 10, type: 'num', fmt: '#,##0' },
    { name: "utility_hole", label: "UTILITY.HOLE", len: 14, type: 'num', fmt: '#,##0' },
    { name: "proc_hole_r", label: "PROC.HOLE.R", len: 13, type: 'num', fmt: '#,##0' },
    { name: "proc_hole_l", label: "PROC.HOLE.L", len: 13, type: 'num', fmt: '#,##0' },
    { name: "total_proc_hole_r", label: "TOTAL.PROC.HOLE.R", len: 19, type: 'num', fmt: '#,##0' },
    { name: "total_proc_hole_l", label: "TOTAL.PROC.HOLE.L", len: 19, type: 'num', fmt: '#,##0' },
    { name: "total_shot", label: "TOTAL.SHOT", len: 18, type: 'num', fmt: '#,##0' }
  ]
});
