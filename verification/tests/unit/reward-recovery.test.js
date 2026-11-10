const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../..');
function boot(options = {}) {
  const records = new Map(), quarantine = new Map(), markers = new Map();
  const markerStorage = { setItem: (key, value) => markers.set(key, String(value)), getItem: key => markers.has(key) ? markers.get(key) : null };
  const stores = { journal: records, quarantine };
  const adapter = options.adapter || {
    get: async (store, key) => stores[store].get(key) || null,
    put: async (store, value) => { stores[store].set(value.key, JSON.parse(JSON.stringify(value))); return value; },
    listByCharacter: async (store, id) => Array.from(stores[store].values()).filter(item => item.characterId === id)
  };
  let busy = false;
  const locks = options.locks === null ? null : options.locks || {
    request: async (name, config, callback) => {
      if (busy) return callback(null);
      busy = true;
      try { return await callback({ name, mode: config.mode }); }
      finally { busy = false; }
    }
  };
  const context = { module: { exports: {} }, console, JSON, Object, Array, Number, Date, Math, Promise };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/reward-recovery.js'), 'utf8'), context, { filename: 'reward-recovery.js' });
  return { API: context.ELDORIA.RewardRecovery.create({ adapter, locks, markerStorage }), records, quarantine, markers };
}
const characterId = 'a'.repeat(32);
const intent = (overrides = {}) => ({
  rewardId: '1', encounterId: 'b'.repeat(32), monsterId: 'poring', exp: 10, gold: 0,
  drops: [{ id: 'jelly', name: 'Poring Jelly' }],
  cards: [{ cardId: 'bash', stars: 1, quantity: 1 }],
  createdAt: '2026-11-10T00:00:00.000Z', ...overrides
});

test('Web Locks coordinator fails closed when Web Locks is unavailable', async () => {
  const { API } = boot({ locks: null });
  const result = await API.runExclusive(characterId, async () => ({ ok: true }));
  assert.equal(result.ok, false);\n  assert.equal(result.reason, 'WEB_LOCKS_UNAVAILABLE');
});

test('Web Locks coordinator refuses a busy lock and never runs the callback', async () => {
  const { API } = boot({ locks: { request: async (name, options, callback) => callback(null) } });
  let called = false;
  const result = await API.runExclusive(characterId, async () => { called = true; return { ok: true }; });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'REWARD_LOCK_BUSY');
  assert.equal(called, false);
});

test('reward journal prepares a durable immutable payload and advances only through legal states', async () => {
  const { API, records, markers } = boot();
  const prepared = await API.prepare(characterId, intent());
  assert.equal(prepared.ok, true);
  assert.equal(prepared.entry.status, 'prepared');
  assert.equal(records.size, 1);
  assert.equal(markers.get('eldoria.reward.v1.active.' + characterId), '1');
  const retry = await API.prepare(characterId, intent());
  assert.equal(retry.ok, true);
  assert.equal(retry.alreadyPrepared, true);
  assert.equal((await API.transition(characterId, '1', 'sidecarStaged')).ok, true);
  assert.equal((await API.transition(characterId, '1', 'savePending')).ok, true);
  assert.equal((await API.transition(characterId, '1', 'completed')).reason, 'INVALID_JOURNAL_TRANSITION');
  const list = await API.list(characterId);
  assert.equal(list.entries.length, 1);
  assert.equal(list.entries[0].status, 'savePending');
});

test('same reward identity with a different payload is quarantined, not rebound', async () => {
  const { API, records, quarantine } = boot();
  assert.equal((await API.prepare(characterId, intent())).ok, true);
  const conflict = await API.prepare(characterId, intent({ exp: 99 }));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'REWARD_ID_PAYLOAD_CONFLICT');
  assert.equal(records.get(characterId + ':1').status, 'prepared', 'the first durable payload remains canonical');
  assert.equal(quarantine.size, 1);
  const evidence = await API.listQuarantine(characterId);
  assert.equal(evidence.entries[0].reason, 'REWARD_ID_PAYLOAD_CONFLICT');
});

test('one encounter identity cannot be rebound to another reward identity', async () => {
  const { API, quarantine } = boot();
  assert.equal((await API.prepare(characterId, intent())).ok, true);
  const conflict = await API.prepare(characterId, intent({ rewardId: '2' }));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'ENCOUNTER_ID_REUSED');
  assert.equal(quarantine.size, 1);
});

test('journal records are retained after completion and quarantine', async () => {
  const { API, records } = boot();
  await API.prepare(characterId, intent());
  for (const state of ['sidecarStaged', 'savePending', 'cardsClaimed', 'saveClaimed', 'completed']) {
    assert.equal((await API.transition(characterId, '1', state)).ok, true);
  }
  assert.equal(records.size, 1);
  assert.equal((await API.get(characterId, '1')).entry.status, 'completed');
});

test('IndexedDB unavailability fails closed and leaves activation evidence for later recovery', async () => {
  const markers = new Map();
  const markerStorage = { setItem: (key, value) => markers.set(key, String(value)), getItem: key => markers.has(key) ? markers.get(key) : null };
  const context = { module: { exports: {} }, console, JSON, Object, Array, Number, Date, Math, Promise };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/reward-recovery.js'), 'utf8'), context, { filename: 'reward-recovery.js' });
  const locks = { request: async (name, options, callback) => callback({ name }) };
  const api = context.ELDORIA.RewardRecovery.create({ locks, markerStorage });
  const result = await api.prepare(characterId, intent());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'INDEXEDDB_UNAVAILABLE');
  assert.equal(api.isActive(characterId), true);
});

test('reward ID collision with a different encounter preserves the first journal and quarantines the incoming intent', async () => {
  const { API, records, quarantine } = boot();
  assert.equal((await API.prepare(characterId, intent())).ok, true);
  const conflict = await API.prepare(characterId, intent({ encounterId: 'c'.repeat(32) }));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'REWARD_ID_PAYLOAD_CONFLICT');
  assert.equal(records.get(characterId + ':1').encounterId, 'b'.repeat(32));
  assert.equal(records.get(characterId + ':1').status, 'prepared');
  assert.equal(quarantine.size, 1);
});
