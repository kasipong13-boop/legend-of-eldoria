const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function loadGame() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/data.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/battle.js'), 'utf8'), context);
  return context.ELDORIA;
}

test('monster definitions do not contain a Gold reward', () => {
  const E = loadGame();
  assert.equal(Object.hasOwn(E.MONSTERS.poring, 'gold'), false);
});

test('monster victory rewards contain EXP and item drops but never Gold', () => {
  const E = loadGame();
  const reward = E.rollRewards('poring', () => 0);
  assert.deepEqual(JSON.parse(JSON.stringify(reward)), {
    exp: 12,
    drops: [{ id: 'jelly', name: 'Poring Jelly' }]
  });
  assert.equal(Object.hasOwn(reward, 'gold'), false);
});

test('victory integration does not enqueue or display monster Gold', () => {
  const main = fs.readFileSync(require.resolve('../js/main.js'), 'utf8');
  assert.doesNotMatch(main, /rw\.gold/);
  assert.doesNotMatch(main, /gold:\s*rw\.gold/);
  assert.match(main, /setPendingReward\(current,\{exp:rw\.exp,drops:/);
});

test('claiming a new EXP and item reward preserves the character Gold balance', () => {
  const data = {};
  const localStorage = {
    getItem: key => data[key] ?? null,
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; }
  };
  const context = {
    localStorage, crypto: webcrypto, Intl, Date, Uint8Array, Math, JSON,
    Object, Array, String, Number, Error, RegExp
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/save.js'), 'utf8'), context);
  const Save = context.ELDORIA.Save;
  let character = Save.createCharacter({
    name: 'นักผจญภัย', gender: 'male', hairstyle: 2, hairColor: 3
  });
  character.gold = 37;
  character = Save.saveCharacter(character);
  character = Save.setPendingReward(character, {
    exp: 12, drops: [{ id: 'jelly', quantity: 1 }], cardDrops: []
  });
  const claimed = Save.claimPendingReward(character);
  assert.equal(claimed.payload.gold, 37);
  assert.equal(claimed.payload.stats.exp, 12);
  assert.equal(claimed.payload.items.jelly, 1);
});
