'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { readJson, writeJson } = require('./paths');

const PACK_ID = 'ms-ceintl.vscode-language-pack-zh-hans';
const PACK_PREFIX = PACK_ID + '-';

function productInfo(appRoot) {
  return readJson(path.join(appRoot, 'product.json'), {}) || {};
}

function extensionsDir() {
  return path.join(os.homedir(), '.cursor', 'extensions');
}

function findInstalledPack() {
  const dir = extensionsDir();
  let names;
  try {
    names = fs.readdirSync(dir).filter((name) => name.startsWith(PACK_PREFIX));
  } catch (e) {
    return null;
  }
  const packs = names
    .map((name) => {
      const full = path.join(dir, name);
      const pkg = readJson(path.join(full, 'package.json'), {}) || {};
      return { dir: full, name, version: pkg.version || name.slice(PACK_PREFIX.length), engines: pkg.engines || {} };
    })
    .sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true }));
  return packs[0] || null;
}

function cursorCli(appRoot) {
  const candidates = [
    path.join(appRoot, 'bin', 'cursor'),
    path.join(appRoot, 'bin', 'cursor.cmd'),
    path.join(appRoot, 'bin', 'code'),
    path.join(appRoot, 'bin', 'code.cmd')
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

function userDataDir() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Cursor');
  }
  return path.join(os.homedir(), '.config', 'Cursor');
}

function ensureLocale() {
  const file = path.join(userDataDir(), 'User', 'locale.json');
  const current = readJson(file, null);
  if (current && current.locale === 'zh-cn') return { file, changed: false };
  writeJson(file, { locale: 'zh-cn' });
  return { file, changed: true };
}

function installViaCli(appRoot, onProgress) {
  const cli = cursorCli(appRoot);
  if (!cli) {
    throw new Error(
      '未找到 Cursor CLI，无法自动安装语言包。请在 Cursor 扩展市场安装 "Chinese (Simplified) Language Pack" 后重试。'
    );
  }
  onProgress(`正在安装官方简体中文语言包: ${PACK_ID}`);
  const args = ['--install-extension', PACK_ID, '--force'];
  const result = spawnSync(cli, args, {
    encoding: 'utf8',
    timeout: 180000,
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`语言包安装失败${detail ? `: ${detail}` : ''}`);
  }
  const installed = findInstalledPack();
  if (installed) onProgress(`语言包已安装: ${installed.version}`);
  return installed;
}

function ensureLanguagePack({ appRoot, onProgress }) {
  const info = productInfo(appRoot);
  const installed = findInstalledPack();
  if (installed) {
    onProgress(`语言包已安装: ${installed.version}`);
    const locale = ensureLocale();
    if (locale.changed) onProgress(`已写入显示语言: ${locale.file}`);
    return { ok: true, skipped: true, version: installed.version, vscodeVersion: info.vscodeVersion || '' };
  }

  const pack = installViaCli(appRoot, onProgress);
  const locale = ensureLocale();
  if (locale.changed) onProgress(`已写入显示语言: ${locale.file}`);
  return { ok: true, skipped: false, version: pack ? pack.version : '', vscodeVersion: info.vscodeVersion || '' };
}

module.exports = {
  PACK_ID,
  productInfo,
  findInstalledPack,
  cursorCli,
  userDataDir,
  ensureLocale,
  ensureLanguagePack
};
