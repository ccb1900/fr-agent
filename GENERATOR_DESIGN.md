# lib 生成器的野心设计（v3 路线图）

> 背景：v2（lib/cpt.js）用"XML 字符串生成 + 双重校验"覆盖了单一模板形态。
> **v3.0 已完成**（sales demo 纯 API 路线全链路跑通），本文档保留三层架构全景与后续路线。

## 〇、v3.0 交付实证（2026-10-26）

| 项 | v2（字符串 XML） | v3.0（API 对象图） |
|---|---|---|
| 构建方式 | 人为拼 XML 字符串 | `Obj.build(SPEC)` 组装 FR 内存对象图，`wb.export()` 即产物 |
| 数据集 | 模板外置，部署后注入 | 自包含（EmbeddedTableData 直接进对象图） |
| 回归门 | Cpt.validate + assertRoundTrip | **同一套校验器复用于 API 产物**（全绿） |
| 渲染 PNG MD5 | E2391200…B96D2F | **E2391200…B96D2F（逐字节相同！）** |
| 产物证据 | demo_template_final.cpt | demo_api.cpt + fineagent\销售明细_api.{png,pdf,cpt} |

两条完全不同的路径收敛到同一份渲染字节——XML 编写层在整个视觉管线中已被消灭。


## 一、现状盘点（为什么 v2 无法规模化）

v2 的本质是 **" discoveries → XML 模板字符串" 的直译**。它只处理它预见过的形态：
新功能 = 新的一手 XML 考古 + 往字符串拼接里再嵌一段。复杂度线性涨到失控：
3D 聚合分析模板 160 格 × 4 数据集，用字符串拼是灾难。

根本认知：**cpt XML 不是 causa 原因，是结果**——它是 FR 内存对象图（WorkBook AST）
的序列化快照。手写 XML 是在"伪造快照"，遇上序列化器的暗柜（Default 化、加密 CDATA、
round-trip 变形）全部要靠考古兜底。

## 二、野心路线的三层结构

### 第 1 层【v3.0 已验证上线】API 对象图 = 唯一真源

实证（`lib/object.js` + `make_api.js`，验收日志 `api_trace.txt`，API 面清单 `v3_trace.txt`）：

```
new WorkBook() → new WorkSheet() → DefaultTemplateCellElement(col,row,value)
  ce.setStyle(Style.DEFAULT_STYLE.deriveHorizontalAlignment(2|4))   ← 一手验证的枚举直通
new Formula("=SUM(B3)") → putTableData → execute → ImageExporter → PNG 全链路 10 秒
FR 自序列化产物与 XML 考古所得范式逐条吻合（Alignment 两值原样出现在导出 cpt）
```

新生成的 XML 由 FR 自己产出——"我怎么写 XML"的整类问题不存在了。衍生 API 面同样在场：

| 功能族 | API 入口（反射确认） |
|---|---|
| 扩展/分组 | `setCellExpandAttr` / `DSColumn.setGrouper(RecordGrouper)` |
| 数据绑定 | `DSColumn` 全家族 setter：`setDSName / setColumnName / setColumn(TableDataColumn) / setCondition / setParameters` |
| 条件属性 | `setHighlightGroup`（HighlightGroup） |
| 超链/浮动窗 | `setNameHyperlinkGroup`（NameJavaScriptGroup） |
| 参数-控件 | `setWidget`（Widget） + `ReportParameterAttr` |
| 字体 | `FRFont.getInstance(String, int, float[, Color, ...])`——注意参数是 **字重+字号(pt)+渲染分辨率**，不是 size=pt×4（XML 里才是 ×4） |
| 条件高亮背景 | `ColorBackground` |

含义：**XML 从"编写格式"降级为"导出产物"**。写模板 = 组装对象图 → `wb.export()` 得到
原生合法 XML。考古类 bug（公式带=前缀、样式被默认化、标签顺序）从类型系统层面消失，
因为我们不再手写任何 XML——校验器只作为回归门。

### 第 2 层【设计】ReportIR：与模板形态无关的中间表示

spec 升格为 *IR*（JSON/JS 对象）——报表 = 可组合的块（block）：

```
IR = {
  blocks: [
    { type: 'title',    text, span },
    { type: 'header',   columns: [...] },
    { type: 'detail',   dataset: 'ds1', groupBy?, format? }   ← 扩展语义在 IR 层显式化
    { type: 'total',    Aggregate: sum/max/pct },
    { type: 'chart',    dataproc 规则, series 维度 },           ← 3D demo 家族
    { type: 'param',    widgets: [...], link: 'ds1.p_cols' },   ← 参数面板家族
    { type: 'link',     target, params }                        ← 超链/浮动窗
    { type: 'browser',  modules[], 分页/日期范围 }                ← v3.7：不是新 IR 节点，是 blocks 之上的共享构造器 lib/browser.js
  ],
  sheets: [...],
  themes: { colors, fonts }        ← TABLE_DESIGN_STANDARD 作为默认 theme 注入
}
```

新增功能族 = 新增 IR 节点 + backend 翻译，不再触碰已有字符串。

### 第 3 层【设计】官方语料 = 验收标准（反向测试）

把 19 个 demo 当作**回归测试集**而非模仿对象：

- **Import 正向**：读官方 cpt → 拆解对象图（本就是引擎做的事）→ 断言 IR 关键特征
  （公式节点数、样式值、扩展方向）——不给 IR"造假"机会
- **渲染对比**：官方模板渲染 PNG vs 我们重建版本的 PNG，像素级 diff（先做直方图/区域差，容忍字体渲染差异）
- 每个 demo 家族 = 一个"能力用例"，lib 生成器必须逐家丰收

## 三、实施顺序（按杠杆率）

1. **【v3.0 已完成】API 后端落地**：`lib/object.js`（样式 derive 链/边框分级/DSColumn/自包含数据集/合计公式）+ `make_api.js`。回归门 = 复用 Cpt.validate/assertRoundTrip
2. **【v3.1 已完成】IR 显式化**：`lib/ir.js`（blocks：title/header/detail/total + datasets）。`Obj.build(IR)` 换成块序线性布局引擎；验收 = 重构后 `demo_api.cpt` 与 PNG **逐字节不变**（101700BB… / E2391200…）
3. **【v3.2 已完成】条件属性家族**：IR `detail.highlight {column,op,value,bg}` → `DefaultHighlight + CommonCondition(col,op,value) + BackgroundHighlightAction(bg,0) + HighlightGroup(数组构造)`。实证：销量 ≥6000 只命中 6100 一格浅红；基线回归零扰动。API 面（probe_hl1-4）：Compare 常量 0=等/1=≠/2=＞/3=≥/4=＜/5=≤/10=contains；cell.setHighlightGroup 在 AbstractDynamicCellElement
4. **【v3.2 已完成】参数面板家族**（含数据过滤实证）：IR `param {widgets[{kind,label|editor|submit, name,text,value,x,y,w,h}], filters[{column,op,parameter}]}`（workbook 级，不占 sheet 行）→ `ReportParameterAttr + FormParameterUI(WParameterLayout) + WAbsoluteLayout$BoundsWidget(Widget,Rectangle) 显式包装布点` + `DSColumn.setCondition(CommonCondition(列,op,Formula('=$参数')))` 逐列挂 + 编辑器默认值经 execute() 参数表送达。实证：编辑器默认 '华东' → PNG 只剩华东 4 行合计 10,680；导出 cpt 含完整 `<ReportParameterAttr>` 段与官方 GettingStarted.cpt 同构（useParamsTemplate=false / Label WidgetName 已对齐）；基线回归零扰动
5. **【v3.2 已完成】图表家族**：IR `chart {kind:'bar'|'pie'|'line', title, dataset, category, value, heightPt}` + 预聚合数据集（spec 显式给数）→ `cell.setValue(ChartCollection)` + `Chart(Bar2DPlot 正体类) + Title + MoreNameCDDefinition(NameTableData 命名引用, ChartSummaryColumn+SumFunction)`。实证：PNG 四柱比例正确（10680/3720/10480/1540 账平 26420）；`<O t="CC">` 序列化 + roundtrip 保真；基线回归零扰动。注：官方 19 demo 中图表全为弹窗形态（ChartHyperPoplink），格内图表序列化真源自桩——这解释了为何官方语料考古找不到 t="ChartCollection"
6. **【v3.2 已完成】超链家族**：IR `detail.link { by, name?, reportlet }` → `ce.setNameHyperlinkGroup(NameJavaScriptGroup(NameJavaScript(名, ReportletHyperlink(path))))`（probe_link/2 + 官方 WorkBook3 语料）。实证：序列化同构断言全绿（组/链/路径/名）+ roundtrip；PNG 与基线一致（超链为浏览器行为不现形属预期）；基线回归零扰动。**v3.2 四大族（条件属性/参数面板+过滤/图表/超链）全部毕业**
7. **【v3.3 已完成】官方 demo 全量普查**：`make_verify.js` 三重门（读回 / 双读回序列化 MD5 自洽 / 双读回渲染 PNG MD5 等价），范围 reportlets 顶层 21 + `demo/` 递归 240（fvs 排除），普查表 `verify_table.txt` 实时落盘、PNG 存 `verify_png/`。顶层数据：读回 21/21、自洽 17/21、渲染 14/21。demo/ 全量数据：读回 240/240、渲染等价 221/240（92%）、自洽 153/240（64%）。分类结论：①form/basic/other/parameter 家族双绿 ✅（第一批 IR 重建语料）；②DataReport 6/6 self=false 但渲染全绿——序列化非确定性（UUID 字段）与语义稳定解耦；③19 个 render=false：3 硬败（引擎导出边界：Image_Export_Error_Info / DeathCycleException）+ 16 个内容级动态（NOW/TODAY/Refresh 时间装置，probe 实证同对象连渲 MD5 全等 → 引擎无罪）——重建时固定时间参数即可对齐。路径语义一手实证：相对 reportlets 根；顶层单文件名、demo/r.txt 相对形态均可达，绝对路径必炸
8. **【v3.3 里程碑达成】逐家族 IR 重建第一梯队 PASS**：官方 `demo/NewbieGuide/第一张报表` 重建版本 vs 官方渲染 **像素 diff 3.79% < 5% 验收线 PASS**（迭代 v1 5.68%→5.71%→3.79%）。全链路实证：官方 ds1（FRDemo 销量表）引擎一手 dump 45 行真值（零臆造、勾稽 9818 账平）→ official 样式/几何考古（s=2 表头=22pt、fit 比例 0.25、标题居中于全表宽）→ rawIR spec（`SPEC.IR` 直通）→ engine v3.3 七处扩容（palette/多系列/legend/axisY/barInterval/BiasTextPainter 斜线角格/corner/sumCols/space + detail 列覆盖）→ 像素 diff 驱动迭代（make_pixel_diff 横带热区 + crop_diff/bbox_probe/colscan 定位三件套，bbox 等大裁决字号）。图表带残差属 Van vs legacy 结构差，整体过线不追；基线回归数据双铁证（cpt=101700BB、PNG=E2391200 逐字节不变）。方法论沉 README #30
9. **v3.3 后续**：按普查表家族逐个重建（basic 双绿家族 25/26 起步，每家族复用"dump 真值→rawIR→pixel diff 迭代"管线）；备选 Hard Mode：analytics/financial2（资金流看板 5 渲染全绿）；form 家族属填报（渲染空格虚白，不诚实过关已排除）
10. **【v3.4 里程碑达成】第二家族 demo/basic/基本明细汇总表A（分组小计族）PASS 0.30%**（阈值<5%，三页堆叠画布 2116×6735 与官方逐像素一致）。管线迁移验证全绿：考古（11 行模型/20 式样式/纸型 EMU）→真值 dump（S产品 77 行+类别字典 8 行，pre-join 替代 DictPresent 零新 API）→engine v3.4 扩容（font name 参数/borders 逐边 style-int 透传/SummaryGrouper+Result $$$/小计行左父绑定 CellExpandAttr/paper 直构造三件套/cells 通用块/float 类型/页头重复 ReportPageAttr HR F=0 T=1）→像素三轮收敛 55.43%→16.06%→0.30%（两个铁律发现：官方明细行整行淡蓝底；官方每页重复标题条带+表头行）。基线双铁证逐字节保持（cpt=101700BB、PNG=E2391200）。沉 README #31；basic 家族第三刀候选：分组统计/高级条件分组（grouping 深化）、产品明细（钻取复用 v3.2 超链族）
11. **【v3.5 里程碑达成】DB 真数据路线打通（模板内置 SQL + 真实 SQL Server）**：IR 数据集新增 `kind:'sql'` → `DBTableData(NameDatabaseConnection(连接名), SQL)` 生产形态；runner 按 `SPEC.connections[]` 注册连接（凭据只留本机 spec，`testConnection()` 真连失败即退出），cpt 内只落连接名引用、零凭据。第一张真库报表 `reports/db_laser_aaa.js`（atom_live_demo.dbo.laser_aaa 122757 行 → 10 行日聚合）出数与同条 SQL 直查逐格全等（合计 33,531 / 日均 0.9501）。API 面一手实证：`NameDatabaseConnection(String)` 有参构造 + `DBTableData(Connection,String)` + `DatasourceManager.putConnection/getConnection/getConnectionNameIterator`；`putConnection` 会持久化进 FineDB（设计器侧同库，撤销用 `removeConnection`）。真库画像教训：同一日期的两种字符串格式 + 半表 NULL score，必须先摸画像再定 SQL 口径。基线双铁证逐字节保持。沉 README #32
12. **【v3.6 里程碑达成】真库第二刀：明细+小计+总计+参数钻取（双模板母子链）**：engine 侧三处纯增量——`ppArray()` ParameterProvider[] 工厂（`Parameter(name, Formula|String)`）、`datasets[].params` → `DBTableData.setParameters`、`linkTo.{params,targetFrame,extendParameters,width,height}` → `ReportletHyperlink` 同名 setter。母版 `reports/db_laser_subtotal.js`（day×stage 20 行明细 + 逐日小计左父绑定 A3 + 全表总计，3 页 A4 横向、每页重复标题带+表头）；子模板 `reports/db_laser_drill.js`（参数 `day` 过滤 → 24 小时行 + 当日合计），日期格 `=$$$` 传值（官方语料同构，序列化实证 `<Parameter name="day">`+`Formula(等号+三个美元符号) + TargetFrame=_self + extendParameters="true"`）。验收：`verify_sub_grid.js` 229 项 + `verify_drill_grid.js` 103 项逐格全对（真值 probe 同条 SQL 直查四段落盘），跨模板母子合计互等，加权口径反检（0.948809 ≠ 各日简单平均 0.950097）。新诊断面：`wb.execute` → `PageRWorkBook.getResultReport(i)` → `KMW.getValue()` 结果栅格 dump（env `RESULT_DUMP` 才开）。两条 ${} 边界实测：只在 SQL 替换、公式里原样留；替换是纯文本注入 → SQL 侧必须自带引号。排版三条铁（sub.png 像素实测）：数字步进 ≈9.5pt 决定列宽下限、FR 按行后画覆盖共享边（小计行"上深下浅"→ 统一浅内线）、加粗行高需 ≥36pt。基线双铁证逐字节保持（cpt=101700BB、PNG=E2391200）。沉 README #33。后续口径变更（内线也黑，README #34）顺带实证：`IR.palette.border` 是 title/header/detail/total 四路统一边框色通道，且 P 存在时 `headerBg` 走 `P.headerBg`——只给 border 不给 headerBg 会把表头底色顶成 undefined，palette 覆写必须成对给
13. **【v3.7 里程碑达成】数据浏览器（三表切换 + 日期范围 + 真分页）——从"做一张报表"升级到"做一套可复用构造器"**：新增 `lib/browser.js`（共享构造器，按 `cfg.modules` 生成导航/工具条/明细带）+ 三份薄 spec（`reports/br_laser_{aaa,aaa_gosa,pwr}.js`，各自只声明表名、列、标题、超链目标）。能力面：顶部三按钮跨模板跳转（`ReportletHyperlink` 相对 reportlets 根 + `extendParameters`）、日期范围 `${d1}/${d2}` 过滤、每页 20 条 SQL 端真分页、`首页/上一页/下一页/末页` 四按钮把页码算式回传自己的 cpt——注意这四条链发的不是字面量，而是**指向工具条格子的动态公式**（`=1`、`=MAX(1,当前页格-1)`、`=MIN(总页数格,当前页格+1)`、`=总页数格`；格址由布局器算出，不写死）。验收 `verify_br_grid.js` **3689 项全绿**：逐格对照独立手写 SQL 预言机、`_ord` 连续、page1≠page2、stage 过滤是子集、超链公式指向动态算出的工具条格址、"SQL 一页 = 渲染一页"（纸高 × 2/3 = PNG 像素高 ±3%）、负号落墨像素门。基线双铁证逐字节保持（cpt=101700BB、PNG=E2391200）。沉 README #35。**四条引擎一手实证**（前两条改的是分页方案，后两条改的是排版方案）：
    - **FR 存盘时吃掉 `ORDER BY`**：cpt 里每个 `[]` 标识符被补上表别名后缀，且 SQL 尾部 `ORDER BY` 在运行时失效。真分页只能用 `ROW_NUMBER() OVER(...) AS _ord` 物化排序键 + 外层 `WHERE _ord BETWEEN` 区间过滤。
    - **渲染展示序 = 明细第一列的绑定序**：想让行按 `_ord` 出现，`_ord` 必须是明细区第一个绑定列（不显示也要占位）。
    - **黑体 8pt 的 `-` 只占位不描墨**：像素探针（`reports/probe_minus2.js` 4 字号 × 4 字族矩阵）实证 SimHei 8pt 下 `-47.5` 首墨落在负号槽之后，9/10/10.5pt 黑体与 8pt 雅黑/宋体/Arial 正常。数据格里负号被吞 = 数据错读，比"列太宽"严重——构造器字号硬下限锁 9pt。`RESULT_DUMP` 的值层 dump 看不见这个缺陷，只有量像素才能。
    - **黑体在这条导出链上的字宽常数**：半角前向宽 ≈ 1.0×FP、全角（CJK）≈ 2.0×FP、粗体再 +10%（Java2D FontMetrics at AWT 36 实测 `w0=18 / w行=36`）。导航条/工具条宽度必须由文案反算（`textPt()`），手拍像素会把标题折行压到工具条上。另：导出链每根网格线 2px 粗、列 EMU 宽精确兑现、1.5pt/px（导出 2/3 缩放）。
14. 交付基线：官方每一个 demo 家族都能用 IR 构建出"视差 < 阈值"的重建版本；真库数据模板（内置 SQL + 命名连接）可生产交付

## 四、风险与预案

- DSColumn 的 Java 组装较深（DataFilter/ColumnRow/Grouper 组合），先以"读官方模板
  再反射深挖 setter 全家族"为考古路径，而不是读 XML 文档
- 加密 CDATA 只出现在"FR 序列化"方向，读方向永远正常——API 路线不受影响
- Nashorn 反射别再裸 `new J('x')`：Java.type 结果必须先赋变量再 new（已踩）
- `${d1}` 这类过滤是**纯文本注入**（v3.6 实测：只在 SQL 里替换、公式里原样留），不是绑定参数。当前只在受控本机 spec + 内网 viewer 下用；对外暴露前必须换成 DBTableData 真绑定参数（`?`），否则日期框就是 SQL 注入口
- 分页方案绑死在"FR 存盘吃 ORDER BY + 渲染按明细第一列重排"这两条引擎行为上；换引擎版本要先重跑 `verify_br_grid.js` 的 `_ord` 连续门复核，不能假定行为不变

## 五、一句话总结

**v2 把"怎么写 XML"变成了确定性；v3 的野心是把"什么是一个报表"变成确定性。**
XML 是 FR 的输出，不是我们的输入；correct-by-construction 的对象图 + 官方语料做验收线，
才是能吃下全部 demo 形态的结构。
