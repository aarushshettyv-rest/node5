#!/usr/bin/env node
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const brand = 'n5pm';
const red = '\x1b[31m';
const reset = '\x1b[0m';

function redError(message) {
  const output = `${brand} error: ${message}`;
  return process.stderr.isTTY && !process.env.NO_COLOR ? `${red}${output}${reset}` : output;
}

function elapsedSeconds(startTime) {
  return (Number(process.hrtime.bigint() - startTime) / 1e9).toFixed(2);
}

function reportError(message) {
  const cleanMessage = message.replace(/^error:\s*/i, '');
  console.error(redError(cleanMessage));
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
    const npm = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
    const cacheMode = options.offline ? '--offline' : '--prefer-offline';
    const npmArgs = [
      'install',
      '--save',
      '--no-audit',
      '--no-fund',
      cacheMode,
      ...(options.ignoreScripts ? ['--ignore-scripts'] : []),
      ...packages
    ];
    const child = spawn(npm, process.platform === 'win32'
      ? ['/d', '/c', 'npm.cmd', ...npmArgs]
      : npmArgs, { stdio: ['inherit', 'inherit', 'pipe'] });

    let errorBuffer = '';
    child.stderr.on('data', (chunk) => {
      errorBuffer += chunk.toString();
      const lines = errorBuffer.split(/\r?\n/);
      errorBuffer = lines.pop();
      for (const line of lines) {
        if (line) console.error(redError(line));
      }
    });
    child.stderr.on('end', () => {
      if (errorBuffer) console.error(redError(errorBuffer));
    });

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
    const startTime = process.hrtime.bigint();
    const packageStates = packages.map((spec) => ({ spec, installed: isInstalled(spec) }));
    const pendingPackages = packageStates.filter(({ installed }) => !installed).map(({ spec }) => spec);
    const installedPackages = packageStates.filter(({ installed }) => installed).map(({ spec }) => spec);
    if (installedPackages.length > 0) {
      console.log(`${brand}: already installed ${installedPackages.join(', ')}`);
    }
    if (pendingPackages.length === 0) {
      console.log(`${brand}: completed in ${elapsedSeconds(startTime)} seconds`);
      return;
    }
    console.log(`${brand}: installing ${pendingPackages.join(', ')}`);
    try {
      await installPackages(pendingPackages, options);
    } catch (error) {
      error.message += ` (${elapsedSeconds(startTime)} seconds elapsed)`;
      throw error;
    }
    console.log(`${brand}: completed in ${elapsedSeconds(startTime)} seconds`);
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
