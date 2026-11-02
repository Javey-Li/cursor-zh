# Changelog

## 0.4.0 — 2026-11-03

- Full pass over Cursor 3.27 UI strings: slash commands, bottom tips, model picker labels, IDE sidebar, Outline/Timeline headers, extension view, search boxes and dynamic counters.
- Keep the `IDE` button as `IDE` instead of renaming it to 编辑器.
- Translate `Agent` / `Agents` labels to 智能体.
- Allow pane headers to be translated (removed `.pane-header.expanded` from the default skip list).
- Add override patterns for dynamic strings such as `Explorer Section: ...`, `Show N more`, `Skip step N of M` and `N extensions found`.
- Dictionary is now 3,254 unique entries and 250 patterns.

## 0.3.2 — 2026-11-03

- Translate model speed labels (`High Fast`, `Low Fast`, `Medium Fast`), the `IDE` button, `Prompt` label and the chat bottom hints.
- Add translations for all slash-command descriptions found in Cursor 3.27 (`/ask`, `/babysit`, `/create-*`, `/goal`, `/model`, `/plan`, `/review`, `/shell`, `/simplify`, etc.).
- Normalize zero-width characters before dictionary lookup (fixes model labels with invisible suffixes).
- Remove `IDE` and `Prompt` from the protected-term list so UI labels can be translated.
- Dictionary is now 3,082 unique entries and 244 patterns.

## 0.3.1 — 2026-11-03

- Translate attribute values that contain line breaks, such as `Split Editor Right\n[⌥] Split Editor Down`.
- Add Cursor 3.27 translations for Automation templates, marketplace UI, slash-command descriptions and sidebar states.
- Dictionary is now 3,054 unique entries and 244 patterns.
- Document that marketplace plugin names/descriptions are remote content, and that the automation list load error reproduces without the patch.

## 0.3.0 — 2026-11-03

- Translate `aria-label`, `placeholder`, `data-placeholder`, `aria-placeholder` and `alt`, not just text nodes and `title`. Toolbar buttons, icon controls and search boxes no longer stay English.
- Add `dictionaries/overrides.json` for high-priority Cursor 3.27 strings, and teach the builder to merge it first.
- Rebuild the dictionary: 3,012 unique entries and 244 patterns.
- Rewrite the README in a plainer, shorter style.

## 0.2.0 — 2026-11-03

- Add the `cursor-zh` agent skill (`skills/cursor-zh/SKILL.md`) with a fixed check → dry-run → confirm → install → verify → restore workflow and safety rules.
- Add macOS double-click installer `install.command`.
- Add Windows double-click installer `install.cmd` and PowerShell script `install.ps1` (untested on Windows).
- Add distribution tests and document all three entry points in the README.

## 0.1.0 — 2026-11-03

- Initial Cursor-only release.
- CLI: `install`, `restore`, `status`, `coverage`, `doctor`.
- Automatic installation of the official VS Code Chinese language pack through Cursor's extension CLI when missing.
- Runtime dictionary injection into `workbench.js` with backup, checksum update, and optional ad-hoc macOS signing.
- Dictionary: 2,997 unique entries and 244 regex patterns, built from community seed data, MIT dictionaries, and 311 original additions.
- Verified on macOS arm64 with Cursor 3.27.22 (VS Code core 1.128.0): install, UI injection, status, and restore.
- English README summary, provenance/NOTICE, contribution guide, security policy, and GitHub Actions validation.
