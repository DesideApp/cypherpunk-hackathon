#!/usr/bin/env node
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npmBin = isWin ? 'npm.cmd' : 'npm';

const env = {
  ...process.env,
  DEMO_MODE: '1',
  VITE_DEMO_MODE: '1',
};

const child = spawn(npmBin, ['run', 'dev'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
