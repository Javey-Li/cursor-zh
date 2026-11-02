# Upstream Attribution

This repository contains code vendored from **Live-Translator-Hub**, used under the MIT
License. The copyright notice and license text are preserved in every vendored file's
header and in the repository's root `LICENSE` / `NOTICE`.

| Field | Value |
|---|---|
| Source | https://github.com/Uncle-Gao/Live-Translator-Hub |
| Commit SHA | `c667b8bd922fe08c3a1bf4a767ba1c8c53fe9013` (short: `c667b8b`) |
| Commit date | 2026-09-07T15:39:10+08:00 |
| Commit subject | Merge pull request #13 from anupamme/fix-repo-live-translator-hub-cve-2026-14257-package-lock-json |
| Copyright | Copyright (c) 2026 Uncle-Gao |
| License | MIT |

## Vendored paths

Copied verbatim, then adapted as listed below:

```
packages/core/package.json
packages/core/src/language-names.js
packages/core/src/protection-defaults.json
packages/core/src/translator-engine.js
packages/patcher-cursor/package.json
packages/patcher-cursor/index.js
packages/patcher-cursor/i18n/dictionary.json
packages/patcher-cursor/i18n/dictionary.zh-CN.json
```

Explicitly **not** vendored: `packages/desktop-app/`, `packages/patcher-claude/`,
`packages/dict-generator/`, and every Claude-specific asset in them.

## Local modifications

Each modified file carries the header line
`Vendored from Uncle-Gao/Live-Translator-Hub (MIT). See NOTICE.`

1. `packages/patcher-cursor/index.js`
   - `require('@live-translator/core/src/protection-defaults.json')` → `../core/src/protection-defaults.json`
   - `require('@live-translator/core/src/language-names')` → `../core/src/language-names.js`
   - `require.resolve('@live-translator/core/src/translator-engine.js')` → fixed `ENGINE_PATH`
   - Anthropic/Claude translation backend removed from the injected `engineConfig`
   - Added `config.codesign`, `config.dictPath`, `config.dictDir`
   - `getPaths()` no longer throws `ENOENT` on a stale `appPath`
   - `install()` warns when a foreign `*Localization*.js` is already injected
   - Extracted the duplicated macOS `xattr`/`codesign` block into `fixMacBundleSignature()`
2. `packages/core/src/translator-engine.js`
   - Removed `callAnthropic()` and its `apiType === 'anthropic'` dispatch branch
   - Updated header comment (Cursor-only, not require()-able)
3. `packages/core/src/language-names.js`
   - Header comment no longer references patcher-claude
4. `packages/patcher-cursor/package.json`
   - Removed `dependencies: { "@live-translator/core": "*" }`
   - Added `"private": true` and `"files"`

`packages/core/src/protection-defaults.json` is **unmodified**. It still lists `Claude`,
`Anthropic`, and Claude model-name patterns in its protected-terms data. These are
translation-protection entries for strings that Cursor's own UI displays (model and
provider names) — not Claude application support — so they are intentionally kept:
removing them would let the localizer translate Cursor's model picker labels.

## License text

MIT License

Copyright (c) 2026 Uncle-Gao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Updating this vendor drop

```bash
git clone --depth 1 https://github.com/Uncle-Gao/Live-Translator-Hub /tmp/lth
git -C /tmp/lth rev-parse HEAD          # record the new SHA above
# re-apply the modifications listed in this file, then diff against the previous drop
```

Upstream is effectively unmaintained; treat this as a frozen fork and re-check the
modification list by hand if it is ever refreshed.
