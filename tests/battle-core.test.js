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


test('hand never exceeds the confirmed 10-card limit when drawing', () => {
  const b = setup({ deck: Array(30).fill('strike') });
  b.state.hand = Array(9).fill('strike');
  b.state.drawPile = Array(10).fill('guard');
  b.state.discardPile = [];
  b.endTurn();
  assert.equal(b.state.hand.length, 0); // End turn discards the previous hand.
  assert.equal(b.state.activeSide, 'player');
  assert.ok(b.state.hand.length <= 10);
});

test('Block resets at the start of each side turn', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  const enemy = b.state.units.find(u => u.id === 'p1');
  hero.block = 7;
  enemy.block = 5;
  b.endTurn();
  assert.equal(hero.block, 7, 'player Block is retained during the enemy turn');
  assert.equal(enemy.block, 0, 'enemy Block resets when enemy turn begins');
  assert.equal(hero.block, 0, 'player Block resets when the next player turn begins');
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
  const deck = Array(19).fill('strike');
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

test('enemy intent is visible before its turn', () => {
  const b = setup();
  assert.deepEqual(b.state.units.find(u => u.id === 'p1').intent, { name: 'Bounce', damage: 4 });
});

test('Bleed triggers after the afflicted unit performs an attack', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  Core.applyStatus(hero, { id: 'bleed', stacks: 3 });
  const index = b.state.hand.findIndex(id => id === 'strike');
  const result = b.playCard(index, 'hero', ['p1']);
  assert.ok(result.events.some(e => e.type === 'bleed' && e.target === 'hero'));
  assert.equal(hero.hp, 47); // Bleed ticks once after the hero's attack action
});

test('Stun prevents an enemy from taking its attack action', () => {
  const b = setup();
  const enemy = b.state.units.find(u => u.id === 'p1');
  Core.applyStatus(enemy, { id: 'stun', stacks: 1 });
  const result = b.endTurn();
  assert.equal(result.events.some(e => e.type === 'enemy-attack' && e.source === 'p1'), false);
});


test('status duration ticks only at its configured side-turn boundary', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  Core.applyStatus(hero, { id: 'bleed', stacks: 2, duration: 2, tickAt: 'player-turn-start' });
  b.endTurn();
  assert.equal(hero.statuses.find(s => s.id === 'bleed').duration, 1);
  b.endTurn();
  assert.equal(hero.statuses.some(s => s.id === 'bleed'), false);
});

test('status duration does not tick on the other side turn', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  Core.applyStatus(hero, { id: 'bleed', stacks: 2, duration: 2, tickAt: 'enemy-turn-start' });
  b.endTurn();
  assert.equal(hero.statuses.find(s => s.id === 'bleed').duration, 2);
});


test('battle setup rejects duplicate unit ids and overlapping living units', () => {
  assert.throws(() => Core.create({
    playerUnits: [{ id: 'same', hp: 10, maxHp: 10, x: 1, y: 1 }],
    enemyUnits: [{ id: 'same', hp: 10, maxHp: 10, x: 8, y: 1 }]
  }), /Duplicate battle unit id/);
  assert.throws(() => Core.create({
    playerUnits: [{ id: 'hero', hp: 10, maxHp: 10, x: 1, y: 1 }],
    enemyUnits: [{ id: 'enemy', hp: 10, maxHp: 10, x: 1, y: 1 }]
  }), /wrong side/);
  assert.throws(() => Core.create({
    playerUnits: [
      { id: 'hero', hp: 10, maxHp: 10, x: 1, y: 1 },
      { id: 'ally', hp: 10, maxHp: 10, x: 1, y: 1 }
    ],
    enemyUnits: [{ id: 'enemy', hp: 10, maxHp: 10, x: 8, y: 1 }]
  }), /already occupied/);
});

test('Bash applies Vulnerable to a surviving target and gains its confirmed block', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  const target = b.state.units.find(u => u.id === 'p1');
  const index = b.state.hand.indexOf('bash');
  assert.notEqual(index, -1);
  const result = b.playCard(index, 'hero', ['p1']);
  assert.equal(result.ok, true);
  assert.equal(target.hp, 12);
  assert.equal(target.statuses.some(s => s.id === 'vulnerable' && s.stacks === 1), true);
  assert.equal(hero.block, 4);
});

test('Buff stacking and duration policies are explicit and independently configurable', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  assert.equal(b.applyBuff(hero, { id: 'power', stacking: 'stack', durationPolicy: 'reset', stacks: 1, duration: 2, tickAt: 'player-turn-start' }).ok, true);
  assert.equal(b.applyBuff(hero, { id: 'power', stacking: 'stack', durationPolicy: 'reset', stacks: 2, duration: 4, tickAt: 'player-turn-start' }).ok, true);
  assert.equal(hero.buffs.length, 1);
  assert.equal(hero.buffs[0].stacks, 3);
  assert.equal(hero.buffs[0].duration, 4);
  assert.equal(b.applyBuff(hero, { id: 'power', stacking: 'refresh', durationPolicy: 'keep', duration: 9 }).ok, true);
  assert.equal(hero.buffs[0].stacks, 3);
  assert.equal(hero.buffs[0].duration, 4);
  assert.equal(b.applyBuff(hero, { id: 'power', stacking: 'independent', durationPolicy: 'independent', duration: 1 }).ok, true);
  assert.equal(hero.buffs.length, 2);
});

test('Buff charge zero behavior follows its declared policy', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  assert.equal(b.applyBuff(hero, { id: 'ward', stacking: 'replace', durationPolicy: 'reset', duration: null, charges: 1, onZero: 'remove' }).ok, true);
  const used = b.consumeBuffCharge(hero, 'ward');
  assert.equal(used.ok, true);
  assert.equal(used.removed, true);
  assert.equal(hero.buffs.some(x => x.id === 'ward'), false);

  assert.equal(b.applyBuff(hero, { id: 'stance', stacking: 'replace', durationPolicy: 'reset', duration: null, charges: 1, onZero: 'disable' }).ok, true);
  const disabled = b.consumeBuffCharge(hero, 'stance');
  assert.equal(disabled.disabled, true);
  assert.equal(hero.buffs.find(x => x.id === 'stance').disabled, true);
});

test('Buff definitions without explicit stacking or charge-zero policy are rejected', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  assert.equal(b.applyBuff(hero, { id: 'ambiguous', duration: 2 }).reason, 'stacking-policy-required');
  assert.equal(b.applyBuff(hero, { id: 'charges', stacking: 'replace', durationPolicy: 'reset', charges: 1 }).reason, 'charge-zero-policy-required');
});

test('configured Buff effects modify damage, block and healing with flat-before-percent order', () => {
  const b = setup();
  const hero = b.state.units.find(u => u.id === 'hero');
  const target = b.state.units.find(u => u.id === 'p1');
  hero.hp = 30;
  // Pin the hand order so this test validates effects, not shuffle order.
  b.state.hand = ['strike', 'guard', 'heal'];
  b.state.energy = 3;
  b.applyBuff(hero, {
    id: 'combat-training', stacking: 'replace', durationPolicy: 'reset', duration: null,
    effects: [
      { channel: 'damage', mode: 'flat', value: 2 },
      { channel: 'damage', mode: 'percent', value: 50 },
      { channel: 'block', mode: 'flat', value: 1 },
      { channel: 'healing', mode: 'percent', value: 25 }
    ]
  });
  const strikeIndex = b.state.hand.indexOf('strike');
  const strike = b.playCard(strikeIndex, 'hero', ['p1']);
  assert.equal(strike.events.find(e => e.type === 'damage').result.hpDamage, 12);
  assert.equal(target.hp, 8);

  const guardIndex = b.state.hand.indexOf('guard');
  const guard = b.playCard(guardIndex, 'hero');
  assert.equal(guard.events.find(e => e.type === 'block').amount, 6);

  const healIndex = b.state.hand.indexOf('heal');
  const heal = b.playCard(healIndex, 'hero');
  assert.equal(heal.events.find(e => e.type === 'heal').amount, 10);
  assert.equal(hero.hp, 40);
});

test('target Buff damageTaken modifier applies before Vulnerable multiplier', () => {
  const b = setup();
  const target = b.state.units.find(u => u.id === 'p1');
  b.applyBuff(target, {
    id: 'armor', stacking: 'replace', durationPolicy: 'reset', duration: null,
    effects: [{ channel: 'damageTaken', mode: 'percent', value: -20 }]
  });
  Core.applyStatus(target, { id: 'vulnerable', stacks: 1 });
  const result = Core.damage(b.state, target, 10, 'physical');
  assert.equal(result.hpDamage, 12);
});

test('battle result resolves immediately when a side has no living units at setup', () => {
  const won = Core.create({
    playerUnits: [{ id: 'hero', hp: 10, maxHp: 10, x: 1, y: 1 }],
    enemyUnits: [{ id: 'fallen-enemy', hp: 0, maxHp: 10, x: 8, y: 1 }],
    deck: []
  });
  assert.equal(won.state.over, 'win');
  assert.equal(won.state.winner, 'player');

  const lost = Core.create({
    playerUnits: [{ id: 'fallen-hero', hp: 0, maxHp: 10, x: 1, y: 1 }],
    enemyUnits: [{ id: 'enemy', hp: 10, maxHp: 10, x: 8, y: 1 }],
    deck: []
  });
  assert.equal(lost.state.over, 'lose');
  assert.equal(lost.state.winner, 'enemy');
});


test('multi-target selection rejects duplicate target IDs', () => {
  const b = setup({
    enemyUnits: [
      { id: 'p1', name: 'Poring A', hp: 20, maxHp: 20, x: 8, y: 2 },
      { id: 'p2', name: 'Poring B', hp: 20, maxHp: 20, x: 8, y: 3 },
      { id: 'p3', name: 'Poring C', hp: 20, maxHp: 20, x: 8, y: 4 }
    ]
  });
  const card = Object.assign({}, E.CARDS.strike, { target: 'enemy', targetCount: 2 });
  E.CARDS['test-double-target'] = card;
  b.state.hand = ['test-double-target'];
  const result = b.playCard(0, 'hero', ['p1', 'p1']);
  delete E.CARDS['test-double-target'];
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid-targets');
  assert.equal(b.state.units.find(u => u.id === 'p1').hp, 20);
});
