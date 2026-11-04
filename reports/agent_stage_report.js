// reports/agent_stage_report.js — 报表创作 Agent 自撰：激光生产日报（按工序 stage 汇总）
//
// 需求：区间 2026-09-13～2026-09-22，列 = 工序 | 计划数 | 完成数 | 完成率(%) | 平均分，含"总计"行。
// 数据真源：atom_live_demo.dbo.laser_aaa（kind=sql 模板内置 SQL，连接名 ATOM_LIVE，
//   凭据只在本 spec.connections 段 → lib/dbpass.js 本机加载，cpt 不落凭据）
// 真值交叉：data/db_laser_sub_truth.txt（同口径 SQL 直查三段真值；grand_total 计划 33531 / 完成 26531，
//   按天×工序明细相加 L=16761/12611、R=16770/13920，两工序合计必须与 grand_total 逐字一致）
// 口径：计划数=有效评分记录数 COUNT(*)（score 可 TRY_CAST float）；完成数=score>=0.9 记录数；
//   完成率=完成/计划×100；平均分=SUM(score)/COUNT(*)（全加权，README 均值口径坑：禁用"平均值的平均"）。
// 脏数据防御：biz_date 混 '2026/9/14' 与 '2026-9-13' 两种格式，TRY_CAST(biz_date AS date) 规范化后
//   BETWEEN '2026-09-13' AND '2026-09-22' 字面量筛除（AGENTS §3：禁 ${} 文本替换）。
// 形态学习：cells+SQL+公式（v3.4/v3.5，同 db_laser_subtotal.js / agent_daily_report.js 已验证语料）；
//   总计行静态落在扩展明细之后 =SUM(B3)；完成率 =C4*100/B4（自格引用，语料已证）。
// 总计平均分（全加权）实测教训（2026-11-04 execute 炸点）：本嵌入引擎无 SUMPRODUCT
//   （com.fr.stable.InterpreterError: no function found: SUMPRODUCT；jar 考古仅 POI 内部类含此名），
//   改走官方"独立聚合单元格"形态（rebuild_basicA 已证：ds.summary=SUM + noExpand）：
//   绑定单行聚合数据集 ds2.total_avg = ROUND(AVG(score),6)（全区间全加权，真值 0.948809）。

var LIGHT = -16777216;  // 内外线全黑（2026-10-27 口径，语料同规）
var DEEP = -16777216;
var HEADBG = -263173;   // 表头淡灰底
var TOTBG = -855310;    // 总计行淡灰底

function HD() { // 表头：加粗居中、上下深线、淡灰底
  return { bold: true, align: 0, bg: HEADBG, edges: { top: 'deep', bottom: 'deep', left: LIGHT, right: LIGHT } };
}
function TX() { // 明细文字格：左对齐、四边内线
  return { align: 2, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } };
}
function NM(fmt) { // 明细数字格：右对齐 + 千分位
  return { align: 4, format: fmt, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } };
}
function TOT(fmt, first, last) { // 总计格：加粗灰底（first/last 决定外框）
  return { align: fmt == null ? 2 : 4, bold: true, bg: TOTBG, format: fmt || null,
    edges: { top: 'deep', bottom: 'deep', left: first ? 'deep' : LIGHT, right: last ? 'deep' : LIGHT } };
}

var SPEC = {
  outName: '激光生产日报_工序汇总_自撰',
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
      // 列宽反算 + PNG 像素实证（2026-11-04 三轮渲染修正）：数字 6 字形+留白 ~120pt（基线 144pt 容
      //   "26,420" 加粗为参照）；表头粗体实测 ~28.5pt/字形：完成率(%)=7 字形+留白 → 240 才单行；
      //   总宽 760pt，导出 0.667px/pt 下 507px，页面单页内（同基线形态，不设自定义纸）
      widthsPt: [100, 140, 140, 240, 140],
      blocks: [
        // r0 标题（span5，全深框，sizePt 14；实测全角 ≈59pt/字，10 字 ≈590 ≤ 表宽 720 单行）
        { type: 'cells', heightPt: 44, items: [
          { c: 0, span: 5, text: '激光生产日报·工序汇总', st: {
              bold: true, sizePt: 14, align: 0,
              edges: { top: 'deep', bottom: 'deep', left: 'deep', right: 'deep' }
            } }
        ] },
        // r1 表头 5 列
        { type: 'cells', heightPt: 34, items: [
          { c: 0, text: '工序', st: HD() },
          { c: 1, text: '计划数', st: HD() },
          { c: 2, text: '完成数', st: HD() },
          { c: 3, text: '完成率(%)', st: HD() },
          { c: 4, text: '平均分', st: HD() }
        ] },
        // r2 明细：ds1 按 stage 聚合（2 行 L/R）；D 列公式 =完成/计划×100（同语料已验证自格引用）
        { type: 'cells', heightPt: 30, dataset: 'ds1', items: [
          { c: 0, ds: { column: 'stage' }, st: TX() },
          { c: 1, ds: { column: 'plan_cnt' }, st: NM('#,##0') },
          { c: 2, ds: { column: 'done_cnt' }, st: NM('#,##0') },
          { c: 3, formula: '=C3 * 100 / B3', st: NM('#,##0.00') },
          { c: 4, ds: { column: 'avg_score' }, st: NM('#,##0.0000') }
        ] },
        // r3 总计（静态行落在扩展明细之后）：计划/完成 =SUM 沿左父链吃全部明细实例（FR 引擎汇总）；
        // 平均分 = 独立聚合格绑 ds2（单行全区间加权 AVG，summary+noExpand 官方形态）
        { type: 'cells', heightPt: 36, items: [
          { c: 0, text: '总计', st: TOT(null, true, false) },
          { c: 1, formula: '=SUM(B3)', st: TOT('#,##0') },
          { c: 2, formula: '=SUM(C3)', st: TOT('#,##0') },
          { c: 3, formula: '=C4 * 100 / B4', st: TOT('#,##0.00') },
          { c: 4, ds: { ds: 'ds2', column: 'total_avg', summary: 'SUM', noExpand: true },
            st: TOT('#,##0.0000', false, true) }
        ] },
        { type: 'space', heightPt: 10 },
        // 尾注口径说明（口径写在报表上，读表人不必猜；sizePt 8 实测 ~3 行，行高 64 容多行不裁切）
        { type: 'cells', heightPt: 64, items: [
          { c: 0, span: 5, text: '口径：计划数=区间内有效评分记录数（score 可数值化）；完成数=评分≥0.9 记录数；完成率=完成/计划×100；' +
              '平均分=评分合计/记录数（全加权）。数据区间 2026-09-13～2026-09-22。', st: { align: 2, sizePt: 8 } }
        ] }
      ]
    }],
    datasets: [{
      name: 'ds1',
      kind: 'sql',
      connection: 'ATOM_LIVE',
      query: "SELECT stage," +
        " COUNT(*) AS plan_cnt," +
        " SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1 ELSE 0 END) AS done_cnt," +
        " ROUND(AVG(TRY_CAST(score AS decimal(18,6))), 6) AS avg_score" +
        " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
        " AND TRY_CAST(biz_date AS date) BETWEEN '2026-09-13' AND '2026-09-22'" +
        " GROUP BY stage ORDER BY 1"
    }, {
      // ds2：全区间单行加权平均（总计行平均分专用；口径 =SUM(score)/COUNT(*) 的 SQL 直算，
      //   真值 grand_total 0.948809；明细两行平均分加权还原亦此值）
      name: 'ds2',
      kind: 'sql',
      connection: 'ATOM_LIVE',
      query: "SELECT ROUND(AVG(TRY_CAST(score AS decimal(18,6))), 6) AS total_avg" +
        " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
        " AND TRY_CAST(biz_date AS date) BETWEEN '2026-09-13' AND '2026-09-22'"
    }]
  }
};
