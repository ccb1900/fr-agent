# 错误处理、重试与停止

原则：**失败不假绿，未决不硬猜，越权不绕过**。工具链的退出码与 `nextActions` 是判定面，不要靠"看起来产物在"来宣布成功。

## 1. 三层判定，缺一不可

| 层 | 看什么 | 不足时的结论 |
|---|---|---|
| 合同行 | `ok` / `exit` / `runId` / `result` | `exit≠0` 即该步失败；`ok=false` 不继续假装成功 |
| 产物 JSON | `result` 指向的 UTF-8 文件 | 合同行只是指针，详细判定必须读文件 |
| 验收 | `validate.json` / `preview.json` / `artifact.json.acceptance` | `create` 的 `exit=0` 不等于数据正确 |

`acceptance.ok` = 执行 ok + 无 `severity=error` 诊断 + `validation.ok !== false`。`validate.json` / `preview.json` 的 `runId` 与本 run 不一致时不会并入（防陈旧验收）。

## 2. 常见失败与动作

| 现象 | 分类 | 动作 |
|---|---|---|
| `exit 2` / 参数缺失 / RunId 非法 / Intent 不可读 | 用法 | 按 `nextActions` 补齐；路径用仓库内 ASCII 相对路径 |
| `resolve` `unknown` (exit 1) | 语义缺口 | 不编字段；用 `discover` 的名单问用户换词 |
| `resolve` `ambiguous` (exit 0) | 需要澄清 | 读 `candidates` / `requiresConfirmation`，**问用户选哪个**，不自动选 |
| `plan` `ambiguous` (exit 1) | 语义未决 | 读 `unresolvedQuestions` 一次问清；改 Intent 后**换新 RunId** 重跑，原文保留 |
| `plan` `rejected` (exit 1) | 能力/前置检查失败 | 读 `issues` / `PREFLIGHT_FAILED` 诊断；如实告知不支持点，不绕过 |
| `RUNID_EXISTS` | 该 run 已有引擎/部署产物 | 新报表/重试用新 RunId；撤销已部署改动用同 RunId 的 `restore` |
| `RUNTIME_BUSY` | 另一 FR JVM 持锁 / 哨兵身份不可确认 | 等待后重试。**绝不**删 `active.json`/`java.pid`、清锁、另起 JVM |
| `QUEUE_TIMEOUT` | 等 OS 命名 Mutex 超时 | 等待后重试；说明 Runtime 单实例是既定约束 |
| `GATE CLOSED` / `cpt_validate` 失败 | 产物被判不合格 | 停止，不部署、不交付；读 `runresult.json` 的诊断与 stage |
| `validate.json` 有 `pass:false` | 数据/栅格不自洽 | 停止；查合计/公式/真值，不许改断言迁就 |
| `preview.json.blankish=true` | PNG 疑似空白 | 停止交付；查图表 title/行高/序列化门，不靠"文件存在"糊弄 |
| PatchSpec `UNSUPPORTED` / `UNIMPLEMENTED` | 白名单外 op | 告知用户不支持并给替代；不偷试、不用重新生成伪装成修改 |
| staging `diffClean=false` / `execution.pass=false` / `render.pass=false` | 修改回归未过 | 报失败，不交付、不 promote |
| `promote` `SOURCE_CHANGED` / `MANIFEST_MISMATCH` / `DEPLOYED_CHANGED` | 部署哈希链不一致 | fail-closed 正确行为；报告现状，不手工替换文件 |

## 3. 重试规则（三轮上限）

同一问题最多三轮：正常调用 → 按 `nextActions` 修正 → 只处理明确剩余。三轮仍失败就**停下来**，把阻塞原因、已读的诊断、未验证事项写清楚交回用户，不继续造新尝试、不换更底层入口绕过。

可重试：等待类（`RUNTIME_BUSY` / `QUEUE_TIMEOUT`）、参数用法类、语义澄清后重跑（换 RunId）。

不可重试/不可绕过：能力未承诺、白名单外 op、验证失败、部署哈希链冲突、凭证/环境缺失需要用户授权。

## 4. 中文路径坑（PS 5.1）

`fr_agent.ps1` 本身是 ASCII-only 脚本，在 GBK 主机上把中文路径作为参数传回会打乱字符（GOLDEN e2e 脚本第 6 步注释有记录）。

- `-Spec` / `-Intent` / `-Patch` / `-Png` / `-Pdf` 一律用**仓库内 ASCII 相对路径**。
- 报表名 / `outName` 可以中文（产物名在 JSON 里以 UTF-8 读）。
- 预览中文名 PNG：从 `artifact.json` 读 `pngPath`，在调用方用 .NET `System.Drawing` / `FileInfo` 检查存在性、字节数、空白采样；不要把中文路径再喂回 `-Png`。`preview` verb 本身零引擎、只读，用 ASCII 副本路径或 PDF 路径也可。

## 5. 部署授权（不可逆/对外动作）

`promote` 会**原子覆盖正式部署件**，`restore` 会**回退正式部署件**。两者都是已验证的 fail-closed 链（SHA-256 全链复核 + staging 绑定 RunId + 原件 `.orig.cpt` 保留），但**仍需用户明确授权**。

- 触发授权的措辞：用户明确说"上线 / 部署 / 覆盖正式报表 / 回退上次部署"。
- 未授权：交付 staging 路径与 manifest 判定，明说"尚未覆盖正式报表"。
- 用户要求"改一下正式报表"但没说部署：先 `modify` 出 staging，把差异与回归结果给他看，再问要不要 promote。
- 不删真实报表/数据库/用户文件，不改 FR 安装目录里的生产文件当测试（AGENTS §N）。

## 6. 失败时怎么向用户报告

四句话，不粉饰：

1. 哪一步、哪个 `runId`、什么 `reason`/`error`
2. 已读的诊断（哪个 check 没过、哪个 stage failed）
3. 工具给的 `nextActions`，以及哪些已经试过、结果如何
4. 哪些还没验证、需要用户做什么（选词、给真值、肉眼过目、授权部署）

禁止：把 `exit=0` 说成"数据正确"、把 staging 件说成"已上线"、把 `layerEvidence` 说成"端到端验证过"、把不支持的能力静默删掉。
