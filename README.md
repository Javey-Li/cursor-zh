# cursor-zh

把 Cursor 的界面换成简体中文。只做 Cursor，不支持 Claude 或其它编辑器。

Cursor 是基于 VS Code 改的，界面可以分成两部分：编辑器、文件树、命令面板这些来自 VS Code；Agent 面板、Cursor 设置、云端智能体这些是 Cursor 自己写的。微软的中文语言包只能翻译前一部分，这个工具把后一部分也补上。

macOS 已经在 Cursor 3.27.22 上验证过，Windows 有脚本但还没完整测试。Cursor 升级后会覆盖补丁，升级完重新运行一次安装即可。

> English: an unofficial, Cursor-only Simplified Chinese localization tool. It installs the official VS Code Chinese language pack for the VS Code UI and injects a small dictionary engine for Cursor-specific UI. macOS is tested; Windows is not. Not affiliated with Anysphere or Cursor.

## 安装

### 方式一：让 agent 装

把 [skills/cursor-zh/SKILL.md](skills/cursor-zh/SKILL.md) 发给 Cursor、Claude 或其它支持 skill 的 agent，也可以把 `skills/cursor-zh` 复制到它的 skills 目录，然后说“按这个 skill 装 cursor-zh”。

Skill 会先检查环境、运行 `install --dry-run`、把要改的文件列给你，等你确认后才真正安装。安装失败会先回滚，不会让 agent 手改 Cursor 文件。

### 方式二：双击

- macOS：双击 `install.command`。如果系统拦截，右键 → 打开。
- Windows：双击 `install.cmd`，它会调用 `install.ps1`。Windows 路径还没完整验证，遇到问题先 `restore`，然后提 Issue。

脚本会检查 Node.js 18+，运行 `doctor` 和 `install`，结束后窗口不会马上关，方便看结果。安装前仍然会要求确认。

### 方式三：命令行

需要 Node.js 18 或更高版本。

```bash
git clone https://github.com/Javey-Li/cursor-zh.git
cd cursor-zh

node cli/index.js doctor
node cli/index.js install --dry-run
node cli/index.js install
```

`install` 默认会列出计划并询问确认。想跳过确认用 `--yes`，想先看改动用 `--dry-run`。macOS 默认会做 ad-hoc 重签，不希望重签就加 `--no-codesign`。

安装完成后用 `Cmd + Q` 完全退出 Cursor 再打开。部分文案要打开一次设置页或切换面板才会刷新。

如果自动安装 VS Code 语言包失败（例如离线或企业代理），在扩展面板手动装 `Chinese (Simplified) Language Pack`，再用 `Cmd + Shift + P` → `Configure Display Language` 选中文。

## 命令

| 命令 | 做什么 |
| --- | --- |
| `cursor-zh install` | 安装语言包，备份 `workbench.js`，把词典引擎和词条追加进去，更新 `product.json` 校验和，macOS 默认重签 |
| `cursor-zh restore` | 用同版本的 `.bak` 还原 `workbench.js` / `workbench.html`，重算校验和并重签 |
| `cursor-zh status` | 查看 Cursor 版本、是否已打补丁、备份是否存在 |
| `cursor-zh coverage` | 扫描 Cursor 安装包，列出词典没收录的候选英文 |
| `cursor-zh doctor` | 检查 Node、Cursor 路径、词典和补丁器 |

常用参数：

| 参数 | 说明 |
| --- | --- |
| `--app PATH` | 指定 Cursor 路径，`.app` 或 `Contents/Resources/app` 都行 |
| `--dry-run` | 只打印路径和词典统计，不写文件 |
| `--yes` | 跳过安装确认 |
| `--no-codesign` | macOS 上不重签 |
| `--force` | 检测到别的汉化补丁时继续。两套注入会叠加，不建议用 |
| `--limit N` | `coverage` 显示多少条候选，默认 100 |
| `--json` | `coverage` 以 JSON 输出 |

## 安装时改了什么

- 语言包装在 `~/.cursor/extensions`，显示语言写进 `locale.json`。
- 在 Cursor 的 `out/vs/code/electron-sandbox/workbench/workbench.js` 末尾追加引擎和词条。Cursor 3.27.22 上 `workbench.html` 不会被改，CSP 也保持原样。
- 修改前把原始文件写成 `workbench.js.<版本>.bak` / `workbench.html.<版本>.bak`。
- 修改后重算 `product.json` 里这两个文件的校验和，避免启动时提示安装损坏。
- macOS 上默认用 `codesign --force --deep --sign -` 做 ad-hoc 签名。
- 状态和引擎词典放在 `~/.cursor-zh/`。
- `restore` 成功后会删掉 `.bak`。

## 覆盖情况

当前词典有 3054 条唯一词条和 244 条正则，来源和每条冲突都记在 `dictionaries/manifest.json`、`dictionaries/conflicts.json`。

已经覆盖的范围包括 Cursor 设置、Agent / Composer、自动化、远程控制、浏览器/网络、用量统计、PR 审查和安全提示。下面这些还可能是英文：

- 新版本 Cursor 新加的文案。
- 动态拼接出来的句子。
- macOS 原生菜单栏。
- 还没验证过的页面。

想知道自己机器上漏了什么，运行：

```bash
cursor-zh coverage
```

`coverage` 只是启发式扫描，数字用来决定下一批补什么，不是精确覆盖率。补充词条的方法见 [CONTRIBUTING.md](CONTRIBUTING.md)。

Cursor 每次自动更新都会把补丁覆盖掉，界面会变回英文。这不是工具坏了，重新运行 `cursor-zh install` 就行。

## 回滚

先完全退出 Cursor，然后：

```bash
cursor-zh restore
```

它会用同版本的 `.bak` 还原文件、重算校验和、重签，然后删除备份。执行完 `restore` 之后就没有就地备份了，想再回滚只能靠整包备份或重装 Cursor。

如果 `restore` 提示找不到备份（比如 Cursor 更新时清掉了 `.bak`），可以直接从官网下载安装包覆盖安装。

语言设置是 Cursor 自己的选项。如果之前把显示语言改成了中文，需要在 `Configure Display Language` 里改回英文；不需要中文语言包的话，在扩展面板卸载。

卸载工具本身只需删除仓库目录（或 `npm unlink cursor-zh`），再按需清理 `~/.cursor-zh/`。它不会安装后台服务、常驻进程或登录项。

## 已知限制

- Cursor 自动更新会覆盖补丁，更新后要重新安装。
- macOS 顶部菜单（File / Edit / View / Window / Help）由 AppKit 绘制，可能一直是英文。
- 修改后应用不再有 Anysphere 的原始签名，默认会打 ad-hoc 签名。部分企业 MDM 或安全软件会拦截这种签名，遇到就 `restore` 或重装。
- 版本适配靠 Cursor 的 `product.json`，没有维护完整的版本兼容表。Cursor 改了 workbench 的打包方式时，注入可能直接失效。
- Windows 脚本还没完整测试。
- 插件市场里的插件名称和简介来自 Cursor 的在线目录，是远程内容；工具只翻译界面文案，不翻译这些动态条目。
- 自动化页面的“无法加载自动化”在未打补丁的 Cursor 上也能复现，属于 Cursor 服务端或账号状态，不是本地汉化造成的。
- 目标是常用界面可用中文，不保证所有角落都翻译。

## 常见问题

**装完还是有一部分英文？**

先用 `Cmd + Q` 完全退出再打开，然后跑 `cursor-zh coverage` 看这些文案是否在词典里。没收录就是还没翻，欢迎补词条。原生菜单栏属于上面的已知限制。

**Cursor 更新后变回英文了？**

自动更新会重写应用文件，补丁被覆盖。重新运行 `cursor-zh install`。如果 `status` 提示备份版本和当前版本不一致，先 `restore` 再 `install`。

**提示“检测到另一套汉化补丁”？**

Cursor 里还留着旧工具的注入，比如 `Cursor_Localization.js`。先用原工具还原，再运行本工具。不要用 `--force` 硬上，两套注入会打架。

**macOS 提示“Cursor 已损坏，无法打开”？**

修改应用后签名会变，工具默认已经重签。如果还是被拦，先完全退出 Cursor，运行 `cursor-zh restore`；不行就恢复整包备份或从官网重装。企业 MDM 环境可能直接禁止 ad-hoc 签名。

**会上传我的数据吗？**

不会。工具没有遥测，安装过程只会在缺少语言包时调用 Cursor 的扩展 CLI。构建词典的脚本会下载 MIT 词典和种子数据，可以用 `CURSOR_ZH_OFFLINE=1` 禁止联网。

## 代码和数据来源

| 部分 | 来源 | 许可 |
| --- | --- | --- |
| `cli/`、`tools/`、字典格式、文档 | 本项目 | MIT |
| `packages/core`、`packages/patcher-cursor` | [Uncle-Gao/Live-Translator-Hub](https://github.com/Uncle-Gao/Live-Translator-Hub) | MIT |
| 词典种子 | 社区项目 `vibepm666/cursor-localization-zh` 的英文→中文对照 | 上游没有 LICENSE |
| 部分词典条目 | [Uncle-Gao/Live-Translator-Hub](https://github.com/Uncle-Gao/Live-Translator-Hub)、[lsh2253823857/cursor-i18n-tool](https://github.com/lsh2253823857/cursor-i18n-tool) | MIT |
| 311 条新增词条和 5 条正则 | 本项目 | MIT |
| VS Code 中文语言包 | Microsoft | 通过 Cursor 扩展 CLI 安装，不随仓库分发 |

上游 `vibepm666/cursor-localization-zh` 没有提供 LICENSE。这里只使用它的英文→中文对照作为种子，代码没有从那个项目复制；补丁引擎来自 Uncle-Gao 的 MIT 项目。种子、MIT 词典和新增条目合并后放在 `dictionaries/zh-CN.json`，每条来源和冲突记录在 `manifest.json`、`conflicts.json`。如果上游作者不希望这些数据被使用，开个 Issue，我们会把对应部分移除。

更细的来源记录见 [docs/PROVENANCE.md](docs/PROVENANCE.md)，版权声明见根目录 `NOTICE`。

## 参与

补词条、改翻译、报 bug、写文档都欢迎，先看 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题不要开公开 Issue，按 [SECURITY.md](SECURITY.md) 私下报告。

提交前跑：

```bash
npm test
node tools/validate-dictionary.js
```

## 免责声明

这是非官方项目，和 Anysphere / Cursor 没有隶属、合作或背书关系。Cursor 是 Anysphere 的产品，相关商标和版权归其权利人所有。

使用本工具会修改本地 Cursor 的安装文件，可能导致签名失效、系统安全提示或升级后界面异常。操作前请保存工作，必要时备份 `Cursor.app`。作者和贡献者不对使用本工具造成的损失负责。如果 Cursor 官方以后提供中文界面，优先用官方方案。
