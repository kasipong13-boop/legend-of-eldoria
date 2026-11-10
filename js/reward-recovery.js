/* Legend of Eldoria — IndexedDB Companion Reward Journal + Web Locks.
   The journal is deliberately separate from the Card Collection Sidecar and Character Save.
   It is forward-only: records are retained, including completed and quarantined evidence.
*/
(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};
  var DB_NAME = 'eldoria-reward-recovery';
  var DB_VERSION = 1;
  var JOURNAL_STORE = 'journal';
  var QUARANTINE_STORE = 'quarantine';
  var STATES = ['prepared', 'sidecarStaged', 'savePending', 'cardsClaimed', 'saveClaimed', 'completed', 'quarantined'];
  var NEXT = {
    prepared: ['sidecarStaged', 'quarantined'],
    sidecarStaged: ['savePending', 'quarantined'],
    savePending: ['cardsClaimed', 'quarantined'],
    cardsClaimed: ['saveClaimed', 'quarantined'],
    saveClaimed: ['completed', 'quarantined'],
    completed: [],
    quarantined: []
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + stable(value[key]); }).join(',') + '}';
  }
  function makeKey(characterId, rewardId) { return characterId + ':' + rewardId; }
  function validId(value) { return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value); }
  function validIntent(characterId, intent) {
    return validId(characterId) && intent && typeof intent.rewardId === 'string' &&
      /^[1-9][0-9]*$/.test(intent.rewardId) && typeof intent.encounterId === 'string' &&
      /^[0-9a-f]{32}$/.test(intent.encounterId) && typeof intent.monsterId === 'string' &&
      !!intent.monsterId && Number.isInteger(intent.exp) && intent.exp >= 0 &&
      intent.gold === 0 && Array.isArray(intent.drops) && Array.isArray(intent.cards) &&
      typeof intent.createdAt === 'string' && !!intent.createdAt;
  }

  function create(options) {
    options = options || {};
    var indexedDB = options.indexedDB || root.indexedDB;
    var locks = options.locks || (root.navigator && root.navigator.locks);
    var markerStorage = options.markerStorage || root.localStorage;
    function activeMarkerKey(characterId) { return 'eldoria.reward.v1.active.' + characterId; }
    function ensureActiveMarker(characterId) {
      try { if (!markerStorage) return false; markerStorage.setItem(activeMarkerKey(characterId), '1'); return markerStorage.getItem(activeMarkerKey(characterId)) === '1'; }
      catch (error) { return false; }
    }
    function isActive(characterId) {
      try { return !markerStorage || markerStorage.getItem(activeMarkerKey(characterId)) === '1'; }
      catch (error) { return true; }
    }
    var adapter = options.adapter || null;
    var dbPromise = null;

    function open() {
      if (adapter) return Promise.resolve(adapter);
      if (!indexedDB || typeof indexedDB.open !== 'function') return Promise.reject(new Error('INDEXEDDB_UNAVAILABLE'));
      if (!dbPromise) dbPromise = new Promise(function (resolve, reject) {
        var request;
        try { request = indexedDB.open(DB_NAME, DB_VERSION); }
        catch (error) { reject(new Error('INDEXEDDB_OPEN_FAILED')); return; }
        request.onupgradeneeded = function () {
          var db = request.result;
          var journal;
          if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
            journal = db.createObjectStore(JOURNAL_STORE, { keyPath: 'key' });
            journal.createIndex('byCharacter', 'characterId', { unique: false });
            journal.createIndex('byEncounter', ['characterId', 'encounterId'], { unique: true });
          }
          if (!db.objectStoreNames.contains(QUARANTINE_STORE)) {
            var quarantine = db.createObjectStore(QUARANTINE_STORE, { keyPath: 'key' });
            quarantine.createIndex('byCharacter', 'characterId', { unique: false });
          }
        };
        request.onsuccess = function () {
          var db = request.result;
          db.onversionchange = function () { db.close(); dbPromise = null; };
          resolve(makeIndexedDbAdapter(db));
        };
        request.onerror = function () { reject(new Error('INDEXEDDB_OPEN_FAILED')); };
        request.onblocked = function () { reject(new Error('INDEXEDDB_BLOCKED')); };
      });
      return dbPromise;
    }

    function makeIndexedDbAdapter(db) {
      function requestPromise(request) {
        return new Promise(function (resolve, reject) {
          request.onsuccess = function () { resolve(request.result); };
          request.onerror = function () { reject(request.error || new Error('INDEXEDDB_REQUEST_FAILED')); };
        });
      }
      function transactionPromise(tx) {
        return new Promise(function (resolve, reject) {
          tx.oncomplete = function () { resolve(); };
          tx.onabort = tx.onerror = function () { reject(tx.error || new Error('INDEXEDDB_TRANSACTION_FAILED')); };
        });
      }
      return {
        get: function (storeName, key) {
          var tx = db.transaction([storeName], 'readonly');
          var done = transactionPromise(tx);
          return Promise.all([requestPromise(tx.objectStore(storeName).get(key)), done]).then(function (values) { return values[0] || null; });
        },
        put: function (storeName, value) {
          var tx = db.transaction([storeName], 'readwrite');
          var done = transactionPromise(tx);
          tx.objectStore(storeName).put(value);
          return done.then(function () { return clone(value); });
        },
        listByCharacter: function (storeName, characterId) {
          var tx = db.transaction([storeName], 'readonly');
          var done = transactionPromise(tx);
          var request = tx.objectStore(storeName).index('byCharacter').getAll(characterId);
          return Promise.all([requestPromise(request), done]).then(function (values) { return values[0] || []; });
        }
      };
    }

    function runExclusive(characterId, callback) {
      if (!validId(characterId) || typeof callback !== 'function') return Promise.resolve({ ok: false, reason: 'BAD_LOCK_ARGUMENT' });
      if (!locks || typeof locks.request !== 'function') return Promise.resolve({ ok: false, reason: 'WEB_LOCKS_UNAVAILABLE' });
      try {
        return Promise.resolve(locks.request('eldoria:reward:' + characterId,
          { mode: 'exclusive', ifAvailable: true }, function (lock) {
            if (!lock) return { ok: false, reason: 'REWARD_LOCK_BUSY' };
            return Promise.resolve().then(callback).then(function (value) {
              return value && typeof value.ok === 'boolean' ? value : { ok: true, value: value };
            });
          })).catch(function () { return { ok: false, reason: 'REWARD_LOCK_FAILED' }; });
      } catch (error) { return Promise.resolve({ ok: false, reason: 'REWARD_LOCK_FAILED' }); }
    }

    function prepare(characterId, intent) {
      if (!validIntent(characterId, intent)) return Promise.resolve({ ok: false, reason: 'BAD_REWARD_INTENT' });
      if (!ensureActiveMarker(characterId)) return Promise.resolve({ ok: false, reason: 'REWARD_MARKER_WRITE_FAILED' });
      return open().then(function (db) {
        var key = makeKey(characterId, intent.rewardId);
        var payload = {
          encounterId: intent.encounterId, monsterId: intent.monsterId, exp: intent.exp, gold: 0,
          drops: clone(intent.drops), cards: clone(intent.cards), createdAt: intent.createdAt
        };
        return db.get(JOURNAL_STORE, key).then(function (existing) {
          if (existing) {
            if (stable(existing.payload) !== stable(payload)) {
              return quarantineRecord(characterId, key, existing, 'REWARD_ID_PAYLOAD_CONFLICT', payload)
                .then(function () { return { ok: false, reason: 'REWARD_ID_PAYLOAD_CONFLICT', quarantined: true }; });
            }
            return { ok: true, alreadyPrepared: true, entry: clone(existing) };
          }
          return db.listByCharacter(JOURNAL_STORE, characterId).then(function (entries) {
            var encounter = entries.find(function (entry) { return entry.encounterId === intent.encounterId; });
            if (encounter && encounter.rewardId !== intent.rewardId) {
              return quarantineRecord(characterId, encounter.key, encounter, 'ENCOUNTER_ID_REUSED', payload)
                .then(function () { return { ok: false, reason: 'ENCOUNTER_ID_REUSED', quarantined: true }; });
            }
            var entry = {
              key: key, characterId: characterId, rewardId: intent.rewardId, encounterId: intent.encounterId,
              payload: payload, status: 'prepared', createdAt: intent.createdAt, updatedAt: intent.createdAt
            };
            return db.put(JOURNAL_STORE, entry).then(function () { return { ok: true, entry: clone(entry) }; });
          });
        });
      }).catch(function (error) { return { ok: false, reason: error.message || 'JOURNAL_WRITE_FAILED' }; });
    }

    function get(characterId, rewardId) {
      if (!validId(characterId) || typeof rewardId !== 'string' || !rewardId) return Promise.resolve({ ok: false, reason: 'BAD_JOURNAL_KEY' });
      return open().then(function (db) { return db.get(JOURNAL_STORE, makeKey(characterId, rewardId)); })
        .then(function (entry) { return { ok: true, entry: entry ? clone(entry) : null }; })
        .catch(function (error) { return { ok: false, reason: error.message || 'JOURNAL_READ_FAILED' }; });
    }

    function list(characterId) {
      if (!validId(characterId)) return Promise.resolve({ ok: false, reason: 'BAD_CHARACTER_ID' });
      return open().then(function (db) { return db.listByCharacter(JOURNAL_STORE, characterId); })
        .then(function (entries) { return { ok: true, entries: entries.map(clone) }; })
        .catch(function (error) { return { ok: false, reason: error.message || 'JOURNAL_READ_FAILED' }; });
    }

    function transition(characterId, rewardId, nextStatus, details) {
      if (!validId(characterId) || typeof rewardId !== 'string' || !rewardId || STATES.indexOf(nextStatus) < 0) {
        return Promise.resolve({ ok: false, reason: 'BAD_TRANSITION_ARGUMENT' });
      }
      return open().then(function (db) {
        var key = makeKey(characterId, rewardId);
        return db.get(JOURNAL_STORE, key).then(function (entry) {
          if (!entry) return { ok: false, reason: 'JOURNAL_ENTRY_MISSING' };
          if (entry.status === nextStatus) return { ok: true, alreadyTransitioned: true, entry: clone(entry) };
          if (NEXT[entry.status].indexOf(nextStatus) < 0) return { ok: false, reason: 'INVALID_JOURNAL_TRANSITION' };
          entry.status = nextStatus;
          entry.updatedAt = new Date().toISOString();
          if (details && typeof details === 'object') entry.details = clone(details);
          return db.put(JOURNAL_STORE, entry).then(function () { return { ok: true, entry: clone(entry) }; });
        });
      }).catch(function (error) { return { ok: false, reason: error.message || 'JOURNAL_WRITE_FAILED' }; });
    }

    function quarantineRecord(characterId, sourceKey, existing, reason, conflictingPayload) {
      return open().then(function (db) {
        var key = characterId + ':' + sourceKey + ':' + Date.now() + ':' + Math.random().toString(16).slice(2);
        var evidence = {
          key: key, characterId: characterId, sourceKey: sourceKey, reason: reason,
          existing: existing ? clone(existing) : null,
          conflictingPayload: conflictingPayload ? clone(conflictingPayload) : null,
          quarantinedAt: new Date().toISOString()
        };
        return db.put(QUARANTINE_STORE, evidence).then(function () {
          if (!existing) return { ok: true, evidence: clone(evidence) };
          existing.status = 'quarantined';
          existing.updatedAt = evidence.quarantinedAt;
          existing.quarantineReason = reason;
          return db.put(JOURNAL_STORE, existing).then(function () { return { ok: true, evidence: clone(evidence) }; });
        });
      });
    }

    function quarantine(characterId, rewardId, reason, conflictingPayload) {
      if (!validId(characterId) || typeof rewardId !== 'string' || !rewardId || typeof reason !== 'string' || !reason) {
        return Promise.resolve({ ok: false, reason: 'BAD_QUARANTINE_ARGUMENT' });
      }
      return get(characterId, rewardId).then(function (result) {
        if (!result.ok) return result;
        return quarantineRecord(characterId, makeKey(characterId, rewardId), result.entry, reason, conflictingPayload)
          .then(function (value) { return { ok: true, evidence: value.evidence }; });
      }).catch(function (error) { return { ok: false, reason: error.message || 'QUARANTINE_FAILED' }; });
    }

    function listQuarantine(characterId) {
      if (!validId(characterId)) return Promise.resolve({ ok: false, reason: 'BAD_CHARACTER_ID' });
      return open().then(function (db) { return db.listByCharacter(QUARANTINE_STORE, characterId); })
        .then(function (entries) { return { ok: true, entries: entries.map(clone) }; })
        .catch(function (error) { return { ok: false, reason: error.message || 'QUARANTINE_READ_FAILED' }; });
    }

    return {
      runExclusive: runExclusive, prepare: prepare, get: get, list: list,
      transition: transition, quarantine: quarantine, listQuarantine: listQuarantine, isActive: isActive,
      databaseName: DB_NAME, databaseVersion: DB_VERSION
    };
  }

  E.RewardRecovery = { create: create, STATES: STATES.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.RewardRecovery;
})(typeof window !== 'undefined' ? window : globalThis);
