#!/usr/bin/env node
// Runs every tests/unit/*.test.js with the built-in Node test runner.
// (Passing a folder to `node --test` does not work on every Node version, so files are listed.)
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const dir = path.join(__dirname, 'unit');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort().map(f => path.join(dir, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env: process.env });
process.exit(r.status === null ? 1 : r.status);
