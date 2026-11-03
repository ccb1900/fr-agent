// reports/db_laser_aaa.js — 第一张真库数据报表（DB 路线 A+B 连打）
//
// 形态：模板内置 SQL（kind=sql 数据集）+ 真实 SQL Server 连接（凭据只在本机 spec，cpt 存连接名）
// 数据真源：atom_live_demo.dbo.laser_aaa（激光加工逐点评分流水，122757 行 / 30 个 file_key）
//   业务列全 nvarchar，数值口径在 SQL 里 TRY_CAST 成 decimal/float，交给 FR 出数
// 验收：报表数字必须与同一条 SQL 直查结果逐格核对（_db3 探针口径）

// 合计行样式：灰底加粗、文字左/数字右、外框深内线浅（TABLE_DESIGN_STANDARD）
var TBG = -855310, LIGHT = -16777216; // 内线黑笔：口径同 db_laser_subtotal.js（用户 2026-10-26 下发）
function T(pos, format) {
  return {
    align: format != null ? 4 : 2, bold: true, bg: TBG, format: format || null,
    edges: { top: 'deep', bottom: 'deep', left: pos === 'first' ? 'deep' : LIGHT, right: pos === 'last' ? 'deep' : LIGHT }
  };
}

var SPEC = {
  outName: '激光加工评分日报',
  // 数据连接：runner 启动后注册进 DatasourceManager，NameDatabaseConnection 按名解析
  connections: [{
    name: 'ATOM_LIVE',
    driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    url: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false',
    user: 'sa',
    password: load('D:/fineagent/lib/dbpass.js')
  }],
  IR: {
    // palette.border：title/header/detail 走引擎 edgesOf 预置边框，统一黑笔（headerBg 必须显式给，
    // 否则 P 存在时预置底色会被 undefined 顶掉）；cells 块（合计行）用本文件 T() 的 LIGHT，同为黑
    palette: { border: -16777216, headerBg: -2497805 },
    sheets: [{
      name: 'sheet1',
      widthsPt: [112, 80, 80, 90, 90, 90, 104],
      blocks: [
        { type: 'title', text: '激光加工评分日报', span: 7, heightPt: 30 },
        {
          type: 'header', heightPt: 24,
          columns: [
            { name: 'biz_day', label: '加工日期', type: 'string' },
            { name: 'row_cnt', label: '记录数', type: 'number', format: '#,##0' },
            { name: 'file_cnt', label: '文件数', type: 'number', format: '#,##0' },
            { name: 'avg_score', label: '平均分', type: 'number', format: '#,##0.0000' },
            { name: 'min_score', label: '最低分', type: 'number', format: '#,##0.0000' },
            { name: 'max_score', label: '最高分', type: 'number', format: '#,##0.0000' },
            { name: 'pass_rate', label: '合格占比(%)', type: 'number', format: '#,##0.00' }
          ]
        },
        {
          type: 'detail', dataset: 'ds1', heightPt: 20,
          columns: [
            { name: 'biz_day', label: '加工日期', type: 'string' },
            { name: 'row_cnt', label: '记录数', type: 'number', format: '#,##0' },
            { name: 'file_cnt', label: '文件数', type: 'number', format: '#,##0' },
            { name: 'avg_score', label: '平均分', type: 'number', format: '#,##0.0000' },
            { name: 'min_score', label: '最低分', type: 'number', format: '#,##0.0000' },
            { name: 'max_score', label: '最高分', type: 'number', format: '#,##0.0000' },
            { name: 'pass_rate', label: '合格占比(%)', type: 'number', format: '#,##0.00' }
          ]
        },
        {
          // 合计行走 cells 通用块：逐列落格 = 整行框线齐全（total 块只落 label+汇总格，右侧无框）
          type: 'cells', heightPt: 24,
          items: [
            { c: 0, text: '合计/日均', st: T('first') },
            { c: 1, formula: '=SUM(B3)', st: T('mid', '#,##0') },
            { c: 2, text: '', st: T('mid') },
            { c: 3, formula: '=AVERAGE(D3)', st: T('mid', '#,##0.0000') },
            { c: 4, text: '', st: T('mid') },
            { c: 5, text: '', st: T('mid') },
            { c: 6, text: '', st: T('last') }
          ]
        }
      ]
    }],
    datasets: [{
      name: 'ds1',
      kind: 'sql',
      connection: 'ATOM_LIVE',
      query: "SELECT convert(varchar(10), TRY_CAST(biz_date AS date), 23) AS biz_day," +
        " COUNT(*) AS row_cnt, COUNT(DISTINCT file_key) AS file_cnt," +
        " ROUND(AVG(TRY_CAST(score AS decimal(10,4))), 4) AS avg_score," +
        " ROUND(MIN(TRY_CAST(score AS decimal(10,4))), 4) AS min_score," +
        " ROUND(MAX(TRY_CAST(score AS decimal(10,4))), 4) AS max_score," +
        " ROUND(AVG(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1.0 ELSE 0.0 END) * 100, 2) AS pass_rate" +
        " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
        " GROUP BY TRY_CAST(biz_date AS date) ORDER BY 1"
    }]
  }
};
