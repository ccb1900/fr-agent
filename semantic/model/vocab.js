// semantic/model/vocab.js — I3 概念词汇表 + 能力名册（纯数据，零依赖，可离线单测）
//   r2 §3 三态之一"业务概念"的形式定义：Entity/Property/Relationship/Metric/Dimension/Mapping/Rule。
//   独立于 FineReport：不引 IR 词汇、不引 com.fr（R7 红线），未来换引擎整体复用。
//   核心主张（r2 §3.2）：指标定义必须"明确聚合语义"——ratio 必带 numerator/denominator，
//   禁裸 formula 串（那把聚合语义丢回不可验证的黑箱）。
var ModelVocab = (function () {
  var MODEL_VERSION = '1';

  // 指标表达式 kind 白名单 + 每种必带字段（validator 据此要求"明确聚合语义"）
  var METRIC_KINDS = {
    count:          { requires: ['table'] },                                  // COUNT(*) 限定实体表
    countThreshold: { requires: ['table', 'column', 'op', 'value'] },        // COUNT WHERE col op value（完成=score>=0.9）
    sum:            { requires: ['table', 'column'] },
    weightedAvg:    { requires: ['table', 'column'] },                       // SUM(col)/COUNT(*) 全加权（禁"均值之均值"，README 口径坑）
    ratio:          { requires: ['numerator', 'denominator'] }              // r2 §3.2 示范形态；scale 可选（×100 显示）
  };
  var RATIO_OPERAND_KEYS = ['metric', 'table', 'column'];                     // 分子/分母：引用已定义 metric 名，或 table[+column(+op+value)] 现算

  var OPS = { '>=': 1, '>': 1, '<=': 1, '<': 1, '=': 1, '==': 1 };

  // 关系来源枚举：DB 声明外键(fk) / 主键事实(pk) / 仅命名推导(naming-derived)——FK=0 库的关系只可能是后者，
  //   naming-derived 必带 requiresConfirmation（r2 §3.3 置信度只排序、不替代业务确认）。
  var RELATION_SOURCES = { fk: 1, pk: 1, 'naming-derived': 1 };

  return {
    MODEL_VERSION: MODEL_VERSION,
    METRIC_KINDS: METRIC_KINDS,
    RATIO_OPERAND_KEYS: RATIO_OPERAND_KEYS,
    OPS: OPS,
    RELATION_SOURCES: RELATION_SOURCES,
    capabilities: function () {
      return {
        modelVersion: MODEL_VERSION,
        metricKinds: Object.keys(METRIC_KINDS),
        relationships: { supported: ['naming-derived(requiresConfirmation)', 'fk', 'pk'], note: '演示库 FK=0（I2 W0 坐实），业务关系当前仅命名推导，绝不自动确认' },
        resolver: { output: ['resolved', 'ambiguous'], neverAutoSelect: true, noFabrication: true },
        independentOfFineReport: true
      };
    }
  };
})();
