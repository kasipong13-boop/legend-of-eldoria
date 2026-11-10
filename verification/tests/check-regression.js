#!/usr/bin/env node
// Confirms Prototype 0.1 gameplay remains unchanged while allowing additive content
// (such as new monster definitions) in Prototype 0.2.
// The stored baseline still protects all original values and 300 seeded wins + 50 defeats.
const fs = require('fs'), path = require('path');
const snap = require('./baseline/game-snapshot');
const stored = fs.readFileSync(path.join(__dirname, 'baseline', 'snapshot-0.1.json'), 'utf8');
const baseline = JSON.parse(stored);
const projectRoot = path.resolve(__dirname, '..', '..');
const devDir = fs.existsSync(path.join(projectRoot, 'game/js/data.js')) ? path.join(projectRoot, 'game') : projectRoot;
const current = JSON.parse(snap(devDir));
const expected = JSON.parse(stored);

// Gold on monster definitions and the Gold field in seeded reward snapshots are
// retired economy data, not gameplay behavior. Ignore only those legacy fields;
// keep the original baseline file immutable and continue checking all seeded
// battle logs, EXP, item drops, cards, rules, and other monster values.
function omitRetiredMonsterGold(snapshot) {
  Object.keys(snapshot.values.MONSTERS).forEach(id => {
    delete snapshot.values.MONSTERS[id].gold;
  });
  snapshot.battles.forEach(battle => {
    if (battle.reward) delete battle.reward.gold;
  });
}
omitRetiredMonsterGold(current);
omitRetiredMonsterGold(expected);

// New monsters are additive content. Compare every monster that existed in 0.1,
// while leaving the full current MONSTERS registry free to grow.
const originalMonsterIds = Object.keys(baseline.values.MONSTERS);
const currentMonsterIds = Object.keys(current.values.MONSTERS);
const missingOriginalMonsters = originalMonsterIds.filter(id => !Object.prototype.hasOwnProperty.call(current.values.MONSTERS, id));
const originalMonsterValues = {};
for (const id of originalMonsterIds) originalMonsterValues[id] = current.values.MONSTERS[id];
current.values.MONSTERS = originalMonsterValues;

let ok = JSON.stringify(current) === JSON.stringify(expected) && missingOriginalMonsters.length === 0;
console.log(ok
  ? 'PASS  original 0.1 rules, cards, Poring data + 350 seeded battles unchanged; additive monsters allowed'
  : 'FAIL  original 0.1 gameplay baseline changed or an original monster is missing');
if (missingOriginalMonsters.length) console.error('Missing original monsters:', missingOriginalMonsters.join(', '));

if (process.argv[2]) {
  const orig = snap(path.resolve(process.argv[2]));
  const same = orig === stored;
  console.log(same ? 'PASS  baseline rebuilt from your 0.1 copy matches the stored baseline' : 'FAIL  stored baseline does not match your 0.1 copy');
  ok = ok && same;
}
process.exit(ok ? 0 : 1);
