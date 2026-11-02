'use strict';

const path = require('path');
const { dictionaryFile, engineDictionaryPath, ensureDir, readJson } = require('./paths');

function loadDictionary(file = dictionaryFile()) {
  const dict = readJson(file);
  if (!dict || typeof dict !== 'object') throw new Error(`Dictionary not found or invalid: ${file}`);
  if (!dict.entries || typeof dict.entries !== 'object') throw new Error('Dictionary is missing entries');
  if (!Array.isArray(dict.patterns)) throw new Error('Dictionary is missing patterns');
  return dict;
}

function stats(dict) {
  return {
    locale: dict.locale || 'zh-CN',
    schemaVersion: dict.schemaVersion || 0,
    generatedAt: dict.generatedAt || '',
    entries: Object.keys(dict.entries || {}).length,
    patterns: (dict.patterns || []).length,
    sources: Array.isArray(dict.sources) ? dict.sources.length : 0
  };
}

function toEngineDictionary(dict) {
  const out = {};
  for (const [en, zh] of Object.entries(dict.entries || {})) {
    if (typeof en === 'string' && en && typeof zh === 'string' && zh) out[en] = zh;
  }
  const regex = {};
  for (const rule of dict.patterns || []) {
    if (!rule || typeof rule.regex !== 'string' || typeof rule.replacement !== 'string') continue;
    let pattern = rule.regex;
    if ((rule.flags || '').includes('i') && !pattern.startsWith('(?i:')) pattern = `(?i:${pattern})`;
    regex[pattern] = rule.replacement;
  }
  out.regex = regex;
  return out;
}

function writeEngineDictionary(dict, target = engineDictionaryPath()) {
  const engineDict = toEngineDictionary(dict);
  ensureDir(path.dirname(target));
  require('fs').writeFileSync(target, JSON.stringify(engineDict) + '\n', 'utf8');
  return target;
}

module.exports = {
  loadDictionary,
  stats,
  toEngineDictionary,
  writeEngineDictionary
};
