#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const blobPath = path.join(rootDir, 'node5-sea.blob');
const nodeExecutable = process.execPath;
const outputPath = path.join(distDir, process.platform === 'win32' ? 'node5.exe' : 'node5');
const seaFuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const red = '\x1b[31m';
const reset = '\x1b[0m';

function reportError(message) {
  const output = `node5 error: ${message}`;
  console.error(process.stderr.isTTY && !process.env.NO_COLOR
    ? `${red}${output}${reset}`
    : output);
}

if (process.platform !== 'win32') {
  reportError('this build command currently targets Windows');
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
  for (const runtimeFile of ['node5.js', 'n5px.js', 'package.json']) {
    fs.copyFileSync(path.join(rootDir, runtimeFile), path.join(distDir, runtimeFile));
  }
  run(nodeExecutable, ['--experimental-sea-config', 'sea-config.json']);
  fs.copyFileSync(nodeExecutable, outputPath);
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'npx', '--yes', 'postject', outputPath, 'NODE_SEA_BLOB', blobPath, '--sentinel-fuse', seaFuse]);
  fs.rmSync(blobPath, { force: true });
  console.log(`node5: built ${path.relative(rootDir, outputPath)}`);
} catch (error) {
  fs.rmSync(blobPath, { force: true });
  reportError(error.message);
  process.exit(1);
}