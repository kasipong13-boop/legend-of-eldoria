#!/usr/bin/env node
// Mutation check: plants one deliberate bug at a time in eldoria/js/save.js (in a temp copy)
// and confirms the unit tests fail. A CONTROL run on the unmodified file must pass first,
// otherwise every "caught" result would be meaningless.
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.resolve(ROOT, '..');
const GAME = fs.existsSync(path.join(PROJECT, 'game/js/save.js')) ? path.join(PROJECT, 'game') : PROJECT;
const SRC = path.join(GAME, 'js', 'save.js');
const unitDir = path.join(__dirname, 'unit');
const files = fs.readdirSync(unitDir).filter(f => f.endsWith('.test.js')).sort().map(f => path.join(unitDir, f));
const mutations = JSON.parse(fs.readFileSync(path.join(__dirname, 'mutations.json'), 'utf8'));
const src = fs.readFileSync(SRC, 'utf8');
const { parseSummary } = require('./mutation-summary');

function runTests(gameDir) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    env: Object.assign({}, process.env, { ELDORIA_DIR: gameDir }),
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  const summary = parseSummary(r.stdout || '', r.status, r.error);
  if (!summary.valid) {
    console.error('Mutation child test run invalid:', summary.reason);
    if (r.stderr) console.error('STDERR:', r.stderr.slice(-3000));
  }
  return summary;
}
function withSave(text, fn) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'eldoria-mut-'));
  fs.mkdirSync(path.join(d, 'js'));
  fs.writeFileSync(path.join(d, 'js', 'save.js'), text);
  try { return fn(d); } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

const ctl = withSave(src, runTests);
console.log(`CONTROL unmodified save.js: pass=${ctl.pass} fail=${ctl.fail}`);
if (!ctl.valid || ctl.fail !== 0 || ctl.pass <= 0) { console.log('Control run failed - aborting.'); process.exit(2); }

let caught = 0; const survivors = [];
for (const m of mutations) {
  const n = src.split(m.find).length - 1;
  if (n !== 1) { console.log(`SKIP      ${m.name}: pattern found ${n} times`); survivors.push(m.name); continue; }
  const r = withSave(src.replace(m.find, () => m.replace), runTests);
  if (!r.valid) { console.log(`ERROR     ${m.name}: ${r.reason}`); process.exit(2); }
  if (r.fail > 0 && r.exitCode !== 0) { caught++; console.log(`CAUGHT    ${m.name}  (${r.fail} failing tests)`); }
  else { survivors.push(m.name); console.log(`SURVIVED  ${m.name}`); }
}
console.log(`\n${caught}/${mutations.length} mutations caught`);
if (survivors.length) { console.log('Survivors:', survivors); process.exit(1); }
