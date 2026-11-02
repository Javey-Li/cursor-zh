---
name: Bug report / 问题反馈
about: 安装失败、界面异常、还原异常等可复现问题
title: "[bug] "
labels: bug
assignees: ""
---

## 前置检查

- [ ] 我已搜索过现有 issue，确认没有重复。
- [ ] 我已完整退出并重启 Cursor（`Cmd + Q`），问题仍然存在。
- [ ] 我确认这是 **Cursor** 的问题，与 Claude 或其它编辑器无关。
- [ ] 我已阅读 README 的「已知限制」（自动更新覆盖补丁、原生菜单栏保持英文、签名失效等属于预期行为）。

## 环境

| 项目 | 内容 |
| --- | --- |
| macOS 版本 | 例如 macOS 15.1 |
| 芯片 | Apple Silicon / Intel |
| Cursor 版本 | 例如 3.27.22（Cursor → About） |
| Cursor 安装路径 | 例如 `/Applications/Cursor.app` |
| cursor-zh 版本 | `node cli/index.js help` 输出的版本号，或 commit hash |
| 是否已汉化 | 是 / 否 / 部分 |
| 之前是否用过其它汉化脚本 | 是（哪个）/ 否 |

## 复现步骤

1.
2.
3.

## 期望行为

<!-- 你期望看到什么？ -->

## 实际行为

<!-- 实际发生了什么？附截图或录屏更好。 -->

## 命令输出

请粘贴相关命令的输出（**不要粘贴密钥、token、账号信息**）：

```text
$ cursor-zh status
...

$ cursor-zh doctor
...

$ cursor-zh coverage --limit 20
...
```

安装/还原失败时，请附上错误信息全文：

```text
$ cursor-zh install
...
```

## 日志

<!-- 安装/还原的终端输出、`~/.cursor-zh/state.json` 的片段（如相关）。粘贴前请删掉用户名等个人信息，不要贴 token。 -->

```text
...
```

## 补充信息

<!-- 例如：是否刚升级过 Cursor、是否装过旧版汉化工具、是否有多个 Cursor 副本、是否用过 sudo 等。 -->
