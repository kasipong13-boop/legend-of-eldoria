const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../..');
const context = { module: { exports: {} }, console };
vm.createContext(context);
for (const file of ['data.js', 'save.js', 'battle.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
}
const E = context.ELDORIA;
const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const applyMatch = mainSource.match(/(function applyRewardToSave\\(target, reward\\) \\{[\\s\\S]*?\\n  \\})\\n\\n  function settlePendingReward/);
assert.ok(applyMatch, 'main.js must contain the existing reward-claim handler');
const applyRewardToSave = vm.runInNewContext('(' + applyMatch[1] + ')', { E });

function readySave(gold) {
  const save = E.Save.makeInitialSave(
    'a'.repeat(32),
    { name: 'Economy Test', gender: 'male', hairStyle: 0, hairColor: 0 },
    { maxHp: 50, start: { c: 1, r: 1 } },
    '2026-11-09T00:00:00.000Z'
  );
  save.status = 'ready';
  save.gold = gold;
  return E.Save.seal(save);
}

test('monster definitions no longer configure Gold rewards', () => {
  for (const monster of Object.values(E.MONSTERS)) {
    assert.equal(Object.hasOwn(monster, 'gold'), false, monster.id + ' must not configure monster Gold');
  }
});

test('monster victory rewards contain only EXP and item drops while preserving seeded item-drop RNG order', () => {
  let calls = 0;
  const reward = E.rollRewards('poring', () => { calls += 1; return 0; });
  assert.deepEqual(Object.keys(reward).sort(), ['drops', 'exp']);
  assert.equal(reward.exp, E.MONSTERS.poring.exp);
  assert.deepEqual(JSON.parse(JSON.stringify(reward.drops)), [{ id: 'jelly', name: 'Poring Jelly' }]);
  assert.equal(calls, 2, 'one retired Gold RNG slot plus one item-drop roll keeps legacy drop determinism');
});

test('new pending monster rewards satisfy the unchanged Save Schema and preserve existing Gold', () => {
  assert.equal(E.Save.SCHEMA_VERSION, 1);
  const original = readySave(37);
  const staged = E.Save.withPendingReward(
    original,
    { exp: 12, gold: 0, drops: [{ id: 'jelly', name: 'Poring Jelly' }] },
    'poring',
    '2026-11-09T00:01:00.000Z'
  );
  assert.equal(staged.ok, true);
  assert.equal(E.Save.validateSave(staged.save).ok, true);
  const claimed = E.Save.withClaim(staged.save, applyRewardToSave);
  assert.equal(claimed.ok, true);
  assert.equal(claimed.save.gold, 37);
  assert.equal(claimed.save.stats.exp, 12);
  assert.equal(claimed.save.items.jelly, 1);
  assert.equal(claimed.save.pendingReward, null);
});

test('legacy pending combat Gold is ignored while EXP and item drops are still claimed', () => {
  const original = readySave(37);
  const legacy = E.Save.withPendingReward(
    original,
    { exp: 12, gold: 99, drops: [{ id: 'jelly', name: 'Poring Jelly' }] },
    'poring',
    '2026-11-09T00:02:00.000Z'
  );
  assert.equal(legacy.ok, true);
  const claimed = E.Save.withClaim(legacy.save, applyRewardToSave);
  assert.equal(claimed.ok, true);
  assert.equal(claimed.save.gold, 37, 'legacy pending Gold must never increase the stored balance');
  assert.equal(claimed.save.stats.exp, 12);
  assert.equal(claimed.save.items.jelly, 1);
  assert.equal(claimed.save.pendingReward, null);
});

test('victory integration supplies schema-compatible zero and never displays monster Gold', () => {
  assert.match(mainSource, /var pendingReward = \\{ exp: rw\\.exp, gold: 0, drops: rw\\.drops \\}/);
  assert.match(mainSource, /function applyRewardToSave\\(target, reward\\)[\\s\\S]*?target\\.stats\\.exp \\+= reward\\.exp/);
  assert.doesNotMatch(applyMatch[1], /target\\.gold\\s*\\+=/);
  assert.doesNotMatch(mainSource, /rw\\.gold/);
});
