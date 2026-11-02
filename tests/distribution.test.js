'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('double-click installers and agent skill exist', () => {
  for (const file of ['install.command', 'install.ps1', 'install.cmd', 'skills/cursor-zh/SKILL.md']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
  }
});

test('install.command has a shebang and is executable', () => {
  const file = path.join(root, 'install.command');
  const content = fs.readFileSync(file, 'utf8');
  assert.match(content, /^#!\/bin\/bash/m);
  if (process.platform !== 'win32') {
    assert.ok((fs.statSync(file).mode & 0o111) !== 0, 'install.command is not executable');
  }
});

test('agent skill has valid frontmatter and safety rules', () => {
  const content = fs.readFileSync(path.join(root, 'skills/cursor-zh/SKILL.md'), 'utf8');
  assert.match(content, /^---\nname: cursor-zh\ndescription: .+\n---/);
  assert.match(content, /Do not run `--force` or `--yes` without explicit user approval/);
  assert.match(content, /Do not install Claude support/);
});

test('README documents the double-click and skill entry points', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /install\.command/);
  assert.match(readme, /install\.ps1/);
  assert.match(readme, /skills\/cursor-zh\/SKILL\.md/);
});
