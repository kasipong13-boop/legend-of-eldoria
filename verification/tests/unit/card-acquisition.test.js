const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');

function boot(cards, table) {
  const context = { ELDORIA: { CARDS: cards || {}, MONSTER_CARD_DROP_TABLE: table || { poring: [] } }, module: { exports: {} } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/card-acquisition.js'), 'utf8'), context, { filename: 'card-acquisition.js' });
  return context.ELDORIA.CardAcquisition;
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('exposes five confirmed rarity tiers and leaves monster drop tables empty by default', () => {
  const acquisition = boot();
  assert.deepEqual(plain(acquisition.rarities), ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']);
  assert.deepEqual(plain(acquisition.rollMonsterDrops('poring', () => 0)), []);
});

test('uses configured chance only; rarity does not alter probability', () => {
  const cards = {
    common_skill: { id: 'common_skill', name: 'Common Skill', acquisitionType: 'monster-special-skill', rarity: 'Common' },
    legendary_skill: { id: 'legendary_skill', name: 'Legendary Skill', acquisitionType: 'monster-special-skill', rarity: 'Legendary' }
  };
  const rolls = [0.2, 0.8];
  const acquisition = boot(cards, { poring: [
    { cardId: 'common_skill', chance: 0.5 },
    { cardId: 'legendary_skill', chance: 0.5 }
  ] });
  assert.deepEqual(plain(acquisition.rollMonsterDrops('poring', () => rolls.shift())), [
    { cardId: 'common_skill', stars: 1, quantity: 1, name: 'Common Skill', rarity: 'Common' }
  ]);
});

test('rejects Monster Cards and ordinary cards from monster drop tables', () => {
  const cards = {
    poring_card: { id: 'poring_card', acquisitionType: 'monster-card', rarity: 'Rare' },
    strike: { id: 'strike', acquisitionType: 'starter', rarity: 'Common' }
  };
  const acquisition = boot(cards);
  assert.throws(() => acquisition.rollMonsterDrops('poring', () => 0, { poring: [{ cardId: 'poring_card', chance: 1 }] }), /only drop Monster Special Skill Cards/);
  assert.throws(() => acquisition.rollMonsterDrops('poring', () => 0, { poring: [{ cardId: 'strike', chance: 1 }] }), /only drop Monster Special Skill Cards/);
});

test('rejects unknown cards, invalid rarities and invalid chance values', () => {
  const unknown = boot();
  assert.throws(() => unknown.rollMonsterDrops('poring', () => 0, { poring: [{ cardId: 'missing', chance: 1 }] }), /Unknown card/);
  const badRarity = boot({ skill: { acquisitionType: 'monster-special-skill', rarity: 'Mythic' } });
  assert.throws(() => badRarity.rollMonsterDrops('poring', () => 0, { poring: [{ cardId: 'skill', chance: 1 }] }), /valid rarity/);
  const valid = boot({ skill: { acquisitionType: 'monster-special-skill', rarity: 'Common' } });
  for (const chance of [-0.1, 1.1, NaN]) {
    assert.throws(() => valid.rollMonsterDrops('poring', () => 0, { poring: [{ cardId: 'skill', chance }] }), /Invalid monster card drop entry/);
  }
});
