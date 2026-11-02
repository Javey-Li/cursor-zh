# Integration Contract — Cursor Patcher Engine

Consumer-facing contract for `packages/patcher-cursor` + `packages/core`.
Everything here is resolved by **relative path**; nothing goes through npm workspaces.

```
packages/
  core/
    package.json
    src/translator-engine.js      # browser runtime, injected as text (NOT require()-able)
    src/language-names.js         # locale -> prompt language name/code
    src/protection-defaults.json  # default protected terms/patterns
  patcher-cursor/
    package.json                  # main: index.js
    index.js                      # CursorPatcher
    i18n/dictionary.json          # zh-CN dictionary (nested) + regex rules
    i18n/dictionary.zh-CN.json
```

## Quick start

```js
const { CursorPatcher } = require('./packages/patcher-cursor');
const patcher = new CursorPatcher();          // no constructor arguments
```

## Method signatures

| Method | Returns | Notes |
|---|---|---|
| `new CursorPatcher()` | instance | No config in constructor. Stateless between calls. |
| `detectStatus(appPath?)` | `Promise<Object>` | Never throws; see shapes below. |
| `createBackup(config?, hooks?)` | `Promise<{ok, skipped, reason?}>` | Idempotent. Throws `Error('Cursor not found')` if not installed. |
| `getInstalledExtensions()` | `Promise<Array<Object>>` | Scans `~/.cursor/extensions/*/webview/index.js`. |
| `install(config, hooks?)` | `Promise<void>` | **This is patch/apply.** Resolves `undefined`; throws on error. |
| `restore(config?, hooks?)` | `Promise<void>` | Restores `workbench.{js,html}.<ver>.bak` + plugin backups. |

There is **no** `patch()`, `apply()`, `update()`, or `unpatch()` method. Use `install()` / `restore()`.

`createBackup` and `restore` also accept a legacy single-argument form (`createBackup(hooks)`),
detected by `onProgress` / `onRequestSudo` being present — this is why `onRequestSudo` still
appears in signatures. The Cursor patcher never calls `onRequestSudo`.

### `detectStatus(appPath?)` shapes

```js
// Cursor not found / unusable appPath
{ installed: false }

// Cursor found
{
  installed: true,
  version,            // string, e.g. '3.27.22', or 'unknown'
  paths: {
    root,             // .../Cursor.app/Contents/Resources/app
    workbenchDir,     // <root>/out/vs/code/electron-sandbox/workbench
    workbenchHtml,    // <workbenchDir>/workbench.html
    workbenchJs,      // <workbenchDir>/workbench.js
    webviewHtml,      // <root>/out/vs/workbench/contrib/webview/browser/pre/index.html
    productJson       // <root>/product.json
  },
  isPatched,          // workbench.js contains the injection marker
  hasBackup,          // BOTH workbench.js.<version>.bak and workbench.html.<version>.bak exist
  backupVersion,      // string | null  (version parsed from any workbench.js.*.bak)
  versionMismatch,    // backupVersion !== version
  hasWebviewBackup    // any extension has webview/index.js.<version>.bak
}
```

Status values are plain booleans/strings — no enums, no codes.

## Config example

`install(config, hooks)` — every field is optional; `appPath` auto-detects
`/Applications/Cursor.app/Contents/Resources/app` when omitted.

```js
const config = {
  appPath: null,                 // or '/Applications/Cursor.app' / .../Resources/app
  targetLanguage: 'zh-CN',       // drives prompt language + dictionary filename
  activeId: 'none',              // 'none' | 'openai' | 'gemini' | 'deepl'
  engines: {                     // only the active engine is injected
    openai: { apiKey: 'sk-...', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    gemini: { apiKey: '...', model: 'gemini-2.0-flash' },
    deepl:  { apiKey: '...:fx' },
  },
  cacheVersion: 1,               // bump to invalidate the localStorage translation cache
  injectWebview: false,          // patch ~/.cursor/extensions/*/webview/index.js too
  codesign: false,               // local addition; false = skip ad-hoc re-signing (default)
  dictPath: './dictionaries/zh-CN.json',  // local addition; explicit dictionary file
  // dictDir: './dictionaries', //        local addition; directory fallback
  features: {
    enableDictionary: true, enableNestedDict: true, enableRegex: true,
    enableTranslationBridge: true, enableLoadingAnimation: true,
    enableFileNameGuard: true, enableProtectedTermGuard: true,
  },
  protection: {
    terms: [],                   // merged with core/src/protection-defaults.json
    patterns: [],                // merged same way; strings or /regex/flags literals
    disabledTerms: [], disabledPatterns: [],
  },
  skip: {
    _cursor_: {                  // note the trailing/leading underscores
      selectors: ['.my-panel'],  // merged with DEFAULT_SKIPS
      disabledSelectors: [],     // removes entries from the merged set
    },
  },
  skipRules: {                   // only used when injectWebview === true
    webview: {
      _global_: { selectors: [], titles: [], urls: [] },
      'publisher.extension': { selectors: [], titles: [], urls: [] },
    },
  },
};

await patcher.install(config, {
  onProgress: (msg) => console.log(msg),        // human-readable Chinese strings
  onTCCBlocked: () => {},                       // open System Settings > Privacy
});
```

`activeId: 'none'` is the ship default: dictionary + regex only, zero network calls.
`'anthropic'` is **not** supported — it is not in `SUPPORTED_APIS` and silently
degrades to `'none'` with a progress warning.

## Hooks

| Hook | When |
|---|---|
| `onProgress(message)` | ~8 steps during install/restore. Messages are Chinese UI text; do not parse them. |
| `onTCCBlocked()` | Fired once when macOS blocks a file operation; the patcher then auto-retries every 3 s up to 40 times. |

## What gets written on disk

1. `workbench.js.<version>.bak` + `workbench.html.<version>.bak` in `workbenchDir`
   (created only when no `.bak` exists).
2. Appended to `workbench.js`:

```js
// === 安装期编译内联组装 ===
(function(){
window.__I18N_TERMS__ = Object.assign(window.__I18N_TERMS__ || {}, { ...dictionary });
window.__I18N_CONFIG__ = { ...engineConfig };
/* ...inlined translator-engine.js... */
})();
```

3. `workbench.html`: CSP `<meta>` rewritten to allow `'unsafe-inline'` — **only if the
   upstream regex matches** (see risks; on 3.27.22 it does not, and that is fine).
4. `product.json` → `checksums['vs/code/electron-sandbox/workbench/workbench.js'|'workbench.html']`
   replaced with base64 sha256 (trailing `=` stripped).
5. On macOS: `xattr -cr` on the bundle. `codesign --force --deep --sign -` runs **only**
   when `config.codesign === true` (opt-in local change; upstream always re-signed).

Old `.bak` files whose name does not contain the current version are deleted on install.

## Runtime contract (inside the renderer)

`translator-engine.js` reads exactly two globals and sets two more.

| Global | Direction | Meaning |
|---|---|---|
| `window.__I18N_TERMS__` | read | Dictionary. Flat strings, nested objects (recursed), and a top-level `regex` map of `pattern -> replacement template`. |
| `window.__I18N_CONFIG__` | read | The `engineConfig` object built by `install()`. |
| `window.__LIVE_I18N_INJECTED__` | write | `true` once the script body has executed. |
| `window.__LIVE_I18N_INIT_DONE__` | write | `true` once `init()` has run; guards double init. |

`engineConfig` keys actually injected:
`apiType, engineId, targetLanguage, targetLanguageCode, openai, gemini, deepl, skip, protection, cacheVersion, features`
(plus `name` for webview injections).

Other runtime constants worth knowing:

- localStorage cache key: `live_i18n_cache_default` (suffixed when `name` is set), plus `..._version`.
- postMessage protocol: `I18N_BRIDGE_REQ`, `I18N_BRIDGE_PUSH`, `I18N_DEBUG_SYNC`.
- Debug/selector-picker toggle: `Cmd/Ctrl + Alt + Shift + B`, then `Alt + click` to pick a skip rule.
- Elements are skipped inside `SCRIPT, STYLE, TEXTAREA, INPUT, CODE, PRE, KBD, SAMP`,
  file-name-like strings, and `CONFIG.skip.selectors`.
- Any text containing `[\u4e00-\u9fa5]` is treated as already translated.

## Dictionary formats

Two shapes are accepted, both verified against the engine:

**A. Upstream / vendored** (`packages/patcher-cursor/i18n/dictionary.json`)

```jsonc
{
  "regex": { "Found (\\d+) files": "找到 $1 个文件" },   // pattern -> template
  "navigation": { "Cloud Agents": "Cloud 智能体" },        // nested OK
  "Manage Account": "管理账户"
}
```

**B. Generated in this repo** (`dictionaries/zh-CN.json`)

```jsonc
{
  "schemaVersion": 1,
  "locale": "zh-CN",
  "entries":  { "&&Quit": "退出" },                        // flat, keyed by source string
  "patterns": [{ "regex": "^(\\d+) requests? remaining$", "flags": "i", "replacement": "$1 次请求剩余" }]
}
```

`entries` is resolved by the engine's recursive lookup, so no conversion is needed.
`patterns` (an array of `{regex, flags, replacement}`) is compiled as an alias for the
native `regex` map; `g`/`y` flags are stripped because rules are probed with `test()`.
`$1`-style back-references in `replacement` work as in `String.replace`.

Measured with `dictionaries/zh-CN.json`: 244 regex rules and 2997 entries load correctly.

> Cost note: every distinct text node is tested against all regex rules once. At 244 rules
> this is noticeably heavier than upstream's 5 — only unmatched strings pay it, and results
> are cached in `localStorage`, but keep an eye on it if the rule count grows.

## Dictionary loading order

`config.dictPath` → `config.dictDir/dictionary.<lang>.json` → `config.dictDir/dictionary.json`
→ `~/.live_translator_hub/dicts/cursor/dictionary.<lang>.json` →
`~/.live_translator_hub/dicts/cursor/dictionary.json` →
`packages/patcher-cursor/i18n/dictionary.<lang>.json` →
`packages/patcher-cursor/i18n/dictionary.json`.

The `~/.live_translator_hub` path is an upstream leftover. Pass `dictPath` so the CLI
reads from this repo's `dictionaries/` and never depends on the user's home directory.

**Known data bug:** for `zh-CN` the vendored `dictionary.zh-CN.json` wins over
`dictionary.json`, and its `regex` templates use literal `(\\d+)` instead of `$1`
back-references (`"Found (\\d+) files" -> "找到 (\\d+) 个文件"`), so those five rules
emit the literal pattern. `dictionary.json` has the correct `$1` form. `cli/patcher.js`
already passes `dictPath` pointing at `dictionaries/zh-CN.json`, which bypasses this.

## Required files (fail fast if missing)

- `packages/core/src/translator-engine.js` — throws `找不到翻译引擎核心: <path>`
- `packages/core/src/language-names.js`
- `packages/core/src/protection-defaults.json` — loaded at module load time
- `packages/patcher-cursor/i18n/dictionary*.json` (or `dictPath`)
- Target: `<appRoot>/product.json`, `<appRoot>/out/vs/code/electron-sandbox/workbench/workbench.{js,html}`

`translator-engine.js` references `window`, so it must never be `require()`d — the
patcher reads it with `fs.readFileSync` and inlines it. `require('packages/patcher-cursor')`
is safe in plain Node.

## Adaptation notes vs. upstream

1. `require('@live-translator/core/src/...')` → `../core/src/...`; the
   `require.resolve('@live-translator/core/...')` probe is gone, replaced by the
   `ENGINE_PATH` constant.
2. `dependencies: { "@live-translator/core": "*" }` removed from
   `patcher-cursor/package.json` so `npm install` cannot pull an unrelated package.
   Package names are kept unchanged purely for provenance; they are never resolved by name.
3. Anthropic/Claude translation backend removed from the engine and from `engineConfig`.
   An `activeId` outside `none|openai|gemini|deepl` now degrades to `none` with a warning.
4. `config.codesign` is **opt-in** (default `false`); upstream always re-signed.
5. `config.dictPath` / `config.dictDir` let callers own dictionary location.
6. `getPaths()` no longer throws `ENOENT` on a stale `appPath`; `detectStatus()` returns
   `{ installed: false }` instead.
7. `install()` warns via `onProgress` when `workbench.html` already references a foreign
   `*Localization*.js` script.
8. The engine accepts `patterns: [{regex, flags, replacement}]` as an alias for its native
   `regex: {pattern: template}` map, so `dictionaries/<locale>.json` needs no conversion.
9. The macOS `xattr`/`codesign` block was de-duplicated into `fixMacBundleSignature()`.

## Integration status

`cli/patcher.js` in this repo calls exactly this contract (`require('../packages/patcher-cursor')`,
`new CursorPatcher()`, `detectStatus`, `install` with `dictPath`, `restore`, `createBackup`).
Verified end to end against a synthetic `Cursor.app` tree: status → install → dictionary
injection → checksum update → restore. No changes were needed on the CLI side.

## Compatibility risks on Cursor 3.27.22 (macOS, verified against the real bundle)

Ordered by severity. All findings below were read-only observations; the patcher was
never run against `/Applications/Cursor.app`.

1. **A second localizer is already installed.** `workbench.html` contains
   `<!-- CURSOR_LOCALIZATION_INJECTION -->` + `<script src="./Cursor_Localization.js">`
   (a separate 502 KB Python-generated script). Keep both and the two engines rewrite the
   same text nodes. Uninstall it first, and note that its backup is `workbench.html.bak`
   (no version segment) — the patcher's restore regex `^(workbench\.(?:html|js))\.(.+)\.bak$`
   does **not** match it, so `restore()` will not clean it up.
2. **`restore()` returns to install-time state, not vanilla.** Because the html is already
   patched, `install()` snapshots that patched html as `workbench.html.3.27.22.bak`.
3. **Re-signing is now opt-in, and a codesign failure is not rolled back.** Cursor.app is
   Developer ID signed (Team `VDXQ22DGB9`, hardened runtime); `codesign --force --deep --sign -`
   downgrades it to ad-hoc and drops entitlements (`--deep` is also deprecated for Electron).
   The seal is *already* invalid on this machine (`a sealed resource is missing or invalid`)
   and Cursor still launches, so `codesign` defaults to `false`. If it is enabled and fails,
   the exception is raised **after** `workbench.js`, `workbench.html`, and `product.json` have
   been written — run `restore()` to roll back.
4. **The CSP rewrite is a silent no-op.** 3.27.22 formats the policy as a multi-line
   `<meta ... content="..."/>`; the regex requires `content="[^"]*">` and does not match.
   Harmless today (code is appended to the external `workbench.js`, which `script-src 'self'`
   allows), but any future move to an inline `<script>` will be blocked by CSP.
5. **`require-trusted-types-for 'script'` is enforced.** The engine must not use `innerHTML` /
   `insertAdjacentHTML`. It currently does not — keep it that way.
6. **`workbench.js` is a ~36 KB IIFE loaded as `type="module"`.** Appending after its
   `//# sourceMappingURL=` line works and the appended code runs in module (strict) mode.
   Verified: injected payload parses, and a second `install()` does not duplicate it.
7. **`product.json` is 2-space indented; the patcher rewrites it with tabs.** Cosmetic only;
   the checksum values themselves are computed correctly.
8. **Auto-update wipes the patch.** Cursor replaces the whole `.app`; `versionMismatch`
   and `backupVersion` are the only signals, and a re-install is required.
9. **`injectWebview: true` is a no-op here.** No `~/.cursor/extensions/*/webview/index.js`
   exists, so `getPluginPaths()` returns `[]`.
10. **`ms-ceintl.vscode-language-pack-zh-hans` is installed**, so some strings may already be
    Chinese and are skipped by the `[\u4e00-\u9fa5]` guard.
11. **TCC.** Writing under `/Applications` needs Full Disk Access for the calling terminal/app;
    otherwise expect up to 120 s of retries before `授权超时`.

## Do not

- Do not run against `/Applications/Cursor.app` from tests or CI.
- Do not `require()` the engine directly.
- Do not parse `onProgress` messages — they are translated display strings.
