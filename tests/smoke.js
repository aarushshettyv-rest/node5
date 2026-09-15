#!/usr/bin/env node
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const run = (file, args) => execFileSync(process.execPath, [path.join(rootDir, file), ...args], {
  cwd: rootDir,
  encoding: 'utf8'
});

assert.match(run('node5.js', ['--version']), /^1\.0\.0\r?\n$/);
assert.match(run('n5pm.js', ['list']), /Dependencies:/);
assert.match(run('n5px.js', ['--help']), /Usage: n5px/);
console.log('Node.5 smoke tests passed');
