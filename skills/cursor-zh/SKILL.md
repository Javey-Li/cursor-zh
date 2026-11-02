---
name: cursor-zh
description: Install, verify, or restore the cursor-zh Simplified Chinese localization for Cursor on macOS or Windows. Use when the user wants Cursor in Chinese, reports untranslated Cursor-specific UI, or asks to roll back cursor-zh.
---

# cursor-zh

Use this skill to install, verify, or roll back the **cursor-zh** localization for Cursor. It is an unofficial community project and is not affiliated with Anysphere or Cursor.

## Locate the repository

This skill normally lives at `<repo>/skills/cursor-zh/SKILL.md`. The repository root is two levels up:

```text
repo/
├── cli/index.js
├── install.command
├── install.ps1
└── skills/cursor-zh/SKILL.md
```

If the skill was copied elsewhere, locate `cli/index.js` first and run all commands from that repository root. Do not copy `cli/`, `packages/`, or `dictionaries/` into a temporary directory; the CLI resolves the engine and dictionary relative to its own location.

## Safety rules

1. **Do not modify Cursor files directly.** Only run the CLI. It creates versioned backups, updates `product.json` checksums, and supports `restore`.
2. **Do not run `--force` or `--yes` without explicit user approval.** They skip confirmations and can stack two localization patches.
3. **Check for another patch first.** If `status` or the installer reports `Cursor_Localization.js` / `CURSOR_LOCALIZATION_INJECTION`, stop. Ask the user to restore the old tool before continuing.
4. **Do not install Claude support.** This project is Cursor-only.
5. **Do not send telemetry or upload user files.** The only network access is the official VS Code language pack installation.
6. **Do not edit `product.json`, `workbench.js`, or `workbench.html` by hand.** If something fails, run `restore` and report the error.

## Workflow

Run every command from the repository root. Use `node cli/index.js` if the `cursor-zh` command is not linked globally.

### 1. Check the environment

```bash
node cli/index.js doctor
node cli/index.js status
```

`doctor` checks Node.js >= 18, finds Cursor, loads the dictionary, and loads the patcher. `status` shows the Cursor version, whether it is already patched, and whether a backup exists.

If Cursor is in a non-standard location:

```bash
node cli/index.js doctor --app "/Applications/Cursor.app"
node cli/index.js status --app "/Applications/Cursor.app"
```

### 2. Show the plan and ask for confirmation

```bash
node cli/index.js install --dry-run
```

Summarize for the user:

- Cursor path and version
- whether the official VS Code Chinese language pack is installed
- dictionary size
- that `workbench.js` / `workbench.html` will be backed up and modified
- that `product.json` checksums will be updated
- that macOS will be ad-hoc signed by default

Then ask a direct question, for example: **“是否继续安装？这会修改 Cursor 安装目录，但会先备份并支持一键还原。”** Do not continue until the user explicitly agrees.

### 3. Install

Only after explicit confirmation:

```bash
node cli/index.js install
```

The CLI itself also asks for confirmation unless `--yes`/`--force` is passed. Do not suppress it.

### 4. Verify

```bash
node cli/index.js status
node cli/index.js coverage --limit 20
```

Expected `status` output includes `已打补丁: 是` and a backup version matching the Cursor version. If `已打补丁: 否`, read the installer output and do not claim success.

### 5. Ask the user to restart Cursor

Tell the user to **fully quit Cursor (`Cmd + Q` on macOS)** and reopen it. Some strings only refresh after opening Settings or switching panels.

### 6. Roll back on failure

```bash
node cli/index.js restore
```

Then verify:

```bash
node cli/index.js status
```

Expected: `已打补丁: 否`, `备份: 无`.

## Troubleshooting

| Symptom | Action |
|---|---|
| `未检测到 Cursor 安装` | Ask for the app path, then use `--app`. macOS default is `/Applications/Cursor.app`. |
| `检测到另一套汉化补丁` | Do not use `--force`. Ask the user to restore the old tool (for example `bash 取消汉化_Mac.sh`), then retry. |
| Language pack installation fails | Install `Chinese (Simplified) Language Pack` from Cursor's Extensions panel, then retry. |
| `codesign` fails on macOS | Explain that the modified app cannot keep the original signature. Offer `restore`; only use `--no-codesign` if the user understands the app may not launch. |
| UI is still partially English | Run `coverage`, explain that coverage is partial; check that the language pack is installed; confirm a full restart. |
| Cursor updated and reverted to English | This is expected. Re-run `install` after the update. |

## What not to promise

- Do not promise full coverage. The dictionary is partial and new Cursor versions add strings.
- Do not promise the native macOS menu bar will be Chinese.
- Do not promise Windows support is verified; macOS is the tested platform.
- Do not claim the app keeps its original signature; it uses an ad-hoc signature by default.

## Report format

After finishing, report concisely:

- Cursor version and path
- installed / restored result
- dictionary entry count
- backup status
- next step (quit and reopen Cursor)
- any remaining English areas, with `coverage` evidence if available
