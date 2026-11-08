// acceptance/tools/build_tasks.js — Agent 验收基准任务定义源 + 生成器（Nashorn ES5，零引擎）
//   源=本文件的 TASKS 数组；产物=acceptance/tasks/*.json + acceptance/benchmark.json（索引/哈希/资格投影）。
//   为什么不手写 40 个 JSON：任务定义要引用"真实能力 ID"与"真实 fixture 真值键"，生成期硬校验比事后 review 可靠。
//   纪律：
//     ① 能力 ID 只能来自 application/capability_manifest.js（不造第二套命名）；requiredCapabilities 必须
//        agentAvailable=true，否则生成失败（PASS 资格不能靠未承诺能力）。
//     ② dataAssertions 必须能在 acceptance/fixtures/sales/expected.json 找到键，否则生成失败。
//     ③ agentTools 必须是 agent/tools/fr_agent.ps1 ValidateSet 里的真实 verb。
//     ④ 任务提示词只写业务需求；机器检查禁用内部词（IR/ReportSpec/CPT/Object/JSON/API/chart kind）。
//     ⑤ 产物文本确定性（无时间/随机），哈希口径=sha256(LF 归一化 UTF-8)；fast_acceptance 逐文件对拍。
//   运行：java -cp <nashorn.jar> jdk.nashorn.tools.Shell acceptance/tools/build_tasks.js
var J = function (n) { return Java.type(n); };
var System = J('java.lang.System');
var Files = J('java.nio.file.Files');
var Paths = J('java.nio.file.Paths');
var MessageDigest = J('java.security.MessageDigest');

var ROOT = System.getenv('FR_AGENT_HOME') || 'D:/fineagent';
var TASK_DIR = ROOT + '/acceptance/tasks';
var BENCH_PATH = ROOT + '/acceptance/benchmark.json';
var FIXTURE_DIR = ROOT + '/acceptance/fixtures/sales';
var SPEC_DATE = '2026-11-08';

function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function readText(p) {
  return String(new (J('java.lang.String'))(Files.readAllBytes(Paths.get(p)), 'UTF-8')).replace(/^\uFEFF/, '');
}
function writeText(p, text) { Files.write(Paths.get(p), J('java.lang.String').valueOf(text).getBytes('UTF-8')); }
function jsonText(o) { return JSON.stringify(o, null, 2) + '\n'; }
function hexOf(bytes) {
  var HEX = '0123456789abcdef', out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    out += HEX.charAt((b >> 4) & 0xf) + HEX.charAt(b & 0xf);
  }
  return out;
}
function sha256(text) {
  var md = MessageDigest.getInstance('SHA-256');
  return hexOf(md.digest(J('java.lang.String').valueOf(text).getBytes('UTF-8')));
}
function normHash(text) { return sha256(String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')); }
function ensureDir(p) { Files.createDirectories(Paths.get(p)); }
function fail(msg) { throw new Error('[build_tasks] ' + msg); }

// ---------------- 评分权重（不适用维度按比例并入同组维度，总和恒 100） ----------------
function weightsFor(mode) {
  var w = { requirement: 10, semantic: 10, planning: 10, capability: 15, ir: 10, cpt: 10, render: 20, interaction: 10, safety: 5 };
  if (mode === 'noInteraction') { w.render = 30; w.interaction = 0; }
  else if (mode === 'modify') { w.safety = 15; w.interaction = 0; }
  else if (mode === 'analysis') { w = { requirement: 20, semantic: 20, planning: 20, capability: 20, ir: 0, cpt: 0, render: 0, interaction: 0, safety: 20 }; }
  var sum = 0;
  Object.keys(w).forEach(function (k) { sum += w[k]; });
  if (sum !== 100) fail('weights sum != 100 for mode ' + mode + ' -> ' + sum);
  return w;
}

var GROUPS = {
  A: { name: '基础报表与数据', focus: '数据集、字段、表格、聚合、排序' },
  B: { name: '布局与组件', focus: '单元格、分组、交叉表、组合布局' },
  C: { name: '图表能力', focus: '常规图表、组合图表、地图、气泡、热力图' },
  D: { name: '样式与格式', focus: '字体、颜色、边框、条件格式、数字格式' },
  E: { name: '参数与交互', focus: '参数、过滤、联动、跳转、分页' },
  F: { name: '复杂分析', focus: '多维分析、同比环比、排名、趋势' },
  G: { name: '修改与维护', focus: '理解已有报表、局部修改、批量修改、回归' },
  H: { name: '自主规划与恢复', focus: '需求澄清、能力选择、错误诊断、验证失败处理' }
};

// 执行批次（对齐用户 V0.1~V0.5 落地顺序；B02-B05 未被原表点名，归入 V0.2 布局批）
function waveOf(id) {
  var g = id.charAt(0), n = parseInt(id.substring(1), 10);
  if (g === 'A') return 'V0.1';
  if (g === 'B') return n === 1 ? 'V0.1' : 'V0.2';
  if (g === 'C') return n <= 3 ? 'V0.1' : 'V0.2';
  if (g === 'D') return n <= 2 ? 'V0.1' : 'V0.2';
  if (g === 'E' || g === 'F') return 'V0.3';
  if (g === 'G') return 'V0.4';
  return 'V0.5';
}

var CREATE_TOOLS = ['plan', 'plan2spec', 'create', 'validate', 'preview'];
var MODIFY_TOOLS = ['list_reports', 'inspect_template', 'modify', 'validate', 'promote', 'restore'];

function T(o) {
  var modification = !!o.modificationRequired;
  var mode = o.weightMode || (o.analysisOnly ? 'analysis' : (modification ? 'modify' : (o.interactionRequired ? 'default' : 'noInteraction')));
  var t = {
    id: o.id,
    name: o.name,
    group: o.group,
    groupName: GROUPS[o.group].name,
    difficulty: o.difficulty,
    wave: waveOf(o.id),
    prompt: o.prompt,
    fixture: 'sales',
    datasetPath: o.datasetPath || 'rows',
    expectedLevel: o.expectedLevel,
    requiredCapabilities: o.requiredCapabilities || [],
    targetCapabilities: o.targetCapabilities || [],
    blockedCapabilities: o.blockedCapabilities || [],
    alternatives: o.alternatives || [],
    agentTools: o.agentTools || (modification ? MODIFY_TOOLS.slice(0) : CREATE_TOOLS.slice(0)),
    dataContract: o.dataContract || 'raw-rows',
    dataAssertions: o.dataAssertions || [],
    render: { required: o.renderRequired !== false, assertions: o.renderAssertions || [] },
    interaction: {
      required: !!o.interactionRequired,
      evidenceTier: o.interactionTier || 'engine',
      assertions: o.interactionAssertions || []
    },
    modification: { required: modification, invariants: o.modificationInvariants || [] },
    safety: { noDeployOnFailure: true, scope: o.scope || 'only the target report' },
    requiredClarifications: o.requiredClarifications || [],
    blockedBy: o.blockedBy || [],
    knownGaps: o.knownGaps || [],
    faultInjection: o.faultInjection || null,
    analysisOnly: !!o.analysisOnly,
    longTermRegression: o.longTermRegression === true,
    acceptance: {
      requireAgentExecution: true,
      requireEngineRender: o.renderRequired !== false,
      requireVisualEvidence: o.renderRequired !== false,
      requireNoSilentDrop: true
    },
    notes: o.notes || '',
    weights: weightsFor(mode)
  };
  return t;
}

// ---------------- 40 条任务（V0.1 规格；分组 5/5/8/5/5/4/4/4） ----------------
var TASKS = [
  // ===== A 基础报表与数据 =====
  T({
    id: 'A01', name: '销售明细表', group: 'A', difficulty: 'basic',
    prompt: '创建一张销售明细表，展示订单日期、订单编号、客户、产品、数量、单价、金额，金额等于数量乘以单价。',
    expectedLevel: 'PASS',
    requiredCapabilities: ['spec.rows.sum'],
    dataContract: 'raw-rows',
    dataAssertions: ['orders.count', 'orders.amount', 'orders.row2.orderId', 'orders.row2.qty', 'orders.row2.unitPrice', 'orders.row2.amount'],
    renderAssertions: ['表头列名与业务名称一致（订单日期/订单编号/客户/产品/数量/单价/金额）', '明细行数等于订单行数（184）', '金额列逐行等于数量×单价（抽查 SO202407-002 = 8×2280 = 18240）'],
    notes: '明细表不聚合；金额在固定数据里已有同值列，验收只看逐行数值，不强制"公式列"实现。'
  }),
  T({
    id: 'A02', name: '区域销售汇总', group: 'A', difficulty: 'basic',
    prompt: '创建销售汇总表，按区域统计销售额、订单数和客户数，销售额从高到低排序。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['spec.rows.sum'],
    targetCapabilities: ['spec.sql.sort', 'spec.sql.model'],
    dataContract: 'report-aggregates',
    dataAssertions: ['region.华东.amount', 'region.华北.amount', 'region.华南.amount', 'region.西南.amount', 'region.西北.amount', 'region.华东.orders', 'region.华东.customers'],
    renderAssertions: ['5 个区域各一行', '销售额列与真值一致', '行顺序按销售额降序'],
    knownGaps: ['ReportSpec rows 路的聚合只有 sum，分组订单数/去重客户数无法在报表层表达', '报表层排序：cell.sort 结构化拒；SQL ORDER BY 需要固定数据入库（fixture-db）'],
    notes: 'rows 路只能保证销售额求和；订单数/客户数需要预聚合（本任务 dataContract 禁止）→ 预期 PARTIAL。SQL 变体待 fixture-db。'
  }),
  T({
    id: 'A03', name: '产品销售额 Top10 与合计', group: 'A', difficulty: 'basic',
    prompt: '创建产品销售排行，展示销售额前 10 名产品，并增加合计行。',
    expectedLevel: 'BLOCKED',
    targetCapabilities: ['spec.sql.topN', 'spec.sql.sort'],
    blockedBy: [{ kind: 'capability-gap', detail: 'rows 路无 topN/sort；cell.sort 结构化拒；SQL topN 需要固定数据入库（fixture-db 未部署）' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['product.top10', 'product.top10.amounts', 'orders.amount'],
    renderAssertions: ['10 行产品排行', '合计行等于全部销售额'],
    knownGaps: ['固定数据 SQL 库与语义模型实体未建立'],
    notes: '不允许把 Top10 结果预先算好塞进内嵌行（dataContract=report-aggregates）；因此当前不是 PARTIAL 而是 BLOCKED。'
  }),
  T({
    id: 'A04', name: '部门员工销售与部门小计', group: 'A', difficulty: 'intermediate',
    prompt: '创建员工销售统计，按部门分组，每个部门展示员工销售额及部门小计。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '分组小计（group subtotal）在能力账本无条目；rows 路 total 只有全局合计，无法按组重复发射' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['dept.销售一部.amount', 'dept.销售二部.amount', 'dept.渠道部.amount', 'employee.E01.amount', 'employee.rank'],
    renderAssertions: ['3 个部门分组', '每个部门末尾一行小计', '员工行合计等于部门小计'],
    knownGaps: ['分组小计/层级汇总未接线']
  }),
  T({
    id: 'A05', name: '库存报表与期末库存计算', group: 'A', difficulty: 'intermediate',
    prompt: '创建一张库存报表，展示产品、仓库、期初库存、入库、出库、期末库存，并计算库存变化。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['spec.rows.sum'],
    targetCapabilities: ['spec.rows.cells'],
    dataContract: 'report-computes',
    dataAssertions: ['inventory.opening.total', 'inventory.inbound.total', 'inventory.outbound.total', 'inventory.closing.total', 'inventory.P01.W01.closing'],
    renderAssertions: ['产品×仓库明细行', '期末库存 = 期初 + 入库 - 出库（逐行）', '库存变化列可见'],
    knownGaps: ['行级计算列走 cells.formula；spec.rows.cells 的 rendering 仍为 pending（只有 rich 文本目检）'],
    notes: '固定数据带 closing 列，但本任务 dataContract=report-computes，禁止直接展示预置期末列。'
  }),

  // ===== B 布局与组件 =====
  T({
    id: 'B01', name: '月度销售报表版式', group: 'B', difficulty: 'basic',
    prompt: '创建一个标准的月度销售报表，上方显示标题和统计期间，下方显示明细，最后显示总计。',
    expectedLevel: 'PASS',
    requiredCapabilities: ['page.headerFooter', 'spec.rows.sum', 'spec.rows.totalAgg'],
    dataContract: 'raw-rows',
    dataAssertions: ['orders.amount', 'orders.count', 'month.2026-06.amount'],
    renderAssertions: ['页眉标题与统计期间可见', '明细按月/客户展开', '末尾合计行金额等于订单总额'],
    notes: '标题/统计期间走页眉；报表本体是明细+总计。'
  }),
  T({
    id: 'B02', name: '区域×月份交叉报表', group: 'B', difficulty: 'intermediate',
    prompt: '创建一个按年月和区域展开的交叉报表，行是区域，列是月份，单元格显示销售额。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '交叉表/透视（动态列维度）在能力账本无条目；rows 路只有固定列明细表' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['region.华东.amount', 'month.2026-06.amount'],
    renderAssertions: ['行=区域、列=月份', '单元格=对应区域月份销售额'],
    knownGaps: ['交叉表/动态列头未接线']
  }),
  T({
    id: 'B03', name: '部门→员工层级报表', group: 'B', difficulty: 'intermediate',
    prompt: '创建一个部门人员报表，部门作为父级分组，员工作为子级明细，支持展开查看。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '层级分组/展开折叠在能力账本无条目（cell.groupCustom 只覆盖分组自定义，不是展开结构）' }],
    dataContract: 'raw-rows',
    dataAssertions: ['employee.rank', 'dept.销售一部.amount'],
    renderAssertions: ['部门父行', '员工子行', '展开/折叠控件可用'],
    knownGaps: ['层级分组与展开交互未接线']
  }),
  T({
    id: 'B04', name: '经营分析看板', group: 'B', difficulty: 'advanced',
    prompt: '创建一个经营分析看板，顶部放置关键指标，中间放置趋势图，底部放置销售明细。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '同页多组件区域布局（KPI/图表/明细分区）在能力账本无条目；现有页面只有单一表格+图表顺序块' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['orders.amount', 'totals.profitRate', 'month.2026-06.amount'],
    renderAssertions: ['顶部 KPI 区', '中部趋势图', '底部明细区'],
    knownGaps: ['看板式多区域布局未接线']
  }),
  T({
    id: 'B05', name: '多区域组合报表', group: 'B', difficulty: 'advanced',
    prompt: '创建一张包含多个数据区域的报表：左侧为销售汇总，右侧为产品排行，下方为订单明细。',
    expectedLevel: 'BLOCKED',
    alternatives: ['page.multiSheet'],
    blockedBy: [{ kind: 'capability-gap', detail: '同一页内的多区域布局（左右上下分区）无能力条目；page.multiSheet 只能拆成多个 sheet，不等于本需求' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['region.华东.amount', 'product.top10', 'orders.count'],
    renderAssertions: ['三个区域同页可见', '区域间不重叠'],
    knownGaps: ['同页多区域布局未接线']
  }),

  // ===== C 图表能力 =====
  T({
    id: 'C01', name: '区域销售额柱状图', group: 'C', difficulty: 'basic',
    prompt: '创建各区域销售额柱状图，按销售额降序排列。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['chart.bar'],
    targetCapabilities: ['spec.sql.sort'],
    dataContract: 'report-aggregates',
    dataAssertions: ['region.华东.amount', 'region.华北.amount', 'region.华南.amount', 'region.西南.amount', 'region.西北.amount'],
    renderAssertions: ['5 根柱子、类目为区域', '柱高与销售额一致', '类目顺序按销售额降序'],
    knownGaps: ['报表层排序无能力（cell.sort 结构化拒）；SQL ORDER BY 需固定数据入库'],
    notes: '图表本身可渲染；"降序"在当前 rows 路不可承诺 → 预期 PARTIAL。'
  }),
  T({
    id: 'C02', name: '近 12 个月销售额趋势', group: 'C', difficulty: 'basic',
    prompt: '创建近 12 个月销售额趋势折线图，按月份升序展示。',
    expectedLevel: 'PASS',
    requiredCapabilities: ['chart.line'],
    dataContract: 'prepared-rows',
    dataAssertions: ['month.2025-07.amount', 'month.2026-06.amount', 'month.2026-05.amount'],
    renderAssertions: ['12 个连续月份点', 'X 轴月份升序', '折线随销售额变化'],
    notes: '月度聚合行是图表的输入数据（固定数据的自然粒度）；月份顺序由输入行顺序保证。'
  }),
  T({
    id: 'C03', name: '产品销售额占比饼图', group: 'C', difficulty: 'basic',
    prompt: '创建各产品销售额占比饼图，显示产品名称和占比。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['chart.vpie'],
    targetCapabilities: ['chart.label'],
    dataContract: 'prepared-rows',
    dataAssertions: ['product.P04.amount', 'product.top10', 'orders.amount'],
    renderAssertions: ['扇区数量=产品数', '图例显示产品名称', '标签显示占比数值'],
    knownGaps: ['vpie 标签 richText 可渲染，但 ${PERCENT} 占位符需要官方 img data-id 格式，纯文本会原样显示（P3）'],
    notes: '产品名称/扇区可证；"占比数值"当前不能承诺 → PARTIAL。'
  }),
  T({
    id: 'C04', name: '销售额与利润率组合图', group: 'C', difficulty: 'advanced',
    prompt: '创建月度销售额和利润率组合图，销售额用柱状图，利润率用折线图，并使用次坐标轴。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '组合图（自定义 plot 列表+双轴+系列分配）构造/序列化已探，但线系列无头渲染未达成（D1 阻塞）；能力账本无 combo 条目' }],
    dataContract: 'prepared-rows',
    dataAssertions: ['month.2026-06.amount', 'totals.profitRate'],
    renderAssertions: ['柱=销售额', '折线=利润率', '次坐标轴刻度可见'],
    knownGaps: ['组合图渲染（D1）阻塞', '利润率需要派生比率']
  }),
  T({
    id: 'C05', name: '销售额-利润率气泡图', group: 'C', difficulty: 'intermediate',
    prompt: '创建销售额与利润率的气泡图，横轴为销售额，纵轴为利润率，气泡大小代表订单数。',
    expectedLevel: 'PASS',
    requiredCapabilities: ['chart.vbubble'],
    dataContract: 'prepared-rows',
    dataAssertions: ['region.华东.amount', 'region.华北.amount', 'region.华东.orders', 'totals.profitRate'],
    renderAssertions: ['5 个区域气泡', 'X=销售额、Y=利润率、大小=订单数', '图例/系列名可见'],
    notes: 'x/y/size 是 vscatter/vbubble 的官方数据定义（BubbleTableDefinition201109）；区域级三指标用预聚合行是图表输入的正常形态。'
  }),
  T({
    id: 'C06', name: '省份销售额地图', group: 'C', difficulty: 'intermediate',
    prompt: '创建各省份销售额地图，使用区域颜色深浅表达销售额。',
    expectedLevel: 'PASS',
    requiredCapabilities: ['chart.vmap'],
    dataContract: 'prepared-rows',
    dataAssertions: ['province.广东省.amount', 'province.四川省.amount', 'province.count'],
    renderAssertions: ['中国地图 12 个省份着色', '颜色深浅与销售额对应', '图例色阶可见'],
    notes: '省份用内置地图全名（如 广东省/北京市），无需经纬度。'
  }),
  T({
    id: 'C07', name: '省份销售热力图', group: 'C', difficulty: 'advanced',
    prompt: '创建全国销售热力图，按省份显示销售强度，并显示对应数值提示。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['chart.vheatmap'],
    targetCapabilities: ['chart.mapTooltip', 'chart.tooltip'],
    interactionRequired: true,
    interactionTier: 'serialization',
    interactionAssertions: ['悬停省份显示销售额提示'],
    dataContract: 'prepared-rows',
    dataAssertions: ['province.广东省.amount', 'province.四川省.amount'],
    renderAssertions: ['热力光晕落在对应省份', '色阶图例可见'],
    knownGaps: ['地图 tooltip 属 web 交互：静态 PNG 不现形，能力账本 rendering=serialization-only 且 agentAvailable=false'],
    notes: '热力渲染可证；"数值提示"只能给序列化证据 → PARTIAL。'
  }),
  T({
    id: 'C08', name: '区域地图标签与悬停详情', group: 'C', difficulty: 'advanced',
    prompt: '创建销售区域地图，地图上显示区域名称和销售额，鼠标悬停时展示区域详细信息。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['chart.vmap', 'chart.mapLabel'],
    targetCapabilities: ['chart.mapTooltip', 'chart.mapTooltipFormat'],
    interactionRequired: true,
    interactionTier: 'serialization',
    interactionAssertions: ['悬停显示区域名称/销售额等详情'],
    dataContract: 'prepared-rows',
    dataAssertions: ['province.广东省.amount', 'province.北京市.amount'],
    renderAssertions: ['地图标签显示省份名与数值', '标签不互相遮挡'],
    knownGaps: ['地图 tooltip 为 web 交互，无渲染证据；mapTooltipFormat 无 Agent 入口'],
    notes: '标签有渲染证据（AttrMapLabel）；悬停详情只有序列化证据 → PARTIAL。'
  }),

  // ===== D 样式与格式 =====
  T({
    id: 'D01', name: '正式经营报表样式', group: 'D', difficulty: 'basic',
    prompt: '创建一张正式的经营报表，标题居中加粗，表头使用深色背景和白色文字，明细采用统一字体。',
    expectedLevel: 'PARTIAL',
    targetCapabilities: ['condition.then.style'],
    dataContract: 'prepared-rows',
    dataAssertions: ['orders.amount', 'totals.profitRate'],
    renderAssertions: ['标题居中加粗', '表头深色底+白字', '明细字体统一'],
    knownGaps: ['ReportSpec 没有表头/单元格静态样式入口；condition.then.style 只能按条件改明细格，不能保证表头样式'],
    notes: '标题/字体统一可部分达成；表头深色底白字当前不可承诺。'
  }),
  T({
    id: 'D02', name: '金额千分位与百分比格式', group: 'D', difficulty: 'basic',
    prompt: '销售额使用千分位格式并保留两位小数，利润率使用百分比格式。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['spec.rows.sum'],
    targetCapabilities: ['spec.rows.totalAgg'],
    dataContract: 'prepared-rows',
    dataAssertions: ['orders.amount', 'totals.profitRate'],
    renderAssertions: ['销售额显示为 1,969,883.00 形态', '利润率显示为百分数形态'],
    knownGaps: ['rows 路 metric 只有 sum，行级利润率（profit/amount）不是可求和列；total.aggregate.ratio 只能用于合计格'],
    notes: '金额格式可证；逐行利润率百分比当前不可承诺 → PARTIAL。'
  }),
  T({
    id: 'D03', name: '低于/高于目标的红绿标记', group: 'D', difficulty: 'intermediate',
    prompt: '销售额低于目标值的单元格标记为红色，高于目标值的标记为绿色。',
    expectedLevel: 'PASS',
    requiredCapabilities: ['condition.formula', 'spec.rows.conditions'],
    dataContract: 'report-aggregates',
    dataAssertions: ['region.华东.amount', 'region.华北.amount', 'region.华南.amount'],
    renderAssertions: ['低于目标的销售额为红字', '高于目标的销售额为绿字', '未命中条件的格保持默认色'],
    notes: '条件公式按明细首行锚点+行自动偏移；目标值写在 spec 的条件里。'
  }),
  T({
    id: 'D04', name: '表格边框布局', group: 'D', difficulty: 'intermediate',
    prompt: '表格增加外边框、内部横线和表头底边框，明细区域不显示多余的竖线。',
    expectedLevel: 'PARTIAL',
    targetCapabilities: ['condition.then.border'],
    dataContract: 'raw-rows',
    dataAssertions: ['orders.count'],
    renderAssertions: ['外边框四边闭合', '内部只有横线', '表头底边框加粗', '明细无竖线'],
    knownGaps: ['ReportSpec 没有表格边框布局入口；condition.then.border 只能按条件替换单元格边框（粗线），不能控制外框/内线/竖线'],
    notes: '当前只能做到"条件粗边框"局部效果，边框布局不可承诺。'
  }),
  T({
    id: 'D05', name: '斑马纹与合计行突出', group: 'D', difficulty: 'intermediate',
    prompt: '创建斑马纹明细表，奇偶行采用不同背景色，合计行突出显示。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['condition.then.style', 'spec.rows.conditions'],
    targetCapabilities: ['condition.formula'],
    dataContract: 'raw-rows',
    dataAssertions: ['orders.count', 'orders.amount'],
    renderAssertions: ['奇偶行背景色交替', '合计行背景/字体突出'],
    knownGaps: ['行奇偶判断需要 MOD(ROW(),2) 类公式，condition.formula 已验证的是比较公式，奇偶形态未验'],
    notes: '合计行突出可用 total.sumCols 的 bg/bold；斑马纹属未验证公式形态 → PARTIAL。'
  }),

  // ===== E 参数与交互 =====
  T({
    id: 'E01', name: '日期范围查询', group: 'E', difficulty: 'intermediate',
    prompt: '创建一个销售查询报表，用户可以选择开始日期和结束日期，查询对应期间的数据。',
    expectedLevel: 'BLOCKED',
    datasetPath: 'sql',
    targetCapabilities: ['spec.sql.filters', 'spec.sql.model', 'spec.params.panel'],
    blockedBy: [{ kind: 'external-data', detail: 'dateRange 只在 SQL 路存在；固定数据的 SQL 库/语义模型实体未部署（fixture-db）' }],
    interactionRequired: true,
    interactionTier: 'engine',
    interactionAssertions: ['改开始/结束日期后重新查询，结果随期间变化'],
    dataContract: 'raw-rows',
    dataAssertions: ['orders.count', 'month.2026-06.amount'],
    renderAssertions: ['参数面板有开始/结束日期控件', '默认期间结果正确'],
    knownGaps: ['固定数据 SQL 库与语义模型未建立']
  }),
  T({
    id: 'E02', name: '区域参数过滤', group: 'E', difficulty: 'intermediate',
    prompt: '创建一个区域销售报表，用户选择区域后，只展示该区域的数据。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['spec.params.filter'],
    targetCapabilities: ['spec.params.panel'],
    interactionRequired: true,
    interactionTier: 'serialization',
    interactionAssertions: ['切换区域后只显示该区域行'],
    dataContract: 'raw-rows',
    dataAssertions: ['filter.region.华东.amount', 'filter.region.华东.rows'],
    renderAssertions: ['参数控件可见', '默认区域（华东）只渲染该区域行'],
    knownGaps: ['已验证=默认参数值执行期过滤；Web 改参后重查询未验证（能力账本明确不承诺）'],
    notes: '静态 PNG 能证默认值过滤，不能证交互改参 → PARTIAL。'
  }),
  T({
    id: 'E03', name: '省份→城市级联参数', group: 'E', difficulty: 'advanced',
    prompt: '创建一个联动查询，先选择省份，再选择该省份下的城市，最后展示城市销售数据。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '参数联动/级联选项（province→city 依赖刷新）在能力账本无条目' }],
    interactionRequired: true,
    interactionTier: 'serialization',
    interactionAssertions: ['省份变化后城市选项只保留该省城市'],
    dataContract: 'raw-rows',
    dataAssertions: ['province.count'],
    renderAssertions: ['省份/城市两个参数控件'],
    knownGaps: ['级联参数与选项依赖未接线']
  }),
  T({
    id: 'E04', longTermRegression: true, name: '区域销售明细跳转', group: 'E', difficulty: 'advanced',
    prompt: '点击销售汇总中的某个区域，可以跳转到该区域的销售明细报表。',
    expectedLevel: 'PARTIAL',
    targetCapabilities: ['condition.then.link', 'chart.hyperlinkCell'],
    interactionRequired: true,
    interactionTier: 'serialization',
    interactionAssertions: ['点击区域跳到明细报表，且只显示该区域数据'],
    dataContract: 'report-aggregates',
    dataAssertions: ['region.华东.amount'],
    renderAssertions: ['汇总表区域行可见', '超链配置绑定到区域列'],
    knownGaps: ['单元格超链已序列化；web 导航点击在本项目多次尝试均未验证（不是已证损坏），参数传递未证'],
    notes: '只能给序列化证据；跳转行为未验证 → PARTIAL。'
  }),
  T({
    id: 'E05', name: '订单明细分页查询', group: 'E', difficulty: 'advanced',
    prompt: '创建一个较长的订单明细查询，支持分页浏览，并保持查询条件。',
    expectedLevel: 'BLOCKED',
    datasetPath: 'sql',
    targetCapabilities: ['spec.sql.model'],
    blockedBy: [{ kind: 'external-data', detail: '分页只能走 SQL 分页（原生 WebPage 全量切片已废弃）；固定数据 SQL 库未部署' }],
    interactionRequired: true,
    interactionTier: 'engine',
    interactionAssertions: ['翻页后条件保持，第 2 页数据连续'],
    dataContract: 'raw-rows',
    dataAssertions: ['orders.count'],
    renderAssertions: ['参数面板含页码/每页条数', '默认第 1 页'],
    knownGaps: ['固定数据 SQL 库未部署', '自造工具条超链翻页禁用（请求头膨胀/Tomcat 400）']
  }),

  // ===== F 复杂分析 =====
  T({
    id: 'F01', name: '本月/上月/环比', group: 'F', difficulty: 'advanced',
    prompt: '创建月度销售分析，展示本月销售额、上月销售额、环比增长率。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: 'rows 路无派生比率/窗口；SQL ratio 只覆盖同周期比率，没有月度位移（MoM）能力' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['analysis.mom.lastAmount', 'analysis.mom.prevAmount', 'analysis.mom.rate'],
    renderAssertions: ['三个指标并排', '环比增长率与真值一致'],
    knownGaps: ['MoM/窗口计算未接线']
  }),
  T({
    id: 'F02', name: '月度同比分析', group: 'F', difficulty: 'advanced',
    prompt: '创建年度销售分析，展示每月销售额、去年同期销售额和同比增长率。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '同期对齐（YoY）需要窗口/自连接，能力账本无条目；固定数据 SQL 库也未部署' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['analysis.yoy.currentAmount', 'analysis.yoy.previousAmount', 'analysis.yoy.rate', 'month.2026-06.amount'],
    renderAssertions: ['每月一行：本期/同期/同比', '同比数值正确'],
    knownGaps: ['YoY 同期对齐未接线']
  }),
  T({
    id: 'F03', name: '销售绩效排名与名次变化', group: 'F', difficulty: 'advanced',
    prompt: '创建销售人员绩效排名，按销售额排名，同时展示排名变化。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '窗口排名（RANK）与上期名次快照在能力账本无条目' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['employee.rank', 'employee.rank.amounts'],
    renderAssertions: ['按销售额降序排名', '名次变化列可见'],
    knownGaps: ['窗口排名/历史快照未接线']
  }),
  T({
    id: 'F04', longTermRegression: true, name: '经营分析综合报表', group: 'F', difficulty: 'advanced',
    prompt: '创建一个经营分析报表，综合展示销售额、利润、利润率、订单数、客户数，并提供趋势和排名分析。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '多指标+趋势+排名+多组件组合同时要求，覆盖 MoM/YoY/rank/组合布局多个未接能力' }],
    dataContract: 'report-aggregates',
    dataAssertions: ['orders.amount', 'orders.profit', 'totals.profitRate', 'orders.count', 'orders.customers', 'region.华东.amount'],
    renderAssertions: ['五个指标全部可见', '趋势图', '排名表'],
    knownGaps: ['多指标/趋势/排名组合未接线']
  }),

  // ===== G 修改与维护 =====
  T({
    id: 'G01', longTermRegression: true, name: '解读现有报表结构', group: 'G', difficulty: 'basic',
    prompt: '分析当前报表的结构，说明它使用了哪些数据集、字段、组件和计算逻辑。',
    expectedLevel: 'PASS',
    agentTools: ['list_reports', 'inspect_template'],
    analysisOnly: true,
    renderRequired: false,
    dataContract: 'raw-rows',
    dataAssertions: [],
    modificationRequired: false,
    modificationInvariants: [],
    renderAssertions: [],
    scope: 'read-only（不得修改/部署任何报表）',
    notes: '验收看 inspect.json 的结构提取与说明是否覆盖数据集/字段/组件/计算逻辑；read-only。'
  }),
  T({
    id: 'G02', longTermRegression: true, name: '增加利润率列（局部修改）', group: 'G', difficulty: 'intermediate',
    prompt: '在现有销售报表中增加利润率列，不改变其他列的顺序、样式和原有计算逻辑。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['template.patch.dataset', 'template.patch.cellValue'],
    targetCapabilities: ['spec.rows.cells'],
    modificationRequired: true,
    modificationInvariants: ['其他列顺序不变', '原有样式不变', '原有计算逻辑不变', '失败不 promote'],
    dataContract: 'prepared-rows',
    dataAssertions: ['totals.profitRate'],
    renderAssertions: ['新列出现在指定位置', '原有列内容/样式逐格一致'],
    knownGaps: ['patch 的 replace_dataset 能换数据集，但"新增列+逐格公式"组合未验证；cells.formula 渲染 pending'],
    notes: '修改范围控制是核心；预期 PARTIAL，不允许整表重生成。'
  }),
  T({
    id: 'G03', longTermRegression: true, name: '柱状图改为组合图', group: 'G', difficulty: 'advanced',
    prompt: '将现有报表中的销售额柱状图改为销售额和利润率组合图，保留原有数据和其他组件。',
    expectedLevel: 'BLOCKED',
    blockedBy: [{ kind: 'capability-gap', detail: '组合图渲染（D1）阻塞；patch 也没有图表结构修改 op，只有单元格/数据集替换' }],
    modificationRequired: true,
    modificationInvariants: ['原有数据集不变', '其他组件不变', '失败不 promote'],
    dataContract: 'prepared-rows',
    dataAssertions: ['month.2026-06.amount', 'totals.profitRate'],
    renderAssertions: ['原柱图位置变成柱+线组合图', '其他组件不变'],
    knownGaps: ['组合图渲染阻塞', '图表结构修改未接线']
  }),
  T({
    id: 'G04', longTermRegression: true, name: '批量表头配色', group: 'G', difficulty: 'intermediate',
    prompt: '将现有报表的表头背景色统一调整为蓝色，并检查修改前后其他布局和数据逻辑是否一致。',
    expectedLevel: 'BLOCKED',
    blockedCapabilities: ['template.patch.style'],
    blockedBy: [{ kind: 'ledger-rejected', detail: 'template.patch.style 在能力账本为 rejected（命名样式有损，README #60 明确不做）' }],
    modificationRequired: true,
    modificationInvariants: ['非表头区域样式不变', '数据与布局逐格一致', '失败不 promote'],
    dataContract: 'raw-rows',
    dataAssertions: ['orders.amount'],
    renderAssertions: ['表头背景统一为蓝色', '其他区域无变化'],
    knownGaps: ['批量样式 patch 结构化拒']
  }),

  // ===== H 自主规划与恢复 =====
  T({
    id: 'H01', longTermRegression: true, name: '统计期间缺失时先澄清', group: 'H', difficulty: 'intermediate',
    prompt: '创建一张销售分析报表，需求中没有说明统计期间。请先判断是否需要向用户确认，再继续创建。',
    expectedLevel: 'PASS_WITH_CLARIFICATION',
    requiredCapabilities: ['spec.rows.sum'],
    requiredClarifications: ['统计期间（起止日期或月份范围）'],
    dataContract: 'prepared-rows',
    dataAssertions: [],
    renderAssertions: ['按澄清后的期间渲染', '标题/说明写明期间'],
    notes: '评分含"是否先问再动手"；澄清后创建的报告按所选期间临时附加数据断言。'
  }),
  T({
    id: 'H02', longTermRegression: true, name: '只有省份名称的销售地图', group: 'H', difficulty: 'intermediate',
    prompt: '创建一个销售地图，但数据中只有省份名称，没有经纬度。请判断现有数据是否足够，并选择合理实现方式。',
    expectedLevel: 'PASS',
    requiredCapabilities: ['chart.vmap'],
    dataContract: 'prepared-rows',
    dataAssertions: ['province.广东省.amount', 'province.四川省.amount', 'province.count'],
    renderAssertions: ['用省份全名匹配内置地图着色', '不需要经纬度输入'],
    notes: '正确判断=区域图按名称匹配即可，不臆造经纬度、不改数据。'
  }),
  T({
    id: 'H03', longTermRegression: true, name: '部分可实现的经营看板', group: 'H', difficulty: 'advanced',
    prompt: '创建一张包含地图、组合图和交互跳转的经营看板。如果某项原生能力当前无法实现，请说明限制并完成其他部分。',
    expectedLevel: 'PARTIAL',
    requiredCapabilities: ['chart.vmap'],
    targetCapabilities: ['chart.hyperlinkCell', 'condition.then.link'],
    blockedBy: [{ kind: 'capability-gap', detail: '组合图渲染阻塞、交互跳转只有序列化证据；按需求应部分完成并诚实报告' }],
    interactionRequired: true,
    interactionTier: 'serialization',
    interactionAssertions: ['点击区域跳转（若实现）'],
    dataContract: 'prepared-rows',
    dataAssertions: ['province.广东省.amount', 'region.华东.amount'],
    renderAssertions: ['地图部分完成且可渲染', '未实现部分在交付说明中逐项列出'],
    knownGaps: ['组合图', '跳转交互'],
    notes: '关键验收=不把未实现能力包装成已实现（诚实报告）。'
  }),
  T({
    id: 'H04', longTermRegression: true, name: '验证失败先修复、不部署', group: 'H', difficulty: 'advanced',
    prompt: '报表生成后，如果真实引擎验证失败，请定位问题，修复后重新验证；如果仍失败，不要部署。',
    expectedLevel: 'PASS',
    requiredCapabilities: ['spec.rows.sum'],
    modificationRequired: false,
    weightMode: 'modify',
    faultInjection: 'operator-supplied：首轮必须给出一个会失败的真实引擎输入（例如引用不存在的列/非法图表映射），由验收执行者注入',
    dataContract: 'raw-rows',
    dataAssertions: ['orders.count'],
    renderAssertions: ['最终成功的报表可渲染'],
    scope: '失败时不得 promote/覆盖任何已部署报表',
    notes: '通过条件=首轮失败被如实报告、诊断到根因、修复后复验成功；若二次仍失败则必须停下且不部署（BLOCKED，不算 FAIL）。'
  })
];

// ---------------- 生成期硬校验 ----------------
function build() {
  // 1) 分组/数量/ID 唯一
  var ids = Object.create(null);
  var counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 };
  TASKS.forEach(function (t) {
    if (ids[t.id]) fail('duplicate task id ' + t.id);
    ids[t.id] = 1;
    if (!hasOwn(GROUPS, t.group)) fail('unknown group ' + t.group + ' for ' + t.id);
    counts[t.group]++;
    if (!/^[A-H][0-9]{2}$/.test(t.id)) fail('bad id format ' + t.id);
  });
  var longTermCount = TASKS.filter(function (t) { return t.longTermRegression === true; }).length;
  if (longTermCount < 10) fail('longTermRegression set=' + longTermCount + ' expected >= 10 (user requirement)');
  var waveCount = {};
  TASKS.forEach(function (t) { waveCount[t.wave] = (waveCount[t.wave] || 0) + 1; });
  var expectWave = { 'V0.1': 11, 'V0.2': 12, 'V0.3': 9, 'V0.4': 4, 'V0.5': 4 };
  Object.keys(expectWave).forEach(function (w) { if (waveCount[w] !== expectWave[w]) fail('wave ' + w + ' count=' + waveCount[w] + ' expected ' + expectWave[w]); });
  var expect = { A: 5, B: 5, C: 8, D: 5, E: 5, F: 4, G: 4, H: 4 };
  Object.keys(expect).forEach(function (g) { if (counts[g] !== expect[g]) fail('group ' + g + ' count=' + counts[g] + ' expected ' + expect[g]); });
  if (TASKS.length !== 40) fail('task count=' + TASKS.length + ' expected 40');

  // 2) 能力 ID 真实性 + required 必须 agentAvailable
  load(ROOT + '/application/capability_manifest.js');
  var MF = CapabilityManifest.build();
  var capMap = Object.create(null);
  ['chart', 'condition', 'write', 'page', 'product'].forEach(function (seg) {
    MF[seg].forEach(function (c) { capMap[c.name] = c; });
  });
  TASKS.forEach(function (t) {
    ['requiredCapabilities', 'targetCapabilities', 'blockedCapabilities', 'alternatives'].forEach(function (field) {
      t[field].forEach(function (name) {
        if (!hasOwn(capMap, name)) fail(t.id + ' references unknown capability ' + name + ' (field ' + field + ')');
      });
    });
    t.requiredCapabilities.forEach(function (name) {
      if (!capMap[name].agentAvailable) fail(t.id + ' requires non-agentAvailable capability ' + name);
    });
    if ((t.expectedLevel === 'PASS' || t.expectedLevel === 'PASS_WITH_CLARIFICATION') && t.requiredCapabilities.length === 0 && !t.analysisOnly) {
      fail(t.id + ' expects ' + t.expectedLevel + ' but has no requiredCapabilities');
    }
    if (t.longTermRegression !== true && t.longTermRegression !== false) fail(t.id + ' longTermRegression must be boolean');
    if (t.expectedLevel === 'BLOCKED' && t.blockedBy.length === 0) fail(t.id + ' is BLOCKED without blockedBy');
    if (t.expectedLevel === 'PARTIAL' && t.knownGaps.length === 0 && t.blockedBy.length === 0) fail(t.id + ' is PARTIAL without knownGaps/blockedBy');
    if (t.interaction.required && t.interaction.assertions.length === 0) fail(t.id + ' interaction required without assertions');
    if (t.modification.required && t.modification.invariants.length === 0) fail(t.id + ' modification required without invariants');
    var wsum = 0;
    Object.keys(t.weights).forEach(function (k) { wsum += t.weights[k]; });
    if (wsum !== 100) fail(t.id + ' weights sum ' + wsum);
  });

  // 3) 真值键存在
  var expected = JSON.parse(readText(FIXTURE_DIR + '/expected.json'));
  if (!expected.keys) fail('expected.json missing keys');
  TASKS.forEach(function (t) {
    t.dataAssertions.forEach(function (k) {
      if (!hasOwn(expected.keys, k)) fail(t.id + ' references unknown oracle key ' + k);
    });
  });

  // 4) agentTools 必须是真实 verb（从 fr_agent.ps1 的 ValidateSet 抽取，一处真相）
  var frAgent = readText(ROOT + '/agent/tools/fr_agent.ps1');
  var m = frAgent.match(/\[ValidateSet\(([^)]*)\)\]/);
  if (!m) fail('cannot find ValidateSet in fr_agent.ps1');
  var verbMap = Object.create(null);
  m[1].split(',').forEach(function (s) { verbMap[s.replace(/['"\s]/g, '')] = 1; });
  TASKS.forEach(function (t) {
    t.agentTools.forEach(function (v) { if (!hasOwn(verbMap, v)) fail(t.id + ' uses unknown agent verb ' + v); });
  });

  // 5) 提示词不得指定内部实现（机器门；业务词不受限）
  var BANNED = ['IR', 'ReportSpec', 'CPT', 'Object', 'plan2spec', 'JSON', 'API', 'vmap', 'vbar', 'vline', 'vpie', 'vheatmap', 'vbubble', 'hyperlink'];
  TASKS.forEach(function (t) {
    BANNED.forEach(function (w) {
      var re = new RegExp('(^|[^A-Za-z])' + w + '([^A-Za-z]|$)', 'i');
      if (re.test(t.prompt)) fail(t.id + ' prompt leaks internal term: ' + w);
    });
  });

  // 6) 写入 tasks/*.json（先清理旧产物，避免改名后幽灵文件）
  ensureDir(TASK_DIR);
  var stream = Files.newDirectoryStream(Paths.get(TASK_DIR), '*.json');
  var it = stream.iterator();
  while (it.hasNext()) Files.delete(it.next());
  stream.close();

  var index = [];
  TASKS.forEach(function (t) {
    var text = jsonText(t);
    var file = t.id + '-' + slugOf(t) + '.json';
    writeText(TASK_DIR + '/' + file, text);
    index.push({
      id: t.id,
      name: t.name,
      group: t.group,
      groupName: t.groupName,
      difficulty: t.difficulty,
      wave: t.wave,
      path: 'acceptance/tasks/' + file,
      expectedLevel: t.expectedLevel,
      datasetPath: t.datasetPath,
      requiredCapabilities: t.requiredCapabilities,
      targetCapabilities: t.targetCapabilities,
      renderRequired: t.render.required,
      interactionRequired: t.interaction.required,
      modificationRequired: t.modification.required,
      longTermRegression: t.longTermRegression === true,
      sha256: normHash(text)
    });
  });

  // 7) 资格投影（静态：只按账本与数据路径；不是执行结果）
  var runnableNow = [], externalData = [], levels = { PASS: [], PASS_WITH_CLARIFICATION: [], PARTIAL: [], BLOCKED: [] };
  var longTermRegression = [];
  var waves = { 'V0.1': [], 'V0.2': [], 'V0.3': [], 'V0.4': [], 'V0.5': [] };
  var reasonCounts = Object.create(null);
  index.forEach(function (e) {
    levels[e.expectedLevel].push(e.id);
    if (e.datasetPath === 'sql') externalData.push(e.id); else runnableNow.push(e.id);
    if (e.longTermRegression) longTermRegression.push(e.id);
    if (hasOwn(waves, e.wave)) waves[e.wave].push(e.id); else fail(e.id + ' unknown wave ' + e.wave);
  });
  TASKS.forEach(function (t) {
    t.blockedBy.forEach(function (b) { reasonCounts[b.kind] = (reasonCounts[b.kind] || 0) + 1; });
  });
  var fixtureManifestText = readText(FIXTURE_DIR + '/manifest.json');
  var benchmark = {
    benchmarkVersion: '1.0.0',
    specDate: SPEC_DATE,
    taskDefinitionsFrozen: true,
    frozenAt: SPEC_DATE,
    purpose: 'FineReport Agent 能力验收基准：自然语言业务需求 → 需求理解/语义映射/规划/原生能力选择/生成/真实引擎验证/后续修改',
    sourceOfTruth: 'acceptance/tools/build_tasks.js（任务定义源）；tasks/*.json 与 benchmark.json 是确定性产物',
    taskModelDoc: 'acceptance/README.md',
    capabilityLedger: {
      source: 'application/capability_manifest.js',
      note: '任务只引用账本真实能力 ID；requiredCapabilities 必须 agentAvailable=true（build 期硬校验）。不固化总数：账本会增长，基准只对它实际引用的 ID 负责'
    },
    fixture: {
      name: 'sales',
      version: JSON.parse(fixtureManifestText).fixtureVersion,
      manifest: 'acceptance/fixtures/sales/manifest.json',
      manifestSha256: normHash(fixtureManifestText),
      oracle: 'acceptance/fixtures/sales/expected.json',
      hashAlgorithm: 'sha256 over LF-normalized UTF-8'
    },
    groups: Object.keys(GROUPS).sort().map(function (g) {
      return { id: g, name: GROUPS[g].name, focus: GROUPS[g].focus, count: counts[g] };
    }),
    defaultWeights: weightsFor('default'),
    weightsNote: '不适用维度整块并入：无交互→render=30/interaction=0；修改类→safety=15/interaction=0；纯分析→需求/语义/规划/能力各20。每个任务自带 weights，和恒 100（README §6）。',
    resultLevels: ['PASS', 'PASS_WITH_CLARIFICATION', 'PARTIAL', 'BLOCKED', 'FAIL', 'UNSAFE'],
    evidenceTiers: {
      plan: 'Agent 执行证据（plan.json / patch.json），不是手写 spec',
      transcript: '可选：工具调用/对话全文',
      specValid: 'SpecValidator 通过（只证明语法/词表）',
      irValid: 'Ir.validate 通过（只证明 IR 形状）',
      cptSerialized: 'CPT 字节生成且图表/结构断言通过（只证明序列化）',
      engineLoaded: 'FineReport 引擎无异常打开（不代表渲染正确）',
      rendered: '真实渲染 PNG 有非空像素证据（非空白门）',
      dataTruth: '栅格逐格/聚合值与 oracle 一致',
      visual: '人工/视觉检查通过（布局与样式）',
      interaction: '参数/跳转/联动真实可用（web 行为）',
      analysis: '只读分析任务：inspect.json/transcript 的结构提取与说明（无 cpt/渲染层）',
      note: '九种证据不得合并成一个 PASS；结果记录器按证据层级校验等级'
    },
    eligibility: {
      note: '静态投影（只按能力账本 + 数据路径 + 外部依赖），不是执行结果；账本变化后重跑 build_tasks.js',
      runnableNow: runnableNow,
      externalData: externalData,
      expectedLevels: levels,
      longTermRegression: longTermRegression,
      waves: waves,
      blockedReasonCounts: reasonCounts,
      counts: { total: index.length, runnableNow: runnableNow.length, externalData: externalData.length, longTermRegression: longTermRegression.length }
    },
    tasks: index
  };
  writeText(BENCH_PATH, jsonText(benchmark));
  print(JSON.stringify({
    ok: true,
    tasks: index.length,
    groups: counts,
    runnableNow: runnableNow.length,
    externalData: externalData.length,
    levels: { PASS: levels.PASS.length, PASS_WITH_CLARIFICATION: levels.PASS_WITH_CLARIFICATION.length, PARTIAL: levels.PARTIAL.length, BLOCKED: levels.BLOCKED.length },
    out: 'acceptance/benchmark.json'
  }));
}

// 文件名 slug 由任务名/ID 决定？用固定英文短名表，避免拼音/翻译漂移
function slugOf(t) {
  var SLUG = {
    A01: 'sales-detail', A02: 'sales-summary', A03: 'product-top10', A04: 'dept-sales-subtotal', A05: 'inventory-report',
    B01: 'monthly-sales-layout', B02: 'region-month-cross', B03: 'dept-employee-hierarchy', B04: 'ops-dashboard', B05: 'multi-region-layout',
    C01: 'sales-bar-ranked', C02: 'monthly-trend-line', C03: 'product-share-pie', C04: 'sales-profit-combo', C05: 'sales-profit-bubble',
    C06: 'province-sales-map', C07: 'province-heatmap', C08: 'region-map-detail',
    D01: 'formal-report-style', D02: 'number-formats', D03: 'conditional-red-green', D04: 'table-borders', D05: 'zebra-total-highlight',
    E01: 'date-range-query', E02: 'region-filter', E03: 'province-city-cascade', E04: 'region-drill-link', E05: 'paged-orders',
    F01: 'month-over-month', F02: 'year-over-year', F03: 'sales-rank-change', F04: 'ops-analysis-suite',
    G01: 'analyze-existing-report', G02: 'add-profit-column', G03: 'bar-to-combo', G04: 'bulk-header-color',
    H01: 'clarify-period', H02: 'map-without-geo', H03: 'partial-dashboard', H04: 'repair-before-deploy'
  };
  if (!hasOwn(SLUG, t.id)) fail('missing slug for ' + t.id);
  return SLUG[t.id];
}

build();
