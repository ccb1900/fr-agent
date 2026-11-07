// reports/s3_daily.js — 阶段3 第二阶段载体：生产日报（从零创建，任务①）
// 真源：atom_live_demo.dbo.laser_aaa（SQL 数据集，连接名 ATOM_LIVE，凭据只走 lib/dbpass.js，只读 SELECT）
// 口径（沿用 agent_daily_report.js 已验证口径）：计划=当日有效评分记录数；完成=评分>=0.9 记录数
// 结构（为 ②⑤⑦ 留真实修改面）：D 列创建时为静态占位「-」，任务② 升级为完成率统计指标列（表头+明细公式+总计公式）
var LIGHT = -16777216, HEADBG = -263173, TOTBG = -855310;
function HD() { return { bold: true, align: 0, bg: HEADBG, edges: { top: 'deep', bottom: 'deep', left: LIGHT, right: LIGHT } }; }
function TX() { return { align: 2, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } }; }
function NM(f) { return { align: 4, format: f, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } }; }
function TOT(f, first, last) { return { align: f == null ? 2 : 4, bold: true, bg: TOTBG, format: f || null, edges: { top: 'deep', bottom: 'deep', left: first ? 'deep' : LIGHT, right: last ? 'deep' : LIGHT } }; }

var SPEC = {
  outName: '生产日报_阶段3',
  connections: [{
    name: 'ATOM_LIVE',
    driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    url: 'jdbc:sqlserver://127.0.0.1:1433;databaseName=atom_live_demo;encrypt=false',
    user: 'sa',
    password: load('D:/fineagent/lib/dbpass.js')
  }],
  IR: {
    sheets: [{
      name: 'sheet1',
      widthsPt: [130, 96, 96, 110],
      blocks: [
        { type: 'cells', heightPt: 44, items: [
          { c: 0, span: 4, text: '生产日报（计划 / 完成）', st: { bold: true, sizePt: 14, align: 0, edges: { top: 'deep', bottom: 'deep', left: 'deep', right: 'deep' } } }
        ] },
        { type: 'cells', heightPt: 34, items: [
          { c: 0, text: '加工日期', st: HD() },
          { c: 1, text: '计划数', st: HD() },
          { c: 2, text: '完成数', st: HD() },
          { c: 3, text: '备注', st: HD() }
        ] },
        { type: 'cells', heightPt: 30, dataset: 'ds1', items: [
          { c: 0, ds: { column: 'biz_day' }, st: TX() },
          { c: 1, ds: { column: 'plan_cnt' }, st: NM('#,##0') },
          { c: 2, ds: { column: 'done_cnt' }, st: NM('#,##0') },
          { c: 3, text: '-', st: TX() }
        ] },
        { type: 'cells', heightPt: 36, items: [
          { c: 0, text: '总计', st: TOT(null, true, false) },
          { c: 1, formula: '=SUM(B3)', st: TOT('#,##0') },
          { c: 2, formula: '=SUM(C3)', st: TOT('#,##0') },
          { c: 3, text: '-', st: TOT(null, false, true) }
        ] },
        { type: 'space', heightPt: 10 },
        { type: 'cells', heightPt: 24, items: [
          { c: 0, span: 4, text: '口径：计划=当日有效评分记录数；完成=评分>=0.9 的记录数。数据区间 2026-09-13～2026-09-22。', st: { align: 2, sizePt: 8 } }
        ] }
      ]
    }],
    datasets: [{
      name: 'ds1', kind: 'sql', connection: 'ATOM_LIVE',
      query: "SELECT convert(varchar(10), TRY_CAST(biz_date AS date), 23) AS biz_day," +
        " COUNT(*) AS plan_cnt," +
        " SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1 ELSE 0 END) AS done_cnt" +
        " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
        " AND TRY_CAST(biz_date AS date) BETWEEN '2026-09-13' AND '2026-09-22'" +
        " GROUP BY TRY_CAST(biz_date AS date) ORDER BY 1"
    }]
  }
};
