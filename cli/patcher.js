'use strict';

function loadPatcher() {
  try {
    return require('../packages/patcher-cursor');
  } catch (err) {
    throw new Error(
      'The Cursor patcher is not available. Run `npm install` or check packages/patcher-cursor.\n' +
        err.message
    );
  }
}

function createPatcher() {
  const { CursorPatcher } = loadPatcher();
  return new CursorPatcher();
}

async function status(appPath) {
  const patcher = createPatcher();
  return patcher.detectStatus(appPath || null);
}

async function install({ appPath, dictionaryPath, codesign = true, onProgress }) {
  const patcher = createPatcher();
  return patcher.install(
    {
      appPath: appPath || null,
      targetLanguage: 'zh-CN',
      activeId: 'none',
      engines: {},
      skip: { _cursor_: {} },
      dictPath: dictionaryPath,
      codesign: codesign !== false
    },
    { onProgress: onProgress || (() => {}) }
  );
}

async function restore({ appPath, codesign = true, onProgress }) {
  const patcher = createPatcher();
  return patcher.restore(
    { appPath: appPath || null, codesign: codesign !== false },
    { onProgress: onProgress || (() => {}) }
  );
}

async function createBackup({ appPath, onProgress }) {
  const patcher = createPatcher();
  return patcher.createBackup(
    { appPath: appPath || null },
    { onProgress: onProgress || (() => {}) }
  );
}

module.exports = {
  createPatcher,
  status,
  install,
  restore,
  createBackup
};
