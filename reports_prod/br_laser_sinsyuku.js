// br_laser_sinsyuku.js — 数据浏览器·伸缩计测（画像源 DB_LASER_TABLES_PROD.json）
// 自动生成（gen_laser_specs.js）：列名/类型/格式照抄直查画像；行数 1097194 超引擎阈值，SQL 分页。
// 凭据只在本机 spec 的 connections 段。

load(Paths.feature('data_browser', 'browser.js'));

var SPEC = BROWSER.spec({
  outName: BROWSER.env('BR_OUT', '激光数据浏览器_伸缩计测'),
  title: '激光数据浏览器 · 伸缩计测 laser_sinsyuku',
  table: 'laser_sinsyuku',
  selfCpt: 'fineagent/激光数据浏览器_伸缩计测_api.cpt',
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
    { name: "stage", label: "Stage", len: 6, type: 'cent' },
    { name: "biz_date", label: "日期", len: 14 },
    { name: "biz_time", label: "时间", len: 10 },
    { name: "manage_no", label: "管理No.", len: 12, type: 'cent' },
    { name: "serial_no", label: "序列号", len: 7, type: 'code' },
    { name: "stretch_rate_x", label: "伸缩率 X", len: 12, type: 'num', fmt: '#,##0.0000000' },
    { name: "stretch_rate_y", label: "伸缩率 Y", len: 12, type: 'num', fmt: '#,##0.0000000' },
    { name: "main_prog_no", label: "主程序的程序编号", len: 34, type: 'cent' },
    { name: "cond_file", label: "条件文件", len: 13, type: 'cent' },
    { name: "status", label: "状态", len: 5, type: 'cent' },
    { name: "error_msg", label: "错误内容", len: 16, type: 'cent' },
    { name: "offset_x", label: "偏置X", len: 9, type: 'num', fmt: '#,##0.0' },
    { name: "offset_y", label: "偏置Y", len: 9, type: 'num', fmt: '#,##0.0' },
    { name: "theta", label: "θ", len: 8 },
    { name: "status2", label: "状态", len: 5 },
    { name: "manual_work_comp", label: "<manual work comp>", len: 20, type: 'num', fmt: '#,##0' },
    { name: "offset_proc_x", label: "<OFFSET PROC. X>", len: 18, type: 'num', fmt: '#,##0.000' },
    { name: "offset_proc_y", label: "<OFFSET PROC. Y>", len: 18, type: 'num', fmt: '#,##0.000' },
    { name: "restart_status", label: "再开始状态", len: 11 },
    { name: "stop_block", label: "停止程序块", len: 11 },
    { name: "end_block", label: "结束程序块", len: 11, type: 'code' },
    { name: "block_no", label: "区块编号", len: 9 },
    { name: "manual_mode", label: "手动模式", len: 9 },
    { name: "work_comp_type", label: "工件补偿类型", len: 14 },
    { name: "p1x", label: "P1X", len: 4 },
    { name: "p1y", label: "P1Y", len: 4 },
    { name: "p2x", label: "P2X", len: 4 },
    { name: "p2y", label: "P2Y", len: 4 },
    { name: "p3x", label: "P3X", len: 4 },
    { name: "p3y", label: "P3Y", len: 4 },
    { name: "p4x", label: "P4X", len: 4 },
    { name: "p4y", label: "P4Y", len: 4 },
    { name: "p5x", label: "P5X", len: 4 },
    { name: "p5y", label: "P5Y", len: 4 },
    { name: "stretch_set_rate_x", label: "伸缩率/设定率 X", len: 17 },
    { name: "stretch_set_rate_y", label: "伸缩率/设定率 Y", len: 17 },
    { name: "prg_start_time", label: "PRG START TIME", len: 16 },
    { name: "rate_p1_p2", label: "RateP1-P2", len: 10 },
    { name: "rate_p3_p4", label: "RateP3-P4", len: 10 },
    { name: "rate_p2_p3", label: "RateP2-P3", len: 10 },
    { name: "rate_p1_p4", label: "RateP1-P4", len: 10 },
    { name: "rate_p1_p3", label: "RateP1-P3", len: 10 },
    { name: "rate_p2_p4", label: "RateP2-P4", len: 10 }
  ]
});
