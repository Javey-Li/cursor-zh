## 这个 PR 做了什么

<!-- 一两句话说明"为什么改"，而不只是"改了什么"。 -->

## 变更类型

- [ ] 字典条目（新增/修正译文/新增模式）
- [ ] 补丁引擎或 CLI 逻辑
- [ ] 工具链（校验、构建、覆盖率）
- [ ] 文档
- [ ] CI

## 影响范围

- [ ] `cli/`
- [ ] `packages/core`
- [ ] `packages/patcher-cursor`
- [ ] `dictionaries/zh-CN.json`
- [ ] `tools/`
- [ ] `tests/`
- [ ] 文档（`docs/`、README、CONTRIBUTING、SECURITY）
- [ ] `.github/`

## 验证

- [ ] `node tools/validate-dictionary.js` 通过
- [ ] `npm test` 通过
- [ ] 手动验证过（请填写 Cursor 版本、芯片架构、验证了哪些页面）

```text
Cursor 版本：
macOS / 芯片：
验证页面：
```

## 检查清单

- [ ] 改动只涉及 **Cursor 的简体中文**，没有夹带 Claude、其它编辑器或多语言支持。
- [ ] 没有提交 `node_modules/`、`*.bak`、`*.log`、`.env`、备份文件或任何密钥。
- [ ] 新增字典条目已同步到构建输入；`dictionaries/` 下是重建产物，不是手改的。
- [ ] 若引入新来源，已更新 `sources[]` 与 `docs/PROVENANCE.md`，并在 PR 中说明许可情况。
- [ ] 没有把第三方文件（字典原文、语言包 VSIX、Cursor 二进制）整份拷入仓库。
- [ ] 涉及安装/还原的改动具备备份、原子写入与失败回滚，且重复执行不会叠加注入。
- [ ] 文档与实现一致；没有夸大覆盖率，也没有声称与 Anysphere / Cursor 官方有任何关系。
- [ ] 该改动不会破坏 `restore` 的可回滚性。

## 备注

<!-- 需要评审者注意的地方、已知遗留问题、后续计划等。 -->
