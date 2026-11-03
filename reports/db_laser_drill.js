// reports/db_laser_drill.js — 真库第二刀·子模板：按参数 day 钻取当日逐小时评分明细
//
// 参数形态（官方语料 demo/basic/数据钻取子报表订单明细.cpt）：
//   ds1 = DBTableData，自带 Parameter(day, 默认值) + 查询里 ${day} 过滤；母版日期格用 =$$$ 把当前格值传进来
//   （实测：${} 只在 SQL 里替换，单元格公式里不替换 → 日期改由数据集列直出，不玩公式回显）
// 数据真源：atom_live_demo.dbo.laser_aaa；逐小时真值 = db_laser_sub_truth.txt ## drill_2026-09-13_hourly
// 默认值 2026-09-13：headless 出图不传参也能渲染，且与真值段同口径可逐格核对

var LIGHT = -16777216, HEADBG = -263173, SUBBG = -855310; // 内线黑笔：口径同母版 db_laser_subtotal.js

function HD() {
  return { bold: true, align: 0, bg: HEADBG, edges: { top: 'deep', bottom: 'deep', left: LIGHT, right: LIGHT } };
}
function TX() { return { align: 2, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } }; }
function NM(fmt) { return { align: 4, format: fmt, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } }; }
function SM(fmt, first, last) {
  return { align: fmt == null ? 2 : 4, bold: true, bg: SUBBG, format: fmt || null,
    edges: { top: 'deep', bottom: 'deep', left: first ? 'deep' : LIGHT, right: last ? 'deep' : LIGHT } };
}

var SPEC = {
  outName: '激光加工评分日报_逐时钻取',
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
      widthsPt: [116, 56, 86, 100, 128, 82, 112, 82],
      // A4 横向 + 每页重复标题/表头（列宽行高按母版同一实测口径排，见 db_laser_subtotal.js 头注）
      paper: { width: 10692000, height: 7560000, top: 228600, left: 342900, bottom: 228600, right: 342900 },
      pageRepeat: { from: 0, to: 1 },
      blocks: [
        {
          type: 'cells', heightPt: 40,
          items: [{
            c: 0, span: 8, text: '激光加工评分 · 当日逐小时明细', st: {
              bold: true, sizePt: 14, align: 0, edges: { top: 'deep', bottom: 'deep', left: 'deep', right: 'deep' }
            }
          }]
        },
        {
          type: 'cells', heightPt: 34,
          items: [
            { c: 0, text: '加工日期', st: HD() },
            { c: 1, text: '小时', st: HD() },
            { c: 2, text: '记录数', st: HD() },
            { c: 3, text: '合格点数', st: HD() },
            { c: 4, text: '评分合计', st: HD() },
            { c: 5, text: '平均分', st: HD() },
            { c: 6, text: '合格率(%)', st: HD() },
            { c: 7, text: '最高分', st: HD() }
          ]
        },
        // 明细行（模型 index 2 → 公式引用行号 3）
        {
          type: 'cells', heightPt: 30, dataset: 'ds1',
          items: [
            { c: 0, ds: { column: 'biz_day' }, st: TX() },
            { c: 1, ds: { column: 'hh' }, st: TX() },
            { c: 2, ds: { column: 'row_cnt' }, st: NM('#,##0') },
            { c: 3, ds: { column: 'pass_cnt' }, st: NM('#,##0') },
            { c: 4, ds: { column: 'score_sum' }, st: NM('#,##0.000') },
            { c: 5, formula: '=E3 / C3', st: NM('#,##0.0000') },
            { c: 6, formula: '=D3 * 100 / C3', st: NM('#,##0.00') },
            { c: 7, ds: { column: 'max_score' }, st: NM('#,##0.0000') }
          ]
        },
        // 当日合计（静态行：无左父绑定，不随分组扩展，只出一次；模型 index 3 → 行号 4）
        {
          type: 'cells', heightPt: 36,
          items: [
            { c: 0, text: '当日合计', st: SM(null, true, false) },
            { c: 1, text: '', st: SM(null, false, false) },
            { c: 2, formula: '=SUM(C3)', st: SM('#,##0') },
            { c: 3, formula: '=SUM(D3)', st: SM('#,##0') },
            { c: 4, formula: '=SUM(E3)', st: SM('#,##0.000') },
            { c: 5, formula: '=E4 / C4', st: SM('#,##0.0000') },
            { c: 6, formula: '=D4 * 100 / C4', st: SM('#,##0.00') },
            { c: 7, formula: '=MAX(H3)', st: SM('#,##0.0000', false, true) }
          ]
        },
        { type: 'space', heightPt: 12 },
        {
          type: 'cells', heightPt: 46,
          items: [{
            c: 0, span: 8, text: '本表由母版"加工日期"格钻取带入参数 day（SQL 里 ${day} 过滤）；小时取 biz_time 前两位；' +
              '平均分 = 评分合计 / 记录数，合格率 = 合格点数 / 记录数，口径同母版。',
            st: { align: 2, sizePt: 8 }
          }]
        }
      ]
    }],
    datasets: [{
      name: 'ds1',
      kind: 'sql',
      connection: 'ATOM_LIVE',
      params: [{ name: 'day', value: '2026-09-13' }],
      query: "SELECT convert(varchar(10), TRY_CAST(biz_date AS date), 23) AS biz_day, left(biz_time, 2) AS hh," +
        " COUNT(*) AS row_cnt," +
        " SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1 ELSE 0 END) AS pass_cnt," +
        " ROUND(SUM(TRY_CAST(score AS decimal(18,6))), 6) AS score_sum," +
        " ROUND(MAX(TRY_CAST(score AS decimal(10,4))), 4) AS max_score" +
        " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
        " AND convert(varchar(10), TRY_CAST(biz_date AS date), 23) = '${day}'" +
        " GROUP BY convert(varchar(10), TRY_CAST(biz_date AS date), 23), left(biz_time, 2) ORDER BY 1, 2"
    }]
  }
};
