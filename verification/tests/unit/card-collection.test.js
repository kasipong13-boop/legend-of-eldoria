const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../..');

function boot(options) {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (options && options.failWrites) throw new Error('storage unavailable');
      values.set(String(key), String(value));
    },
    removeItem(key) { values.delete(key); }
  };
  const context = { module: { exports: {} }, console, localStorage: storage, Map, Object, Array, Number, JSON, Math, Date, Uint8Array };
  vm.createContext(context);
  for (const file of ['data.js', 'save.js', 'card-collection.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
  }
  return { E: context.ELDORIA, storage, values };
}

const characterId = 'a'.repeat(32);

test('new characters preview the existing starter deck without writing to character saves', () => {
  const { E, values } = boot();
  const result = E.CardCollection.get(characterId);
  assert.equal(result.ok, true);
  assert.equal(result.source, 'starter');
  const data = JSON.parse(JSON.stringify(result.data));
  assert.equal(data.owned.reduce((sum, item) => sum + item.quantity, 0), E.STARTER_DECK.length);
  assert.equal(data.owned.length, 5);
  assert.equal(data.presets.length, 1);
  assert.equal(data.presets[0].id, 'starter');
  assert.equal(data.presets[0].cardRefs.length, E.STARTER_DECK.length);
  assert.equal(values.size, 0, 'read-only preview must not write or migrate any save');
});

test('collection sidecar saves and reloads independently of the character Save Engine', () => {
  const { E, values } = boot();
  const core = E.Save.makeInitialSave(
    characterId,
    { name: 'Collection Test', gender: 'male', hairStyle: 0, hairColor: 0 },
    { maxHp: 50, start: { c: 1, r: 1 } },
    '2026-11-10T00:00:00.000Z'
  );
  const coreBefore = JSON.stringify(core);
  const starter = E.CardCollection.get(characterId).data;
  const saved = E.CardCollection.save(characterId, starter);
  assert.equal(saved.ok, true);
  assert.equal(saved.data.checksum, E.Save.checksumOf(saved.data));
  assert.equal(values.has('eldoria.cards.' + characterId), true);
  assert.equal(Array.from(values.keys()).some(key => key.indexOf('eldoria.char.') === 0), false);
  const loaded = E.CardCollection.get(characterId);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, 'saved');
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.data.owned)), JSON.parse(JSON.stringify(starter.owned)));
  assert.equal(JSON.stringify(core), coreBefore);
  assert.equal(E.Save.validateSave(core).ok, true);
  assert.equal(E.Save.SCHEMA_VERSION, 1);
});

test('rejects unowned references, unknown cards and oversized presets without replacing valid sidecar data', () => {
  const { E, values } = boot();
  const starter = E.CardCollection.get(characterId).data;
  assert.equal(E.CardCollection.save(characterId, starter).ok, true);
  const key = E.CardCollection.keyFor(characterId);
  const original = values.get(key);
  const badReference = {
    owned: [{ cardId: 'strike', stars: 1, quantity: 1 }],
    presets: [{ id: 'bad', name: 'Bad', cardRefs: [{ cardId: 'strike', stars: 1 }, { cardId: 'strike', stars: 1 }] }],
    activePresetId: 'bad'
  };
  assert.match(E.CardCollection.save(characterId, badReference).reason, /unownedReference/);
  const unknownCard = { owned: [{ cardId: 'not-a-card', stars: 1, quantity: 1 }], presets: [], activePresetId: null };
  assert.match(E.CardCollection.save(characterId, unknownCard).reason, /owned/);
  const tooLarge = {
    owned: [{ cardId: 'strike', stars: 1, quantity: 21 }],
    presets: [{ id: 'large', name: 'Too Large', cardRefs: Array.from({ length: 21 }, () => ({ cardId: 'strike', stars: 1 })) }],
    activePresetId: 'large'
  };
  assert.match(E.CardCollection.save(characterId, tooLarge).reason, /preset/);
  assert.equal(values.get(key), original, 'invalid writes must leave the last valid collection untouched');
});

test('corrupt sidecar data is reported and never silently reset to starter data', () => {
  const { E, values } = boot();
  const key = E.CardCollection.keyFor(characterId);
  values.set(key, '{broken');
  const result = E.CardCollection.get(characterId);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'CORRUPT');
  assert.equal(values.get(key), '{broken');
});

test('storage failures are reported without changing the character save', () => {
  const { E, values } = boot({ failWrites: true });
  const result = E.CardCollection.save(characterId, E.CardCollection.get(characterId).data);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'WRITE_FAILED');
  assert.equal(values.size, 0);
  assert.equal(E.CardCollection.get('invalid').reason, 'BAD_CHARACTER_ID');
});

test('Card Collection UI is registered without modifying the transactional Save Engine', () => {
  const main = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const save = fs.readFileSync(path.join(root, 'js', 'save.js'), 'utf8');
  assert.match(main, /'screen-card-collection'/);
  assert.match(main, /function openCardCollection\(\)[\s\S]*?E\.World\.pause\(\)[\s\S]*?show\('screen-card-collection'\)/);
  assert.match(main, /function closeCardCollection\(\)[\s\S]*?E\.World\.resume\(\)/);
  assert.match(main, /E\.CardCollection\.get\(currentSave\.characterId\)/);
  assert.match(html, /id="btn-card-collection"/);
  assert.match(html, /id="screen-card-collection"/);
  assert.ok(html.indexOf('js/save.js') < html.indexOf('js/card-collection.js'));
  assert.ok(html.indexOf('js/card-collection.js') < html.indexOf('js/main.js'));
  assert.match(save, /var SCHEMA_VERSION = 1;/);
  assert.match(save, /var SAVE_KEYS = \['schemaVersion'/);
  assert.doesNotMatch(save, /CardCollection|deckCollection|deckPresets/);
});
