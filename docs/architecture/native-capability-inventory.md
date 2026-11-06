# Native Capability Inventory（原生能力库存，2026-11-06）

> 目的：回答"**FineReport 已经拥有、而 fr-agent 尚未开放的能力究竟有多少**"——不能因为 IR 没字段就认为 FR 不支持。
> 与 `capability-matrix.md` 的分工：矩阵=「已接入能力」的成熟度与优先级；本清单=「原生能力 vs 已开放」的五层差集与补法。

## 0. 五层模型（不可混为一谈）

| 层 | 判据 | 证据形态 |
|---|---|---|
| **E1 Engine** | FineReport 原生是否支持（类/API/真实样本） | 官方 demo 240 类账本、生产参考 CPT、jar 类面、官方 API |
| **E2 CPT/Object** | 能否构造对象、设属性、正确序列化 | `lib/object.js` 构造点 + 部署 cpt 断言 |
| **E3 IR** | 能否用稳定、可校验的结构表达 | `lib/ir.js` 键/白名单/结构化拒 |
| **E4 ReportSpec/Planner** | 能否从需求规划出该 IR | `spec_compiler.js`/`spec_validator.js`/`planner` 字段面 |
| **E5 Agent** | 能否发现/组合/生成/验证/修改 | plan→create→validate→preview→modify 实跑证据 |

**证据纪律**：每行"是/否"必须能指到 ①类/键源头 ②真实 CPT 样本 ③当前代码行号；不凭印象。置信度标：`确证`（一手代码/产物）/`待核实`（账本推断）。

## 1. 五层总览（本轮统计，确证）

| 指标 | 数量 | 来源 |
|---|---|---|
| object.js 构造的 FR 类 | **127** | `grep J('com.fr.*'` 去重 |
| ir.js 显式结构化拒 | **3**（multi_sheet / cell.sort / write.verifiers） | `ir.js:469,522,727` |
| demo 240 引用的 FR 类 | 223（missing 32 / partial 20 / noncore 44） | `logs/_demo_classes.txt` + coverage.md |
| 生产参考 3D翘曲 使用类 | 14（其中 **3 个 object 未构造**） | 生产 CPT grep + object 类清单差集 |
| ReportSpec 可表达字段 | dataset{kind,connection,entity,dimensions,metrics,rows,dateRange,filters,sort,topN} + presentation{chart,footnote,heightsPt,showTotal} | `spec_compiler.js` 字段面 |
| IR 已支持但 ReportSpec 无通路的能力族 | **≥8 族**（见 §3 B 类） | 差集 |

## 2. A 类清单：Object/CPT 已有，IR 缺失或被拒（补 IR 即可，成本最低）

| 能力 | E1 Engine | E2 Object | E3 IR | 判断 | 证据 |
|---|---|---|---|---|---|
| **多 Sheet** | ✓（FR WorkBook 多 WorkSheet） | **✓** `wb.addReport(sIR.name, sheet)` 在 sheets 循环内 | **✗ 拒** | **补 IR（放开 + 验证）** | object.js:786；ir.js:469 `UNSUPPORTED_CAPABILITY multi_sheet`（注释"object.js v3.2 预留 throw"已过时——实际已支持） |
| 编辑器校验 reg | ✓ NoneReg/PhoneReg/IDCardReg/CustomReg | ✓ `REGF + 'CustomReg'` 等 6 种映射 | ✓ `reg` 键 | 已通（无需补） | object.js:1557-1567 |
| 隐藏行列 | 待核实（FR 支持，场景需区分） | **待核实**（object 零命中 hidden） | ✗ | 归 C 类（需研究 setHidden） | object.js 无 hidden 构造 |
| 其余 object 消费键 vs ir 键 | — | — | — | 待逐项核实（object 消费键 ~100 个，ir 校验宽松，多数可达） | 见 §6 待核实 |

**A 类结论**：当前**唯一确证**的 A 类是**多 Sheet**——object 已有构造能力、ir 一条硬闸拒之。成本极低（放开 + 多 sheet 载体 + 真引擎验证），但业务频率低（240 demo 里多 sheet 少）。**建议列为 P2 低成本项，不抢跑 B 类**。

## 3. B 类清单：IR 已有，ReportSpec/Planner 无入口（Agent 用不到）——**本轮最大发现**

> 判据：`lib/ir.js` 有键/消费；`spec_compiler.js` 无字段 → plan/create 路不可达（rawIR 手写 spec 才可用）。

| 能力族 | E3 IR | E4 ReportSpec | E5 Agent | 业务频率 | 证据 |
|---|---|---|---|---|---|
| **条件格式/高亮（8 族）** | ✓ 全 verified | **✗** detail 硬写 `conditions:null/highlight:null` | ✗ | **极高**（golden 需求"<80% 高亮"） | spec_compiler.js:149；ir.js condition 族 |
| **参数面板（13 控件）** | ✓ 全 supported | **✗** 零 param | ✗ | **极高**（真实报表必有筛选） | spec_compiler.js 零 param；ir.js param |
| 富文本 / 字典 / 子报表 / 条码 / 斜线表头 | ✓ cells item 全有 | ✗ 无 cells 块概念 | ✗ | 中 | spec_compiler 无 cells |
| 展开属性（expand 方向/左父格） | ✓ | ✗ | ✗ | 中 | object.js putCell expand |
| 超链/钻取（linkTo/parameter js/reportlet） | ✓ | ✗ | ✗ | 中高 | spec 无 link 字段 |
| 页眉页脚 / 水印 / 浮动元素 / 工具栏 | ✓ 全 verified | ✗ | ✗ | 中（档案式报表高频） | spec 无 headerFooter/floats |
| 纸型（ReportSettings/PaperSetting） | ✓ | ✗ | ✗ | 中 | object.js:788-801 |
| cells 多行合并表头（rowSpan） | ✓（R3-0 刚收） | ✗ | 待验证 | 高（103/240 文件） | 见 capability-matrix §5 |
| 合计行 sumCols（多列求和）/ groupCustom | ✓ | ✗（仅 aggregate sum） | ✗ | 中 | ir.js total.sumCols |
| 图表装饰全族（tooltip/label/stack/条件色/轴/预警） | ✓ 多数 | ✗（chart 仅 kind/category/value） | ✗ | 中 | spec_compiler presentation.chart |
| 编辑器校验 reg | ✓ | ✗ | ✗ | 低 | spec 无 widgets |
| 运行期筛选语义 | IR param 在，但 SQL 编译期字面量 | ✗ | ✗ | 高 | sqlbuilder.js:117-121 |

**B 类结论**：ReportSpec 是**窄腰**——IR 已开放的 ≥8 族能力 Agent 完全用不到，只能 rawIR 手写。**这是"Agent 独立创建真实报表成功率"的最大瓶颈**，也是成本/价值比最高的方向：不需要新构造、不需要研究 FR API，只需在 spec_compiler/planner 开字段 + 校验 + 载体。

## 4. C 类清单：Object/CPT 部分实现或有原生类未接（需补齐）

| 能力 | E1 | E2 | 状态 | 证据 |
|---|---|---|---|---|
| 单元格排序 cell.sort/SortHeader | ✓ FR 类可加载 | ✗ 未调用 setCellSortAttr（仅注释） | 缺语料（240 demo 无非空 cellSortAttr） | ir.js:522 rejected |
| 写回 Verifier 族 | ✓ ValueVerifier 类在 | ✗ VerifyItem≠Verifier | 挂点未通 | ir.js:727 rejected |
| 多 sheet（A 类同项） | ✓ | ✓ | 见 §2 | — |
| 隐藏行列 | ✓ | ✓ 已接（C2，2026-11-06） | **完成**：IR `sheets[].hideRows/hideCols` + object 在 sheet 构建末 setRowHeight/setColumnWidth 归零 + ReportSpec `sheet.hideRows/hideCols` | 载体 test_hidden（rawIR）+ hidden.json（spec）：引擎 RowHeight[1]=0 / ColumnWidth[2]=0，PNG 表头行与「完成」列消失（hideCols:[2]）；基线 MD5 不变 |
| 绝对布局（WAbsoluteLayout） | ✓ | ✓ BoundsWidget 已构造（浮动元素） | 部分（仅浮动，非整表布局） | 3D翘曲 5 处 |
| TemplateInfoAttrMark | ✓（**cloud 插件包** `com.fr.plugin.cloud.analytics.attr.*`） | ✗ | **非缺口（noncore）**：core 包 `com.fr.base.iofile.attr.*` 无此类（ClassNotFoundException 探针实证），生产参考用的是云分析插件类，按范围圈定（`com.fr.plugin.cloud.*`=插件配置类）不追 | probe_ti.js + 3D翘曲 cpt class= 证据 |
| WidgetDisplayEnhanceMarkAttr | ✓ | ✗ | 未接 | 生产参考 1 处 |
| StrategyConfigsAttr | ✓ | ✗ | 未接（配置类，价值低） | 生产参考 1 处 |
| coverage missing 32 / partial 20 | 部分 ✓ | 部分 ✗ | 明细见 coverage.md A 表 | — |

**C 类结论**：cell.sort/verifiers 是"引擎有墙、项目明确拒"（诚实留账）；TemplateInfoAttrMark 经探针更正为 **cloud 插件类（noncore）**，不属于本项目范围、非缺口；隐藏行列已按 C2 完成（IR+object+ReportSpec 三层 + 引擎/PNG 实证）。

## 5. D 类清单：Engine 原生支持，项目完全没接入（按业务价值排序）

| 能力 | E1 | 证据 | 价值 | 建议 |
|---|---|---|---|---|
| 地图 vmap | ✓（同类 VanChartMapPlot 在核心 jar；官方 mapfather.cpt 无头渲染已证） | API 面已抓：setMapType(MapType)/setMatchResult(MapMatchResult)/setGeoUrl/setViewCenter/setZoomLevel/setGisLayer（probe_r4m19 一手） | 中 → **待独立工单**：需地图数据模型（MapType/MatchResult/地理层）整包，非单键接线 | P2 留待（引擎可行、链路未通） |
| 热力图 heatmap | ✓ 核心 heatmap 包 | manifest pending | 中低 | P3 |
| Poly 块面 | ✓ 核心 jar | probe_r4m21 方法面 | 低 | P3（240 demo 仅 4-5 处） |
| 组合图 VanChartCustomPlot | ✓ | **构造+序列化已证，渲染未达成**（D1，2026-11-06） | 中 → **阻塞** | 已打通：CustomStyle.parse/CustomPlotList/CustomDefinition+DefinitionMap(枚举键) → 部署 cpt 与官方 柱形图变形.cpt 同构；但渲染分类轴恒单类（4 行=1 类 6 系列），缺子图系列分配 ConditionCollection(AttrSeriesStackAndAxis)+分类 Present；plain Chart 外层 NPE。证据 probe_customplot*/probe_customtype/probe_customdef* + logs/d1_combo*。重开条件：先有可运行系列分配语料 |
| 图表热链 ChartHyperRelateCellLink | ✓ | manifest pending | 低 | P3 |
| 多 Sheet | ✓ | object 已支持（见 A 类） | 中低 | **A 类优先于 D** |
| 模板继承/样式复用 | 待核实 | ir 零命中 | 中 | 待核实 |

**D 类结论**：D1 已实施到「构造+序列化与官方同构」，渲染受子图系列分配机制阻塞（三轮规则封存，重开条件已写）；D2 vmap API 面已抓但需地图数据模型整包；D3–D5 维持 pending 不接线。D 类整体仍是 P2–P3，不抢 B 类。

## 6. 待逐项核实（诚实标注，不臆造）

1. object.js 消费键（~100 个）与 ir.js 白名单的逐项可达性——ir 校验宽松（多数键不枚举），"可达"置信度高但未逐项跑通。
2. ~~FR 隐藏行列 API 与真实样本~~——已核实（C2）：语义即行高/列宽归零（sheet.setRowHeight/setColumnWidth(FU 0)），在 sheet 构建末应用才不被块行高覆盖；载体与 PNG 实证见 §4。
3. 3D翘曲 `NoneReg` 在 object 的对应（REGF 族已覆盖 none/phone/idcard/mobile/postcard/custom，生产用的是 NoneReg=默认无校验，属"零触碰"，不需构造）——已核，非缺口。
4. 官方 API 文档面（help.fanruan.com）逐条对照——本轮未联网抓取，以 demo 类账本 + 生产 CPT + jar 类面为证据源。

## 7. 下一阶段策略（按用户 A/B/C 模型）

| 类型 | 工作方式 | 优先级 | 本轮后建议 |
|---|---|---|---|
| **B：IR 已有、Agent 无入口** | 补 ReportSpec/Planner 字段 + 校验 + 载体 | **最高** | **R3-1 条件高亮 → R3-2 参数面板**（原路线不变，且现在有库存证据支撑） |
| A：Object 已有、IR 缺 | 放开 IR + 载体验证 | 高（single item） | 多 Sheet 列为 P2 低成本项 |
| C：Object 部分/原生类未接 | 复用已有构造/研究 API | 按价值 | 隐藏行列已完成（C2）；TemplateInfoAttrMark 裁定 noncore 不追；cell.sort/verifiers 诚实拒留账 |
| D：Engine 支持未接 | 研究成熟 API + 真实样本 | 低（P2–P3） | vmap/poly/heatmap 继续 pending |

**架构原则（本轮确立）**：**fr-agent 不做 FineReport 的重新实现，只做"让 Agent 安全完整调用 FR 已有能力"的语义接口层。** 新增能力的默认动作顺序 = 查原生 → 查 Object/CPT → 查 IR → 补 spec/planner，而不是从 IR 往下推。
