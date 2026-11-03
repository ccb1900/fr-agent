// reports/db_laser_subtotal.js — 真库第二刀·母版：day×stage 明细 + 逐日小计 + 全表总计 + 日期钻取链
//
// 数据真源：atom_live_demo.dbo.laser_aaa（模板内置 SQL，连接名 ATOM_LIVE，凭据只在本 spec）
// 逐格真值：D:/fineagent/data/db_laser_sub_truth.txt（probe_dbtruth2.js 直查同一条 SQL 落的三段真值）
// 组版词汇：v3.4 cells 通用块（左父绑定小计）+ v3.5 kind=sql 数据集 + v3.6 linkTo.params 钻取传参
// 口径纪律：平均分 = 评分合计/记录数（加权），不做"平均值的平均"；合格率 = 合格点数/记录数
// 钻取：日期格 =$$$ 把当前格值传给子报表参数 day（官方语料 demo/basic/数据钻取主报表.cpt）

var LIGHT = -16777216;  // 数据区内线：用户口径（本轮起）内边框也用黑笔，覆盖标准文档"内线浅灰"
var DEEP = -16777216;   // 外框/合计线深黑
var HEADBG = -263173;   // 表头淡灰底
var SUBBG = -855310;    // 小计/总计淡灰底（与第一张 DB 报表合计行同色）
// 实测（sub.png 像素扫描）：导出 0.667 px/pt，列宽按请求值逐列命中；但 sizePt 经引擎 ×4 灌进 FR size，
// 渲染视觉字号约为标称 2 倍（10.5 标称 → 数字宽 ≈11pt、汉字宽 ≈21pt）。列宽/行高按此实测值排，不做引擎换算
// （改换算会动到 demo_api.cpt 与 basicA 两条基线路径）。

function HD() { // 表头：加粗居中、上下深线、淡灰底
  return { bold: true, align: 0, bg: HEADBG, edges: { top: 'deep', bottom: 'deep', left: LIGHT, right: LIGHT } };
}
function TX() { // 明细文字格：左对齐、内线浅
  return { align: 2, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } };
}
function NM(fmt) { // 明细数字格：右对齐 + 千分位
  return { align: 4, format: fmt, edges: { top: LIGHT, bottom: LIGHT, left: LIGHT, right: LIGHT } };
}
function SM(fmt, first, last) { // 小计/总计格：加粗灰底（first/last 决定左右是否吃外框）
  // 内线改黑后，FR"按行后画覆盖共享边"导致的上深下浅不再显形（两侧同色），无需再分 deep/light 两档
  return { align: fmt == null ? 2 : 4, bold: true, bg: SUBBG, format: fmt || null,
    edges: { top: 'deep', bottom: 'deep', left: first ? 'deep' : LIGHT, right: last ? 'deep' : LIGHT } };
}

var DETAIL_ROW = 2; // 明细行模型行 index（第 3 行）；公式引用行号 = index+1 = 3

var SPEC = {
  outName: '激光加工评分日报_工序明细小计',
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
      // sub.png 实测：74/112/96 时 总计 33,531、31,814.517 与表头 合格率(%) 折行，逐列加宽到 86/128/112
      widthsPt: [116, 56, 86, 100, 128, 82, 112, 82],
      // A4 横向（EMU 直灌：842×595pt）：纸宽 842 - 左右边距 54 = 可印 788pt，表宽 762pt 落在单页内
      paper: { width: 10692000, height: 7560000, top: 228600, left: 342900, bottom: 228600, right: 342900 },
      // 每页重复标题条带 + 表头（v3.4 页头重复能力，跨页可读）
      pageRepeat: { from: 0, to: 1 },
      blocks: [
        // r0 标题（span8，全深框）
        {
          type: 'cells', heightPt: 44,
          items: [{
            c: 0, span: 8, text: '激光加工评分日报（工序明细 · 逐日小计）', st: {
              bold: true, sizePt: 14, align: 0, edges: { top: 'deep', bottom: 'deep', left: 'deep', right: 'deep' }
            }
          }]
        },
        // r1 表头 8 列
        {
          type: 'cells', heightPt: 34,
          items: [
            { c: 0, text: '加工日期', st: HD() },
            { c: 1, text: '工序', st: HD() },
            { c: 2, text: '记录数', st: HD() },
            { c: 3, text: '合格点数', st: HD() },
            { c: 4, text: '评分合计', st: HD() },
            { c: 5, text: '平均分', st: HD() },
            { c: 6, text: '合格率(%)', st: HD() },
            { c: 7, text: '最高分', st: HD() }
          ]
        },
        // r2 明细行（ds1 = 模板内置 SQL，day×stage 20 行）：日期格挂钻取链（=$$$ 传值给子报表 day）
        {
          type: 'cells', heightPt: 30, dataset: 'ds1',
          items: [
            { c: 0, ds: { column: 'biz_day' }, st: TX(),
              linkTo: {
                reportlet: 'fineagent/激光加工评分日报_逐时钻取_api.cpt', name: '逐时钻取',
                targetFrame: '_self', extendParameters: true, width: 1000, height: 640,
                params: [{ name: 'day', formula: '=$$$' }]
              } },
            { c: 1, ds: { column: 'stage' }, st: TX() },
            { c: 2, ds: { column: 'row_cnt' }, st: NM('#,##0') },
            { c: 3, ds: { column: 'pass_cnt' }, st: NM('#,##0') },
            { c: 4, ds: { column: 'score_sum' }, st: NM('#,##0.000') },
            { c: 5, formula: '=E3 / C3', st: NM('#,##0.0000') },
            { c: 6, formula: '=D3 * 100 / C3', st: NM('#,##0.00') },
            { c: 7, ds: { column: 'max_score' }, st: NM('#,##0.0000') }
          ]
        },
        // r3 逐日小计（左父 = 明细行日期格 A3，随日期分组扩展；首公式格显式 dir=0，其余默认传播——v3.4 basicA 实证形态）
        {
          type: 'cells', heightPt: 36,
          items: [
            { c: 0, text: '', st: SM(null, true, false) },
            { c: 1, text: '小计', st: SM(null, false, false), expand: { leftRow: DETAIL_ROW } },
            { c: 2, formula: '=SUM(C3)', st: SM('#,##0'), expand: { dir: 0, leftRow: DETAIL_ROW } },
            { c: 3, formula: '=SUM(D3)', st: SM('#,##0') },
            { c: 4, formula: '=SUM(E3)', st: SM('#,##0.000') },
            { c: 5, formula: '=E4 / C4', st: SM('#,##0.0000') },
            { c: 6, formula: '=D4 * 100 / C4', st: SM('#,##0.00') },
            { c: 7, formula: '=MAX(H3)', st: SM('#,##0.0000', false, true) }
          ]
        },
        // r4 全表总计（静态行落在扩展行之后 = 报表底部只出一次；口径：明细格全展开求和）
        {
          type: 'cells', heightPt: 36,
          items: [
            { c: 0, text: '', st: SM(null, true, false) },
            { c: 1, text: '总计', st: SM(null, false, false) },
            { c: 2, formula: '=SUM(C3)', st: SM('#,##0') },
            { c: 3, formula: '=SUM(D3)', st: SM('#,##0') },
            { c: 4, formula: '=SUM(E3)', st: SM('#,##0.000') },
            { c: 5, formula: '=E5 / C5', st: SM('#,##0.0000') },
            { c: 6, formula: '=D5 * 100 / C5', st: SM('#,##0.00') },
            { c: 7, formula: '=MAX(H3)', st: SM('#,##0.0000', false, true) }
          ]
        },
        { type: 'space', heightPt: 12 },
        // 尾注口径说明（口径写在报表上，读表人不必猜）
        {
          type: 'cells', heightPt: 46,
          items: [{
            c: 0, span: 8, text: '口径：平均分 = 评分合计 / 记录数（逐点加权，非各工序平均值的平均）；合格率 = 合格点数(score≥0.9) / 记录数；' +
              '小计 = 当日两工序合并；点击"加工日期"钻取当日逐小时明细。', st: { align: 2, sizePt: 8 }
          }]
        }
      ]
    }],
    datasets: [{
      name: 'ds1',
      kind: 'sql',
      connection: 'ATOM_LIVE',
      query: "SELECT convert(varchar(10), TRY_CAST(biz_date AS date), 23) AS biz_day, stage," +
        " COUNT(*) AS row_cnt," +
        " SUM(CASE WHEN TRY_CAST(score AS float) >= 0.9 THEN 1 ELSE 0 END) AS pass_cnt," +
        " ROUND(SUM(TRY_CAST(score AS decimal(18,6))), 6) AS score_sum," +
        " ROUND(MIN(TRY_CAST(score AS decimal(10,4))), 4) AS min_score," +
        " ROUND(MAX(TRY_CAST(score AS decimal(10,4))), 4) AS max_score" +
        " FROM laser_aaa WHERE TRY_CAST(score AS float) IS NOT NULL" +
        " GROUP BY TRY_CAST(biz_date AS date), stage ORDER BY 1, 2"
    }]
  }
};
