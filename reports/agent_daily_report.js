// reports/agent_daily_report.js — 迭代 3 真实业务报表（ZCode 作者首份·生产日报：计划/完成/完成率）
// 真源：atom_live_demo.dbo.laser_aaa（SQL 数据集，连接名 ATOM_LIVE，凭据只在 spec→lib/dbpass.js）
// 真值：data/db_laser_aaa_truth.txt（逐日 row_cnt=计划、pass_rate=完成率）；合计与 db_laser_sub_truth.txt grand_total 交叉
// 口径：计划=当日有效评分记录数 COUNT(*)；完成=score>=0.9 记录数；完成率(%)=完成/计划×100
// 版式走已验证 cells+SQL+公式形态（v3.4/v3.5）。日期范围按语料口径烤成字面量（AGENTS §3：`${}` 是文本替换不安全，
//   运行期交互筛选是浏览器族 br_* 的既定专责，README #38–44，本独立报表不重造该轮子）。
var LIGHT = -16777216, DEEP = -16777216, HEADBG = -263173, TOTBG = -855310;
function HD() { return { bold: true, align: 0, bg: HEADBG, edges: { top: 'deep', bottom: 'deep', left: LIGHT, right: LIGHT } }; }
function TX() { return { align: 2, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } }; }
function NM(f) { return { align: 4, format: f, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } }; }
function TOT(f, first, last) { return { align: f == null ? 2 : 4, bold: true, bg: TOTBG, format: f || null, edges: { top: 'deep', bottom: 'deep', left: first ? 'deep' : LIGHT, right: last ? 'deep' : LIGHT } }; }

var SPEC = {
  outName: '激光生产日报_计划完成_自撰',
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
      widthsPt: [130, 96, 96, 118],
      blocks: [
        { type: 'cells', heightPt: 44, items: [
          { c: 0, span: 4, text: '激光生产日报（计划 / 完成 / 完成率）', st: { bold: true, sizePt: 14, align: 0, edges: { top: 'deep', bottom: 'deep', left: 'deep', right: 'deep' } } }
        ] },
        { type: 'cells', heightPt: 34, items: [
          { c: 0, text: '加工日期', st: HD() },
          { c: 1, text: '计划数', st: HD() },
          { c: 2, text: '完成数', st: HD() },
          { c: 3, text: '完成率(%)', st: HD() }
        ] },
        // r2 明细：ds1 逐日聚合；D 列公式 =完成/计划×100
        { type: 'cells', heightPt: 30, dataset: 'ds1', items: [
          { c: 0, ds: { column: 'biz_day' }, st: TX() },
          { c: 1, ds: { column: 'plan_cnt' }, st: NM('#,##0') },
          { c: 2, ds: { column: 'done_cnt' }, st: NM('#,##0') },
          { c: 3, formula: '=C3 * 100 / B3', st: NM('#,##0.00') }
        ] },
        // r3 总计（静态行落在扩展明细之后）
        { type: 'cells', heightPt: 36, items: [
          { c: 0, text: '总计', st: TOT(null, true, false) },
          { c: 1, formula: '=SUM(B3)', st: TOT('#,##0') },
          { c: 2, formula: '=SUM(C3)', st: TOT('#,##0') },
          { c: 3, formula: '=C4 * 100 / B4', st: TOT('#,##0.00', false, true) }
        ] },
        { type: 'space', heightPt: 10 },
        { type: 'cells', heightPt: 24, items: [
          { c: 0, span: 4, text: '口径：计划=当日有效评分记录数；完成=评分≥0.9 的记录数；完成率=完成/计划×100。数据区间 2026-09-13～2026-09-22。', st: { align: 2, sizePt: 8 } }
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

