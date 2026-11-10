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
    // D3.6 域身份闸（外审 P1-1b）：id 前缀、doc.domain、注册 relPath 域段、model.ref 域段——四方一体。
    //   不能只靠 modelVersion 相等判定模型身份：跨域误绑（sales 资产绑 production 模型）在此拒，
    //   与 assets 工具层的四面体闸同规（fail-closed 于 U READY 链最上游）。
    var relDom = (function () { var m = /^models\/([^\/]+)\/datasets\//.exec(String(hit.relPath)); return m ? m[1] : null; })();
    var refDom = (function () { var m = /^models\/([^\/]+)\/model\.json$/.exec(String(hit.doc.model.ref || '')); return m ? m[1] : null; })();
    var idDom = String(hit.id).split('.')[0];
    if (!relDom)
      return { ok: false, errors: ['DOMAIN_MISMATCH@' + ref + ' (registered relPath is not models/<domain>/datasets/<name>.json: ' + hit.relPath + ')'] };
    if (!isStr(hit.doc.domain) || hit.doc.domain !== relDom)
      return { ok: false, errors: ['DOMAIN_MISMATCH@' + ref + ' (doc.domain=' + hit.doc.domain + ' vs registered path models/' + relDom + '/)'] };
    if (idDom !== relDom)
      return { ok: false, errors: ['DOMAIN_MISMATCH@' + ref + ' (id prefix ' + idDom + ' vs registered domain ' + relDom + ')'] };
    if (!refDom)
      return { ok: false, errors: ['BAD_MODEL_REF@' + ref + ' (model.ref must be models/<domain>/model.json, got: ' + hit.doc.model.ref + ')'] };
    if (refDom !== relDom)
      return { ok: false, errors: ['DOMAIN_MISMATCH@' + ref + ' (model.ref domain ' + refDom + ' vs registered domain ' + relDom + ')'] };
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
