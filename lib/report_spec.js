// lib/report_spec.js — I1（r2.md）ReportSpec 词汇与能力边界（纯数据，零运行时依赖，可离线单测）
//
// ReportSpec = 用户/Agent 表达"要什么报表"的受约束 JSON（dimensions/metrics/filters/table），
//   与 ReportIR（FineReport 可执行中间表示，lib/ir.js）生命周期不同层，绝不混用（r2 §1.2）。
//   本文件只放"契约词汇 + 能力名册"，校验在 spec_validator.js、编译在 spec_compiler.js——三职责分离。
//
// 编码风格红线（与 ir.js/object.js 一致，Nashorn ES5）：全 var + function 声明；
//   白名单查表用 Object.prototype.hasOwnProperty.call（无 includes）；无箭头/模板串/Object.assign。
var ReportSpec = (function () {
  var SPEC_VERSION = '1';

  // v1 聚合词汇：sum-only（用户拍板最小闭环）。其余聚合是"扩展位"——validate 明确拒 UNSUPPORTED，
  //   不是静默忽略（ir.js #48 铁律：后端会静默丢弃的意图，前置到拒）。ratio/count/avg… 待 I3 语义层落地再开。
  var AGGREGATIONS = { sum: 1 };
  var AGG_UNIMPLEMENTED = { avg: 1, average: 1, count: 1, min: 1, max: 1, ratio_of_sums: 1 };

  // 列 dataType 词表 = 复用 ir.js embedded 数据集列型（一处真相，避免第二套类型语言）
  //   metric 默认 number；dimension 恒 text（维度是分组键，非数值）。
  var COLUMN_TYPES = { text: 1, number: 1, integer: 1, long: 1, float: 1, decimal: 1 };

  // presentation.type：v1 只 'table'（chart/kpi 等 = r2 I4/I5 面，此处不建）。
  var PRESENTATION_TYPES = { table: 1 };

  // I5：数据集两种形态。rows=内嵌（v1，sum-only 列求和）；sql=模型驱动（语义 ReportSpec 引用
  //   model 实体/维度/指标名，由 semantic/query/sqlbuilder 生成受控 SQL——非自由文本，凭据只在 runner 本地）。
  var DATASET_KINDS = { rows: 1, sql: 1 };

  // v1 明确拒绝的能力键（存在即报 UNSUPPORTED_CAPABILITY，指向应接管的迭代）
  var REJECTED = {
    filters: 'I5 日期范围筛选已接（dateRange）；非日期 filters 也已接（sql 路 dataset.filters，受控字面量）',
    chart: '顶层 chart 键仍拒；sql 路用 presentation.chart{kind,category|value 或 x|y} 编译（bar|pie|line|Van 族）',
    semanticQuery: 'I5 已接 model-driven SQL（dataset.kind=sql）；自由文本 query 仍拒（§5.2 SQL 范围约束）',
    multiSheet: 'rows 路 extraSheets[]（name 唯一、追加 sheet+独立数据集；planner 已透传）；SQL 作为 extra 后续批'
  };

  return {
    SPEC_VERSION: SPEC_VERSION,
    AGGREGATIONS: AGGREGATIONS,
    AGG_UNIMPLEMENTED: AGG_UNIMPLEMENTED,
    COLUMN_TYPES: COLUMN_TYPES,
    PRESENTATION_TYPES: PRESENTATION_TYPES,
    DATASET_KINDS: DATASET_KINDS,
    REJECTED: REJECTED,
    // 机器读能力清单（Ir.capabilities() 同形：Agent 据此收边界，不靠猜）——I1.1 按数据集种类分列，
    //   与实际 compiler/validator 一字对齐；只读接口，Agent 不应据过时文案误判图表/筛选/JOIN 不支持。
    capabilities: function () {
      return {
        specVersion: SPEC_VERSION,
        datasets: {
          rows: {
            aggregation: ['sum'],
            presentation: ['table(+showTotal)', 'conditions', 'cells', 'total{label,sumCols,aggregate(fn=sum|avg|count|min|max|ratio)}', 'footnote'],
            params: ['控件族 13 kind', 'params[].filter 执行期筛选（rows 路，单条；agentAvailable=false——默认参数值过滤已验证，Web 交互改参重查询/plan→create 未验证）'],
            sheet: ['headerFooter', 'floats', 'paper', 'watermark', 'toolbar', 'hideRows/hideCols'],
            chart: { supported: ['bar', 'pie', 'line', 'vbar', 'vline', 'varea', 'vscatter', 'vbubble', 'vpie', 'vgauge', 'vmap', 'vheatmap'], note: 'category=维度 field、value=度量 field（内嵌 rows 数据集列名）' }, filters: 'unsupported', sort: 'unsupported', topN: 'unsupported', join: 'unsupported',
            note: '内嵌数据、纯列求和；I1 v1 基线，sales_demo.json≡sales_demo.js'
          },
          sql: {
            aggregation: '由 Semantic Model 指标声明(count/countThreshold/sum/weightedAvg/ratio)，非自由 SQL',
            presentation: ['table(+showTotal)', 'chart{bar|pie|line|vbar|vline|varea|vscatter|vbubble|vpie|vgauge|vmap(area|point)|vheatmap} via presentation.chart'],
            chart: { supported: ['bar', 'pie', 'line', 'vbar', 'vline', 'varea', 'vscatter', 'vbubble', 'vpie', 'vgauge', 'vmap', 'vheatmap'], note: 'category=维度别名、value=基础度量别名（派生比率不可作 value）；vscatter/vbubble 用 x/y（+可选 bubbleSize）；vmap 支持区域图/点图（geoUrl 限 assets/map/ 下，area 名须匹配内置地图全名；line/custom 未接）；vheatmap 热力图（2026-11-07，heat{radius,blur,minOpacity,maxOpacity} 可省=官方 35/45/0/70）' },
            filters: ['dateRange(严格双边+日历有效)', 'dataset.filters(受控字面量：数值/文本+op×类型约束)'],
            sort: 'dataset.sort[{field,dir}]（已选 SQL 别名 asc|desc；派生比率列不可排）',
            topN: 'dataset.topN{n}（须配 sort）',
            join: 'confirmed 安全关系(N:1/1:1、目标键机器验证唯一)才生成 INNER JOIN；跨表度量/非安全基数拒',
            note: 'model-driven SQL（sqlbuilder 生成，非自由文本 query）；凭据仅 runner 本地 dbpass'
          }
        },
        // 兼容旧字段（已有消费方读顶层，保留真值不再撒谎）
        aggregation: { supported: ['sum'], planned: ['ratio_of_sums', 'avg', 'count'] },
        presentation: { supported: ['table', 'chart(sql 路 presentation.chart)'] },
        dataset: { supported: ['rows(内嵌)', 'sql(model-driven)'], rejected: ['自由文本 dataset.query（§5.2）'] },
        filters: 'sql 路支持 dateRange + dataset.filters；rows 路不支持',
        chart: '两路均支持 presentation.chart（bar|pie|line|Van 族含 vmap/vheatmap）；rows 路 category/value=内嵌数据集列名',
        multiSheet: 'rows 路 extraSheets[] 已支持（planner 已透传；SQL 作为 extra 后续批）；plan→create e2e=结构链路（不证明逐格/第二 Sheet 视觉/隐藏行列，C4 口径）'
      };
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ReportSpec;
