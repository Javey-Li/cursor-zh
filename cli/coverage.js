'use strict';

const fs = require('fs');
const path = require('path');

const STRING_RE = /"((?:[^"\\]|\\.){3,160})"|'((?:[^'\\]|\\.){3,160})'|`((?:[^`\\]|\\.){3,160})`/g;

const NOISE_WORDS = new Set([
  'Enter', 'Escape', 'Esc', 'Tab', 'Shift', 'Alt', 'Meta', 'Ctrl', 'Cmd', 'Command', 'Option',
  'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'CapsLock', 'NumLock', 'Space', 'Return', 'Windows', 'Mac', 'Linux',
  'INPUT', 'TEXTAREA', 'BUTTON', 'DIV', 'SPAN', 'SELECT', 'OPTION', 'SCRIPT', 'STYLE', 'HTML',
  'BODY', 'HEAD', 'FORM', 'LABEL', 'CANVAS', 'SVG', 'PATH', 'URL', 'URI', 'API', 'JSON', 'CSS'
]);

const SKIP_PATTERNS = [
  /[{}$;<>]/,
  /:\/\//,
  /\bmg-[a-z0-9]/i,
  /className|aria-|data-testid|useState|useEffect|require\(|module\.exports/,
  /\b(function|return|const|let|var|import|export|class|extends|async|await)\b/,
  /\\u[0-9a-f]{4}/i,
  /\.(js|ts|tsx|jsx|css|scss|json|png|jpg|jpeg|svg|woff2?|ttf)$/i,
  /^https?:/i,
  /^[./~]/,
  /\s{2,}/,
  /[\u4e00-\u9fff]/
];

function listJsFiles(appRoot) {
  const files = [];
  const add = (file) => {
    try {
      const stat = fs.statSync(file);
      if (stat.isFile() && stat.size > 0) files.push({ file, size: stat.size });
    } catch (err) {
      // ignore
    }
  };

  add(path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.js'));
  add(path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.glass.main.js'));
  add(path.join(appRoot, 'out', 'main.js'));
  add(path.join(appRoot, 'out', 'vs', 'code', 'electron-sandbox', 'workbench', 'workbench.js'));

  const assetsDir = path.join(appRoot, 'molten', 'dist', 'renderer', 'assets');
  try {
    for (const name of fs.readdirSync(assetsDir)) {
      if (name.endsWith('.js')) add(path.join(assetsDir, name));
    }
  } catch (err) {
    // molten assets are optional
  }

  return files;
}

function looksLikeUiText(text) {
  const value = text.trim();
  if (value.length < 3 || value.length > 160) return false;
  if (!/[A-Za-z]{2,}/.test(value)) return false;
  if (!/\s/.test(value) && !/^[A-Z0-9⌘⌥⇧⌃]/.test(value)) return false;
  if (!/^[A-Z0-9⌘⌥⇧⌃]/.test(value)) return false;
  if (/^\d+(\.\d+)?(px|rem|em|%|vh|vw|s|ms|deg|fr)$/i.test(value)) return false;
  if (/^[A-Z_]{2,}$/.test(value)) return false;
  if (/^F\d{1,2}$/.test(value)) return false;
  if (!/\s/.test(value) && NOISE_WORDS.has(value)) return false;
  for (const re of SKIP_PATTERNS) {
    if (re.test(value)) return false;
  }
  return true;
}

function scanFile(file, dictionaryKeys) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { file, candidates: 0, missing: [] };
  }

  const seen = new Set();
  const missing = [];
  STRING_RE.lastIndex = 0;
  let match;
  while ((match = STRING_RE.exec(content)) !== null) {
    const value = (match[1] || match[2] || match[3] || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    if (!looksLikeUiText(value)) continue;
    if (dictionaryKeys.has(value)) continue;
    missing.push(value);
  }

  return { file, candidates: seen.size, missing };
}

function scan({ appRoot, dictionary, limit = 100 }) {
  const keys = new Set(Object.keys(dictionary.entries || {}));
  const files = listJsFiles(appRoot);
  const missingCounts = new Map();
  let candidates = 0;
  const perFile = [];

  for (const entry of files) {
    const result = scanFile(entry.file, keys);
    candidates += result.candidates;
    perFile.push({
      file: path.relative(appRoot, entry.file),
      candidates: result.candidates,
      missing: result.missing.length
    });
    for (const value of result.missing) {
      missingCounts.set(value, (missingCounts.get(value) || 0) + 1);
    }
  }

  const missing = Array.from(missingCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([text, count]) => ({ text, count }));

  return {
    appRoot,
    files: files.length,
    candidates,
    dictionaryEntries: keys.size,
    missingUnique: missingCounts.size,
    coverage: candidates > 0 ? Number((((candidates - missingCounts.size) / candidates) * 100).toFixed(1)) : 0,
    perFile,
    missing
  };
}

module.exports = { scan, looksLikeUiText, listJsFiles };
