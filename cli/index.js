#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const paths = require('./paths');
const dictionary = require('./dictionary');
const languagePack = require('./language-pack');
const patcher = require('./patcher');
const coverage = require('./coverage');

const VERSION = require('../package.json').version;

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args[0] : 'help';
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--app') flags.app = args[++i];
    else if (arg === '--limit') flags.limit = Number(args[++i]) || 100;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--force') flags.force = true;
    else if (arg === '--yes' || arg === '-y') flags.yes = true;
    else if (arg === '--no-codesign') flags.noCodesign = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (!arg.startsWith('-')) flags._.push(arg);
  }
  return { command, flags };
}

function out(text) {
  process.stdout.write(text + '\n');
}

function err(text) {
  process.stderr.write(text + '\n');
}

function loadDictionaryOrNull() {
  try {
    return dictionary.loadDictionary();
  } catch (e) {
    return null;
  }
}

function printDictionaryStats(dict) {
  if (!dict) {
    out('词典: 未找到 (dictionaries/zh-CN.json)');
    return;
  }
  const s = dictionary.stats(dict);
  out(`词典: ${s.entries} 条词条 / ${s.patterns} 条正则 (${s.locale})`);
}

function detectForeignPatch(appRoot) {
  const html = path.join(appRoot, 'out', 'vs', 'code', 'electron-sandbox', 'workbench', 'workbench.html');
  try {
    const content = fs.readFileSync(html, 'utf8');
    if (content.includes('Cursor_Localization.js') || content.includes('CURSOR_LOCALIZATION_INJECTION')) {
      return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

async function cmdStatus(flags) {
  const appRoot = paths.resolveAppRoot(flags.app);
  printDictionaryStats(loadDictionaryOrNull());
  const pack = languagePack.findInstalledPack();
  out(`VS Code 语言包: ${pack ? pack.version : '未安装'}`);
  out(`Cursor 路径: ${appRoot}`);

  try {
    const status = await patcher.status(flags.app);
    if (!status || !status.installed) {
      out('状态: 未检测到 Cursor 安装');
      return 1;
    }
    out(`版本: ${status.version}`);
    out(`已打补丁: ${status.isPatched ? '是' : '否'}`);
    out(`备份: ${status.hasBackup ? '有' : '无'}${status.backupVersion ? ` (${status.backupVersion})` : ''}`);
    if (status.versionMismatch) out('警告: 备份版本与当前 Cursor 版本不一致，建议先 restore 再 install');
    return 0;
  } catch (e) {
    err(`状态检查失败: ${e.message}`);
    return 1;
  }
}

async function confirmInstall(flags) {
  if (flags.yes || flags.force || !process.stdin.isTTY) return true;
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question('继续安装? [y/N] ', resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function cmdInstall(flags) {
  const appRoot = paths.resolveAppRoot(flags.app);
  const dict = loadDictionaryOrNull();
  if (!dict) {
    err('找不到 dictionaries/zh-CN.json，请先运行 python3 tools/build_dictionary.py');
    return 1;
  }

  const status = await patcher.status(flags.app);
  if (!status || !status.installed) {
    err('未检测到 Cursor 安装，可用 --app 指定路径');
    return 1;
  }

  if (detectForeignPatch(appRoot) && !flags.force) {
    err('检测到另一套汉化补丁（Cursor_Localization.js）。');
    err('请先用原工具还原（例如 bash 取消汉化_Mac.sh），或加 --force 强制继续。');
    return 1;
  }

  printDictionaryStats(dict);
  out(`Cursor 版本: ${status.version}`);
  out(`目标路径: ${appRoot}`);
  const installedPack = languagePack.findInstalledPack();
  out(`VS Code 语言包: ${installedPack ? installedPack.version : '未安装（将尝试自动安装）'}`);

  if (flags.dryRun) {
    out('dry-run: 不写入任何文件');
    return 0;
  }

  out('');
  out('将执行:');
  out('  1. 安装/确认官方简体中文语言包');
  out('  2. 备份 workbench.js / workbench.html');
  out('  3. 注入 Cursor 专有界面词典');
  out('  4. 更新 product.json 校验和');
  out(`  5. 在 macOS 上重新签名副本${flags.noCodesign ? '（已跳过）' : ''}`);
  if (!(await confirmInstall(flags))) {
    out('已取消。');
    return 0;
  }

  try {
    await languagePack.ensureLanguagePack({
      appRoot,
      onProgress: (message) => out(`  ${message}`)
    });
  } catch (e) {
    err(`语言包安装失败: ${e.message}`);
    return 1;
  }

  const enginePath = paths.engineDictionaryPath();
  dictionary.writeEngineDictionary(dict, enginePath);
  out(`引擎词典: ${enginePath}`);

  try {
    const result = await patcher.install({
      appPath: flags.app,
      dictionaryPath: enginePath,
      codesign: !flags.noCodesign,
      onProgress: (message) => out(`  ${message}`)
    });
    paths.writeJson(paths.stateFile(), {
      version: VERSION,
      appRoot,
      cursorVersion: status.version,
      installedAt: new Date().toISOString(),
      dictionary: dictionary.stats(dict)
    });
    out('安装完成。请完全退出并重新打开 Cursor。');
    return result && result.ok === false ? 1 : 0;
  } catch (e) {
    err(`安装失败: ${e.message}`);
    return 1;
  }
}

async function cmdRestore(flags) {
  try {
    await patcher.restore({
      appPath: flags.app,
      codesign: !flags.noCodesign,
      onProgress: (message) => out(`  ${message}`)
    });
    out('还原完成。请完全退出并重新打开 Cursor。');
    return 0;
  } catch (e) {
    err(`还原失败: ${e.message}`);
    return 1;
  }
}

function cmdCoverage(flags) {
  const dict = loadDictionaryOrNull();
  if (!dict) {
    err('找不到 dictionaries/zh-CN.json');
    return 1;
  }
  const appRoot = paths.resolveAppRoot(flags.app);
  out(`扫描: ${appRoot}`);
  out('提示: 这是启发式扫描，结果用于发现候选词条，不代表最终覆盖率。');
  const result = coverage.scan({ appRoot, dictionary: dict, limit: flags.limit || 100 });

  if (flags.json) {
    out(JSON.stringify(result, null, 2));
    return 0;
  }

  out(`文件: ${result.files}，候选字符串: ${result.candidates}，词典: ${result.dictionaryEntries} 条`);
  out(`未收录唯一字符串: ${result.missingUnique}，估算覆盖: ${result.coverage}%`);
  out('');
  out('未收录候选（按出现次数）:');
  for (const item of result.missing) out(`  ${item.count}x  ${item.text}`);
  return 0;
}

async function cmdDoctor(flags) {
  let ok = true;
  const check = (name, pass, detail) => {
    out(`${pass ? 'OK ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
    if (!pass) ok = false;
  };

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  check('Node.js >= 18', nodeMajor >= 18, process.versions.node);

  const appRoot = paths.resolveAppRoot(flags.app);
  check('Cursor product.json', fs.existsSync(path.join(appRoot, 'product.json')), appRoot);

  const dict = loadDictionaryOrNull();
  check('词典可加载', Boolean(dict), dict ? `${dictionary.stats(dict).entries} 条` : 'dictionaries/zh-CN.json');

  try {
    const p = patcher.createPatcher();
    check('补丁器可加载', Boolean(p && typeof p.detectStatus === 'function'));
  } catch (e) {
    check('补丁器可加载', false, e.message);
  }

  try {
    const status = await patcher.status(flags.app);
    check('补丁器状态检查', Boolean(status && status.installed), status ? `v${status.version}` : '未安装');
  } catch (e) {
    check('补丁器状态检查', false, e.message);
  }

  return ok ? 0 : 1;
}

function cmdHelp() {
  out(`cursor-zh v${VERSION} — Cursor 简体中文汉化工具`);
  out('');
  out('用法:');
  out('  cursor-zh install [--app PATH] [--dry-run] [--force] [--yes] [--no-codesign]');
  out('  cursor-zh restore [--app PATH] [--no-codesign]');
  out('  cursor-zh status  [--app PATH]');
  out('  cursor-zh coverage [--app PATH] [--limit N] [--json]');
  out('  cursor-zh doctor  [--app PATH]');
  out('');
  out('说明:');
  out('  install   备份并注入词典，更新 product.json 校验和');
  out('  restore   从备份还原 Cursor');
  out('  status    查看 Cursor 版本、补丁与词典状态');
  out('  coverage  扫描 Cursor 安装包，列出词典未收录的候选字符串');
  out('  doctor    检查运行环境、词典和补丁器');
}

async function main() {
  const { command, flags } = parseArgs(process.argv);
  if (flags.help || command === 'help') return cmdHelp();
  switch (command) {
    case 'install':
      return cmdInstall(flags);
    case 'restore':
      return cmdRestore(flags);
    case 'status':
      return cmdStatus(flags);
    case 'coverage':
      return cmdCoverage(flags);
    case 'doctor':
      return cmdDoctor(flags);
    default:
      cmdHelp();
      return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = typeof code === 'number' ? code : 0;
  })
  .catch((e) => {
    err(`错误: ${e.stack || e.message}`);
    process.exitCode = 1;
  });
