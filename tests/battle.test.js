const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadGame() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/data.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/battle.js'), 'utf8'), context);
  return context.ELDORIA;
}

function battleWith(E, deck) {
  return E.createBattle({ player: { hp: 50, maxHp: 50 }, monsterId: 'poring', deck, rng: () => 0 });
}

test('status stacks add, cap at 99, and timed reapplication resets duration', () => {
  const E = loadGame();
  const target = { statuses: {} };
  E.applyCombatStatus(target, 'bleed', 80);
  E.applyCombatStatus(target, 'bleed', 30);
  assert.equal(target.statuses.bleed.stacks, 99);
  assert.equal(target.statuses.bleed.duration, null);
  E.applyCombatStatus(target, 'vulnerable', 1, 1);
  E.applyCombatStatus(target, 'vulnerable', 2, 3);
  assert.equal(target.statuses.vulnerable.stacks, 3);
  assert.equal(target.statuses.vulnerable.duration, 3);
});

test('Vulnerable increases incoming damage by 50 percent and rounds to nearest integer', () => {
  const E = loadGame();
  const b = battleWith(E, ['strike', 'strike', 'strike', 'strike', 'strike']);
  E.applyCombatStatus(b.state.enemy, 'vulnerable', 1, 1);
  const result = b.playCard(0);
  assert.equal(result.ok, true);
  assert.equal(b.state.enemy.hp, 11); // 6 x 1.5 = 9
});

test('Bleed deals damage before the affected enemy attacks, then removes one stack', () => {
  const E = loadGame();
  const b = battleWith(E, ['guard', 'guard', 'guard', 'guard', 'guard']);
  E.applyCombatStatus(b.state.enemy, 'bleed', 3);
  const beforeHp = b.state.player.hp;
  const result = b.endTurn();
  assert.equal(b.state.enemy.hp, 17);
  assert.equal(b.state.enemy.statuses.bleed.stacks, 2);
  assert.equal(b.state.player.hp, beforeHp - b.state.enemy.intent.damage);
  assert.ok(result.msgs.some(message => message.includes('takes 3 Bleed damage')));
});

test('lethal Bleed ends battle before the enemy can attack', () => {
  const E = loadGame();
  const b = battleWith(E, ['guard', 'guard', 'guard', 'guard', 'guard']);
  b.state.enemy.hp = 2;
  E.applyCombatStatus(b.state.enemy, 'bleed', 2);
  const result = b.endTurn();
  assert.equal(b.state.enemy.hp, 0);
  assert.equal(b.state.over, 'win');
  assert.equal(result.attack, undefined);
  assert.equal(b.state.player.hp, 50);
});

test('Slime Splash base effect applies Vulnerable after its base hit', () => {
  const E = loadGame();
  const b = battleWith(E, Array(5).fill('msc-por-001'));
  const result = b.playCard(0);
  assert.equal(b.state.enemy.hp, 15);
  assert.equal(b.state.enemy.statuses.vulnerable.stacks, 1);
  assert.equal(b.state.enemy.statuses.vulnerable.duration, 1);
  assert.ok(result.msgs.some(message => message.includes('Vulnerable')));
});

test('Slime Splash ★★★ adds a 3-damage bonus hit only if Vulnerable existed before play', () => {
  const E = loadGame();
  const b = battleWith(E, Array(5).fill({ id: 'msc-por-001', stars: 3 }));
  E.applyCombatStatus(b.state.enemy, 'vulnerable', 1, 1);
  const result = b.playCard(0);
  assert.equal(result.element, 'water');
  assert.equal(b.state.enemy.hp, 7); // separate hits: round(5 x 1.5)=8, round(3 x 1.5)=5
});

test('Savage Bite ★★ checks the target HP threshold before damage', () => {
  const E = loadGame();
  const deck = ['strike', { id: 'msc-wolf-001', stars: 2 }, 'guard', 'guard', 'guard'];
  const b = battleWith(E, deck);
  // With deterministic shuffle, top-of-pile is the final entry; make all cards available.
  b.state.enemy.hp = 10;
  const savageIndex = b.state.hand.findIndex(card => card.id === 'msc-wolf-001');
  assert.notEqual(savageIndex, -1);
  b.playCard(savageIndex);
  assert.equal(b.state.enemy.statuses.bleed.stacks, 3);
});

test('Savage Bite ★★★ applies Vulnerable when the target already has Bleed', () => {
  const E = loadGame();
  const b = battleWith(E, Array(5).fill({ id: 'msc-wolf-001', stars: 3 }));
  E.applyCombatStatus(b.state.enemy, 'bleed', 1);
  b.playCard(0);
  assert.equal(b.state.enemy.statuses.bleed.stacks, 3);
  assert.equal(b.state.enemy.statuses.vulnerable.stacks, 1);
  assert.equal(b.state.enemy.statuses.vulnerable.duration, 1);
});

test('legacy string deck entries remain supported as one-star cards', () => {
  const E = loadGame();
  const b = battleWith(E, ['strike', 'guard', 'bash', 'firebolt', 'heal']);
  assert.ok(b.state.hand.every(card => card.stars === 1));
  assert.ok(b.state.hand.every(card => typeof card.id === 'string'));
});
