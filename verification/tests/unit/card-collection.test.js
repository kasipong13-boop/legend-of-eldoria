const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../..');

function boot(options) {
  const values = options && options.values ? options.values : new Map();
  let writeCount = 0;
  const storage = {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      writeCount++;
      if (options && (options.failWrites || options.failWriteAt === writeCount)) throw new Error('storage unavailable');
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
  assert.equal(loaded.source, 'legacy-v1');
  assert.equal(values.get(E.CardCollection.keyFor(characterId)), JSON.stringify(legacy), 'read must not mutate old sidecar');
  assert.equal(E.CardCollection.stageReward(characterId, 'reward-legacy', []).ok, true);
  assert.equal(E.CardCollection.get(characterId).data.schemaVersion, 3);
});

test('sidecar write failure prevents card reward claim and preserves staged reward for retry', () => {
  const { E, values } = boot({ failWrites: true });
  const result = E.CardCollection.stageReward(characterId, 'reward-fail', [{ cardId: 'strike', stars: 1, quantity: 1 }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'WRITE_FAILED');
  assert.equal(values.size, 0);
});


test('sidecar schema v2 migrates read-only to v3 with an empty durable journal', () => {
  const { E, values } = boot();
  const starter = E.CardCollection.get(characterId).data;
  const previous = {
    schemaVersion: 2, characterId, owned: starter.owned, presets: starter.presets,
    activePresetId: 'starter', pendingRewards: [], claimedRewardIds: []
  };
  previous.checksum = E.Save.checksumOf(previous);
  values.set(E.CardCollection.keyFor(characterId), JSON.stringify(previous));
  const loaded = E.CardCollection.get(characterId);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, 'legacy-v2');
  assert.equal(loaded.data.schemaVersion, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.data.rewardJournal)), []);
  assert.equal(values.get(E.CardCollection.keyFor(characterId)), JSON.stringify(previous), 'migration must remain read-only');
});

test('battle reward journal survives a fresh runtime and retains the complete reward intent', () => {
  const first = boot();
  const intent = {
    rewardId: '1', monsterId: 'poring',
    reward: { exp: 17, gold: 0, drops: [{ id: 'jelly', name: 'Poring Jelly' }] },
    cards: [{ cardId: 'bash', stars: 1, quantity: 1 }],
    createdAt: '2026-11-10T00:00:00.000Z'
  };
  const staged = first.E.CardCollection.stageBattleReward(characterId, intent);
  assert.equal(staged.ok, true);
  assert.equal(first.E.CardCollection.isRewardSystemActive(characterId), true);
  const second = boot({ values: first.values });
  const journal = second.E.CardCollection.getRewardJournal(characterId);
  assert.equal(journal.ok, true);
  assert.equal(journal.entries.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(journal.entries[0])), {
    rewardId: '1', monsterId: 'poring', exp: 17, gold: 0,
    drops: [{ id: 'jelly', name: 'Poring Jelly' }],
    cards: [{ cardId: 'bash', stars: 1, quantity: 1 }],
    createdAt: '2026-11-10T00:00:00.000Z', status: 'staged'
  });
  const claimed = second.E.CardCollection.claimReward(characterId, '1');
  assert.equal(claimed.ok, true);
  assert.equal(second.E.CardCollection.getRewardJournal(characterId).entries[0].status, 'cardsClaimed');
  assert.equal(second.E.CardCollection.completeReward(characterId, '1').ok, true);
  assert.equal(second.E.CardCollection.getRewardJournal(characterId).entries[0].status, 'completed');
  assert.equal(second.E.CardCollection.claimReward(characterId, '1').alreadyClaimed, true);
});

test('corrupt primary sidecar recovers from its verified backup without resetting data', () => {
  const { E, values } = boot();
  const data = E.CardCollection.get(characterId).data;
  assert.equal(E.CardCollection.save(characterId, data).ok, true);
  values.set(E.CardCollection.keyFor(characterId), '{corrupt-primary');
  const recovered = E.CardCollection.get(characterId);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.source, 'backup');
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.data.owned.reduce((sum, item) => sum + item.quantity, 0), E.STARTER_DECK.length);
});

test('activated reward sidecar cannot silently fall back to starter data if both copies disappear', () => {
  const { E, values } = boot();
  const staged = E.CardCollection.stageBattleReward(characterId, {
    rewardId: '1', monsterId: 'poring', reward: { exp: 1, gold: 0, drops: [] },
    cards: [], createdAt: '2026-11-10T00:00:00.000Z'
  });
  assert.equal(staged.ok, true);
  values.delete(E.CardCollection.keyFor(characterId));
  values.delete(E.CardCollection.backupKeyFor(characterId));
  const missing = E.CardCollection.get(characterId);
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'ACTIVE_SIDECAR_MISSING');
});

test('duplicate sequence retry reuses the first durable battle reward payload', () => {
  const { E } = boot();
  const intent = {
    rewardId: '1', monsterId: 'poring',
    reward: { exp: 17, gold: 0, drops: [] }, cards: [],
    createdAt: '2026-11-10T00:00:00.000Z'
  };
  assert.equal(E.CardCollection.stageBattleReward(characterId, intent).ok, true);
  const retry = E.CardCollection.stageBattleReward(characterId, {
    rewardId: '1', monsterId: 'wolf',
    reward: { exp: 99, gold: 0, drops: [] }, cards: [],
    createdAt: '2026-11-10T00:00:01.000Z'
  });
  assert.equal(retry.ok, true);
  assert.equal(retry.alreadyStaged, true);
  assert.equal(retry.journal.monsterId, 'poring');
  assert.equal(retry.journal.exp, 17);
});


test('sidecar revision selection recovers a newer backup after a crash before primary replacement', () => {
  const { E, values } = boot();
  const starter = E.CardCollection.get(characterId).data;
  assert.equal(E.CardCollection.save(characterId, starter).ok, true);
  const oldPrimary = values.get(E.CardCollection.keyFor(characterId));
  const reward = E.CardCollection.stageBattleReward(characterId, {
    rewardId: '1', monsterId: 'poring', reward: { exp: 5, gold: 0, drops: [] },
    cards: [{ cardId: 'bash', stars: 1, quantity: 1 }], createdAt: '2026-11-10T00:00:00.000Z'
  });
  assert.equal(reward.ok, true);
  // Simulate interruption after the new backup revision was written but before primary caught up.
  values.set(E.CardCollection.keyFor(characterId), oldPrimary);
  const recovered = E.CardCollection.getRewardJournal(characterId);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.source, 'backup');
  assert.equal(recovered.entries.length, 1);
  assert.equal(recovered.entries[0].rewardId, '1');
});


test('two runtime instances sharing browser storage cannot double-claim the same reward', () => {
  const first = boot();
  const second = boot({ values: first.values });
  const intent = {
    rewardId: '1', monsterId: 'poring', reward: { exp: 3, gold: 0, drops: [] },
    cards: [{ cardId: 'bash', stars: 1, quantity: 1 }], createdAt: '2026-11-10T00:00:00.000Z'
  };
  assert.equal(first.E.CardCollection.stageBattleReward(characterId, intent).ok, true);
  assert.equal(second.E.CardCollection.stageBattleReward(characterId, intent).alreadyStaged, true);
  assert.equal(first.E.CardCollection.claimReward(characterId, '1').ok, true);
  assert.equal(second.E.CardCollection.claimReward(characterId, '1').alreadyClaimed, true);
  const owned = second.E.CardCollection.get(characterId).data.owned.find(card => card.cardId === 'bash' && card.stars === 1);
  assert.equal(owned.quantity, 2);
});


test('stale sidecar revisions are rejected instead of overwriting another tab update', () => {
  const first = boot();
  const second = boot({ values: first.values });
  const firstView = first.E.CardCollection.get(characterId).data;
  const secondView = second.E.CardCollection.get(characterId).data;
  const firstEdit = JSON.parse(JSON.stringify(firstView));
  firstEdit.owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity += 1;
  assert.equal(first.E.CardCollection.save(characterId, firstEdit).ok, true);
  const staleEdit = JSON.parse(JSON.stringify(secondView));
  staleEdit.owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity += 2;
  const rejected = second.E.CardCollection.save(characterId, staleEdit);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'STALE_SIDECAR_WRITE');
  const finalOwned = first.E.CardCollection.get(characterId).data.owned.find(card => card.cardId === 'strike' && card.stars === 1);
  assert.equal(finalOwned.quantity, firstView.owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity + 1);
});


test('backup-first journal write remains recoverable when primary replacement throws', () => {
  const { E } = boot({ failWriteAt: 2 });
  const staged = E.CardCollection.stageBattleReward(characterId, {
    rewardId: '1', monsterId: 'poring', reward: { exp: 4, gold: 0, drops: [] },
    cards: [{ cardId: 'bash', stars: 1, quantity: 1 }], createdAt: '2026-11-10T00:00:00.000Z'
  });
  assert.equal(staged.ok, true);
  assert.equal(staged.degraded, true);
  const recovered = E.CardCollection.getRewardJournal(characterId);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.source, 'backup');
  assert.equal(recovered.entries[0].rewardId, '1');
});

test('same-revision sidecar copies with different checksums fail closed', () => {
  const { E, values } = boot();
  const data = E.CardCollection.get(characterId).data;
  assert.equal(E.CardCollection.save(characterId, data).ok, true);
  const primary = JSON.parse(values.get(E.CardCollection.keyFor(characterId)));
  const conflicting = JSON.parse(JSON.stringify(primary));
  conflicting.owned.find(card => card.cardId === 'strike' && card.stars === 1).quantity += 1;
  conflicting.checksum = E.Save.checksumOf(conflicting);
  values.set(E.CardCollection.backupKeyFor(characterId), JSON.stringify(conflicting));
  const result = E.CardCollection.get(characterId);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'SIDECAR_REVISION_CONFLICT');
});
