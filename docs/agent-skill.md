# fr-agent Agent Skill 安装与发现（ZCode）

> 2026-11-09 实证。ZCode 的技能发现逻辑在其主程序 `resources/glm/zcode.cjs`（`resolveDefaultSkillRoots` / `NodeSkillAdapter.discoverSkills`）。

## 两层目录，各司其职

| 路径 | 角色 | 发现优先级 | 作用域 |
|---|---|---|---|
| `D:\fineagent\.agents\skills\finereport\` | **源码**（随仓库版本控制、随提交走） | 项目级 #5 | 仅当会话 cwd 在 `D:\fineagent`（或其子目录）且启动时已存在 |
| `C:\Users\<user>\.agents\skills\finereport\` | **安装件**（ZCode 实际跨会话加载） | 用户级 #3 | 所有工作区、所有新会话 |

发现顺序（从 ZCode 代码读出）：显式 `skills.roots` → `~/.zcode/skills` → `~/.agents/skills` → 从 cwd 到 git 根逐级 `.zcode/skills` → 同范围 `.agents/skills` → 插件 roots。同一级里 `.zcode` 先于 `.agents`。技能身份是**文件路径**；同名不同路径都发现，但按优先级第一个胜出。

因此：**只放项目级 `.agents/skills` 不够**。运行中新建的项目级技能对已打开会话的 UI 索引不热更新；其它工作区/cwd 的会话根本不扫这个目录。用户级副本才是稳定入口，和本机已能识别的 `ambitious-execution` 同级。

## 安装 / 同步

改完仓库里的 `SKILL.md` 或 `references/*.md` 后：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sync-fineresport-skill.ps1
```

脚本把 7 个文件按 SHA-256 差异复制到 `~/.agents/skills/finereport/`（幂等，无变化不写）。**仓库是唯一真相源**，用户目录只是安装件；不要直接改用户目录里的文件，改动会被下次同步覆盖。

新开一个 ZCode 会话后验证：

- 输入 `/` → Skills 组里应出现 `finereport`
- 或发 `/finereport 出一份生产日报`
- 或发自然语言「出一份激光机台生产日报，按业务日期分组，带合计」，看是否自动触发

ZCode 的模型侧元数据（`name` / `description` / `when_to_use`）在会话启动时注入；装好后**必须新开会话**，当前会话不会热更新。

## 文件格式（已验证）

`.agents/skills/finereport/SKILL.md` 是 flat YAML frontmatter：`name` 与目录名一致、`description` <1024 字符、顶层标量；`references/` 下 6 份按需读。目录名不以 `.` 开头，文件精确叫 `SKILL.md`（大小写敏感）。这些条件全部满足——本轮「识别不到」不是格式问题，是**根的作用域**。

## 排障顺序（diagnosing-skills 口径）

1. 子系统是否开：`features.skill` / `skills.enabled` 都默认 true；`~/.zcode/cli/config.json` 无禁用项。
2. 是否被发现：Settings → Skills 或 `/` 菜单，从**该会话实际 cwd**看。
3. frontmatter：`name`/`description` 缺失、>1024 字符、畸形行 → 被丢弃。
4. 是否被更高优先级同名技能 shadow：查 `~/.zcode/skills/finereport`、`<cwd>/.zcode/skills/finereport`；本轮已查，均无。
5. 是否被 `skillOverrides` 按绝对路径 `enable:false` 禁用；本轮配置无此项。
6. 已发现但不触发：description 触发词不够前；本描述首句已写「只要用户要求出报表…就应使用本技能」。

## 与 MCP 的关系

冻结 MCP / Node / Java MCP。Skill 负责「教 Agent 怎么完成报表任务」，`agent/tools/fr_agent.ps1` 负责执行；将来若要多客户端标准协议，再在现有 Tool API 上加 MCP Adapter，不改动 Skill 的工作流知识。
