const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function boot() {
  const context = { Math, JSON, Object, Array, Number, String, RegExp };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/data.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/battle.js'), 'utf8'), context);
  return context.ELDORIA;
}

test('battle starts with confirmed 3 Energy and 5 drawn cards', () => {
  const E = boot();
  const battle = E.createBattle({
    player: { hp: 37, maxHp: 50 },
    monsterId: 'poring',
    deck: E.STARTER_DECK,
    rng: () => 0.5
  });
  assert.equal(battle.state.player.hp, 37);
  assert.equal(battle.state.player.energy, 3);
  assert.equal(battle.state.hand.length, 5);
  assert.equal(battle.state.drawPile.length + battle.state.hand.length, E.STARTER_DECK.length);
});

test('playing a card spends Energy and moves it to discard', () => {
  const E = boot();
  const battle = E.createBattle({
    player: { hp: 50, maxHp: 50 }, monsterId: 'poring',
    deck: ['strike', 'guard', 'bash', 'firebolt', 'heal'], rng: () => 0.5
  });
  const idx = battle.state.hand.findIndex(id => id === 'strike');
  assert.notEqual(idx, -1);
  const before = battle.state.player.energy;
  const result = battle.playCard(idx);
  assert.equal(result.ok, true);
  assert.equal(battle.state.player.energy, before - E.CARDS.strike.cost);
  assert.equal(battle.state.discardPile.includes('strike'), true);
});

test('insufficient Energy does not consume the card', () => {
  const E = boot();
  const battle = E.createBattle({
    player: { hp: 50, maxHp: 50 }, monsterId: 'poring',
    deck: ['firebolt', 'guard', 'strike', 'heal', 'bash'], rng: () => 0.5
  });
  const idx = battle.state.hand.indexOf('firebolt');
  if (idx < 0) return;
  battle.state.player.energy = 1;
  const handBefore = battle.state.hand.slice();
  const result = battle.playCard(idx);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'energy');
  assert.deepEqual(battle.state.hand, handBefore);
});

test('end turn resolves visible enemy intent and starts next player turn', () => {
  const E = boot();
  const battle = E.createBattle({
    player: { hp: 50, maxHp: 50 }, monsterId: 'poring',
    deck: E.STARTER_DECK, rng: () => 0.5
  });
  const intent = battle.state.enemy.intent;
  const hpBefore = battle.state.player.hp;
  const result = battle.endTurn();
  assert.equal(result.ok, true);
  assert.equal(result.attack, true);
  assert.equal(battle.state.player.hp, hpBefore - intent.damage);
  assert.equal(battle.state.turn, 2);
  assert.equal(battle.state.player.energy, 3);
  assert.equal(battle.state.hand.length, 5);
});

test('battle UI returns remaining HP and world integration does not auto-heal', () => {
  const ui = fs.readFileSync(require.resolve('../js/battle-ui.js'), 'utf8');
  const main = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');
  assert.match(ui, /hp: unit\('hero'\)\.hp, maxHp: unit\('hero'\)\.maxHp/);
  assert.match(ui, /Core\.create\(/);
  assert.match(main, /player\.hp=Number\.isFinite\(result\.hp\)/);
  assert.doesNotMatch(main, /player\.hp=player\.maxHp/);
});

test('defeat applies the confirmed 10 percent Gold penalty', () => {
  const main = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');
  assert.match(main, /Math\.floor\(player\.gold\*0\.10\)/);
  assert.match(main, /player\.gold-=penalty/);
});

test('battle layout preserves separate-screen transition and intent display', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const ui = fs.readFileSync(require.resolve('../js/battle-ui.js'), 'utf8');
  assert.match(html, /id="screen-battle"/);
  assert.match(html, /id="enemy-intent"/);
  assert.match(ui, /Next: /);
});

test('live battle UI displays status effects and Buff details for both sides', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const ui = fs.readFileSync(require.resolve('../js/battle-ui.js'), 'utf8');
  assert.match(html, /id="enemy-status"/);
  assert.match(html, /id="player-status"/);
  assert.match(ui, /function effectDetails\(u\)/);
  assert.match(ui, /\(u\.buffs \|\| \[\]\)/);
  assert.match(ui, /function renderEffects\(id, u\)/);
  assert.match(ui, /\.title = effects\.map/);
});
