#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const brand = 'n5px';
const args = process.argv.slice(2);
const version = require('./package.json').version;

function reportError(message) {
  console.error(`${brand} error: ${message}`);
}

if (args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: n5px <command> [args...]');
  console.log('Run a local package binary or JavaScript file.');
  process.exit(0);
}

if (args[0] === '--version' || args[0] === '-v') {
  console.log(`n5px ${version}`);
  process.exit(0);
}

if (args.length === 0) {
  reportError('usage: n5px <command> [args...]');
  process.exit(1);
}

const command = args.shift();
const localScript = path.resolve(command);
const binDirectories = [
  path.resolve('node_modules', '.bin'),
  path.resolve('n5_modules', '.bin')
];
const commandCandidates = process.platform === 'win32'
  ? [command, `${command}.cmd`, `${command}.exe`, `${command}.bat`]
  : [command];

let commandPath;
let executable = process.execPath;
let executableArgs = args;

if (fs.existsSync(localScript) && fs.statSync(localScript).isFile()) {
  commandPath = localScript;
  executableArgs = [localScript, ...args];
}

if (!commandPath) {
  for (const directory of binDirectories) {
    for (const candidate of commandCandidates) {
      const resolvedPath = path.join(directory, candidate);
      if (fs.existsSync(resolvedPath)) {
        commandPath = resolvedPath;
        break;
      }
    }
    if (commandPath) break;
  }
}

if (!commandPath) {
  reportError(`command '${command}' was not found in node_modules/.bin or n5_modules/.bin`);
  console.error(`${brand}: install it with 'n5pm install ${command}'`);
  process.exit(1);
}

const isWindowsScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(commandPath);
if (!fs.existsSync(localScript) || !fs.statSync(localScript).isFile()) {
  executable = isWindowsScript ? (process.env.ComSpec || 'cmd.exe') : commandPath;
  executableArgs = isWindowsScript ? ['/d', '/c', commandPath, ...args] : args;
}
const child = spawn(executable, executableArgs, { stdio: 'inherit' });

child.on('error', (error) => {
  reportError(error.message);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});
