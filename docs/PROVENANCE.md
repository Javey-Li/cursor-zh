# 来源与许可（Provenance）

这份文档把 `cursor-zh` 里每一类内容的**来源、许可状态、我们如何使用它**写清楚，包括那些"许可不完美"的部分。目的很简单：任何人（包括上游作者）都能据此判断我们做了什么、有没有越界。

> 本文是诚实披露，不是法律意见。若你是权利人并认为某项使用不当，请见文末的[下架与联系](#下架与联系)政策。

## 一、总表

| # | 内容 | 位置 | 来源 | 许可 | 我们如何使用 |
| --- | --- | --- | --- | --- | --- |
| 1 | CLI、安装编排、状态与备份逻辑 | `cli/`、`tools/` | 本项目原创 | MIT（见根目录 `LICENSE`） | 原创代码 |
| 2 | Cursor 补丁引擎（core / patcher-cursor） | `packages/core`、`packages/patcher-cursor` | [Uncle-Gao/Live-Translator-Hub](https://github.com/Uncle-Gao/Live-Translator-Hub)，固定 commit `c667b8b` | MIT | **源码 vendored**：裁剪为 Cursor-only，保留原版权与许可声明（见根目录 `NOTICE`） |
| 3 | 字典种子数据 | `dictionaries/zh-CN.json` 中由 `role: seed` 来源贡献的条目（见 `manifest.json`） | 社区汉化项目 `vibepm666/cursor-localization-zh`，固定 commit `88f93c6` | **上游未提供 LICENSE** | **仅作为数据种子/翻译记忆**：在自有 schema 下重新过滤、合并、去重；不复制其代码、脚本或发布包 |
| 4 | 字典条目（MIT 部分） | 同上（`role: mit` 的两个来源，条数见 `manifest.json`） | [Uncle-Gao/Live-Translator-Hub](https://github.com/Uncle-Gao/Live-Translator-Hub) 的 `dictionary.zh-CN.json`，commit `c667b8b` | MIT | 按条目并入，来源与条数记录在 `manifest.json` |
| 5 | 字典条目（MIT 部分） | 同上 | [lsh2253823857/cursor-i18n-tool](https://github.com/lsh2253823857/cursor-i18n-tool) 的 `dict.js`，commit `a5dbf9e` | MIT | 以文本方式解析（**不执行**其代码）后按条目并入 |
| 6 | 本项目新增词条 | 同上（`role: own`） | 本项目 | MIT | **311 条词条（去重后贡献 310 条）+ 5 条正则模式**，覆盖设置页、Agent、自动化、远程控制、浏览器/网络、用量、PR 审查、安全提示等；最终字典合计 2997 条唯一词条 / 244 条模式 |
| 7 | VS Code 中文语言包 | 不随仓库分发；CLI 在缺失时通过 Cursor 扩展 CLI 安装 | Microsoft（Visual Studio Code 语言包） | Microsoft 的许可与 Marketplace 条款 | **不打包、不再分发**；只调用官方安装通道 |
| 8 | Cursor 应用本体 | 不随仓库分发 | Anysphere | 专有 | 只在本地修改用户已安装的副本，不重新分发 |

表中第 3 行是本项目**唯一许可状态不完整**的部分，下面单独说明。

## 二、关于"无 LICENSE 的上游字典种子"

事实：

- 上游社区汉化项目（`vibepm666/cursor-localization-zh`）**没有提供 LICENSE 文件**。
- 它包含大量英文 → 简体中文的界面短句对，这些短句本身多是 Cursor / VS Code 的界面文案（英文原文版权属各自权利人），中文译文的著作权归属在法律上并不明确。
- 我们在早期就把这批数据当作**翻译记忆/种子**使用，并在此基础上补充了 311 条自己的词条与 5 条模式。

我们的做法与边界：

1. **不复制代码。** 仓库中没有任何上游 vibepm666 的脚本、安装器或发布产物；引擎来自 MIT 的 `Uncle-Gao/Live-Translator-Hub`。
2. **不整份搬运。** 数据在我们的 schema 下重新过滤与合并，键排序、确定性构建；`dictionaries/manifest.json` 记录每个来源的 commit、sha256 与贡献条数，`dictionaries/conflicts.json` 逐条记录冲突取舍（选了哪条、拒了哪条、来自哪个来源），可被追溯与审计。
3. **明确署名。** README、本文、`NOTICE` 与 `manifest.json` 的 provenance 字段都写明种子数据来自上游社区项目。
4. **不主张对这些条目的排他权利。** 我们不会对种子数据主张超出其来源的许可；本项目的 MIT 声明覆盖我们自己编写的内容（代码、schema、工具、文档、原创词条）。
5. **可移除。** 收到权利人请求时按文末政策处理，包括从仓库历史中移除相关数据。

风险评级（供使用者判断）：**中低**。理由是不涉及代码复制、不涉及二进制再分发、数据为界面短句为主；但"无 LICENSE"意味着使用授权本身不确定，这一点我们选择披露而不是掩盖。

## 三、为什么要 A + B 混合

Cursor 的界面由两块拼成，用一套方案覆盖全部会既费力又不稳：

| 层 | 覆盖对象 | 方案 | 为什么这样选 |
| --- | --- | --- | --- |
| **A：官方语言包** | VS Code 共用界面：编辑器、文件树、命令面板、设置页大部分、扩展市场 | 安装微软发布的 VS Code 中文语言包 | 官方翻译质量高、随内核版本更新、**我们不需要重新翻译上万条字符串**，也不需要为这些文案承担翻译错误的责任 |
| **B：运行时字典** | Cursor 自研界面：Agent、Composer、Cursor 设置项、云端 Agent、用量统计等 | 向 workbench 注入小型字典引擎 + 我们维护的字典 | 这些字符串官方语言包**不覆盖**，只能自己维护；字典可版本化、可增量、可统计覆盖率 |

A + B 的分工原则：

- 语言包能覆盖的，**不重复造轮子**，避免同一句文案出现两种译法。
- 只有语言包覆盖不到的 Cursor 专有文案才进我们的字典，因此字典规模可控（条目量级在千级而非万级），也便于人工审校。
- 字典与引擎都在本仓库，可审计；语言包保持"用户机器上安装的官方组件"，我们不介入其分发。

**当前实现状态**：CLI 自动化两层：A 层语言包在缺失时通过 Cursor 扩展 CLI 安装并写入 `locale.json`，B 层注入引擎与字典。工具不打包、不再分发微软组件；离线或代理导致自动安装失败时，才需要用户手动在扩展市场安装。

代价（如实说明）：

- 语言包与内核版本必须匹配，版本错配会导致部分界面回退英文；
- 两层的更新节奏不同（语言包随 VS Code 发布，字典随本仓库发布），因此**覆盖率永远是部分的**；
- A 层通常由 `install` 自动安装；离线/代理失败时需要手动一步，否则会看到"部分中文 + 部分英文"；
- macOS 原生菜单栏不属于任何一层，保持英文是已知限制。

## 四、没有使用的东西

为避免误解，明确列出**没有**做的事：

- 没有复制 `vibepm666` 或其衍生仓库（如 GBall5599、glxs3666 等）的**代码**。
- 没有在本仓库或发布物中**打包微软语言包 VSIX**。
- 没有**再分发 Cursor 的安装包或二进制**。
- 没有把上游字典文件原样放入仓库（只按条目并入自有 schema）。
- 没有移除任何第三方版权声明；MIT 代码的原始版权声明保留在 `NOTICE` 与源文件头部。
- 没有**执行**上游 `cursor-i18n-tool` 的 `dict.js`：它是被当作文本解析的，从不 `require` 或运行。

## 五、如何自行核对

```bash
# 1. 每个来源的 commit / sha256 / 贡献条数
node -e "console.log(require('./dictionaries/manifest.json').sources)"

# 2. 总条数与模式数
node -e "const m=require('./dictionaries/manifest.json');console.log(m.totalUniqueEntries, m.patternCount, m.conflictCount)"

# 3. 冲突取舍（选了谁、拒了谁）
node -e "console.log(require('./dictionaries/conflicts.json').byPair)"

# 4. 字典里的来源清单（名称 / URL / 许可 / 条数 / role）
node -e "console.log(require('./dictionaries/zh-CN.json').sources)"

# 5. MIT 代码的原始声明
grep -rn "Live-Translator-Hub\|MIT" packages/ NOTICE
```

（`dictionaries/` 下的文件是构建产物，已随仓库提供；若你改过构建输入，先运行 `python3 tools/build_dictionary.py` 再核对。）

如果你核对后发现某个来源的标注有误，请提 issue，我们会修正——标注错比没标注更糟。

## 六、下架与联系

我们尊重上游作者与权利人的意愿。若你是以下任一方，并希望我们停止使用某些内容：

- 上游社区汉化项目的作者（种子数据）；
- `Uncle-Gao/Live-Translator-Hub` 或 `lsh2253823857/cursor-i18n-tool` 的作者（MIT 代码/字典）；
- 任何认为本仓库内容侵犯其权利的权利人；

请通过以下任一渠道联系我们：

1. **GitHub Issue**：在本仓库开 issue，标题以 `[provenance]` 开头，说明涉及的文件、条目范围与你的诉求（不需要公开个人信息）。
2. **私密渠道**：若不便公开，请按 [SECURITY.md](../SECURITY.md) 的私密漏洞报告入口提交，并注明 "provenance request"。
3. 若 GitHub 渠道不可用，可在任意一个相关 issue 中留言，维护者会提供备用联系方式。

处理承诺（尽力而为，非法律承诺）：

| 情形 | 我们的动作 | 目标时间 |
| --- | --- | --- |
| 明确要求移除某批数据或代码 | 从当前分支移除，并在 `docs/PROVENANCE.md` 记录变更；必要时重写历史 | 确认后 7 天内 |
| 要求补充/更正署名 | 修改 README、本文与 `NOTICE` | 7 天内 |
| 要求停止分发某个组件 | 移除该组件并发布说明，评估替代方案 | 14 天内 |
| 许可条款澄清（例如补上 LICENSE） | 按其许可重新评估使用方式，必要时调整 | 14 天内 |

在争议解决前，我们倾向于**先移除、后讨论**：可用性让位于尊重权利人。

## 七、变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-03 | 初版：确立 A + B 方案、种子数据披露、MIT 代码来源、下架政策 |
