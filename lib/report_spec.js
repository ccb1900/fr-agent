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

  // v1 明确拒绝的能力键（存在即报 UNSUPPORTED_CAPABILITY，指向应接管的迭代）
  var REJECTED = {
    filters: 'I2/I3（Schema Inspector + Semantic Model 落地后接筛选）',
    chart: 'I4/I5（Planner + 图种编译）',
    semanticQuery: 'I2/I3（dataset.query.type=semantic 需语义模型，ReportSpec v1 只接内嵌 dataset.rows）',
    multiSheet: '后端单 sheet（同 ir.js UNSUPPORTED_CAPABILITY:multi_sheet）'
  };

  return {
    SPEC_VERSION: SPEC_VERSION,
    AGGREGATIONS: AGGREGATIONS,
    AGG_UNIMPLEMENTED: AGG_UNIMPLEMENTED,
    COLUMN_TYPES: COLUMN_TYPES,
    PRESENTATION_TYPES: PRESENTATION_TYPES,
    REJECTED: REJECTED,
    // 机器读能力清单（Ir.capabilities() 同形：Agent 据此收边界，不靠猜）
    capabilities: function () {
      return {
        specVersion: SPEC_VERSION,
        aggregation: { supported: ['sum'], planned: ['ratio_of_sums', 'avg', 'count'] },
        presentation: { supported: ['table'] },
        dataset: { supported: ['rows(内嵌)'], rejected: ['query.type=semantic (I2/I3)'] },
        filters: 'unsupported (I2/I3)',
        chart: 'unsupported (I4/I5)',
        multiSheet: 'unsupported'
      };
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ReportSpec;
