#!/usr/bin/env node
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const brand = 'n5pm';

function reportError(message) {
  const cleanMessage = message.replace(/^error:\s*/i, '');
  console.error(`${brand} error: ${cleanMessage}`);
}

function loadPkgJson() {
  if (!fs.existsSync('package.json')) {
    return { dependencies: {}, scripts: {} };
  }
  return JSON.parse(fs.readFileSync('package.json', 'utf8'));
}

function packageName(spec) {
  if (spec.startsWith('@')) {
    const versionSeparator = spec.indexOf('@', 1);
    return versionSeparator === -1 ? spec : spec.slice(0, versionSeparator);
  }
  const versionSeparator = spec.indexOf('@');
  return versionSeparator === -1 ? spec : spec.slice(0, versionSeparator);
}

function isInstalled(spec) {
  const name = packageName(spec);
  if (spec !== name) return false;
  return fs.existsSync(path.join('node_modules', name, 'package.json'));
}

function installPackages(packages, options) {
  return new Promise((resolve, reject) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const cacheMode = options.offline ? '--offline' : '--prefer-offline';
    const child = spawn(npm, [
      'install',
      '--save',
      '--no-audit',
      '--no-fund',
      cacheMode,
      ...(options.ignoreScripts ? ['--ignore-scripts'] : []),
      ...packages
    ], { stdio: 'inherit' });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install failed with exit code ${code ?? 1}`));
    });
  });
}

program
  .version(require('./package.json').version)
  .configureOutput({
    writeErr: (message) => reportError(message.trim())
  })
  .command('install <packages...>')
  .description('Install npm packages with cache-friendly defaults')
  .option('--offline', 'Use only the local npm cache')
  .option('--ignore-scripts', 'Skip package install scripts')
  .action(async (packages, options) => {
    const packageStates = packages.map((spec) => ({ spec, installed: isInstalled(spec) }));
    const pendingPackages = packageStates.filter(({ installed }) => !installed).map(({ spec }) => spec);
    const installedPackages = packageStates.filter(({ installed }) => installed).map(({ spec }) => spec);
    if (installedPackages.length > 0) {
      console.log(`${brand}: already installed ${installedPackages.join(', ')}`);
    }
    if (pendingPackages.length === 0) {
      return;
    }
    console.log(`${brand}: installing ${pendingPackages.join(', ')}`);
    await installPackages(pendingPackages, options);
    console.log(`${brand}: packages installed`);
  });

program
  .command('list')
  .description('List dependencies')
  .action(() => {
    const pkgJson = loadPkgJson();
    console.log("Dependencies:");
    for (const [pkg, ver] of Object.entries(pkgJson.dependencies || {})) {
      console.log(`- ${pkg}@${ver}`);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  reportError(err.message);
  process.exitCode = 1;
});
