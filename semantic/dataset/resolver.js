// semantic/dataset/resolver.js — D3 Dataset Resolver（纯函数，零 Java/零 IO；R7a/R7b 语义层红线）
//   职责（且仅此）：把 ReportSpec 里的 dataset:{kind:'catalog', ref, reportScope} 解析成
//   dataset:{kind:'sql', ...}，使用 DatasetRegistry/DatasetDef 的已有纯函数。
//   不读文件、不写文件、不生成 SQL（SqlBuilder 在下游 SpecCompiler）。零依赖注入而非全局引用。
//   契约：docs/architecture/dataset-contract.md §5（四向映射）。
var DatasetResolver = (function () {

  // registry: DatasetRegistry.build(entries) 的返回值
  // ref: dataset id (e.g. 'production.inspection_records')
  // reportScope: {dateRange?, sort?, topN?} — 报表级关注点（白名单在 DatasetDef.scopeProblems）
  // model: 已加载的 model.json 对象（用于版本绑定检查；可为 null = 跳过版本检查）
  function resolve(registry, ref, reportScope, model) {
    var hit = registry.resolve(ref);
    if (!hit) return { ok: false, errors: ['DATASET_NOT_FOUND@' + ref] };
    if (hit.doc.status !== 'published')
      return { ok: false, errors: ['NOT_PUBLISHED@' + ref + ' (status=' + hit.doc.status + ')'] };
    if (!isObj(hit.doc.model) || !isStr(hit.doc.model.modelVersion))
      return { ok: false, errors: ['BAD_MODEL_REF@' + ref + ' (doc.model missing or modelVersion empty)'] };
    var problems = DatasetDef.scopeProblems(reportScope);
    if (problems.length) return { ok: false, errors: problems };
    if (model && hit.doc.model.modelVersion !== model.modelVersion)
      return { ok: false, errors: ['MODEL_VERSION_MISMATCH@' + ref + ' (dataset expects ' + hit.doc.model.modelVersion + ', model is ' + model.modelVersion + ')'] };
    // 审查轮 P1 补：resolver 侧再跑一次契约审计 + 绑定（纵深防御——make_api 的扫描器不按 audit 过滤，
    //   不合格文档如果进了 registry 就能到这里；此处是最后一道纯函数门，零 IO）
    var audit = DatasetDef.audit(hit.doc, hit.relPath);
    var bind = DatasetDef.bindDrift(hit.doc, model);
    if (audit.length || bind.length) return { ok: false, errors: audit.concat(bind) };
    var dataset = DatasetDef.toReportDataset(hit.doc, reportScope);
    return {
      ok: true,
      dataset: dataset,
      datasetRef: { id: hit.id, version: hit.version, modelVersion: hit.doc.model.modelVersion, relPath: hit.relPath }
    };
  }

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isStr(v) { return typeof v === 'string'; }

  return { resolve: resolve };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DatasetResolver;
