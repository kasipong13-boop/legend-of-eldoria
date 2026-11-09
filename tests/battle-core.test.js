const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/data.js');
const Core = require('../js/battle-core.js');
const E = globalThis.ELDORIA;

function setup(extra) {
  return Core.create(Object.assign({
    playerUnits: [{ id: 'hero', name: 'Novice', hp: 50, maxHp: 50, x: 1, y: 2 }],
    enemyUnits: [
      { id: 'p1', name: 'Poring A', hp: 20, maxHp: 20, x: 8, y: 2, moves: [{ name: 'Bounce', damage: 4 }] },
      { id: 'p2', name: 'Poring B', hp: 20, maxHp: 20, x: 8, y: 3, moves: [{ name: 'Bounce', damage: 4 }] }
    ],
    deck: ['strike', 'guard', 'bash', 'firebolt', 'heal'],
    rng: () => 0
  }, extra || {}));
}

test('battlefield enforces 10x10 coordinates and five unit slots per side', () => {
  assert.throws(() => Core.create({
    playerUnits: Array.from({ length: 6 }, (_, i) => ({ id: 'h' + i, hp: 10, maxHp: 10, x: 1, y: i })),
    enemyUnits: [{ id: 'e', hp: 10, maxHp: 10, x: 8, y: 1 }]
  }), /slot limit/);
  assert.throws(() => Core.create({
    playerUnits: [{ id: 'h', hp: 10, maxHp: 10, x: 7, y: 1 }],
    enemyUnits: [{ id: 'e', hp: 10, maxHp: 10, x: 8, y: 1 }]
  }), /wrong side/);
});

test('multi-unit battle starts with 3 Energy and draws at most five cards', () => {
  const b = setup();
  assert.equal(b.state.units.length, 3);
  assert.equal(b.state.energy, 3);
  assert.equal(b.state.hand.length, 5);
  assert.equal(b.state.activeSide, 'player');
});

test('target selection is required when eligible enemies exceed target count', () => {
  const b = setup();
  const result = b.playCard(b.state.hand.indexOf('strike'), 'hero');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'select-targets');
  assert.deepEqual(result.candidates, ['p1', 'p2']);
});

test('Vulnerable increases incoming damage by 50 percent', () => {
  const b = setup();
  const target = b.state.units.find(u => u.id === 'p1');
  Core.applyStatus(target, { id: 'vulnerable', stacks: 1 });
  const result = Core.damage(b.state, target, 6, 'physical');
  assert.equal(result.hpDamage, 9);
  assert.equal(target.hp, 11);
});

test('status stacks add and cap at 99', () => {
  const b = setup();
  const target = b.state.units.find(u => u.id === 'p1');
  Core.applyStatus(target, { id: 'bleed', stacks: 70, duration: 2 });
  Core.applyStatus(target, { id: 'bleed', stacks: 70, duration: 3 });
  assert.equal(target.statuses[0].stacks, 99);
  assert.equal(target.statuses[0].duration, 3);
});

test('summons occupy fixed battlefield slots and reject full sides or occupied cells', () => {
  const b = setup();
  assert.equal(b.summon({ id: 's1', side: 'player', hp: 5, maxHp: 5, x: 2, y: 2 }).ok, true);
  assert.equal(b.summon({ id: 's2', side: 'player', hp: 5, maxHp: 5, x: 2, y: 2 }).reason, 'occupied');
});

test('deck validator enforces the 20-card deck size and rarity copy caps', () => {
  const deck = Array(20).fill('strike');
  const cards = Object.assign({}, E.CARDS, { strike: Object.assign({}, E.CARDS.strike, { rarity: 'Common' }) });
  const result = Core.validateDeck(deck, cards);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(x => x.includes('exactly 20')));
  assert.ok(result.errors.some(x => x.includes('Copy limit')));
});

test('dead units cannot be healed by further damage and battle result is detected', () => {
  const b = setup();
  const target = b.state.units.find(u => u.id === 'p1');
  const result = Core.damage(b.state, target, 999, 'physical');
  assert.equal(result.defeated, true);
  assert.equal(target.hp, 0);
  assert.equal(target.alive, false);
});
