'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

function defaultAppPath() {
  if (process.platform === 'darwin') return '/Applications/Cursor.app';
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor');
  }
  return '/usr/share/cursor';
}

function resolveAppRoot(input) {
  const candidate = input || defaultAppPath();
  if (fs.existsSync(path.join(candidate, 'product.json'))) return candidate;
  const macRoot = path.join(candidate, 'Contents', 'Resources', 'app');
  if (fs.existsSync(path.join(macRoot, 'product.json'))) return macRoot;
  const winRoot = path.join(candidate, 'resources', 'app');
  if (fs.existsSync(path.join(winRoot, 'product.json'))) return winRoot;
  return candidate;
}

function stateDir() {
  return path.join(os.homedir(), '.cursor-zh');
}

function stateFile() {
  return path.join(stateDir(), 'state.json');
}

function engineDictionaryPath() {
  return path.join(stateDir(), 'engine', 'dictionary.zh-CN.json');
}

function dictionaryFile() {
  return path.join(__dirname, '..', 'dictionaries', 'zh-CN.json');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

module.exports = {
  defaultAppPath,
  resolveAppRoot,
  stateDir,
  stateFile,
  engineDictionaryPath,
  dictionaryFile,
  ensureDir,
  readJson,
  writeJson
};
