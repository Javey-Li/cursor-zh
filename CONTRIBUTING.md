# 贡献指南

感谢参与 `cursor-zh`。本项目只做 **Cursor 的简体中文**，范围很小，因此规则也比较明确：**改动可控、来源清楚、随时可回滚**。

- 安全问题请不要开公开 issue，见 [SECURITY.md](SECURITY.md)。
- 本项目是非官方社区项目，与 Anysphere / Cursor 无关；请不要在 issue 里代官方承诺任何事。

## 可以贡献什么

| 类型 | 说明 | 入口 |
| --- | --- | --- |
| 字典条目 | 补英文原文 / 修正译文 / 增加正则模式 | 构建输入（见下），产物在 `dictionaries/` |
| 补丁引擎 | 注入逻辑、版本适配、校验和修复 | `packages/` |
| CLI | 安装、还原、覆盖率、自检 | `cli/` |
| 工具链 | 校验脚本、字典构建、覆盖率统计 | `tools/` |
| 文档 | README、docs/、模板 | 文档文件本身 |

不接受的改动：加入 Claude 或其它编辑器的支持、引入遥测/上报、在仓库内分发微软语言包 VSIX、把整份第三方字典原样拷进来（请按条目并入并标注来源）。

## 添加字典条目

### 先搞清楚：字典是生成物

`dictionaries/` 下的三个文件都是 `python3 tools/build_dictionary.py` 的确定性产物，**不要手改结构**：

| 文件 | 内容 |
| --- | --- |
| `dictionaries/zh-CN.json` | 合并后的词条（`entries`）与正则（`patterns`），即随工具使用的字典 |
| `dictionaries/conflicts.json` | 每条冲突译文：最终选了哪条、拒了哪条、来自哪个来源 |
| `dictionaries/manifest.json` | 计数、来源 sha256、许可说明与 provenance 摘要 |

构建输入有三类：

1. **社区种子**：上游 `vibepm666/cursor-localization-zh` 的 `Core_Dictionary.json` / `Pattern_Dictionary.json`（无 LICENSE，仅作翻译记忆使用，见 `docs/PROVENANCE.md`）。
2. **本项目新增**：目前仍存放在构建脚本读取的 `Core_Dictionary.json` 的 `cursor_3_27_补充` / `cursor_3_27_设置与自动化补充` 两个分节里，路径由 `CURSOR_ZH_UPSTREAM_DIR` 指定（见脚本头部 docstring）。**这是当前的已知缺口**：把自有新增搬进本仓库是待办事项。
3. **MIT 词典**：`Uncle-Gao/Live-Translator-Hub` 与 `lsh2253823857/cursor-i18n-tool`，按 commit 固定，可离线缓存。

冲突处理优先级固定为 **own > MIT > upstream seed**，所有被拒值都能在 `conflicts.json` 里查到。过滤规则会丢掉"中英同形"、不含中文、URL、文件名与代码噪音的条目。

### schema（`schemaVersion: 1`）

```json
{
  "schemaVersion": 1,
  "locale": "zh-CN",
  "generatedAt": "2026-11-03",
  "cursorVersions": ["3.27.x"],
  "entries": {
    "Run Mode": "运行模式",
    "Worktree": "工作树"
  },
  "patterns": [
    {
      "regex": "^(\\d+) requests? remaining$",
      "flags": "i",
      "replacement": "$1 次请求剩余"
    }
  ],
  "sources": [
    {
      "name": "cursor-zh Cursor 3.27 additions (own sections + 5 patterns)",
      "url": "https://github.com/Javey-Li/cursor-zh",
      "license": "MIT",
      "entries": 310,
      "role": "own"
    }
  ]
}
```

字段约定：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `schemaVersion` | 是 | 当前为 `1`。改结构必须同时升级版本号并更新校验脚本。 |
| `locale` | 是 | 固定 `zh-CN`。本项目不做其它语言。 |
| `generatedAt` | 是 | `YYYY-MM-DD`，由 `CURSOR_ZH_GENERATED_AT` 控制，默认 `2026-11-03`，保证可复现。 |
| `cursorVersions` | 是 | 非空字符串数组，该字典针对的 Cursor 版本（默认 `3.27.x`）。 |
| `entries` | 是 | **对象**：英文原文 → 中文译文。键按字典序排序；值必须是非空字符串，且不能与键相同（同形视为未翻译）。 |
| `patterns[].regex` | 是 | 正则源串，必须能编译，且全表唯一。 |
| `patterns[].flags` | 是 | 字符串，只允许 `d g i m s u v y`；不用时写 `""`。 |
| `patterns[].replacement` | 是 | 非空替换模板，捕获组写作 `$1`…`$9`。 |
| `sources[].name` / `.url` / `.license` | 是 | 非空字符串；`license` 要如实写（无许可就写 `NOASSERTION`，不要写成 MIT）。 |
| `sources[].role` | 是 | 只允许 `seed` / `mit` / `own`。 |
| `sources[].entries` | 是 | 该来源最终贡献的条数（非负整数）；**所有来源之和必须等于 `entries` 的键数**。 |

> `tools/validate-dictionary.js` 是字段约束的最终依据（它还会交叉校验 `conflicts.json` 与 `manifest.json` 的计数）。本文与脚本不一致时以脚本为准，并顺手提 PR 修本文。

### 硬性规则

1. **不要出现"同形"条目**。译名与英文原文完全相同（或只改大小写）会被视为未翻译，校验会失败；该保留英文的词就别进字典。
2. **占位符必须对齐**。模板里的 `$1`、`${count}`、`%s`、`{{name}}` 必须与正则捕获/原文一一对应，不能多也不能少。
3. **代码标识符不翻译**：命令名、文件路径、配置键、API 字段、品牌名（Cursor、Composer、Tab、Git、MCP 等）保持原样。
4. **短、准、一致**。UI 文案优先短句；同一概念全库统一，遵循下方术语表。
5. **不要把正则当普通条目**。含变量的文案（数量、时间、文件数）用 `patterns`；本项目约定正则**必须锚定**（`^` / `$`），避免替换到正文。
6. **来源如实**。新的第三方数据要新增 `sources[]` 条目（含 `url`、真实 `license`、`role`、贡献条数），并在 `docs/PROVENANCE.md` 记录；来源不明的条目会被拒。

### 补词条的实际流程

1. 先确认这句确实该由 B 层字典负责：VS Code 共用界面（编辑器、文件树、命令面板等）交给官方语言包，不进词典。
2. 在构建输入里添加 `英文原文 → 中文`（放在自有新增分节下），或在 `patterns` 里加锚定正则。
3. 重建并校验：

   ```bash
   python3 tools/build_dictionary.py          # 等价于 npm run build:dict
   node tools/validate-dictionary.js          # 等价于 npm run validate
   npm test
   ```

   重建需要读到种子与 MIT 词典，可设 `CURSOR_ZH_OFFLINE=1` 强制只用本地缓存；路径不存在时脚本会报错并告诉你缺什么。

4. 在 PR 里贴出 `dictionaries/manifest.json` 里变化的计数（entries / patterns / conflicts），以及 `cursor-zh coverage` 的前后摘要（只贴摘要，不要贴整份字典）。

如果你只改了 `dictionaries/zh-CN.json` 而没有改对应来源，请在 PR 中明确说明——下一次重建会把你的改动覆盖掉，维护者需要同步更新构建输入。

## 术语表（起始版）

新条目优先对齐下表；需要新增或修改术语时，**单独提 PR 并说明理由**，避免各改各的。

| English | 简体中文 | 备注 |
| --- | --- | --- |
| Agent | 智能体 | 指 Cursor 的 Agent 功能，不用"代理"/"特工" |
| Composer | Composer | 产品名，不翻译 |
| Tab | Tab | 产品名（Tab 补全），不翻译 |
| Worktree | 工作树 | |
| Run Mode | 运行模式 | 与 "Agent Mode" 区分 |

补充约定：

- 中英文之间加空格（如 `在 Cursor 中`），标点用中文全角。
- 按钮用动词短语（"保存"而不是"保存的"），状态用形容词（"已连接"）。
- 不确定的术语先按英文保留，并在 PR 里提问，不要自造译名。

## 代码风格

- **纯 Node.js，CommonJS，无构建步骤。** 不引入 TypeScript 编译链；`engines` 要求 Node >= 18。文件头写 `'use strict';`。
- **零运行时依赖优先。** 新增依赖需要说明理由，且不能是带 postinstall 脚本的可疑包。
- **缩进跟随所在目录**：`cli/`、`tools/` 新增代码用 2 空格；`packages/patcher-cursor` 是从 MIT 上游 vendored 的代码，保持其 4 空格与原有风格，**不要为了统一格式重排**，否则 diff 无法评审。
- 字符串用单引号，语句结尾带分号；文件结尾保留一个换行。
- 新代码优先使用 `node:` 前缀（`require('node:fs')`）；已有旧写法不必单独提 PR 修改。
- 平台相关操作（`codesign`、`xattr`、路径推导）集中在 `packages/patcher-cursor`；语言包安装封装在 `cli/language-pack.js`，其余 `cli/` 只做参数解析与输出。
- 错误必须**可行动**：报错信息说明"发生了什么 + 你可以怎么办"，必要时同时给出中英文关键词（便于搜索）。
- 任何会改动用户磁盘的操作必须：备份 → 写入 → 校验 → 失败时回滚。幂等优先：重复 `install` 必须先还原再注入，不能叠加。
- 不打印、不收集用户数据；日志里不要出现项目路径、账号信息。
- 测试用 `node:test`，放在 `tests/*.test.js`，命名 `*.test.js`；涉及文件系统的用例要用临时目录。

## PR 检查清单

提交前逐项确认（PR 模板里也有同样的清单）：

- [ ] 改动范围符合"只做 Cursor、只做简体中文"，没有夹带 Claude 或其它编辑器相关内容。
- [ ] 没有提交 `node_modules/`、备份文件、`*.bak`、`*.log`、`.env` 或任何密钥。
- [ ] 新增/修改字典条目已同步到构建输入，`dictionaries/` 下的产物是重建出来的，不是手改的；必要时更新了 `sources[]` 与 `docs/PROVENANCE.md`。
- [ ] `node tools/validate-dictionary.js` 通过（`npm run validate`）。
- [ ] `npm test` 通过；新增逻辑有对应测试。
- [ ] 涉及安装/还原逻辑的改动，手动验证过 `install` → `status` → `restore` 全流程。
- [ ] 文档同步更新（README / docs/），不夸大覆盖率，不声称官方支持。
- [ ] 提交信息说明"为什么改"，而不只是"改了什么"。

提交信息建议格式：

```
dict: 补充 Agent 面板 12 条文案
fix(patcher): 修复 3.28 版本 workbench 路径变化
docs: 说明 ad-hoc 重签后的回滚步骤
```

## 评审与合并

- 字典类 PR 至少一位维护者确认术语一致性。
- 补丁/CLI 类 PR 需要说明在哪些 Cursor 版本上验证过（版本号 + 芯片架构）。
- 维护者可以因为"来源不清""无法回滚""影响范围过大"而拒绝 PR，这是本项目的安全底线，不代表对贡献者的评价。
