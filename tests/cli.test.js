'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { toEngineDictionary } = require('../cli/dictionary');
const { looksLikeUiText } = require('../cli/coverage');
const { resolveAppRoot } = require('../cli/paths');

test('toEngineDictionary keeps flat entries and converts patterns', () => {
  const dict = {
    entries: {
      'Close (⌘W)': '关闭 (⌘W)',
      'Search settings ⌘F': '搜索设置 ⌘F'
    },
    patterns: [
      { regex: '^(\\d+) minutes? left$', flags: 'i', replacement: '剩余 $1 分钟' }
    ]
  };
  const engine = toEngineDictionary(dict);
  assert.equal(engine['Close (⌘W)'], '关闭 (⌘W)');
  assert.equal(engine['Search settings ⌘F'], '搜索设置 ⌘F');
  assert.equal(engine.regex['(?i:^(\\d+) minutes? left$)'], '剩余 $1 分钟');
});

test('looksLikeUiText accepts UI labels and rejects code/URLs', () => {
  assert.equal(looksLikeUiText('Search settings ⌘F'), true);
  assert.equal(looksLikeUiText('Close (⌘W)'), true);
  assert.equal(looksLikeUiText('function foo()'), false);
  assert.equal(looksLikeUiText('https://example.com'), false);
  assert.equal(looksLikeUiText('mg-1a2b3c'), false);
  assert.equal(looksLikeUiText('设置'), false);
});

test('resolveAppRoot accepts a macOS app bundle path', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-zh-test-'));
  const appRoot = path.join(temp, 'Cursor.app', 'Contents', 'Resources', 'app');
  fs.mkdirSync(appRoot, { recursive: true });
  fs.writeFileSync(path.join(appRoot, 'product.json'), '{}');
  assert.equal(resolveAppRoot(path.join(temp, 'Cursor.app')), appRoot);
});
