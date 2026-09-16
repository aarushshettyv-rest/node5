#!/usr/bin/env bun
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const bunExecutable = process.execPath;
const outputPath = path.join(distDir, process.platform === 'win32' ? 'node5.exe' : 'node5');
const red = '\x1b[31m';
const reset = '\x1b[0m';

function reportError(message) {
  const output = `node5 error: ${message}`;
  console.error(process.stderr.isTTY && !process.env.NO_COLOR
    ? `${red}${output}${reset}`
    : output);
}

if (process.platform !== 'win32' || process.versions.bun === undefined) {
  reportError('Bun on Windows is required for this executable build');
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: rootDir, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw result.error || new Error(`${command} exited with code ${result.status}`);
  }
}

try {
  fs.mkdirSync(distDir, { recursive: true });
  run(bunExecutable, [
    'build',
    '--compile',
    '--target=bun-windows-x64',
    '--compile-autoload-package-json',
    '--outfile',
    outputPath,
    path.join(rootDir, 'node5.js')
  ]);
  console.log(`node5: built ${path.relative(rootDir, outputPath)}`);
} catch (error) {
  reportError(error.message);
  process.exit(1);
}