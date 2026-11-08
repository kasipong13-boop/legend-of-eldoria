#!/usr/bin/env node
// Confirms the game rules are untouched: every value in data.js plus 300 seeded wins and
// 50 seeded defeats must produce exactly the same output as Prototype 0.1.
// Optional: node tests/check-regression.js <path-to-original-0.1-eldoria-folder> also rebuilds
// the baseline from your own copy of 0.1 and compares it with the stored one.
const fs = require('fs'), path = require('path');
const snap = require('./baseline/game-snapshot');
const stored = fs.readFileSync(path.join(__dirname, 'baseline', 'snapshot-0.1.json'), 'utf8');
const projectRoot = path.resolve(__dirname, '..', '..');
const devDir = fs.existsSync(path.join(projectRoot, 'game/js/data.js')) ? path.join(projectRoot, 'game') : projectRoot;
const dev = snap(devDir);
let ok = dev === stored;
console.log(ok ? 'PASS  0.2 game values + 350 seeded battles identical to the 0.1 baseline' : 'FAIL  game output differs from the 0.1 baseline');
if (process.argv[2]) {
  const orig = snap(path.resolve(process.argv[2]));
  const same = orig === stored;
  console.log(same ? 'PASS  baseline rebuilt from your 0.1 copy matches the stored baseline' : 'FAIL  stored baseline does not match your 0.1 copy');
  ok = ok && same;
}
process.exit(ok ? 0 : 1);
