const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../..');
const characterId = 'a'.repeat(32);
const intent = (overrides = {}) => ({
  rewardId: '1', encounterId: 'b'.repeat(32), monsterId: 'poring', exp: 10, gold: 0,
  drops: [{ id: 'jelly', name: 'Poring Jelly' }],
  cards: [{ cardId: 'bash', stars: 1, quantity: 1 }],
  createdAt: '2026-11-10T00:00:00.000Z', ...overrides
});

function boot(options = {}) {
  const records = new Map(), quarantine = new Map(), markers = new Map();
  const markerStorage = {
    setItem: (key, value) => markers.set(key, String(value)),
    getItem: key => markers.has(key) ? markers.get(key) : null
  };
  const stores = { journal: records, quarantine };
  const adapter = Object.prototype.hasOwnProperty.call(options, 'adapter') ? options.adapter : {
    get: async (store, key) => stores[store].get(key) || null,
    put: async (store, value) => { stores[store].set(value.key, JSON.parse(JSON.stringify(value))); return value; },
    listByCharacter: async (store, id) => Array.from(stores[store].values()).filter(item => item.characterId === id)
  };
  let busy = false;
  const locks = Object.prototype.hasOwnProperty.call(options, 'locks') ? options.locks : {
    request: async (name, config, callback) => {
      if (busy) return callback(null);
      busy = true;
      try { return await callback({ name, mode: config.mode }); }
      finally { busy = false; }
    }
  };
  const context = { module: { exports: {} }, console, JSON, Object, Array, Number, Date, Math, Promise, Uint8Array };
  vm.createContext(context);
  for (const file of ['data.js', 'save.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
  }
  vm.runInContext(fs.readFileSync(path.join(root, 'js/reward-recovery.js'), 'utf8'), context, { filename: 'reward-recovery.js' });
  const API = context.ELDORIA.RewardRecovery.create({
    adapter, locks, markerStorage, fault: options.fault, now: options.now, crypto: options.crypto
  });
  return { API, records, quarantine, markers, context };
}

async function locked(API, callback) {
  return API.runExclusive(characterId, callback);
}

test('Web Locks coordinator fails closed when Web Locks is unavailable', async () => {
  const { API } = boot({ locks: null });
  const result = await API.runExclusive(characterId, async () => ({ ok: true }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'WEB_LOCKS_UNAVAILABLE');
});

test('Web Locks coordinator refuses a busy lock and never runs the callback', async () => {
  const { API } = boot({ locks: { request: async (name, options, callback) => callback(null) } });
  let called = false;
  const result = await API.runExclusive(characterId, async () => { called = true; return { ok: true }; });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'REWARD_LOCK_BUSY');
  assert.equal(called, false);
});

test('Journal mutations require the per-character Web Lock', async () => {
  const { API } = boot();
  const prepared = await API.prepare(characterId, intent());
  assert.equal(prepared.ok, false);
  assert.equal(prepared.reason, 'REWARD_LOCK_REQUIRED');
  const transitioned = await API.transition(characterId, '1', 'sidecarStaged');
  assert.equal(transitioned.ok, false);
  assert.equal(transitioned.reason, 'REWARD_LOCK_REQUIRED');
});

test('Journal prepares an immutable payload and permits only forward state transitions', async () => {
  const { API, records, markers } = boot();
  const result = await locked(API, async () => {
    const prepared = await API.prepare(characterId, intent());
    assert.equal(prepared.ok, true);
    assert.equal(prepared.entry.status, 'prepared');
    const retry = await API.prepare(characterId, intent());
    assert.equal(retry.ok, true);
    assert.equal(retry.alreadyPrepared, true);
    assert.equal((await API.transition(characterId, '1', 'sidecarStaged')).ok, true);
    assert.equal((await API.transition(characterId, '1', 'savePending')).ok, true);
    assert.equal((await API.transition(characterId, '1', 'completed')).reason, 'INVALID_JOURNAL_TRANSITION');
    return { ok: true };
  });
  assert.equal(result.ok, true);
  assert.equal(records.size, 1);
  assert.equal(markers.get('eldoria.reward.v1.active.' + characterId), '1');
  const list = await API.list(characterId);
  assert.equal(list.entries.length, 1);
  assert.equal(list.entries[0].status, 'savePending');
  assert.equal(typeof list.entries[0].payloadDigest, 'string');
  assert.equal(list.entries[0].payloadCanonical.length > 0, true);
});

test('same reward identity with a different payload is quarantined without invalidating the canonical intent', async () => {
  const { API, records, quarantine } = boot();
  const result = await locked(API, async () => {
    assert.equal((await API.prepare(characterId, intent())).ok, true);
    const conflict = await API.prepare(characterId, intent({ exp: 99 }));
    assert.equal(conflict.ok, false);
    assert.equal(conflict.reason, 'REWARD_ID_PAYLOAD_CONFLICT');
    return { ok: true };
  });
  assert.equal(result.ok, true);
  assert.equal(records.get(characterId + ':1').status, 'prepared');
  assert.equal(quarantine.size, 1);
  const evidence = await API.listQuarantine(characterId);
  assert.equal(evidence.entries[0].reason, 'REWARD_ID_PAYLOAD_CONFLICT');
});

test('one encounter identity cannot be rebound to another reward identity', async () => {
  const { API, records, quarantine } = boot();
  const result = await locked(API, async () => {
    assert.equal((await API.prepare(characterId, intent())).ok, true);
    const conflict = await API.prepare(characterId, intent({ rewardId: '2' }));
    assert.equal(conflict.ok, false);
    assert.equal(conflict.reason, 'ENCOUNTER_ID_REUSED');
    return { ok: true };
  });
  assert.equal(result.ok, true);
  assert.equal(quarantine.size, 2, 'both the canonical encounter and incoming collision are retained as evidence');
  assert.equal(records.get(characterId + ':1').status, 'quarantined');
});

test('completed and quarantined Journal records are retained', async () => {
  const { API, records } = boot();
  await locked(API, async () => {
    await API.prepare(characterId, intent());
    for (const state of ['sidecarStaged', 'savePending', 'cardsClaimed', 'saveClaimed', 'completed']) {
      assert.equal((await API.transition(characterId, '1', state)).ok, true);
    }
    const replay = await API.prepare(characterId, intent());
    assert.equal(replay.ok, false);
    assert.equal(replay.reason, 'REWARD_ALREADY_COMPLETED');
    return { ok: true };
  });
  assert.equal(records.size, 1);
  assert.equal((await API.get(characterId, '1')).entry.status, 'completed');
});

test('IndexedDB unavailability fails closed without creating a false activation marker', async () => {
  const { API, markers } = boot({ adapter: null });
  const result = await locked(API, () => API.prepare(characterId, intent()));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'INDEXEDDB_UNAVAILABLE');
  assert.equal(markers.has('eldoria.reward.v1.active.' + characterId), false);
});

test('crash after durable Journal write but before marker is recoverable by idempotent prepare', async () => {
  let shouldFail = true;
  const { API, records, markers } = boot({
    fault: point => { if (point === 'journal.prepare.after' && shouldFail) { shouldFail = false; throw new Error('INJECTED_CRASH'); } }
  });
  const first = await locked(API, () => API.prepare(characterId, intent()));
  assert.equal(first.ok, false);
  assert.equal(records.size, 1);
  assert.equal(markers.has('eldoria.reward.v1.active.' + characterId), false);
  const retry = await locked(API, () => API.prepare(characterId, intent()));
  assert.equal(retry.ok, true);
  assert.equal(retry.alreadyPrepared, true);
  assert.equal(markers.get('eldoria.reward.v1.active.' + characterId), '1');
});

test('transition retry is idempotent after a crash immediately after the durable write', async () => {
  let shouldFail = true;
  const { API } = boot({
    fault: point => { if (point === 'journal.transition.after' && shouldFail) { shouldFail = false; throw new Error('INJECTED_CRASH'); } }
  });
  await locked(API, async () => {
    await API.prepare(characterId, intent());
    const interrupted = await API.transition(characterId, '1', 'sidecarStaged');
    assert.equal(interrupted.ok, false);
    const retry = await API.transition(characterId, '1', 'sidecarStaged');
    assert.equal(retry.ok, true);
    assert.equal(retry.alreadyTransitioned, true);
    return { ok: true };
  });
});

test('corrupt Journal payload digest is rejected and never returned as valid recovery input', async () => {
  const { API, records } = boot();
  await locked(API, async () => {
    await API.prepare(characterId, intent());
    records.get(characterId + ':1').payload.exp = 999;
    return { ok: true };
  });
  const result = await API.get(characterId, '1');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'JOURNAL_CORRUPT');
});

test('lock callback errors fail closed and release the lock for a later retry', async () => {
  const { API } = boot();
  const first = await API.runExclusive(characterId, async () => { throw new Error('INJECTED_LOCK_CALLBACK'); });
  assert.equal(first.ok, false);
  assert.equal(first.reason, 'INJECTED_LOCK_CALLBACK');
  const second = await locked(API, async () => ({ ok: true }));
  assert.equal(second.ok, true);
});

test('encounter identity is generated from cryptographic random bytes and fails closed without crypto', () => {
  const crypto = { getRandomValues: bytes => { for (let i = 0; i < bytes.length; i++) bytes[i] = i; return bytes; } };
  const withCrypto = boot({ crypto }).API.createEncounterId();
  assert.equal(withCrypto, '000102030405060708090a0b0c0d0e0f');
  const withoutCrypto = boot().API.createEncounterId();
  assert.equal(withoutCrypto, null);
});

test('deleted Journal after activation is detectable and cannot be downgraded to legacy success', async () => {
  const { API, records, markers } = boot();
  await locked(API, () => API.prepare(characterId, intent()));
  records.delete(characterId + ':1');
  const listed = await API.list(characterId);
  assert.equal(listed.ok, true);
  assert.equal(listed.entries.length, 0);
  assert.equal(API.isActive(characterId), true);
  assert.equal(markers.get('eldoria.reward.v1.active.' + characterId), '1');
});


test('F-02: journal evidence repairs a missing activation marker under the reward lock', async () => {
  const { API, markers } = boot();
  await locked(API, () => API.prepare(characterId, intent()));
  markers.clear();
  const evidence = await API.list(characterId);
  assert.equal(evidence.ok, true);
  const outside = API.reconcileActivation(characterId, evidence.entries);
  assert.equal(outside.ok, false);
  const result = await locked(API, () => API.reconcileActivation(characterId, evidence.entries));
  assert.equal(result.ok, true);
  assert.equal(result.activated, true);
  assert.equal(markers.get('eldoria.reward.v1.active.' + characterId), '1');
});

test('F-02: missing marker and durable journal evidence never permits legacy fallback', async () => {
  const { API, markers } = boot();
  await locked(API, () => API.prepare(characterId, intent()));
  markers.clear();
  const evidence = await API.list(characterId);
  const result = await locked(API, () => API.reconcileActivation(characterId, evidence.entries));
  assert.equal(result.ok, true);
  assert.equal(result.activated, true);
});



test('FI-01: aborted Journal put leaves no partial record or activation marker', async () => {
  const journal = new Map(), quarantine = new Map();
  const stores = { journal, quarantine };
  let abort = true;
  const adapter = {
    get: async (store, key) => stores[store].get(key) || null,
    put: async (store, value) => {
      if (store === 'journal' && abort) { abort = false; throw new Error('INJECTED_TRANSACTION_ABORT'); }
      stores[store].set(value.key, JSON.parse(JSON.stringify(value)));
      return value;
    },
    listByCharacter: async (store, id) => Array.from(stores[store].values()).filter(x => x.characterId === id)
  };
  const { API, markers } = boot({ adapter });
  const failed = await locked(API, () => API.prepare(characterId, intent()));
  assert.equal(failed.ok, false);
  assert.equal(journal.size, 0);
  assert.equal(markers.has('eldoria.reward.v1.active.' + characterId), false);
  const retry = await locked(API, () => API.prepare(characterId, intent()));
  assert.equal(retry.ok, true);
  assert.equal(journal.size, 1);
  assert.equal(markers.get('eldoria.reward.v1.active.' + characterId), '1');
});

test('FI-03: same reward identity cannot silently bind a different encounter', async () => {
  const { API, records, quarantine } = boot();
  await locked(API, async () => {
    assert.equal((await API.prepare(characterId, intent())).ok, true);
    const rebound = await API.prepare(characterId, intent({ encounterId: 'c'.repeat(32) }));
    assert.equal(rebound.ok, false);
    assert.equal(records.size, 1);
    assert.equal(records.get(characterId + ':1').payload.encounterId, 'b'.repeat(32));
    assert.ok(quarantine.size > 0);
    return { ok: true };
  });
});

test('FI-31: cross-reward encounter collision retains canonical record and conflict evidence', async () => {
  const { API, records, quarantine } = boot();
  await locked(API, async () => {
    assert.equal((await API.prepare(characterId, intent())).ok, true);
    const conflict = await API.prepare(characterId, intent({ rewardId: '2' }));
    assert.equal(conflict.ok, false);
    assert.equal(conflict.reason, 'ENCOUNTER_ID_REUSED');
    assert.equal(records.has(characterId + ':2'), false);
    assert.ok(quarantine.size >= 1);
    return { ok: true };
  });
});


test('FI-01: durable Journal commit with lost acknowledgement reuses the exact persisted payload', async () => {
  const journal = new Map(), quarantine = new Map(), stores = { journal, quarantine };
  let loseAck = true;
  const adapter = {
    get: async (store, key) => stores[store].get(key) || null,
    put: async (store, value) => {
      stores[store].set(value.key, JSON.parse(JSON.stringify(value)));
      if (store === 'journal' && loseAck) { loseAck = false; throw new Error('INJECTED_ACK_LOSS'); }
      return value;
    },
    listByCharacter: async (store, id) => Array.from(stores[store].values()).filter(x => x.characterId === id)
  };
  const { API, markers } = boot({ adapter });
  const first = await locked(API, () => API.prepare(characterId, intent()));
  assert.equal(first.ok, false);
  assert.equal(journal.size, 1);
  assert.equal(markers.has('eldoria.reward.v1.active.' + characterId), false);
  const durable = JSON.stringify(journal.get(characterId + ':1'));
  const retry = await locked(API, () => API.prepare(characterId, intent()));
  assert.equal(retry.ok, true);
  assert.equal(retry.alreadyPrepared, true);
  assert.equal(JSON.stringify(journal.get(characterId + ':1')), durable);
  assert.equal(markers.get('eldoria.reward.v1.active.' + characterId), '1');
  assert.equal(quarantine.size, 0);
});

test('FI-03: reward identity rebinding preserves canonical payload and records exact conflict', async () => {
  const { API, records } = boot();
  await locked(API, async () => {
    const first = await API.prepare(characterId, intent());
    assert.equal(first.ok, true);
    const canonical = JSON.stringify(records.get(characterId + ':1'));
    const rejected = await API.prepare(characterId, intent({ encounterId: 'c'.repeat(32) }));
    assert.equal(rejected.reason, 'REWARD_ID_PAYLOAD_CONFLICT');
    assert.equal(JSON.stringify(records.get(characterId + ':1')), canonical);
    return { ok: true };
  });
  const evidence = await API.listQuarantine(characterId);
  assert.equal(evidence.ok, true);
  assert.equal(evidence.entries.length, 1);
  assert.equal(evidence.entries[0].reason, 'REWARD_ID_PAYLOAD_CONFLICT');
  assert.equal(evidence.entries[0].conflictingPayload.encounterId, 'c'.repeat(32));
});

test('FI-31: collision across API sessions quarantines both identities without an incoming Journal record', async () => {
  const journal = new Map(), quarantine = new Map(), stores = { journal, quarantine };
  const adapter = {
    get: async (store, key) => stores[store].get(key) || null,
    put: async (store, value) => { stores[store].set(value.key, JSON.parse(JSON.stringify(value))); return value; },
    listByCharacter: async (store, id) => Array.from(stores[store].values()).filter(x => x.characterId === id)
  };
  const sessionOne = boot({ adapter });
  assert.equal((await locked(sessionOne.API, () => sessionOne.API.prepare(characterId, intent()))).ok, true);
  const originalPayload = JSON.stringify(journal.get(characterId + ':1').payload);
  const sessionTwo = boot({ adapter });
  const collision = await locked(sessionTwo.API, () => sessionTwo.API.prepare(characterId, intent({ rewardId: '2' })));
  assert.equal(collision.ok, false);
  assert.equal(collision.reason, 'ENCOUNTER_ID_REUSED');
  assert.equal(journal.size, 1);
  assert.equal(journal.has(characterId + ':2'), false);
  assert.equal(journal.get(characterId + ':1').status, 'quarantined');
  assert.equal(JSON.stringify(journal.get(characterId + ':1').payload), originalPayload);
  const evidence = await sessionTwo.API.listQuarantine(characterId);
  assert.equal(evidence.ok, true);
  assert.equal(evidence.entries.length, 2);
  assert.ok(evidence.entries.every(entry => entry.reason === 'ENCOUNTER_ID_REUSED'));
  assert.ok(evidence.entries.some(entry => entry.conflictingPayload && entry.conflictingPayload.encounterId === 'b'.repeat(32)));
});


test('FI-08: corrupted durable Journal payload fails closed without changing canonical bytes', async () => {
  const { API, records, markers } = boot();
  assert.equal((await locked(API, () => API.prepare(characterId, intent()))).ok, true);
  const key = characterId + ':1';
  const original = records.get(key);
  const altered = JSON.parse(JSON.stringify(original));
  altered.payload.exp = original.payload.exp + 1;
  records.set(key, altered);
  const bytesBefore = JSON.stringify(records.get(key));
  const direct = await API.get(characterId, '1');
  assert.equal(direct.ok, false);
  assert.equal(direct.reason, 'JOURNAL_CORRUPT');
  const listing = await API.list(characterId);
  assert.equal(listing.ok, false);
  assert.equal(JSON.stringify(records.get(key)), bytesBefore, 'read failure must not silently repair a corrupt record');
  assert.equal(markers.get('eldoria.reward.v1.active.' + characterId), '1', 'activation must remain fail closed');
});
