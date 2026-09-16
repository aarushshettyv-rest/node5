const { spawn } = require('child_process');
const path = require('path');

const nodeCommand = process.env.NODE5_NODE || (process.platform === 'win32' ? 'node.exe' : 'node');
const runtimePath = path.join(path.dirname(process.execPath), 'node5.js');
const child = spawn(nodeCommand, [runtimePath, ...process.argv.slice(2)], {
	cwd: process.cwd(),
	stdio: 'inherit'
});

child.on('error', (error) => {
	console.error(`node5 error: ${error.message}`);
	process.exitCode = 1;
});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
	} else {
		process.exitCode = code ?? 1;
	}
});