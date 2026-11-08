# Web 交互验证证据（2026-11-08，frserver 无头 Tomcat + 浏览器自动化）

环境：`scripts/frserver.ps1 start`（Tomcat 8705，catalina.base=logs/frserver_base，FR webapp=webapps/webroot），
登录 test/test（用户提供）；验证后已 `scripts/frserver.ps1 stop`。

## 已验证（web 真实交互）

1. **G3 生产日报（SQL 路）整页渲染**（截图 g3_web_page.png）
   - 表体 10 行 day@machine 值可见；合计行 33531/26531；
   - 完成率 <75 的三行（67.34/73.87/71.67）在 web 端显示为**红色** → cell highlight 条件在 web 生效；
   - 底部柱图（每日计划数）渲染；原生报表工具栏（首页/上一页/下一页/末页/打印/导出/邮件）可见。
2. **chart tooltip 悬停**（截图 g3_tooltip.png）：鼠标悬停柱形出现浮层
   `2026-09-16 / planned: 5333` → web 端 tooltip 交互真实可用（该图为引擎默认 tooltip；
   自定义 AttrTooltip 的 web 验证仍待做）。

## 发现（真实缺陷）

3. **内嵌 rows 数据集的图表在 web 端不初始化**（截图 rows_chart_web_blank.png 为旧产物；新产物更强）
   - 表格数据正常（A线80/B线40/C线150/合计270），图表区域 canvas 300×150、`getImageData` 采样 painted=0（完全空白）；
   - 同一服务器上 SQL 路 G3 柱图正常 → 不是服务器/浏览器环境问题；
   - 官方内嵌图 cpt（国旗柱形图等）序列化形状同为 `MoreNameCDDefinition + NameTableData(ds) + ChartSummaryColumn NoneFunction`；
   - 实验：Van 图改用 SumFunction 后 web 仍空白（headless PNG 反而只显示单类目）→ 已回滚官方 NoneFunction；
   - 结论：内嵌 rows → web 图表渲染链路存在缺陷（headless PNG 正确、web 空白），待定位
     （下一步：逐项对比官方 cpt 的 chart 节点/ChartDefinition 与我们的产物，或抓 web 端 chart JS 错误）。

## 未完成（本轮未验证）

- 自定义 AttrTooltip（richText/formats）web 悬停；
- 自定义工具栏按钮（能力自检_填报章：ToolBarManager/BuiltInSQLSubmiter 已序列化）web 可见性/点击；
- 超链钻取点击（候选 cpt：销售明细_超链 / 能力自检_条件动作满血 / 能力自检_热链热提示spec）；
- 填报提交（submit）——涉及写库，未授权 F8，不做。
