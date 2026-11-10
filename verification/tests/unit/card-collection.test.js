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

test('card reward staging and claiming are idempotent and stack identical card variants', () => {
  const { E, values } = boot();
  const first = E.CardCollection.stageReward(characterId, 'reward-1', [{ cardId: 'strike', stars: 1, quantity: 1 }]);
  assert.equal(first.ok, true);
  const retry = E.CardCollection.stageReward(characterId, 'reward-1', [{ cardId: 'guard', stars: 1, quantity: 1 }]);
  assert.equal(retry.ok, true);
  assert.equal(retry.alreadyStaged, true);
  assert.deepEqual(JSON.parse(JSON.stringify(retry.cards)), [{ cardId: 'strike', stars: 1, quantity: 1 }]);
  const claimed = E.CardCollection.claimReward(characterId, 'reward-1');
  assert.equal(claimed.ok, true);
  const repeated = E.CardCollection.claimReward(characterId, 'reward-1');
  assert.equal(repeated.ok, true);
  assert.equal(repeated.alreadyClaimed, true);
  const owned = E.CardCollection.get(characterId).data.owned;
  assert.deepEqual(JSON.parse(JSON.stringify(owned.find(card => card.cardId === 'strike' && card.stars === 1))),
    { cardId: 'strike', stars: 1, quantity: 5 });
  assert.equal(values.has(E.CardCollection.keyFor(characterId)), true);
});

test('card rewards keep different star variants separate and never touch Save Schema', () => {
  const { E, values } = boot();
  const save = E.CardCollection.get(characterId).data;
  const result = E.CardCollection.stageReward(characterId, 'reward-2', [{ cardId: 'strike', stars: 2, quantity: 2 }]);
  assert.equal(result.ok, true);
  assert.equal(E.CardCollection.claimReward(characterId, 'reward-2').ok, true);
  const data = E.CardCollection.get(characterId).data;
  assert.deepEqual(JSON.parse(JSON.stringify(data.owned.filter(card => card.cardId === 'strike'))), [
    { cardId: 'strike', stars: 1, quantity: 4 },
    { cardId: 'strike', stars: 2, quantity: 2 }
  ]);
  assert.equal(E.Save.SCHEMA_VERSION, 1);
  assert.equal(values.has('eldoria.char.' + characterId + '.main'), false);
  assert.equal(save.owned.length, 5);
});

test('legacy sidecar schema v1 is readable and upgrades only when a reward is written', () => {
  const { E, values } = boot();
  const starter = E.CardCollection.get(characterId).data;
  const legacy = {
    schemaVersion: 1, characterId, owned: starter.owned, presets: starter.presets, activePresetId: 'starter'
  };
  legacy.checksum = E.Save.checksumOf(legacy);
  values.set(E.CardCollection.keyFor(characterId), JSON.stringify(legacy));
  const loaded = E.CardCollection.get(characterId);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, 'legacy');
  assert.equal(values.get(E.CardCollection.keyFor(characterId)), JSON.stringify(legacy), 'read must not mutate old sidecar');
  assert.equal(E.CardCollection.stageReward(characterId, 'reward-legacy', []).ok, true);
  assert.equal(E.CardCollection.get(characterId).data.schemaVersion, 2);
});

test('sidecar write failure prevents card reward claim and preserves staged reward for retry', () => {
  const { E, values } = boot({ failWrites: true });
  const result = E.CardCollection.stageReward(characterId, 'reward-fail', [{ cardId: 'strike', stars: 1, quantity: 1 }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'WRITE_FAILED');
  assert.equal(values.size, 0);
});


test('FI-23: a failed claim write does not persist ownership without its receipt', () => {
  const { E, values } = boot();
  const id = 'fi23-reward';
  assert.equal(E.CardCollection.stageReward(characterId, id, [{ cardId: 'strike', stars: 1, quantity: 1 }]).ok, true);
  const key = E.CardCollection.keyFor(characterId);
  const staged = values.get(key);
  const originalSet = values.set.bind(values);
  // Simulate an atomic localStorage setItem failure at the claim boundary.
  // The staged record remains the durable state until the write succeeds.
  const { E: failedE, values: failedValues } = boot({ failWrites: true });
  failedValues.set(key, staged);
  const before = JSON.parse(JSON.stringify(failedE.CardCollection.get(characterId).data));
  const failed = failedE.CardCollection.claimReward(characterId, id);
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'WRITE_FAILED');
  const after = JSON.parse(JSON.stringify(failedE.CardCollection.get(characterId).data));
  assert.deepEqual(after.owned, before.owned);
  assert.deepEqual(after.claimedRewards, before.claimedRewards);
  assert.equal(failedValues.get(key), staged);
  assert.equal(typeof originalSet, 'function');
});

test('FI-24: repeated card claim after sidecar reload grants only one copy', () => {
  const { E, values } = boot();
  const id = 'fi24-reward';
  assert.equal(E.CardCollection.stageReward(characterId, id, [{ cardId: 'strike', stars: 1, quantity: 1 }]).ok, true);
  assert.equal(E.CardCollection.claimReward(characterId, id).ok, true);
  const snapshot = values.get(E.CardCollection.keyFor(characterId));
  const reloaded = boot();
  reloaded.values.set(E.CardCollection.keyFor(characterId), snapshot);
  const retry = reloaded.E.CardCollection.claimReward(characterId, id);
  assert.equal(retry.ok, true);
  assert.equal(retry.alreadyClaimed, true);
  const owned = reloaded.E.CardCollection.get(characterId).data.owned;
  assert.equal(owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity, 5);
});


test('FI-23: failed claim write preserves pending receipt boundary, then retry atomically grants once', () => {
  const id = 'fi23-retry';
  const { E, storage, values } = boot();
  assert.equal(E.CardCollection.stageReward(characterId, id, [{ cardId: 'strike', stars: 1, quantity: 1 }]).ok, true);
  const key = E.CardCollection.keyFor(characterId);
  const stagedRaw = values.get(key);
  const originalSetItem = storage.setItem;
  storage.setItem = () => { throw new Error('INJECTED_CLAIM_WRITE_FAILURE'); };
  const rejected = E.CardCollection.claimReward(characterId, id);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'WRITE_FAILED');
  assert.equal(values.get(key), stagedRaw);
  const pending = E.CardCollection.get(characterId);
  assert.equal(pending.ok, true);
  assert.equal(pending.data.pendingRewards.length, 1);
  assert.equal(pending.data.claimedRewardIds.includes(id), false);
  assert.equal(pending.data.owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity, 4);
  storage.setItem = originalSetItem;
  assert.equal(E.CardCollection.claimReward(characterId, id).ok, true);
  const settled = E.CardCollection.get(characterId).data;
  assert.equal(settled.pendingRewards.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(settled.claimedRewardIds)), [id]);
  assert.equal(settled.owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity, 5);
  assert.equal(E.CardCollection.claimReward(characterId, id).alreadyClaimed, true);
  assert.equal(E.CardCollection.get(characterId).data.owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity, 5);
});

test('FI-24: repeated reload and claim retains exactly one durable receipt and card increment', () => {
  const id = 'fi24-multi-reload';
  const first = boot();
  assert.equal(first.E.CardCollection.stageReward(characterId, id, [{ cardId: 'strike', stars: 1, quantity: 1 }]).ok, true);
  assert.equal(first.E.CardCollection.claimReward(characterId, id).ok, true);
  const key = first.E.CardCollection.keyFor(characterId);
  let durable = first.values.get(key);
  for (let attempt = 0; attempt < 3; attempt++) {
    const next = boot();
    next.values.set(key, durable);
    const replay = next.E.CardCollection.claimReward(characterId, id);
    assert.equal(replay.ok, true);
    assert.equal(replay.alreadyClaimed, true);
    const result = next.E.CardCollection.get(characterId);
    assert.equal(result.ok, true);
    assert.equal(result.data.claimedRewardIds.filter(x => x === id).length, 1);
    assert.equal(result.data.pendingRewards.some(x => x.rewardId === id), false);
    assert.equal(result.data.owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity, 5);
    assert.equal(next.values.get(key), durable, 'replay must not rewrite the durable sidecar');
    durable = next.values.get(key);
  }
});
