'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { resolveAppRoot } = require('../cli/paths');

const appPath = process.env.CURSOR_ZH_TEST_APP;
const cli = path.join(__dirname, '..', 'cli', 'index.js');

function run(...args) {
  return execFileSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

test(
  'install, status and restore on a copied Cursor app',
  { skip: !appPath && 'set CURSOR_ZH_TEST_APP to a disposable Cursor.app copy' },
  () => {
    const before = run('status', '--app', appPath);
    assert.match(before, /版本:/);

    run('install', '--app', appPath, '--force');
    const installed = run('status', '--app', appPath);
    assert.match(installed, /已打补丁: 是/);

    const workbenchJs = path.join(
      resolveAppRoot(appPath),
      'out', 'vs', 'code', 'electron-sandbox', 'workbench', 'workbench.js'
    );
    const content = fs.readFileSync(workbenchJs, 'utf8');
    assert.match(content, /__I18N_TERMS__/);
    assert.match(content, /添加关键词/);
    assert.match(content, /\(\?i:/);

    run('restore', '--app', appPath);
    const restored = run('status', '--app', appPath);
    assert.match(restored, /已打补丁: 否/);
  }
);
