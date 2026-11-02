#!/usr/bin/env node
/**
 * Schema validator for the cursor-zh dictionary. No dependencies.
 *
 * Usage:
 *   node tools/validate-dictionary.js [path/to/zh-CN.json]
 *
 * Path resolution: CLI argument > CURSOR_ZH_DICTIONARY > ../dictionaries/zh-CN.json.
 * Checks the dictionary, then cross-checks conflicts.json / manifest.json when they
 * sit next to it. Exits 1 on the first failing category (all problems are printed).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROLES = new Set(['seed', 'mit', 'own']);
const DEFAULT_PATH = path.join(__dirname, '..', 'dictionaries', 'zh-CN.json');

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function readJson(file, errors, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${label}: cannot read ${file}: ${error.message}`);
    return null;
  }
}

function validate(dictionary, errors, warnings) {
  if (!isPlainObject(dictionary)) {
    errors.push('dictionary must be a JSON object');
    return;
  }

  if (dictionary.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1, got ${JSON.stringify(dictionary.schemaVersion)}`);
  }
  if (dictionary.locale !== 'zh-CN') {
    errors.push(`locale must be "zh-CN", got ${JSON.stringify(dictionary.locale)}`);
  }
  if (typeof dictionary.generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dictionary.generatedAt)) {
    errors.push(`generatedAt must be a YYYY-MM-DD string, got ${JSON.stringify(dictionary.generatedAt)}`);
  }
  if (!Array.isArray(dictionary.cursorVersions) || dictionary.cursorVersions.length === 0
    || !dictionary.cursorVersions.every(isNonEmptyString)) {
    errors.push('cursorVersions must be a non-empty array of strings');
  }

  if (!isPlainObject(dictionary.entries)) {
    errors.push('entries must be an object');
  } else {
    const keys = Object.keys(dictionary.entries);
    if (keys.length === 0) errors.push('entries must not be empty');
    let badKeys = 0;
    let badValues = 0;
    for (const key of keys) {
      const value = dictionary.entries[key];
      if (key.trim() === '') badKeys += 1;
      if (!isNonEmptyString(value)) {
        badValues += 1;
        if (badValues <= 5) errors.push(`entries[${JSON.stringify(key)}] must be a non-empty string`);
      }
      if (key === value) {
        errors.push(`entries[${JSON.stringify(key)}] is untranslated (value equals key)`);
      }
    }
    if (badKeys > 0) errors.push(`${badKeys} entries have a blank key`);
    if (badValues > 5) errors.push(`...and ${badValues - 5} more entries with an empty/non-string value`);
  }

  if (!Array.isArray(dictionary.patterns)) {
    errors.push('patterns must be an array');
  } else {
    const seen = new Map();
    dictionary.patterns.forEach((pattern, index) => {
      if (!isPlainObject(pattern)) {
        errors.push(`patterns[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(pattern.regex)) errors.push(`patterns[${index}].regex must be a non-empty string`);
      if (typeof pattern.flags !== 'string') errors.push(`patterns[${index}].flags must be a string`);
      if (typeof pattern.replacement !== 'string') {
        errors.push(`patterns[${index}].replacement must be a string`);
      } else if (pattern.replacement.trim() === '') {
        errors.push(`patterns[${index}].replacement must not be empty`);
      }
      if (typeof pattern.regex === 'string' && typeof pattern.flags === 'string') {
        if (/[^dgimsuvy]/.test(pattern.flags)) {
          errors.push(`patterns[${index}].flags contains unsupported flags: ${JSON.stringify(pattern.flags)}`);
        } else {
          try {
            new RegExp(pattern.regex, pattern.flags);
          } catch (error) {
            errors.push(`patterns[${index}] does not compile: ${error.message} (${JSON.stringify(pattern.regex)})`);
          }
        }
      }
      if (typeof pattern.regex === 'string') {
        if (seen.has(pattern.regex)) {
          errors.push(`duplicate pattern regex at indexes ${seen.get(pattern.regex)} and ${index}: ${JSON.stringify(pattern.regex)}`);
        } else {
          seen.set(pattern.regex, index);
        }
      }
    });
  }

  if (!Array.isArray(dictionary.sources) || dictionary.sources.length === 0) {
    errors.push('sources must be a non-empty array');
  } else {
    let contributed = 0;
    dictionary.sources.forEach((source, index) => {
      if (!isPlainObject(source)) {
        errors.push(`sources[${index}] must be an object`);
        return;
      }
      for (const field of ['name', 'url', 'license']) {
        if (!isNonEmptyString(source[field])) errors.push(`sources[${index}].${field} must be a non-empty string`);
      }
      if (!ROLES.has(source.role)) errors.push(`sources[${index}].role must be one of seed|mit|own`);
      if (!Number.isInteger(source.entries) || source.entries < 0) {
        errors.push(`sources[${index}].entries must be a non-negative integer`);
      } else {
        contributed += source.entries;
      }
    });
    if (isPlainObject(dictionary.entries) && contributed !== Object.keys(dictionary.entries).length) {
      warnings.push(
        `sum of sources[].entries (${contributed}) differs from entries count (${Object.keys(dictionary.entries).length})`,
      );
    }
  }
}

function crossCheckConflicts(file, dictionary, errors) {
  if (!fs.existsSync(file)) {
    return null;
  }
  const conflicts = readJson(file, errors, 'conflicts');
  if (!conflicts) return null;
  if (!Array.isArray(conflicts.conflicts)) {
    errors.push('conflicts.conflicts must be an array');
    return conflicts;
  }
  if (conflicts.total !== conflicts.conflicts.length) {
    errors.push(`conflicts.total (${conflicts.total}) must equal conflicts.conflicts.length (${conflicts.conflicts.length})`);
  }
  for (const item of conflicts.conflicts) {
    if (!isNonEmptyString(item.key)) {
      errors.push('conflict entry without a key');
      continue;
    }
    const chosen = dictionary.entries ? dictionary.entries[item.key] : undefined;
    if (chosen === undefined) {
      errors.push(`conflict key ${JSON.stringify(item.key)} is missing from entries`);
    } else if (chosen !== item.chosen?.value) {
      errors.push(`conflict key ${JSON.stringify(item.key)}: chosen value does not match entries`);
    }
    if (!Array.isArray(item.rejected) || item.rejected.length === 0) {
      errors.push(`conflict key ${JSON.stringify(item.key)} has no rejected values`);
    }
  }
  return conflicts;
}

function crossCheckManifest(file, dictionary, conflicts, errors) {
  if (!fs.existsSync(file)) {
    return null;
  }
  const manifest = readJson(file, errors, 'manifest');
  if (!manifest) return null;
  const entryCount = isPlainObject(dictionary.entries) ? Object.keys(dictionary.entries).length : -1;
  if (manifest.totalUniqueEntries !== entryCount) {
    errors.push(`manifest.totalUniqueEntries (${manifest.totalUniqueEntries}) must equal entries count (${entryCount})`);
  }
  if (manifest.patternCount !== (Array.isArray(dictionary.patterns) ? dictionary.patterns.length : -1)) {
    errors.push('manifest.patternCount must equal patterns.length');
  }
  if (conflicts && manifest.conflictCount !== conflicts.total) {
    errors.push('manifest.conflictCount must equal conflicts.total');
  }
  if (manifest.generatedAt !== dictionary.generatedAt) {
    errors.push('manifest.generatedAt must equal dictionary.generatedAt');
  }
  if (!Array.isArray(manifest.provenance) || manifest.provenance.length === 0) {
    errors.push('manifest.provenance must be a non-empty array');
  }
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    errors.push('manifest.sources must be a non-empty array');
  }
  return manifest;
}

function main() {
  const target = path.resolve(
    process.argv[2] || process.env.CURSOR_ZH_DICTIONARY || DEFAULT_PATH,
  );
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(target)) {
    console.error(`dictionary not found: ${target}`);
    process.exit(1);
  }

  const dictionary = readJson(target, errors, 'dictionary');
  if (dictionary) {
    validate(dictionary, errors, warnings);
    const conflicts = crossCheckConflicts(path.join(path.dirname(target), 'conflicts.json'), dictionary, errors);
    crossCheckManifest(path.join(path.dirname(target), 'manifest.json'), dictionary, conflicts, errors);
  }

  const entryCount = dictionary && isPlainObject(dictionary.entries) ? Object.keys(dictionary.entries).length : 0;
  const patternCount = dictionary && Array.isArray(dictionary.patterns) ? dictionary.patterns.length : 0;
  const sourceCount = dictionary && Array.isArray(dictionary.sources) ? dictionary.sources.length : 0;
  const conflictCount = fs.existsSync(path.join(path.dirname(target), 'conflicts.json'))
    ? (readJson(path.join(path.dirname(target), 'conflicts.json'), [], 'conflicts')?.total ?? 0)
    : 0;

  console.log(`file:      ${target}`);
  console.log(`locale:    ${dictionary ? dictionary.locale : '?'} (schemaVersion ${dictionary ? dictionary.schemaVersion : '?'})`);
  console.log(`entries:   ${entryCount}`);
  console.log(`patterns:  ${patternCount}`);
  console.log(`sources:   ${sourceCount}`);
  console.log(`conflicts: ${conflictCount}`);
  for (const warning of warnings) console.log(`warning: ${warning}`);

  if (errors.length > 0) {
    console.error(`\nFAILED with ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log('\nOK');
}

main();
