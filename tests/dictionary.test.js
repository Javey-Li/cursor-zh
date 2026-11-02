'use strict';

/**
 * Node test suite for the shipped cursor-zh dictionary.
 * Run with: node --test tests/dictionary.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DICT_DIR = path.join(__dirname, '..', 'dictionaries');
const dictionary = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'zh-CN.json'), 'utf8'));
const conflicts = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'conflicts.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'manifest.json'), 'utf8'));

const OWN_PATTERNS = [
  '^Agent AI Stats: (\\d+) accepted out of (\\d+) suggested, (\\d+) percent acceptance rate$',
  '^Tab AI Stats: (\\d+) accepted out of (\\d+) suggested, (\\d+) percent acceptance rate$',
  '^(\\d+) minutes? left$',
  '^(\\d+) hours? left$',
  '^(\\d+) days? left$',
];

test('dictionary has the expected schema header', () => {
  assert.equal(dictionary.schemaVersion, 1);
  assert.equal(dictionary.locale, 'zh-CN');
  assert.match(dictionary.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(dictionary.cursorVersions) && dictionary.cursorVersions.length > 0);
  assert.ok(dictionary.entries && typeof dictionary.entries === 'object' && !Array.isArray(dictionary.entries));
});

test('entries are unique, non-empty English -> Chinese pairs', () => {
  const keys = Object.keys(dictionary.entries);
  assert.ok(keys.length >= 2500, `expected >= 2500 unique entries, got ${keys.length}`);
  assert.equal(new Set(keys).size, keys.length, 'entry keys must be unique');
  for (const key of keys) {
    assert.equal(typeof key, 'string');
    assert.ok(key.trim().length > 0, 'entry key must not be blank');
    const value = dictionary.entries[key];
    assert.equal(typeof value, 'string', `value for ${JSON.stringify(key)} must be a string`);
    assert.ok(value.trim().length > 0, `value for ${JSON.stringify(key)} must not be empty`);
    assert.notEqual(value.trim(), key.trim(), `value for ${JSON.stringify(key)} must be translated`);
  }
});

test('known UI strings are translated', () => {
  assert.equal(dictionary.entries['Add keyword'], '添加关键词');
  assert.equal(dictionary.entries['Search settings ⌘F'], '搜索设置 ⌘F');
});

test('pattern set is large enough, duplicate-free and compiles', () => {
  assert.ok(Array.isArray(dictionary.patterns));
  assert.ok(dictionary.patterns.length >= 200, `expected >= 200 patterns, got ${dictionary.patterns.length}`);

  const regexes = dictionary.patterns.map((pattern) => pattern.regex);
  assert.equal(new Set(regexes).size, regexes.length, 'pattern regexes must be duplicate-free');

  for (const pattern of dictionary.patterns) {
    assert.equal(typeof pattern.regex, 'string');
    assert.equal(typeof pattern.flags, 'string');
    assert.equal(typeof pattern.replacement, 'string');
    assert.ok(pattern.replacement.trim().length > 0, `replacement for ${pattern.regex} must not be empty`);
    assert.doesNotThrow(() => new RegExp(pattern.regex, pattern.flags), `pattern must compile: ${pattern.regex}`);
  }
});

test('the five cursor-zh specific patterns are present', () => {
  const regexes = new Set(dictionary.patterns.map((pattern) => pattern.regex));
  for (const regex of OWN_PATTERNS) {
    assert.ok(regexes.has(regex), `missing pattern: ${regex}`);
  }
});

test('sources carry attribution metadata and add up to the entry count', () => {
  const roles = new Set(['seed', 'mit', 'own']);
  assert.ok(Array.isArray(dictionary.sources) && dictionary.sources.length >= 3);
  let contributed = 0;
  for (const source of dictionary.sources) {
    assert.ok(source.name && source.url && source.license, 'source needs name/url/license');
    assert.ok(roles.has(source.role), `unexpected role ${source.role}`);
    assert.ok(Number.isInteger(source.entries) && source.entries >= 0);
    contributed += source.entries;
  }
  assert.equal(contributed, Object.keys(dictionary.entries).length);
  assert.ok(dictionary.sources.some((source) => source.role === 'own'));
  assert.ok(dictionary.sources.some((source) => source.role === 'mit'));
  assert.ok(dictionary.sources.some((source) => source.role === 'seed'));
});

test('conflict log is consistent with the merged entries', () => {
  assert.ok(Array.isArray(conflicts.conflicts));
  assert.equal(conflicts.total, conflicts.conflicts.length);
  for (const item of conflicts.conflicts) {
    assert.equal(dictionary.entries[item.key], item.chosen.value, `chosen value mismatch for ${item.key}`);
    assert.ok(Array.isArray(item.rejected) && item.rejected.length > 0, 'conflict must list rejected values');
    for (const rejected of item.rejected) {
      assert.notEqual(rejected.value, item.chosen.value, 'rejected value must differ from the chosen one');
    }
  }
});

test('manifest counts match the generated files', () => {
  assert.equal(manifest.totalUniqueEntries, Object.keys(dictionary.entries).length);
  assert.equal(manifest.patternCount, dictionary.patterns.length);
  assert.equal(manifest.conflictCount, conflicts.total);
  assert.equal(manifest.generatedAt, dictionary.generatedAt);
  assert.ok(Array.isArray(manifest.provenance) && manifest.provenance.length > 0);
  assert.equal(
    manifest.sources.reduce((sum, source) => sum + source.contributedEntries, 0),
    manifest.totalUniqueEntries,
  );
});
